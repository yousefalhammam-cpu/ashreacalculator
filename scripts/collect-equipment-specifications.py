"""Collect public catalogue evidence; never infer missing engineering ratings."""
import concurrent.futures
import datetime
import hashlib
import io
import json
import pathlib
import re
import subprocess
import sys
import urllib.request
from html.parser import HTMLParser
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0
        self.rows = []
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self.hidden += 1
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = []
        if tag in ('p', 'div', 'li', 'br', 'h1', 'h2', 'h3', 'tr'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self.hidden = max(0, self.hidden - 1)
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None:
                self.row.append(' '.join(' '.join(self.cell).split()))
            self.cell = None
        if tag == 'tr' and self.row:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, text):
        if not self.hidden:
            self.parts.append(text)
            if self.cell is not None:
                self.cell.append(text)


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 AirCalcCatalogueReview/1.0'})
        with urllib.request.urlopen(req, timeout=18) as response:
            raw = response.read(64000001)
            if len(raw)>64000000:
                raise ValueError('Source exceeds 64 MB collection limit; no truncated PDF is parsed')
            kind = response.headers.get('Content-Type', '')
        result = {'url': url, 'status': 'retrieved', 'sha256': hashlib.sha256(raw).hexdigest()}
        if raw.startswith(b'%PDF') or 'application/pdf' in kind:
            pages = [page.extract_text() or '' for page in PdfReader(io.BytesIO(raw)).pages]
            result.update(pages=pages, rows=[], text='\n'.join(pages), format='pdf')
        else:
            doc = Document()
            doc.feed(raw.decode('utf-8', errors='replace'))
            text = '\n'.join(line.strip() for line in ''.join(doc.parts).splitlines() if line.strip())
            result.update(pages=[], rows=doc.rows, text=text, format='html')
        return result
    except Exception as error:
        return {'url': url, 'status': 'unavailable', 'error': str(error)[:200], 'text': '', 'rows': [], 'pages': []}


def normalized(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


def main():
    raw = subprocess.check_output(['node', '-e', "global.window={};require('./data/equipment-records.real.js');process.stdout.write(JSON.stringify(window.AirCalcRealEquipmentRecords));"], cwd=ROOT)
    records = json.loads(raw)
    previous = {}
    if '--retry-unavailable' in sys.argv or '--refresh-daikin' in sys.argv:
        previous = json.loads(subprocess.check_output(['node','-e',"global.window={};require('./data/equipment-source-evidence.js');process.stdout.write(JSON.stringify(window.AirCalcEquipmentSourceEvidence));"],cwd=ROOT))
    urls = sorted({r['sourceReference'] for r in records if r.get('sourceReference', '').startswith('https://')})
    if previous:
        urls=[url for url in urls if any(e['sourceUrl']==url and e['sourceStatus']!='retrieved' for e in previous.values())]
    if '--refresh-daikin' in sys.argv:
        urls=['https://www.daikin.eu/en_us/products/product.table.html/FXSQ-A.html']
        for record in records:
            if record['exactModelNumber'].startswith('FXSQ'):
                record['sourceReference']=urls[0]
    sources = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(fetch, urls):
            sources[result['url']] = result
            print(result['status'], result['url'], flush=True)
    today = datetime.datetime.now(datetime.timezone.utc).isoformat()
    evidence = {}
    for record in records:
        if record['sourceReference'] not in sources:
            evidence[record['id']]=previous[record['id']]
            continue
        source = sources[record['sourceReference']]
        model = record['exactModelNumber']
        family = bool(re.search(r'FAMILY|\[family\]|MODULAR-[RP]-SIZE|FWH-AT/AF-', model, re.I)) or model.startswith(('Zamil -', 'ZamilAC -', 'Cooline PRO', 'Zamil Cooline'))
        token = normalized(model)
        text = source['text']
        found = not family and token in normalized(text)
        blocks = []
        if found:
            if source['format'] == 'pdf':
                for number, page in enumerate(source['pages'], 1):
                    if token in normalized(page):
                        blocks.append({'label': 'Catalogue page ' + str(number), 'text': page[:9000]})
                        if len(blocks) == 5:
                            break
            else:
                rows = [row for row in source['rows'] if any(token in normalized(cell) for cell in row)]
                if rows:
                    blocks.append({'label': 'Published table headers', 'text': '\n'.join(' | '.join(row) for row in source['rows'][:8])[:3500]})
                    blocks.append({'label': 'Matching catalogue rows', 'text': '\n'.join(' | '.join(row) for row in rows)[:6500]})
                else:
                    # Keep exact product-page text as evidence, not normalized numeric ratings.
                    position = text.lower().find(model.lower())
                    blocks.append({'label': 'Official product page', 'text': text[max(0,position):max(0,position)+11000]})
        evidence[record['id']] = {'retrievedAt': today, 'sourceUrl': record['sourceReference'],
            'sourceStatus': source['status'], 'sourceHash': source.get('sha256', ''),
            'modelFound': found, 'recordKind': 'product_family' if family else 'catalogue_model',
            'blocks': blocks}
        if '--refresh-daikin' in sys.argv and record['exactModelNumber'].startswith('FXSQ'):
            evidence[record['id']]['tableRows']=source['rows']
    output = ROOT / 'data' / 'equipment-source-evidence.js'
    output.write_text('(function(){\n"use strict";\nwindow.AirCalcEquipmentSourceEvidence='+json.dumps(evidence, ensure_ascii=True, separators=(',', ':'))+';\n})();\n', encoding='utf-8')
    audit = ROOT / 'dist' / 'equipment-source-audit.json'
    audit.parent.mkdir(exist_ok=True)
    combined={e['sourceUrl']:e['sourceStatus'] for e in evidence.values()}
    audit.write_text(json.dumps({'checkedAt':today,'records':len(records),'sources':len(combined),
        'retrievedSources':sum(status=='retrieved' for status in combined.values()),
        'exactModelsFound':sum(e['modelFound'] for e in evidence.values()),
        'families':sum(e['recordKind']=='product_family' for e in evidence.values()),
        'unavailable':[{'url':u,'error':sources.get(u,{}).get('error')} for u,status in combined.items() if status!='retrieved']},indent=2),encoding='utf-8')
    print(audit.read_text(),flush=True)


if __name__ == '__main__':
    main()

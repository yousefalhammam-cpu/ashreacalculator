'use strict';

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createAirCalcServer } = require('../local-static-server');

const APP_PORT = 5511;
const DEBUG_PORT = 9224;
const HOST = '127.0.0.1';
const APP_URL = `http://${HOST}:${APP_PORT}/app/index.html`;
const OUT_DIR = path.join(process.cwd(), 'dist', 'browser-audit');
const QUOTE_MODE = process.argv.includes('--quotation');
const REPORT_MODE = process.argv.includes('--technical-report') || QUOTE_MODE;

function requestJson(url, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (err) { reject(err); }
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`Timeout requesting ${url}`)));
    req.on('error', reject);
  });
}

async function waitForTarget() {
  const deadline = Date.now() + 20000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const targets = await requestJson(`http://${HOST}:${DEBUG_PORT}/json`);
      const target = targets.find((item) => item.url && item.url.includes('/app/index.html')) || targets[0];
      if (target && target.webSocketDebuggerUrl) return target;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error('Browser target was not available.');
}

function findBrowser() {
  return [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].find((candidate) => fs.existsSync(candidate));
}

function send(ws, method, params) {
  send.nextId = (send.nextId || 0) + 1;
  ws.send(JSON.stringify({ id: send.nextId, method, params: params || {} }));
  return send.nextId;
}

function closeBrowser(browser) {
  return new Promise((resolve) => {
    if (!browser || browser.killed) return resolve();
    if(process.platform==='win32' && browser.pid){
      const cleanup=spawn('taskkill.exe',['/PID',String(browser.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
      cleanup.once('exit',resolve);
      cleanup.once('error',resolve);
      return;
    }
    browser.once('exit', resolve);
    browser.kill();
    setTimeout(resolve, 3000);
  });
}

function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();

    ws.onopen = () => {
      function call(method, params) {
        const id = send(ws, method, params);
        return new Promise((res, rej) => {
          const timeout=setTimeout(()=>{pending.delete(id);rej(new Error(`${method}: browser response timed out`));},45000);
          pending.set(id, { res, rej, method, timeout });
        });
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (!msg.id || !pending.has(msg.id)) return;
        const item = pending.get(msg.id);
        clearTimeout(item.timeout);
        pending.delete(msg.id);
        if (msg.error) item.rej(new Error(`${item.method}: ${msg.error.message}`));
        else item.res(msg.result || {});
      };

      resolve({ call, close: () => ws.close() });
    };

    ws.onerror = () => reject(new Error('WebSocket connection to browser failed.'));
  });
}

async function auditViewport(client, name, width, height) {
  await client.call('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700
  });
  await client.call('Page.navigate', { url: APP_URL });
  await new Promise((resolve) => setTimeout(resolve, 4500));

  if(REPORT_MODE){
    const readyDeadline=Date.now()+30000;
    let ready=false;
    while(Date.now()<readyDeadline){
      const state=await client.call('Runtime.evaluate',{expression:'typeof normalizeProjectSystem === "function" && typeof renderTechReportFoundation === "function"',returnByValue:true});
      if(state.result && state.result.value){ready=true;break;}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready) throw Error('Technical report application did not finish loading');
    const setup = await client.call('Runtime.evaluate', {expression: `(() => {
      hist = [{id:'review-test',roomType:'Office',ar:'مكتب اختبار',en:'Test office',btu:30000,requiredBtu:30000,mkt:36000,cfm:1000,tr:2.5,area:40,vol:120,roomCount:1}];
      quoteMode = 'proj';
      projectSystems = [normalizeProjectSystem({id:'review-system',unitType:'split',selectedBtu:24000,qty:1})];
      openDesktopView('tech'); renderTechReportFoundation(); window.scrollTo(0,0);
      const alerts = window._lastTechnicalReportModel.alerts;
      if(!alerts.some(a=>a.severity==='CRITICAL')) throw Error('Missing undersizing alert');
      if(document.querySelector('#tech-analysis-slot details')) throw Error('Report panels must not collapse');
      renderTechReportFoundation();
      if(document.querySelector('#tech-analysis-slot details')) throw Error('Report refresh recreated collapsible panels');
      selectTechnicalReportTopic('report-equipment');
      if(document.getElementById('report-equipment').hidden || !document.getElementById('report-loads').hidden) throw Error('Report topics did not switch');
      renderTechReportFoundation();
      if(document.getElementById('report-equipment').hidden) throw Error('Selected report topic was lost on refresh');
      const context=document.getElementById('report-project-context');
      if(!context || !context.innerText.includes('مكتب اختبار') || !context.innerText.includes('30,000')) throw Error('Project context missing rooms or required load');
      if(document.querySelector('#p-tech .manufacturer-rec-select')) throw Error('Commercial equipment selector still appears in report');
      selectTechnicalReportTopic('report-decision');
      const form=document.querySelector('form[onsubmit="return applyReportCapacityAction(this)"]');
      if(!form) throw Error('Capacity action missing');
      form.elements.capacity.value='36000';
      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      if(getSelectedUnitCapacityBtu(getProjectSystem('review-system'))!==36000) throw Error('Capacity action did not update main state');
      if(window._lastTechnicalReportModel.alerts.some(a=>a.sourceRule==='Rules Engine: project_capacity >= project_load')) throw Error('Capacity warning is stale');
      projectSystems[0].unitType='package'; recalcProjectSystems(); renderTechReportFoundation();
      const duct=document.querySelector('form[onsubmit="return applyReportDuctAction(this)"]');
      if(!duct) throw Error('Duct action missing');
      duct.elements.width.value='600'; duct.elements.height.value='400';
      duct.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      if(!window._lastDuctSizing || window._lastDuctSizing.sup.w!==600 || window._lastDuctSizing.sup.h!==400) throw Error('Duct action did not update sizing');
      if(calcDuctSize(1000,1000,'sup').std.w!==600) throw Error('Manual duct dimensions not used');
      return true;
    })()`,returnByValue:true});
    if(setup.exceptionDetails) throw Error(JSON.stringify(setup.exceptionDetails));
    if(QUOTE_MODE){
      const quoteSetup=await client.call('Runtime.evaluate',{expression:`(() => {
        openDesktopView('hist');renderHist();renderQuote();window.scrollTo(0,0);
        const projectName=document.getElementById('desktop-project');
        projectName.value='Launch validation project';
        projectName.dispatchEvent(new Event('input',{bubbles:true}));
        if(document.getElementById('tech-project').value!==projectName.value || document.getElementById('quote-project').value!==projectName.value) throw Error('Project name synchronization failed');
        if(!document.getElementById('quote-project-context').textContent.includes(projectName.value)) throw Error('Project summary identity is stale');
        goPanel('tech');
        const clientField=document.getElementById('report-client');
        clientField.focus();
        if(document.activeElement!==clientField) throw Error('Client hidden before editing: '+JSON.stringify(Array.from((function*(e){while(e){yield {id:e.id,cls:e.className,display:getComputedStyle(e).display,hidden:e.hidden};e=e.parentElement;}})(clientField))));
        clientField.value='Launch client';
        clientField.dispatchEvent(new Event('input',{bubbles:true}));
        if(document.activeElement!==clientField || clientField.value!=='Launch client') throw Error('Client editing loses focus or content: '+JSON.stringify({active:document.activeElement.id,value:clientField.value,connected:clientField.isConnected,rect:clientField.getBoundingClientRect().toJSON(),parent:clientField.parentElement.parentElement.parentElement.outerHTML.slice(0,300)}));
        if(JSON.parse(localStorage.getItem('aircalc_project_identity_draft')).hasOwnProperty('report-client')===false) throw Error('Client draft not persisted');
        clientField.blur();
        goPanel('hist');
        const page=document.getElementById('p-hist');
        if(page.firstElementChild.id!=='quote-project-context') throw Error('Quotation summary is not at the top');
        const history=document.querySelector('#quote-workspace-columns>.quote-room-history');
        const pricing=document.querySelector('#quote-workspace-columns>.quote-card');
        if(!history || !pricing) throw Error('Quotation workspace panels missing');
        const price=pricing.querySelector('[data-auto-quote-line-field="unitPrice"]');
        if(price){
          price.value='123';price.dispatchEvent(new Event('input',{bubbles:true}));
          const progress=document.querySelector('#quote-project-context [data-pricing-progress]');
          if(!progress || !progress.textContent.includes('1 / ')) throw Error('Pricing progress did not update while entering a price');
        }
        const h=history.getBoundingClientRect(),p=pricing.getBoundingClientRect();
        if(h.width<100 || h.height<20 || p.width<100 || p.height<20) throw Error('Quotation workspace panels are hidden');
        if(innerWidth>1100 && h.left<p.right-2) throw Error('Room history is not on the right');
        if(innerWidth<=1100 && h.top>p.top) throw Error('Room history must precede pricing on mobile');
        if(page.scrollWidth>page.clientWidth+2) throw Error('Quotation page overflows');
        return true;
      })()`,returnByValue:true});
      if(quoteSetup.exceptionDetails) throw Error(JSON.stringify(quoteSetup.exceptionDetails));
    }
  }

  const textResult = await client.call('Runtime.evaluate', {
    expression: `(() => {
      const bodyText = document.body ? document.body.innerText : '';
      const rect = document.body ? document.body.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        hasLogo: bodyText.includes('AirCalc Pro'),
        hasMainNav: bodyText.includes('تصميم المشروع') || bodyText.includes('Project design') || bodyText.includes('الرئيسية') || bodyText.includes('Home'),
        hasTechnicalReport: bodyText.includes('التقرير الفني') || bodyText.includes('Tech Report'),
        hasDashboard: !!document.querySelector('.report-dashboard'),
        reportOverflow: document.getElementById('p-tech') ? document.getElementById('p-tech').scrollWidth - document.getElementById('p-tech').clientWidth : 0,
        width: rect.width,
        height: rect.height
      };
    })()`,
    returnByValue: true
  });

  const screenshot = await client.call('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false
  });

  if(REPORT_MODE) name = (QUOTE_MODE?'quote-':'report-') + name;
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
  if(REPORT_MODE && width>=1024){
    const bounds=await client.call('Runtime.evaluate',{expression:`(() => {
      const views=['calc','tech','hist','projects','settings','equipment'];
      const measured=views.map(view=>{
        goPanel(view);
        if(!document.getElementById('p-'+view).classList.contains('on')) return {view,blocked:true};
        const panel=document.getElementById('p-'+view).getBoundingClientRect();
        const element=document.getElementById('p-'+view);
        return {view,left:panel.left,width:panel.width,parent:element.parentElement.className,mainWidth:element.parentElement.getBoundingClientRect().width,style:element.getAttribute('style'),mainStyle:getComputedStyle(element.parentElement).gridTemplateColumns,shell:element.parentElement.parentElement.className};
      });
      goPanel('${QUOTE_MODE?'hist':'tech'}');
      const reference=measured[0];
      if(measured.some(item=>!item.blocked && (Math.abs(item.left-reference.left)>2 || Math.abs(item.width-reference.width)>2))) throw Error('Page bounds differ from project design: '+JSON.stringify(measured));
      return measured;
    })()`,returnByValue:true});
    if(bounds.exceptionDetails) throw Error(JSON.stringify(bounds.exceptionDetails));
    await client.call('Runtime.evaluate',{expression:"goPanel('equipment');window.scrollTo(0,0);"});
    const catalogueShot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(OUT_DIR,'equipment-desktop-1440x1000.png'),Buffer.from(catalogueShot.data,'base64'));
    await client.call('Runtime.evaluate',{expression:`goPanel('${QUOTE_MODE?'hist':'tech'}');`});
  }
  if(REPORT_MODE && !QUOTE_MODE){
    for(const sectionId of ['report-decision','report-loads','report-equipment','report-evidence','report-duct-tool']){
      await client.call('Runtime.evaluate',{expression:`selectTechnicalReportTopic('${sectionId==='report-duct-tool'?'report-air':sectionId}'); document.getElementById('${sectionId}')?.scrollIntoView({block:'start'})`});
      const sectionShot=await client.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      fs.writeFileSync(path.join(OUT_DIR,`${name}-${sectionId}.png`),Buffer.from(sectionShot.data,'base64'));
    }
    await client.call('Runtime.evaluate',{expression:'window.scrollTo(0,0)'});
  }

  const value = textResult.result && textResult.result.value ? textResult.result.value : {};
  const isMobile = width < 700;
  const failures = [];
  if (!value.hasLogo && !isMobile) failures.push('AirCalc Pro brand text not found.');
  if (REPORT_MODE && !value.hasDashboard) failures.push('Technical dashboard missing.');
  if (REPORT_MODE && value.reportOverflow > 2) failures.push('Technical report overflows horizontally.');
  if (!isMobile && !value.hasMainNav) failures.push('Main navigation text not found.');
  if (!isMobile && !value.hasTechnicalReport) failures.push('Technical report navigation text not found.');
  if (!value.width || !value.height) failures.push('Document body has no measurable size.');

  if(QUOTE_MODE){
    await client.call('Page.reload',{ignoreCache:true});
    let restored=false;
    for(let attempt=0;attempt<20;attempt++){
      await new Promise(resolve=>setTimeout(resolve,300));
      const identity=await client.call('Runtime.evaluate',{expression:`(() => {
        const project=document.getElementById('desktop-project');
        const client=document.getElementById('report-client');
        return !!(project && client && project.value==='Launch validation project' && client.value==='Launch client');
      })()`,returnByValue:true});
      if(identity.result && identity.result.value){restored=true;break;}
    }
    if(!restored) failures.push('Project name or client was not restored after page reload.');
  }

  return {
    viewport: name,
    width,
    height,
    bodyWidth: value.width || 0,
    bodyHeight: value.height || 0,
    screenshot: path.join('dist', 'browser-audit', `${name}.png`),
    failures
  };
}

async function run() {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Node WebSocket global is unavailable. Use Node 22 or newer.');
  }

  const browserPath = findBrowser();
  if (!browserPath) throw new Error('No supported Edge/Chrome executable was found.');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = createAirCalcServer({ host: HOST, port: APP_PORT });
  await new Promise((resolve) => server.listen(APP_PORT, HOST, resolve));

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aircalc-browser-visual-'));
  const browser = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    APP_URL
  ], { stdio: 'ignore' });

  try {
    const target = await waitForTarget();
    const client = await cdp(target.webSocketDebuggerUrl);
    await client.call('Page.enable');
    await client.call('Runtime.enable');

    const results = [
      await auditViewport(client, 'desktop-1440x1000', 1440, 1000),
      await auditViewport(client, 'mobile-390x844', 390, 844)
    ];
    client.close();

    fs.writeFileSync(path.join(OUT_DIR, 'browser-visual-audit.json'), JSON.stringify(results, null, 2));
    const failed = results.filter((item) => item.failures.length);

    if (failed.length) {
      console.error('Browser visual audit failed:');
      failed.forEach((item) => console.error(`${item.viewport}: ${item.failures.join('; ')}`));
      process.exitCode = 1;
    } else {
      console.log(`Browser visual audit passed for ${APP_URL}`);
      results.forEach((item) => console.log(`${item.viewport}: ${item.screenshot}`));
    }
  } finally {
    await closeBrowser(browser);
    server.close();
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    } catch (err) {
      console.warn(`Browser profile cleanup warning: ${err.message || err}`);
    }
  }
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

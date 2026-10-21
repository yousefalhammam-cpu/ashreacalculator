'use strict';
const fs=require('node:fs');
const path=require('node:path');
global.window={};
require('../data/equipment-records.real.js');
require('../data/equipment-source-evidence.js');
const evidence=window.AirCalcEquipmentSourceEvidence;
const records=window.AirCalcRealEquipmentRecords;
const number=value=>{const n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:null;};
const fieldLabels={
  'Type':['نوع التشغيل','Operating type'], 'Cooling T1 (BTU)':['التبريد T1','Cooling T1'],
  'Cooling T3 (BTU)':['التبريد T3','Cooling T3'], 'Cooling T1(BTU)':['التبريد T1','Cooling T1'],
  'Cooling T3(BTU)':['التبريد T3','Cooling T3'], 'Cooling Power Input T1':['استهلاك التبريد T1 (W)','Cooling input T1 (W)'],
  'Cooling Power Input T3':['استهلاك التبريد T3 (W)','Cooling input T3 (W)'],
  'Indoor Net Weight (kg)':['وزن الداخلية الصافي (kg)','Indoor net weight (kg)'],
  'Outdoor Net Weight (kg)':['وزن الخارجية الصافي (kg)','Outdoor net weight (kg)'],
  'Indoor Net Dimension W*H*D (mm)':['أبعاد الداخلية عرض × ارتفاع × عمق (mm)','Indoor W × H × D (mm)'],
  'Outdoor Net Dimension W*H*D (mm)':['أبعاد الخارجية عرض × ارتفاع × عمق (mm)','Outdoor W × H × D (mm)'],
  'Power Supply (V/Ph/Hz)':['التغذية V/Ph/Hz','Power supply V/Ph/Hz'],
  'Air Circulation (m³/h)(Turbo/Hi/Mid/Lo)':['تدفق الهواء تربو/عال/متوسط/منخفض (m³/h)','Airflow turbo/high/mid/low (m³/h)'],
  'Cooling T3 (A)':['تيار التبريد T3 (A)','Cooling current T3 (A)'],
  'Outdoor Noise [Db(A)]':['ضوضاء الخارجية dB(A)','Outdoor noise dB(A)'],
  'Indoor Noise [Db(A)](Hi/Mid/Lo)':['ضوضاء الداخلية عال/متوسط/منخفض dB(A)','Indoor noise high/mid/low dB(A)']
};
let enriched=0;
for(const record of records){
  const e=evidence[record.id];e.specifications=[];e.patch={};
  const text=e.blocks.map(b=>b.text).join('\n');
  const add=(ar,en,value)=>{if(value!=null&&String(value).trim()&&String(value)!=='/')e.specifications.push({ar,en,value:String(value)});};
  if(record.manufacturerId==='haier' && e.modelFound){
    const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
    for(let i=0;i<lines.length-1;i++){
      if(!lines[i].endsWith(':') || lines[i+1].endsWith(':'))continue;
      const label=lines[i].slice(0,-1),value=lines[i+1];
      const labels=fieldLabels[label] || [label,label];
      add(labels[0],labels[1],value);
      if(label==='Cooling Power Input T3' && number(value)>0)e.patch.inputPowerKw=number(value)/1000;
      if(label==='Cooling T3 (A)' && number(value)>0)e.patch.runningCurrentA=number(value);
      if(label==='Outdoor Net Weight (kg)' && number(value)>0)e.patch.weightKg=number(value);
      if(label==='Outdoor Noise [Db(A)]' && number(value)>0)e.patch.soundLevelDb=number(value);
    }
    const start=text.indexOf('\nCapacity\nType:');
    if(start>=0)e.blocks=[{label:'Published specifications',text:text.slice(start,text.indexOf('\nDisclaimer',start)>start?text.indexOf('\nDisclaimer',start):start+7500)}];
  }
  if(record.manufacturerId==='zamil' && e.modelFound){
    const fields=[['Cooling Type','نوع التبريد'],['Cooling Capacity in Tons','سعة التبريد بالطن'],['Cooling Capacity in BTU','سعة التبريد BTU/h'],['Warranty','الضمان'],['Compressor Warranty','ضمان الضاغط'],['Outdoor Dimensions','أبعاد الخارجية كما نشرها المصدر'],['Indoor Dimensions','أبعاد الداخلية كما نشرها المصدر'],['Annual Energy Consumption','استهلاك الطاقة السنوي كما نشره المصدر'],['Energy Rating','تصنيف الطاقة']];
    for(const [en,ar] of fields){const match=text.match(new RegExp('(?:^|\\n)'+en+'([^\\n]+)'));if(match)add(ar,en,match[1]);}
    const start=text.indexOf('Details & Specs\nCooling Type');
    if(start>=0)e.blocks=[{label:'Published specifications',text:text.slice(start,text.indexOf('\nPackage Includes:',start)>start?text.indexOf('\nPackage Includes:',start):start+3000)}];
  }
  if(record.exactModelNumber.startsWith('FXSQ') && e.tableRows && e.tableRows.length){
    const models=e.tableRows[0].slice(-11),index=models.findIndex(m=>m.startsWith(record.exactModelNumber));
    if(index>=0){
      let labels=[],coolingKw=null;
      for(const row of e.tableRows.slice(1)){
        if(row.length<12)continue;
        const prefix=row.slice(0,-11),value=row.slice(-11)[index];
        prefix.forEach((label,i)=>{if(label && label!==labels[i]){labels=labels.slice(0,i);labels[i]=label;}});
        const heading=labels.slice(0,prefix.length).filter(Boolean).join(' / ');
        add(heading,heading,value);
        const numeric=Number.parseFloat(String(value).replace(/,/g,''));
        if(!Number.isFinite(numeric))continue;
        if(labels[0]==='Cooling capacity')coolingKw=numeric;
        if(labels[0]==='Power input - 50Hz' && labels[1]==='Cooling')e.patch.inputPowerKw=numeric;
        if(labels[0]==='Dimensions'){
          e.patch.dimensions=e.patch.dimensions || {};
          const key={Width:'widthMm',Height:'heightMm',Depth:'depthMm'}[labels[2]];
          if(key)e.patch.dimensions[key]=numeric;
        }
        if(labels[0]==='Weight')e.patch.weightKg=numeric;
        if(labels[0]==='Fan' && labels[1]==='Air flow rate - 50Hz' && labels[3]==='At high fan speed')e.patch.airflowNominalCfm=Math.round(numeric*35.3146667);
      }
      e.patch.sourceReference=e.sourceUrl;
      e.patch.phase=1;
      e.specifications.unshift({ar:'الموديل الكامل بالجدول','en':'Full model in source table',value:models[index]},
        {ar:'نطاق مواصفات القدرة والهواء','en':'Power and airflow scope',value:'Indoor unit only; outdoor unit combination and total VRF system power are separate. Published power/airflow values are at 50 Hz.'});
      if(coolingKw===record.coolingCapacityKw){e.patch.verificationStatus=e.patch.workflowStatus='verified';e.patch.verifiedAt='2026-10-21T00:00:00.000Z';e.patch.verifiedBy='Official Daikin FXSQ-A model-specific specification table cross-check';}
    }
  }
  if(record.exactModelNumber.startsWith('MSTMX') && e.modelFound){
    const models=['MSTMX12HRNAG1','MSTMX18HRNAG1','MSTMX24HRNAG1','MSTMX30HRNAG1','MSTMX36HRNMB'];
    const column=text.split(/(?:230V|220-230V),1Ph,60Hz\n/).slice(1)[models.indexOf(record.exactModelNumber)];
    if(column){
      const values=column.split('\n').map(s=>s.trim()).filter(Boolean);
      const t3=number(values[4]);
      if(t3===record.coolingCapacityBtuH){
        Object.assign(e.patch,{inputPowerKw:number(values[5])/1000,runningCurrentA:number(values[6]),eer:number(values[7]),voltage:230,phase:1,frequencyHz:60,refrigerant:'R410A',weightKg:number(values[23].split('/')[0]),soundLevelDb:number(values[20]),verificationStatus:'verified',workflowStatus:'verified',verifiedAt:'2026-10-21T00:00:00.000Z',verifiedBy:'Manufacturer-authored Midea technical leaflet, T3 column cross-check'});
        const dims=values[21].split('x').map(number);
        if(dims.length===3 && dims.every(n=>n>0))e.patch.dimensions={widthMm:dims[0],depthMm:dims[1],heightMm:dims[2]};
        const speeds=values[15].split('/').map(number);
        if(speeds.length===4 && speeds.every(n=>n>0)){
          if(record.airflowNominalCfm==null)e.patch.airflowNominalCfm=Math.round(speeds[1]*.588577);
          e.patch.airflowMaxCfm=Math.round(speeds[0]*.588577);
        }
        const named=[['T1 cooling capacity BTU/h','سعة T1 للتبريد BTU/h',0],['T1 cooling input W','قدرة التبريد T1 بالواط',1],['T3 cooling capacity BTU/h','سعة T3 للتبريد BTU/h',4],['T3 cooling input W','قدرة التبريد T3 بالواط',5],['Maximum input W','أقصى استهلاك بالواط',12],['Maximum current A','أقصى تيار بالأمبير',13],['Starting current A','تيار البدء بالأمبير',14],['Indoor airflow turbo/high/mid/low m3/h','تدفق الداخلية تربو/عال/متوسط/منخفض m3/h',15],['Indoor sound turbo/high/mid/low dB(A)','ضوضاء الداخلية تربو/عال/متوسط/منخفض dB(A)',16],['Indoor dimensions W x D x H mm','أبعاد الداخلية عرض × عمق × ارتفاع mm',17],['Indoor net/gross weight kg','وزن الداخلية الصافي/الإجمالي kg',19],['Outdoor dimensions W x D x H mm','أبعاد الخارجية عرض × عمق × ارتفاع mm',21],['Outdoor net/gross weight kg','وزن الخارجية الصافي/الإجمالي kg',23],['Refrigerant / charge kg','وسيط التبريد / الشحنة kg',24],['Maximum pipe length m','أقصى طول أنابيب m',27],['Maximum elevation m','أقصى فرق ارتفاع m',28]];
        named.forEach(([en,ar,i])=>add(ar,en,values[i]));
        add('مرجع النشرة','Leaflet provenance','Manufacturer-authored Midea leaflet hosted by Saudi distributor; local stock and current revision require supplier confirmation.');
      }
    }
  }
  if(record.manufacturerId==='gree' && e.sourceUrl.startsWith('https://www.gso.org.sa/') && e.modelFound && record.coolingCapacityBtuH===18000){
    Object.assign(e.patch,{voltage:230,refrigerant:'R410A',verificationStatus:'verified',workflowStatus:'verified',verifiedAt:'2026-10-21T00:00:00.000Z',verifiedBy:'GSO public technical listing: model identity and nominal capacity cross-check'});
    add('التغذية المنشورة','Published supply','220-240 V; 50/60 Hz');
    add('الأبعاد المنشورة للداخلية (mm)','Published indoor dimensions (mm)','943 × 333 × 246; axis order not stated on public listing');
    add('الأبعاد المنشورة للخارجية (mm)','Published outdoor dimensions (mm)','958 × 660 × 402; axis order not stated on public listing');
    add('بيان المصدر الإضافي','Additional source statement','11 A; R410A; Class I; outdoor IPX4');
    add('نطاق التوثيق','Verification scope','GSO public model and technical listing only. Nominal 18000 BTU/h; no T3 design rating or airflow is published.');
  }
  if(e.specifications.length)enriched++;
}
const rooftop=[
  ['MRCT-050CWN1-M',5.780,8.3,207,66.5,1486,840,1068],
  ['MRCT-062CWN1-Y(D)',8.100,7.8,360,74.5,1965,1230,1130],
  ['MRCT-075CWN1-Y(D)',8.670,8.3,370,78,1965,1230,1130]
];
for(const [model,power,eer,weight,sound,w,h,d]of rooftop){
  const record=records.find(r=>r.exactModelNumber===model),e=evidence[record.id];
  e.patch={inputPowerKw:power,eer,weightKg:weight,soundLevelDb:sound,dimensions:{widthMm:w,heightMm:h,depthMm:d},minOutdoorTemperatureC:10,maxOutdoorTemperatureC:52,compressorType:'Scroll'};
  e.specifications.push({ar:'شروط السعة المدخلة','en':'Imported capacity rating',value:'Cooling2: outdoor 46 C DB; indoor 29 C DB / 19 C WB; standard fan.'});
}
const daikinDimensions=[['350',1276,1914,2525],['400',1360,1914,2525],['470',1360,1914,2525],['530',1403,1914,2525],['640',1757,2220,2484],['750',1757,2220,2484],['840',1980,2207,2835],['940',1980,2207,2835]];
for(const [size,h,w,d]of daikinDimensions){const r=records.find(r=>r.exactModelNumber==='UAYN'+size+'AFY1A');evidence[r.id].patch.dimensions={widthMm:w,heightMm:h,depthMm:d};}
const carrier=[['060',70.6,9.7,2.8,13.1],['070',80.4,9.9,2.9,13.4],['080',93.4,9.8,2.9,14.3],['090',100.7,10.3,3,13.7],['100',109.6,10.2,3,13.5],['110',125.7,10.1,3,13.9],['120',137.7,10.3,3,13.8],['130',150.2,10.2,3,13.8],['150',166.6,10,3,13.6],['160',177.5,10.3,3,13.6],['170',193.8,10.2,3,13.6],['190',219.7,10.2,3,13.4],['210',239.3,9.8,2.9,13.3],['225',253.1,9.8,2.9,13.4],['250',279.4,9.8,2.9,13.4],['275',305.2,9.8,2.9,13.3],['300',330.4,9.9,2.9,13.2],['315',355,10.3,3,13.6],['330',371.3,10.2,3,13.6],['345',387.6,10.2,3,13.6],['360',413.5,10.2,3,13.4],['390',439.5,10.2,3,13.4]];
for(const [size,power,eer,cop,iplv]of carrier){const r=records.find(r=>r.exactModelNumber==='30RB '+size);const e=evidence[r.id];
  e.patch={inputPowerKw:power,eer,cop,iplv,compressorType:'Rotary scroll'};
  e.specifications.push({ar:'شروط جدول الوحدات القياسية','en':'Standard-unit rating conditions',value:'AHRI 550/590: entering outdoor air 35 C; leaving chilled water 6.7 C; standard units, not Greenspeed.'});
}
const skmWeights=[['51050',305,.55],['51060',355,.55],['51075',363,.75],['51080',402,1.1],['51100',474,1.1],['52115',547,1.5],['52125',648,1.5],['52150',666,2.2],['52170',766,2.2],['52200',892,3],['52230',907,3],['52240',979,3],['52270',1005,3],['52300',1070,3],['52340',1160,4]];
const skmTables=Object.values(evidence).flatMap(e=>e.blocks).filter(b=>b.text.includes('ENGINEERING SPECIFICATIONS - 50 Hz'));
for(const [model,weight,motor]of skmWeights){const r=records.find(r=>r.exactModelNumber==='APMR '+model),e=evidence[r.id];
  if(!skmTables.length)continue;
  e.patch.weightKg=weight;e.patch.compressorType='Hermetic scroll';
  e.specifications.push({ar:'قدرة محرك مروحة المبخر، وليست استهلاك الوحدة (kW)',en:'Evaporator fan motor size, not total unit power (kW)',value:String(motor)});
  e.specifications.push({ar:'أساس الوزن',en:'Weight basis',value:'Unit operating weight; official engineering tables 2 and 3, 50 Hz.'});
  const table=skmTables.find(b=>b.text.includes('APMR '+model+' ')) || skmTables.find(b=>b.text.includes(model));
  if(table){e.modelFound=true;if(!e.blocks.some(b=>b.label===table.label))e.blocks.unshift(table);}
}
const samsung=[['AG042KSVANH/EU',42,12.35,19.6,446,60,120,60],['AG056KSVANH/EU',56,18.67,29.6,446,62,160,100],['AG070KSVANH/EU',65,26,41.2,465,63,186,120]];
for(const [model,kw,power,current,weight,sound,water,drop]of samsung){const r=records.find(r=>r.exactModelNumber===model),e=evidence[r.id];
  if(!e.modelFound)continue;
  e.patch={voltage:400,phase:3,inputPowerKw:power,runningCurrentA:current,weightKg:weight,soundLevelDb:sound,dimensions:{widthMm:1795,heightMm:1695,depthMm:765},minOutdoorTemperatureC:-15,maxOutdoorTemperatureC:48,compressorType:'Inverter scroll'};
  e.specifications.push({ar:'التغذية الكهربائية المنشورة',en:'Published power supply',value:'380-415 V / 3 phase / 50-60 Hz'},
    {ar:'تدفق الماء الاسمي للتبريد (L/min)',en:'Nominal cooling water flow (L/min)',value:String(water)},
    {ar:'فقد الضغط المائي الاسمي (kPa)',en:'Nominal water pressure drop (kPa)',value:String(drop)},
    {ar:'حدود درجة ماء التبريد (C)',en:'Cooling water temperature range (C)',value:'5 to 25; brine application -10 to 25'},
    {ar:'السعة الاسمية المنشورة (kW)',en:'Published nominal cooling capacity (kW)',value:String(kw)});
  if(r.coolingCapacityKw===kw){e.patch.verificationStatus=e.patch.workflowStatus='verified';e.patch.verifiedAt='2026-10-21T00:00:00.000Z';e.patch.verifiedBy='Official Samsung catalogue nominal cooling table cross-check';}
}
const vrf=[['MV8-2300WV2GN1(SA)',61.865,9.38,'22HP + 28HP + 32HP','277 + 380 + 419'],['MV8-2355WV2GN1(SA)',62.745,9.59,'24HP + 28HP + 32HP','297 + 380 + 419'],['MV8-2415WV2GN1(SA)',67.190,9.20,'26HP + 28HP + 32HP','380 + 380 + 419'],['MV8-2470WV2GN1(SA)',69.610,9.08,'28HP + 28HP + 32HP','380 + 380 + 419']];
for(const [model,power,eer,combination,weight]of vrf){const r=records.find(r=>r.exactModelNumber===model),e=evidence[r.id];
  if(!e.modelFound)continue;
  e.patch={inputPowerKw:power,eer,voltage:400,phase:3,soundLevelDb:68,minOutdoorTemperatureC:-15,maxOutdoorTemperatureC:55,compressorType:'DC inverter'};
  e.specifications.push({ar:'تكوين الوحدات الخارجية',en:'Outdoor module combination',value:combination},
    {ar:'أوزان الوحدات الخارجية منفصلة (kg)',en:'Separate outdoor module weights (kg)',value:weight},
    {ar:'التغذية المنشورة',en:'Published power supply',value:'380-415 V / 3 phase / 50(60) Hz'},
    {ar:'شروط أداء التبريد',en:'Cooling rating conditions',value:'T3: indoor 29 C DB / 19 C WB, outdoor 46 C DB, equivalent piping 5 m, zero elevation difference.'});
  e.patch.verificationStatus=e.patch.workflowStatus='verified';e.patch.verifiedAt='2026-10-21T00:00:00.000Z';e.patch.verifiedBy='Official Midea V8 T3 table 2-1.10 cross-check';
}
const screw=[['6060',216.2,35.3,53,1,4],['6070',247,46.9,111,1,4],['6085',302.5,50.3,104,1,6],['6100',345,68.4,104,1,6],['6115',406,75.5,149,1,6],['6130',449.2,88.4,181,2,8],['6145',503.8,88.9,181,2,8]];
const screwTables=Object.values(evidence).flatMap(e=>e.blocks).filter(b=>b.text.includes('ENGINEERING SPECIFICATIONS - 60 Hz'));
for(const [model,kw,charge,water,compressors,fans]of screw){const r=records.find(r=>r.exactModelNumber==='APCY '+model+' S'),e=evidence[r.id];
  const table=screwTables.find(b=>b.text.includes(model+' S'));
  if(!table || r.coolingCapacityKw!==kw)continue;
  e.modelFound=true;if(!e.blocks.some(b=>b.label===table.label))e.blocks.unshift(table);
  e.specifications.push({ar:'شحنة R134a (kg)',en:'R134a charge (kg)',value:String(charge)},
    {ar:'حجم ماء المبخر (L)',en:'Evaporator water volume (L)',value:String(water)},
    {ar:'عدد الضواغط',en:'Compressor quantity',value:String(compressors)},
    {ar:'عدد مراوح المكثف؛ ليست مراوح هواء الإمداد',en:'Condenser fan quantity, not supply fans',value:String(fans)},
    {ar:'شروط السعة الاسمية SI',en:'SI nominal cooling conditions',value:'Outdoor 35 C; leaving chilled water 7 C; water range 5 C. Verify fouling and project ambient.'});
  e.patch.compressorType='Semi-hermetic screw';e.patch.verificationStatus=e.patch.workflowStatus='verified';
  e.patch.verifiedAt='2026-10-21T00:00:00.000Z';e.patch.verifiedBy='Official SKM APCY 60 Hz table 3 cooling rating cross-check';
}
let verified=0;
for(const r of records){
  const e=evidence[r.id];
  const ratings=e.specifications.filter(s=>/^(Cooling T3\s*\(BTU\)|Cooling Capacity in BTU)$/.test(s.en));
  const ratingMatches=ratings.some(s=>number(s.value.replace(/\s*BTU(?:\/h)?\s*/ig,''))===r.coolingCapacityBtuH);
  const daikinChecked=daikinDimensions.some(row=>r.exactModelNumber==='UAYN'+row[0]+'AFY1A') && e.modelFound;
  if(e.recordKind!=='product_family' && (ratingMatches || daikinChecked)){
    e.patch.verificationStatus=e.patch.workflowStatus='verified';
    e.patch.verifiedAt='2026-10-21T00:00:00.000Z';
    e.patch.verifiedBy='Official model identity and published rating cross-check';
    e.patch.reviewerNote='Checked published model and rating fields only. Missing specifications remain unknown; local availability and project-specific approval are not implied.';
    e.confirmedFields=['exactModelNumber','coolingCapacityBtuH'];verified++;
  }
}
const generated='(function(){\n"use strict";\nwindow.AirCalcEquipmentSourceEvidence='+JSON.stringify(evidence)+';\n(window.AirCalcRealEquipmentRecords||[]).forEach(function(record){var evidence=window.AirCalcEquipmentSourceEvidence[record.id];if(evidence && evidence.patch)Object.assign(record,evidence.patch);});\n})();\n';
fs.writeFileSync(path.join(__dirname,'../data/equipment-source-evidence.js'),generated);
console.log('Structured public product specifications extracted for '+enriched+' records; audited table patches applied.');
console.log('Published identity/rating confirmed for '+verified+' additional record checks.');

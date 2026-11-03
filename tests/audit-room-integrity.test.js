'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const data = require('../data.json');
const Engine = require('../js/core/engineering-calculation-engine');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const functionSource = name => {
  const match = source.match(new RegExp('function ' + name + '\\([^]*?\\n\\}'));
  assert(match, name); return match[0];
};
const ctx = { console:{log(){}}, window:null, localStorage:{getItem(){return null;}},
  ROOM_STANDARDS:data.ROOM_STANDARDS, ROOM_EQUIPMENT_PRESETS:data.ROOM_EQUIPMENT_PRESETS,
  DEVS:data.DEVS, lang:'en', devs:[{id:'printer',qty:1}] };
ctx.window = ctx; vm.createContext(ctx);
for (const file of ['js/core/storage.js', 'modules/rooms.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
}
assert.equal(ctx.AppRooms.inferRoomStandardKey(data.ROOMS.r_residential),'residential');
ctx.AppRooms.applyRoomEquipmentPreset('residential');
assert.equal(ctx.devs.length,0,'residential must not inherit office devices');
assert.equal(ctx.AppRooms.getRoomStandard(data.ROOMS.r_residential).roomType,'Residential');
assert.equal(ctx.AppRooms.inferRoomStandardKey({en:'NICU room'}),'nicu');
for (const room of Object.values(data.ROOMS).filter(r=>r.mode==='hc')) {
  const standard = ctx.AppRooms.getRoomStandard(room);
  assert.equal(standard.ach,room.tach,room.id);
  assert.equal(standard.oa,room.oach,room.id);
}
for (const mode of ['ashrae','fresh100']) {
  const legacy = {rid:'h_or',calcMode:'hc',vol:126,ach:20,oaStd:4,oa:4,sup:1483,
    freshAirMode:mode,btu:44244,tr:'3.69',mkt:45000};
  const thermal = [legacy.btu,legacy.tr,legacy.mkt];
  ctx.AppStorage.normalizeRoomRecord(legacy);
  assert.equal(legacy.oa,mode==='fresh100'?1483:297);
  assert.equal(legacy.oaStd,4);
  assert.equal(legacy.recirc,mode==='fresh100'?0:1186);
  assert.equal(legacy.mode,'hc');
  assert.equal(legacy.airflowMigration.previousOa,4);
  assert.deepEqual([legacy.btu,legacy.tr,legacy.mkt],thermal,'migration preserves thermal results');
  const once=JSON.stringify(legacy);ctx.AppStorage.normalizeRoomRecord(legacy);
  assert.equal(JSON.stringify(legacy),once,'migration is idempotent');
}
const unknown = {rid:'h_or',oa:4,btu:44244};
ctx.AppStorage.normalizeRoomRecord(unknown);
assert.equal(unknown.oa,4,'do not guess missing volume/ACH');
assert.equal(unknown.airflowReviewRequired,true);
const manual = {qty:2,up:1500,unitType:'split',selectedBtu:24000,qtyAuto:false};
ctx.AppStorage.normalizeQuoteLines([manual]);
assert.equal(manual.systems[0].selectedBtu*manual.systems[0].qty,48000);
assert.equal(manual.systemPrices[manual.systems[0].id].unitPrice*2,3000,'preserve historic priced equipment');
const suggested={qty:1,up:0,selectedBtu:36000,qtyAuto:true};
ctx.AppStorage.normalizeQuoteLines([suggested]);
assert.equal(suggested.systems,undefined,'an automatic suggestion is not installed equipment');
vm.runInContext(functionSource('isHealthcareRoom'),ctx);
assert.equal(ctx.isHealthcareRoom({calcMode:'hc'}),true);
assert.equal(ctx.isHealthcareRoom({rid:'h_or'}),true);
assert.equal(ctx.isHealthcareRoom({calcMode:'rot',rid:'r_residential'}),false);

// Execute the production healthcare UI adapter, rather than a copied formula.
const elements={};let saved;
Object.assign(ctx,{AirCalcEngineering:Engine,curRoom:data.ROOMS.h_or,
  getFreshAirMode:()=>ctx.testMode,totalDevBtu:()=>8189,m3toft3:Engine.m3ToFt3,
  flash(){},t:x=>x,toast(){},showCalcQuoteAction(){},
  G:id=>elements[id]||(elements[id]={style:{},classList:{add(){}}}),
  saveHist(...args){saved=args;}});
vm.runInContext(functionSource('calcHC'),ctx);
for (const mode of ['ashrae','fresh100']) {
  ctx.testMode=mode;ctx.calcHC(126,0);
  const record=saved[7];
  assert.equal(record.oa,mode==='fresh100'?1483:297);
  assert.equal(record.outdoorAirCfm,record.oa);
  assert.equal(record.outdoorAch,4);
  assert.equal(record.oaStd,4);
  assert.equal(record.recirc,mode==='fresh100'?0:1186);
  assert.equal(record.finalLoadVerified,false);
  assert.equal(Math.round(saved[4]),44244,'retain declared preliminary formula');
}
const before=saved;ctx.curRoom={...data.ROOMS.h_or,oach:25};ctx.calcHC(126,0);
assert.equal(saved,before,'invalid ACH must not save an unchecked fallback calculation');

// Missing independent verification cannot turn a clinical room into a pass.
Object.assign(ctx,{buildValidationValue:(a,e,v)=>({label:e,value:v}),
  buildValidationItem:(title,status,detail,values)=>({status,detail,values})});
vm.runInContext(functionSource('evaluateAshraeGuidedValidation'),ctx);
assert.equal(ctx.evaluateAshraeGuidedValidation({isHealthcare:true,requiredCfm:1483,selectedSystemCfm:1500},{ach:20,oaStd:4,pressure:'positive'}).status,'warning');
assert.equal(ctx.evaluateAshraeGuidedValidation({isHealthcare:true,requiredCfm:1483,selectedSystemCfm:1000},{ach:20,pressure:'positive'}).status,'fail');
assert.equal(Engine.calculateHealthcareRoom({volumeM3:60,totalAch:6,outdoorAch:20}).ok,false);
assert.equal(Engine.calculateGeneralRoom({volumeM3:NaN}).ok,false);
assert.equal(Engine.calculateDuctSize({cfm:100000,velocityFpm:1000,maxSideMm:1800,maxAspectRatio:4}).ok,false);
const standardOnly=Engine.calculateDuctSize({cfm:100,velocityFpm:1000,minSideMm:500,maxSideMm:600,standardSizes:[[500,500]],preferredHeightsMm:[200]});
assert.equal(standardOnly.ok,true);assert.equal(standardOnly.calc.h,500);
const boot={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'data.bootstrap.js'),'utf8'),boot);
assert.equal(JSON.stringify(boot.window.__AIRCALC_BOOT_DATA__),JSON.stringify(data),'offline and JSON sources must match');
console.log('Audit regression: residential presets, clinical identity, OA units/migration, legacy prices, validation and duct bounds passed.');
Object.assign(ctx,{getEngineeringValidationThresholds:()=>Engine.VALIDATION_THRESHOLDS,calcDuctSize:()=>null});
vm.runInContext(functionSource('evaluateDuctVelocityValidation'),ctx);
assert.equal(ctx.evaluateDuctVelocityValidation(100000,true).status,'fail','missing duct size cannot pass using target velocity');
const reportCtx={hist:[{en:'OR',roomCount:1,btu:44244,cfm:1483,oa:4,outdoorAirCfm:297,outdoorAch:4,selectedBtu:36000}],
 getRoomSystemState:()=>({selectedCapacityBtu:0,systems:[]}),getSelectedProjectEquipmentBtu:()=>0,window:null};
reportCtx.window=reportCtx;vm.createContext(reportCtx);
vm.runInContext(fs.readFileSync(path.join(root,'js/reports/professional-report-data-builder.js'),'utf8'),reportCtx);
const report=reportCtx.AirCalcProfessionalReportData.buildProfessionalReportData();
assert.equal(report.rooms[0].outdoorAirCfm,297,'report prefers canonical CFM over legacy ambiguous field');
assert.equal(report.rooms[0].outdoorAirAch,4);
assert.equal(report.rooms[0].selectedCapacityBtuH,0,'zero assignment must not fall back to an old suggestion');

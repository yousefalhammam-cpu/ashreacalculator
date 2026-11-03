'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function load(ctx,name){const m=source.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));assert(m,name);vm.runInContext(m[0],ctx);}
let next=1;const timers=new Map(),elements={};
const ctx={window:{},lang:'en',curRoom:{mode:'hc'},editIdx:0,roomLiveSyncTimer:null,
  hist:[{id:'existing'}],peopleManualOverride:true,
  setTimeout:fn=>{const id=next++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
  setRoomVolumeFromDimensions:()=>({volume:126}),G:id=>elements[id]||(elements[id]={value:'0',style:{}}),
  trackAppEvent(){},isHealthcareRoom:()=>true,currentAnalyticsRoomType:()=> 'h_or',currentAnalyticsLanguage:()=> 'en',
  toast(){},t:x=>x,resetCalcEntryForm(){throw Error('must not reset a record under edit');},
  calcHC(){if(ctx.editIdx<0)ctx.hist.push({});else ctx.hist[ctx.editIdx]={updated:true};ctx.editIdx=-1;}};
vm.createContext(ctx);load(ctx,'scheduleLiveRoomSync');load(ctx,'doCalc');
ctx.scheduleLiveRoomSync();assert.equal(timers.size,1);
ctx.doCalc();assert.equal(timers.size,0,'manual calculate cancels debounce');
assert.equal(ctx.editIdx,0,'keep the existing record under edit');assert.equal(ctx.hist.length,1);
ctx.scheduleLiveRoomSync();const callback=[...timers.values()][0];timers.clear();callback();
ctx.doCalc();assert.equal(ctx.hist.length,1,'auto refresh followed by manual update must not append');
ctx.scheduleLiveRoomSync();const stale=[...timers.values()][0];timers.clear();ctx.editIdx=-1;
stale();assert.equal(ctx.hist.length,1,'pending edits must not create new rooms');

const states=[{systems:[],selectedCapacityBtu:0,selectedSystemCfm:0},
  {systems:[{qty:1}],selectedCapacityBtu:24000,selectedSystemCfm:800}];
Object.assign(ctx,{hist:[{},{}],getRoomSystemState:i=>states[i],getSelBtu:()=>36000,getQty:()=>1,getCurrentCfmPerTr:()=>400});
load(ctx,'getRoomModeSelectedEquipmentSummary');
const summary=ctx.getRoomModeSelectedEquipmentSummary();
assert.equal(summary.btu,24000);assert.equal(summary.unitCount,1);assert.equal(summary.cfm,800);
Object.assign(ctx,{getRoomAssignment:()=>({mode:'independent'}),hasRoomSystems:i=>i===1,
  getRoomSystemsSubtotal:()=>1500,getRoomSystemsQty:()=>1});
load(ctx,'getRoomQuoteSubtotal');load(ctx,'getRoomQuoteTotalQty');
assert.equal(ctx.getRoomQuoteSubtotal(0),0);assert.equal(ctx.getRoomQuoteTotalQty(0),0);
assert.equal(ctx.getRoomQuoteSubtotal(1),1500);
Object.assign(ctx,{instPct:10,quoteMode:'room',vatOn:true,getRoomModeQuoteTotals:()=>({subtotal:1500,totalQty:1}),money:v=>v.toFixed(2)});
load(ctx,'getInstallationPercent');
const override=source.match(/refreshGrandTotal = function\(\)\{[^]*?\n\};/)[0];vm.runInContext(override,ctx);
for (const [rate,grand] of [['5','1811.25'],['0','1725.00'],['2.5','1768.13']]) {
  ctx.G('qs-inst').value=rate;ctx.refreshGrandTotal();
  assert.equal(ctx.G('qt-grand').textContent,'cur '+grand);
}
ctx.vatOn=false;ctx.G('qs-inst').value='0';ctx.refreshGrandTotal();
assert.equal(ctx.G('qt-grand').textContent,'cur 1500.00');
console.log('Audit regression: debounced/manual edits preserve record count; assigned equipment and zero/decimal rates remain consistent.');

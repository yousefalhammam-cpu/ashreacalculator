const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/equipment-records.real.js'),'utf8'),context);
const records=context.window.AirCalcRealEquipmentRecords;
assert.equal(new Set(records.map(r=>r.id)).size,records.length,'Unique catalogue IDs');
for(const type of ['package','split','ducted','cassette','fcu','vrf','window','floor','chiller','ahu']) {
  assert.ok(new Set(records.filter(r=>r.equipmentType===type).map(r=>r.manufacturerId)).size>=2,type+' has multiple manufacturers');
}
const additions=records.filter(r=>r.id.startsWith('catalogue-20261020-'));
assert.equal(additions.length,37);
for(const r of additions) {
  assert.match(r.sourceReference,/^https:\/\//);
  assert.equal(r.sampleData,false);
  if(r.exactModelNumber.endsWith('[family]')) {
    assert.equal(r.coolingCapacityBtuH,null);
    assert.equal(r.verificationStatus,'pending_review');
  } else {
    assert.equal(r.verificationStatus,'verified');
    assert.equal(r.workflowStatus,'verified');
    assert.ok(r.verifiedAt && r.verifiedBy);
    assert.match(r.reviewerNote,/not Saudi stock/);
  }
  if(r.equipmentType==='chiller') {
    assert.equal(r.airflowNominalCfm,null);
    assert.equal(r.availableEspPa,null);
  }
}
const midea=additions.find(r=>r.exactModelNumber==='MRCT-100CWN1-Y(D)');
assert.equal(midea.coolingCapacityBtuH,107000);
assert.equal(midea.frequencyHz,60);
assert.equal(midea.airflowNominalCfm,3800);
const carrier=additions.find(r=>r.exactModelNumber==='30RB 060');
assert.equal(carrier.coolingCapacityKw,200.6);
assert.match(carrier.notes,/NOT a Saudi high-ambient rating/);
assert.equal(additions.filter(r=>r.verificationStatus==='verified').length,29);
console.log('All equipment types have multiple manufacturers; 37 sourced additions validated.');

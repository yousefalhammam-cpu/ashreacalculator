const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const context={window:{}};
function load(file){vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);}
load('data/equipment-records.real.js');
const before=context.window.AirCalcRealEquipmentRecords.map(r=>[r.id,r.coolingCapacityBtuH,r.airflowNominalCfm,r.availableEspPa]);
load('data/equipment-source-evidence.js');
load('js/equipment/equipment-schema.js');
const rows=context.window.AirCalcRealEquipmentRecords;
for(let i=0;i<rows.length;i++){
  assert.equal(rows[i].id,before[i][0]);assert.equal(rows[i].coolingCapacityBtuH,before[i][1],'Existing capacity is preserved');
  if(before[i][2]!=null)assert.equal(rows[i].airflowNominalCfm,before[i][2],'Existing airflow is preserved');
  assert.equal(rows[i].availableEspPa,before[i][3],'Maximum static pressure is not substituted for a duty rating');
}
const evidence=context.window.AirCalcEquipmentSourceEvidence;
assert.equal(Object.keys(evidence).length,164);
assert.equal(rows.filter(r=>r.verificationStatus==='verified').length,109);
assert.equal(Object.values(evidence).filter(e=>e.recordKind==='product_family').length,55);
for(const r of rows){
  const e=evidence[r.id];assert.equal(e.sourceUrl,r.sourceReference);
  assert.ok(Array.isArray(e.specifications) && Array.isArray(e.blocks));
  if(e.sourceStatus==='retrieved')assert.match(e.sourceHash,/^[a-f0-9]{64}$/);
  if(e.recordKind==='product_family')assert.ok(!e.patch.verificationStatus,'Retrieval must not verify a family as an exact model');
}
const haier=rows.find(r=>r.exactModelNumber==='HSU-18HQ13/R32(T3DB-B)');
assert.equal(haier.inputPowerKw,1.613);assert.equal(haier.runningCurrentA,7);
const daikin=rows.find(r=>r.exactModelNumber==='UAYN350AFY1A');
assert.equal(daikin.dimensions.heightMm,1276);assert.equal(daikin.verificationStatus,'verified');
const midea=rows.find(r=>r.exactModelNumber==='MRCT-050CWN1-M');
assert.equal(midea.weightKg,207);assert.equal(midea.eer,8.3);
const carrier=rows.find(r=>r.exactModelNumber==='30RB 060');
assert.equal(carrier.inputPowerKw,70.6);assert.equal(carrier.cop,2.8);
assert.equal(carrier.voltage,null);assert.equal(carrier.airflowNominalCfm,null);
const normalized=context.window.AirCalcEquipmentSchema.normalizeEquipmentRecord(midea);
assert.equal(normalized.dimensions.depthMm,1068);
const indoor=rows.find(r=>r.exactModelNumber==='FXSQ25A');
assert.equal(indoor.airflowNominalCfm,318);assert.equal(indoor.inputPowerKw,.041);
assert.equal(indoor.availableEspPa,null,'Do not use the published maximum 150 Pa as a duty-point ESP');
assert.match(indoor.sourceReference,/product.table.html/);
const mission=rows.find(r=>r.exactModelNumber==='MSTMX18HRNAG1');
assert.equal(mission.inputPowerKw,1.797);assert.equal(mission.eer,8.85);
assert.equal(mission.dimensions.widthMm,890);assert.equal(mission.dimensions.depthMm,342);
const gree=rows.find(r=>r.exactModelNumber==='GWC18ATDXF-S3DTA1C');
assert.equal(gree.verificationStatus,'verified');assert.equal(gree.runningCurrentA,null,'GSO generic current statement is not a cooling duty current');
console.log('164 source entries, precise enrichment and preservation of existing ratings passed.');

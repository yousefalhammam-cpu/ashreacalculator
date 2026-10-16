const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

global.window = global;
function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInThisContext(source, { filename: relativePath });
}

load('js/equipment/equipment-schema.js');
load('data/equipment-records.real.js');

assert.ok(Array.isArray(global.AirCalcRealEquipmentRecords), 'real equipment records should be exposed.');
assert.strictEqual(global.AirCalcRealEquipmentRecords.length, 127, 'seed includes the sourced Saudi market expansion.');
const additions=global.AirCalcRealEquipmentRecords.filter(r=>r.id.startsWith('real-sa-20261016-'));
assert.strictEqual(additions.length,30);
assert.strictEqual(new Set(global.AirCalcRealEquipmentRecords.map(r=>r.id)).size,127);
const applied=global.AirCalcRealEquipmentRecords.filter(r=>r.id.startsWith('real-applied-20261016-'));
assert.strictEqual(applied.length,14);
assert.strictEqual(applied.filter(r=>r.equipmentType==='chiller').length,10);
assert(applied.every(r=>r.airflowNominalCfm===null && r.availableEspPa===null));
assert(applied.every(r=>r.verificationStatus==='pending_review' && r.sourceReference.startsWith('https://')));
assert.strictEqual(applied.find(r=>r.exactModelNumber==='AG056KSVANH/EU').coolingCapacityKw,56);
assert.strictEqual(applied.find(r=>r.exactModelNumber==='MV8-2300WV2GN1(SA)').coolingCapacityKw,170.5);
for(const brand of ['Zamil','Gree','Midea','Haier']) assert(additions.some(r=>r.manufacturerName===brand));
const haier=additions.find(r=>r.exactModelNumber==='HSU-18HQ13/R32(T3DB-B)');
assert.strictEqual(haier.coolingCapacityBtuH,14400);
assert.strictEqual(haier.coolingCapacityT1BtuH,18000);
assert.strictEqual(haier.availableEspPa,null);
assert.strictEqual(additions.find(r=>r.exactModelNumber==='MTBTVE18HWN1KSA').coolingCapacityBtuH,18000);
assert.strictEqual(additions.find(r=>r.exactModelNumber==='DAQ60 / KAQ60').coolingCapacityBtuH,52000);
assert.strictEqual(additions.find(r=>r.exactModelNumber==='GWC18ATDXF-S3DTA1C').verificationStatus,'pending_review');
assert(additions.every(r=>r.sourceReference.startsWith('https://') && !r.sampleData));
const skm=global.AirCalcRealEquipmentRecords.find(r=>r.exactModelNumber==='APMR 52170');
assert.strictEqual(skm.coolingCapacityBtuH,149300);
assert.strictEqual(skm.airflowNominalCfm,6000);
assert.strictEqual(skm.frequencyHz,50);
assert(skm.notes.includes('gross'));
const gulfPackage = global.AirCalcRealEquipmentRecords.find(r=>r.exactModelNumber==='AK-C04820.AWGBIBR');
assert.strictEqual(gulfPackage.coolingCapacityBtuH,42000);
assert.strictEqual(gulfPackage.availableEspPa,null);
assert.strictEqual(gulfPackage.verificationStatus,'verified');

const first = global.AirCalcRealEquipmentRecords[0];
assert.strictEqual(first.sampleData, false, 'real seed records must not be sample data.');
assert.strictEqual(first.manufacturerName, 'Daikin');
assert.strictEqual(first.equipmentType, 'package');
assert.strictEqual(first.exactModelNumber, 'UAYN350AFY1A');
assert.strictEqual(first.coolingCapacityKw, 37.2);
assert.strictEqual(first.airflowNominalCfm, 4132);
assert.strictEqual(first.availableEspPa, 210);
assert.strictEqual(first.verificationStatus, 'pending_review');
assert.ok(first.sourceReference.includes('daikin.co.nz'), 'real records should keep their official source URL.');
assert.ok(first.notes.toLowerCase().includes('official'), 'real records should explain source and review limits.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Carrier' && record.exactModelNumber === '50FEQ-10T-FAMILY'), 'Carrier package family seed should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Zamil' && record.equipmentType === 'ducted'), 'Zamil ducted records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Zamil' && record.equipmentType === 'cassette'), 'Zamil cassette records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Zamil' && record.equipmentType === 'split'), 'Zamil split records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Daikin' && record.equipmentType === 'fcu'), 'Daikin FCU records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Daikin' && record.equipmentType === 'vrf'), 'Daikin VRF records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Zamil' && record.equipmentType === 'window'), 'Zamil window records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Zamil' && record.equipmentType === 'floor'), 'Zamil floor standing records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.equipmentType === 'chiller' && record.exactModelNumber === '30XV-140-FAMILY'), 'Carrier 30XV chiller records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.equipmentType === 'chiller' && record.exactModelNumber === 'RTAF-115-FAMILY'), 'Trane RTAF chiller records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.equipmentType === 'chiller' && record.exactModelNumber === 'EWAT-B-C-250KW-FAMILY'), 'Daikin EWAT-B-C chiller records should be included.');
assert.ok(global.AirCalcRealEquipmentRecords.some((record) => record.manufacturerName === 'Daikin' && record.equipmentType === 'ahu'), 'Daikin AHU records should be included.');

global.AirCalcRealEquipmentRecords.forEach((record) => {
  const validation = global.AirCalcEquipmentSchema.validateEquipmentRecord(record);
  assert.strictEqual(validation.ok, true, `${record.id} should satisfy equipment schema: ${validation.errors.join(', ')}`);
});

console.log('Real equipment records tests passed.');

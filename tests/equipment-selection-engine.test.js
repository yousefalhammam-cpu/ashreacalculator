const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

global.window = global;

function load(relativePath) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath });
}

load('js/equipment/equipment-schema.js');
load('js/equipment/equipment-selection-engine.js');

const Engine = global.AirCalcEquipmentSelection;
assert.ok(Engine, 'equipment selection engine should be exposed');

function record(overrides) {
  return Object.assign({
    id: 'unit-ok',
    manufacturerId: 'carrier',
    manufacturerName: 'Carrier',
    brand: 'Carrier',
    series: 'TEST DATA - NOT MARKET MODEL',
    exactModelNumber: 'TEST-060',
    equipmentType: 'package',
    marketRegion: 'SA',
    saudiMarketStatus: 'listed',
    catalogueRevision: 'test',
    coolingCapacityBtuH: 60000,
    sensibleCapacityBtuH: 45000,
    airflowNominalCfm: 2200,
    availableEspPa: 300,
    voltage: 380,
    phase: 3,
    frequencyHz: 60,
    eer: 11,
    sourceReference: 'test fixture',
    verificationStatus: 'verified',
    discontinued: false,
    sampleData: false
  }, overrides || {});
}

const baseReq = {
  requiredCoolingLoadBtuH: 52000,
  requiredSensibleLoadBtuH: 39000,
  requiredSupplyCfm: 1900,
  requiredEspPa: 180,
  equipmentType: 'package',
  voltage: 380,
  phase: 3,
  frequencyHz: 60,
  marketRegion: 'SA',
  requireSaudiListing: true,
  verifiedDataOnly: true,
  maxUnits: 4
};

let result = Engine.selectEquipment({ ...baseReq, records: [record()] });
assert.ok(result.recommendedOption, 'matching unit should be recommended');
assert.ok(Array.isArray(result.recommendationBuckets), 'selection should return recommendation buckets');
assert.ok(result.recommendationBuckets.some((bucket) => bucket.id === 'best_match' && bucket.available), 'best-match bucket should be available for a matching unit');
assert.strictEqual(result.recommendedOption.quantity, 1, 'single suitable unit should be selected');
assert.strictEqual(result.rejectedAlternatives.length, 0, 'matching unit should not be rejected');
assert.ok(result.recommendedOption.matchScore >= 75, 'matching unit should receive a strong score');
assert.ok(result.recommendedOption.scoreBreakdown.capacity <= 20, 'score should expose capacity component');

result = Engine.selectEquipment({ ...baseReq, maxUnits: 1, records: [record({ id: 'low-capacity', coolingCapacityBtuH: 42000 })] });
assert.strictEqual(result.suitableOptions.length, 0, 'unit below load should not be suitable');
assert.ok(
  result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'capacity_below_load')),
  'capacity below load should be reported'
);

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'oversized', coolingCapacityBtuH: 110000, airflowNominalCfm: 3200 })] });
assert.ok(result.recommendedOption, 'oversized but compatible unit can remain suitable');
assert.ok(result.recommendedOption.oversizingPercent > 100, 'oversizing percentage should be calculated');
assert.ok(result.recommendedOption.scoreBreakdown.capacity < 20, 'capacity score should penalize excessive oversizing');

result = Engine.selectEquipment({ ...baseReq, maxUnits: 1, records: [record({ id: 'low-cfm', airflowNominalCfm: 1200 })] });
assert.strictEqual(result.suitableOptions.length, 0, 'low airflow unit should be rejected');
assert.ok(result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'airflow_below_requirement')));

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'low-esp', availableEspPa: 90 })] });
assert.strictEqual(result.suitableOptions.length, 0, 'low ESP unit should be rejected');
assert.ok(result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'esp_below_requirement')));

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'bad-electrical', voltage: 220, phase: 1 })] });
assert.strictEqual(result.suitableOptions.length, 0, 'electrical mismatch should hard reject');
assert.ok(result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'voltage')));

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'unverified', verificationStatus: 'pending' })] });
assert.strictEqual(result.suitableOptions.length, 0, 'unverified model should be rejected when verified only is enabled');
assert.ok(result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'unverified')));

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'published', verificationStatus: 'published' })] });
assert.ok(result.recommendedOption, 'published model should be eligible when verified only is enabled');

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'discontinued', discontinued: true })] });
assert.strictEqual(result.suitableOptions.length, 0, 'discontinued model should be rejected');
assert.ok(result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'discontinued')));

result = Engine.selectEquipment({ ...baseReq, records: [record({ id: 'sample', sampleData: true, verificationStatus: 'sample' })] });
assert.strictEqual(result.suitableOptions.length, 0, 'sample model should be rejected by default');
assert.ok(result.rejectedAlternatives.some((alt) => alt.reasons.some((r) => r.code === 'sample_data')));

result = Engine.selectEquipment({
  ...baseReq,
  requiredCoolingLoadBtuH: 150000,
  requiredSupplyCfm: 5400,
  records: [
    record({ id: 'unit-75', exactModelNumber: 'TEST-075', coolingCapacityBtuH: 75000, airflowNominalCfm: 2800, seer: 13, soundLevelDb: 58, inputPowerKw: 18 }),
    record({ id: 'unit-160', exactModelNumber: 'TEST-160', coolingCapacityBtuH: 160000, airflowNominalCfm: 5900, seer: 10, soundLevelDb: 64, inputPowerKw: 25 })
  ]
});
assert.ok(result.suitableOptions.some((opt) => opt.quantity === 2 && opt.equipmentId === 'unit-75'), 'two identical units should be generated');
assert.ok(result.recommendedOption, 'large load should receive a recommendation');
assert.ok(result.recommendationBuckets.some((bucket) => bucket.id === 'highest_efficiency' && bucket.option.equipmentId === 'unit-75'), 'highest-efficiency bucket should prefer the most efficient suitable option');
assert.ok(result.recommendationBuckets.some((bucket) => bucket.id === 'lowest_noise' && bucket.option.equipmentId === 'unit-75'), 'lowest-noise bucket should prefer the quietest suitable option');
assert.ok(result.recommendationBuckets.some((bucket) => bucket.id === 'lowest_power' && bucket.option.equipmentId === 'unit-160'), 'lowest-power bucket should prefer the lowest documented total input power option');

result = Engine.selectEquipment({
  ...baseReq,
  requiredCoolingLoadBtuH: 100000,
  requiredSupplyCfm: 3600,
  redundancyPreference: 'n_plus_1',
  records: [record({ id: 'unit-50', exactModelNumber: 'TEST-050', coolingCapacityBtuH: 50000, airflowNominalCfm: 1800 })]
});
assert.ok(result.suitableOptions.some((opt) => opt.redundancyLevel === 'N+1'), 'N+1 combinations should be generated when requested');
assert.strictEqual(result.recommendedOption.redundancyLevel, 'N+1', 'N+1 preference should influence ranking');

result = Engine.selectEquipment({
  requiredCoolingLoadBtuH: 52000,
  records: [record()]
});
assert.ok(result.missingProjectData.includes('requiredSupplyCfm'), 'missing CFM should be reported');
assert.ok(result.missingProjectData.includes('requiredEspPa'), 'missing ESP should be reported');

console.log('Equipment selection engine tests passed.');

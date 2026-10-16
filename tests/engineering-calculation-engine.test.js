const assert = require('assert');
const path = require('path');

const Engine = require('../js/core/engineering-calculation-engine.js');
const data = require('../data.json');

function approx(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`
  );
}

function generalCase(name, roomId, input, expected) {
  const room = data.ROOMS[roomId] || input.room;
  const result = Engine.calculateGeneralRoom({
    volumeM3: input.volumeM3,
    loadFactorBtuhPerM3: input.loadFactorBtuhPerM3 || room.factor,
    insulationMultiplier: input.insulationMultiplier || 1,
    windowLoadBtuh: input.windowLoadBtuh || 0,
    peopleCount: input.peopleCount || 0,
    deviceLoadBtuh: input.deviceLoadBtuh || 0
  });
  assert.strictEqual(result.ok, true, `${name} should calculate`);
  assert.strictEqual(Math.round(result.totalBtuh), expected.totalBtuh, `${name} total BTU/h`);
  assert.strictEqual(result.supplyCfm, expected.supplyCfm, `${name} supply CFM`);
  assert.strictEqual(result.marketBtuh, expected.marketBtuh, `${name} market BTU/h`);
  return result;
}

function healthcareCase(name, roomId, input, expected) {
  const room = data.ROOMS[roomId] || input.room;
  const result = Engine.calculateHealthcareRoom({
    volumeM3: input.volumeM3,
    totalAch: input.totalAch || room.tach,
    outdoorAch: input.outdoorAch || room.oach,
    pressure: input.pressure || room.pres,
    freshAirMode: input.freshAirMode || 'ashrae',
    peopleCount: input.peopleCount || 0,
    deviceLoadBtuh: input.deviceLoadBtuh || 0
  });
  assert.strictEqual(result.ok, true, `${name} should calculate`);
  assert.strictEqual(result.supplyCfm, expected.supplyCfm, `${name} supply CFM`);
  assert.strictEqual(result.outdoorAirCfm, expected.outdoorAirCfm, `${name} outdoor air CFM`);
  assert.strictEqual(result.exhaustCfm, expected.exhaustCfm, `${name} exhaust CFM`);
  assert.strictEqual(Math.round(result.totalBtuh), expected.totalBtuh, `${name} total BTU/h`);
  return result;
}

function presetDeviceLoadBtuh(presetKey) {
  const deviceById = new Map(data.DEVS.map((device) => [device.id, device]));
  const preset = data.ROOM_EQUIPMENT_PRESETS[presetKey] || [];
  return preset.reduce((total, item) => {
    const id = typeof item === 'string' ? item : item.id;
    const qty = item && typeof item === 'object' && item.qty ? item.qty : 1;
    const device = deviceById.get(id);
    assert.ok(device, `preset ${presetKey} references missing device ${id}`);
    return total + Engine.wattsToBtuh(device.w * qty);
  }, 0);
}

// Unit conversions
approx(Engine.m2ToFt2(80), 861.112, 0.01, 'm2 to ft2');
approx(Engine.m3ToFt3(240), 8475.528, 0.01, 'm3 to ft3');
approx(Engine.cfmToLps(1000), 471.947, 0.01, 'CFM to L/s');
approx(Engine.btuhToKw(12000), 3.51685, 0.0001, 'BTU/h to kW');
approx(Engine.trToKw(1), 3.51685, 0.0001, 'TR to kW');

approx(Engine.convertUnit({ value: 80, from: 'm2', to: 'ft2' }).value, 861.112, 0.01, 'strict m2 to ft2');
approx(Engine.convertUnit({ value: 861.112, from: 'ft2', to: 'm2' }).value, 80, 0.01, 'strict ft2 to m2');
approx(Engine.convertUnit({ value: 240, from: 'm3', to: 'ft3' }).value, 8475.528, 0.01, 'strict m3 to ft3');
approx(Engine.convertUnit({ value: 8475.528, from: 'ft3', to: 'm3' }).value, 240, 0.01, 'strict ft3 to m3');
approx(Engine.convertUnit({ value: 1000, from: 'cfm', to: 'lps' }).value, 471.947, 0.01, 'strict CFM to L/s');
approx(Engine.convertUnit({ value: 471.947, from: 'lps', to: 'cfm' }).value, 1000, 0.01, 'strict L/s to CFM');
approx(Engine.convertUnit({ value: 12000, from: 'btuh', to: 'kw' }).value, 3.51685, 0.0001, 'strict BTU/h to kW');
approx(Engine.convertUnit({ value: 3.51685, from: 'kw', to: 'btuh' }).value, 12000, 0.01, 'strict kW to BTU/h');
approx(Engine.convertUnit({ value: 1, from: 'tr', to: 'kw' }).value, 3.51685, 0.0001, 'strict TR to kW');
approx(Engine.convertUnit({ value: 3.51685, from: 'kw', to: 'tr' }).value, 1, 0.0001, 'strict kW to TR');
assert.strictEqual(
  Engine.convertUnit({ value: -1, from: 'm2', to: 'ft2' }).ok,
  false,
  'strict conversion rejects negative values'
);
assert.strictEqual(
  Engine.convertUnit({ value: 1, from: 'm2', to: 'cfm' }).ok,
  false,
  'strict conversion rejects unsupported unit pairs'
);
assert.deepStrictEqual(
  Engine.calculateMarketCapacity({ btuh: 28820, stepBtuh: 9000 }),
  { ok: true, requiredBtuh: 28820, stepBtuh: 9000, marketBtuh: 36000 },
  'strict market capacity should round up to the configured step'
);
assert.strictEqual(
  Engine.calculateMarketCapacity({ btuh: 28820, stepBtuh: -9000 }).ok,
  false,
  'strict market capacity rejects negative step'
);

// General HVAC cases
generalCase('Bedroom', 'r_residential', {
  volumeM3: 45,
  peopleCount: 2,
  deviceLoadBtuh: 500
}, {
  totalBtuh: 18755,
  supplyCfm: 625,
  marketBtuh: 27000
});

generalCase('Office', 'r_office', {
  volumeM3: 90,
  peopleCount: 4,
  deviceLoadBtuh: 1200
}, {
  totalBtuh: 28820,
  supplyCfm: 961,
  marketBtuh: 36000
});

// Healthcare HVAC cases. ASHRAE 170 values are read from data.json, not invented here.
healthcareCase('Waiting Area', 'h_waiting', {
  volumeM3: 150,
  peopleCount: 15
}, {
  supplyCfm: 706,
  outdoorAirCfm: 177,
  exhaustCfm: 706,
  totalBtuh: 23375
});

healthcareCase('Patient Room', 'h_patient_room', {
  volumeM3: 80,
  peopleCount: 1
}, {
  supplyCfm: 283,
  outdoorAirCfm: 94,
  exhaustCfm: 283,
  totalBtuh: 7164
});

healthcareCase('Patient Room with default equipment preset', 'h_patient_room', {
  volumeM3: 80,
  peopleCount: 1,
  deviceLoadBtuh: presetDeviceLoadBtuh('patient_room')
}, {
  supplyCfm: 283,
  outdoorAirCfm: 94,
  exhaustCfm: 283,
  totalBtuh: 9604
});

healthcareCase('ICU', 'h_icu', {
  volumeM3: 120,
  peopleCount: 2
}, {
  supplyCfm: 565,
  outdoorAirCfm: 141,
  exhaustCfm: 509,
  totalBtuh: 14304
});

healthcareCase('Operating Room', 'h_or', {
  volumeM3: 150,
  peopleCount: 3
}, {
  supplyCfm: 1766,
  outdoorAirCfm: 353,
  exhaustCfm: 1589,
  totalBtuh: 43280
});

healthcareCase('Isolation Room', 'h_isolation', {
  volumeM3: 90,
  peopleCount: 1
}, {
  supplyCfm: 636,
  outdoorAirCfm: 106,
  exhaustCfm: 700,
  totalBtuh: 15551
});

healthcareCase('Pharmacy', 'h_pharmacy', {
  volumeM3: 60,
  peopleCount: 1
}, {
  supplyCfm: 212,
  outdoorAirCfm: 71,
  exhaustCfm: 191,
  totalBtuh: 5477
});

// Fresh air and mixed air calculations
const dentalFresh100 = healthcareCase('Dental Operatory 100% Fresh Air', 'h_dental', {
  volumeM3: 80,
  freshAirMode: 'fresh100',
  peopleCount: 2
}, {
  supplyCfm: 706,
  outdoorAirCfm: 706,
  exhaustCfm: 706,
  totalBtuh: 17655
});
const mixed = Engine.calculateMixedAir({
  supplyCfm: dentalFresh100.supplyCfm,
  outdoorAirCfm: 94
});
assert.strictEqual(mixed.ok, true, 'mixed air should calculate');
assert.strictEqual(mixed.recirculatedCfm, 612, 'mixed air recirculated CFM');
assert.strictEqual(mixed.outdoorAirPercent, 13.3, 'mixed air outdoor air percent');

// Duct sizing and air velocity
const duct = Engine.calculateDuctSize({
  cfm: 2544,
  velocityFpm: 1000,
  standardSizes: [[400, 400], [500, 500], [700, 350], [800, 400], [900, 450]]
});
assert.strictEqual(duct.ok, true, 'duct sizing should calculate');
assert.strictEqual(duct.std.w, 700, 'duct standard width');
assert.strictEqual(duct.std.h, 350, 'duct standard height');
assert.strictEqual(duct.std.actualFpm, 965, 'duct actual velocity fpm');

const advancedDuct = Engine.calculateAdvancedDuctAnalysis({
  cfm: 2544,
  widthMm: 700,
  heightMm: 350,
  lengthM: 30
});
assert.strictEqual(advancedDuct.ok, true, 'advanced duct analysis should calculate');
assert.strictEqual(advancedDuct.A_ft2, 2.6372, 'advanced duct area ft2');
assert.strictEqual(advancedDuct.V_fpm, 965, 'advanced duct velocity fpm');
assert.strictEqual(advancedDuct.Dh_mm, 467, 'advanced duct hydraulic diameter mm');
assert.strictEqual(advancedDuct.Pv_inwg, 0.058, 'advanced duct velocity pressure in.w.g.');
assert.strictEqual(advancedDuct.dP_per100ft_inwg, 0.076, 'advanced duct friction per 100 ft');

// ESP
const esp = Engine.calculateEsp({
  lenSupM: 30,
  lenRetM: 20,
  bends: 4,
  frictionPaPerM: 1,
  bendLossPerPa: 10,
  filterLossPa: 20,
  diffuserLossPa: 30,
  coilLossPa: 0,
  damperLossPa: 0,
  otherLossPa: 0
});
assert.strictEqual(esp.totalPa, 140, 'ESP total Pa');
assert.strictEqual(esp.status.key, 'med', 'ESP status');

// Input validation
const invalid = Engine.calculateGeneralRoom({
  volumeM3: -1,
  loadFactorBtuhPerM3: 260
});
assert.strictEqual(invalid.ok, false, 'negative input rejected');

const invalidSafetyFactor = Engine.calculateGeneralRoom({
  volumeM3: 45,
  loadFactorBtuhPerM3: 260,
  safetyFactor: -1
});
assert.strictEqual(invalidSafetyFactor.ok, false, 'negative safety factor rejected');
assert.ok(
  invalidSafetyFactor.errors.some((error) => error.includes('safetyFactor')),
  'general room validation should name invalid safety factor field'
);

const invalidHealthcare = Engine.calculateHealthcareRoom({
  volumeM3: 80,
  totalAch: -1,
  outdoorAch: 2
});
assert.strictEqual(invalidHealthcare.ok, false, 'negative healthcare ACH rejected');
assert.ok(
  invalidHealthcare.errors.some((error) => error.includes('totalAch')),
  'healthcare validation should name invalid ACH field'
);

const invalidMixedAir = Engine.calculateMixedAir({
  supplyCfm: 500,
  outdoorAirCfm: -50
});
assert.strictEqual(invalidMixedAir.ok, false, 'negative mixed-air input rejected');
assert.ok(
  invalidMixedAir.errors.some((error) => error.includes('outdoorAirCfm')),
  'mixed-air validation should name invalid outdoor air field'
);

const invalidDuct = Engine.calculateDuctSize({
  cfm: 1000,
  velocityFpm: -1000
});
assert.strictEqual(invalidDuct.ok, false, 'negative duct velocity rejected');
assert.ok(
  invalidDuct.errors.some((error) => error.includes('velocityFpm')),
  'duct validation should name invalid velocity field'
);

const invalidAdvancedDuct = Engine.calculateAdvancedDuctAnalysis({
  cfm: 1000,
  widthMm: 700,
  heightMm: 350,
  lengthM: -1
});
assert.strictEqual(invalidAdvancedDuct.ok, false, 'negative advanced duct length rejected');
assert.ok(
  invalidAdvancedDuct.errors.some((error) => error.includes('lengthM')),
  'advanced duct validation should name invalid length field'
);

const invalidResolvedDuctCfm = Engine.resolveDuctCfm({
  selectedBtuh: 24000,
  fallbackCfm: 800,
  cfmPerTr: -400
});
assert.strictEqual(invalidResolvedDuctCfm.ok, false, 'negative CFM/TR rejected');
assert.ok(
  invalidResolvedDuctCfm.errors.some((error) => error.includes('cfmPerTr')),
  'duct CFM resolver validation should name invalid CFM/TR field'
);

const invalidEsp = Engine.calculateEsp({
  lenSupM: -1,
  lenRetM: 20,
  bends: 4,
  frictionPaPerM: 1,
  bendLossPerPa: 10,
  filterLossPa: 20,
  diffuserLossPa: 30
});
assert.strictEqual(invalidEsp.ok, false, 'negative ESP input rejected');
assert.ok(
  invalidEsp.errors.some((error) => error.includes('lenSupM')),
  'ESP validation should name invalid length field'
);

console.log('Engineering calculation engine tests passed.');

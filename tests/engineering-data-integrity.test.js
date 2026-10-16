const assert = require('assert');
const data = require('../data.json');

const rooms = data.ROOMS || {};
const standards = data.ROOM_STANDARDS || {};
const presets = data.ROOM_EQUIPMENT_PRESETS || {};
const devices = data.DEVS || [];
const sourceStatus = data.ENGINEERING_SOURCE_STATUS || {};
const healthcareSourceStatus = sourceStatus.healthcareRoomValues || {};
const deviceIds = new Set(devices.map((device) => device.id));

assert.ok(rooms.h_waiting, 'Explicit healthcare Waiting Room should exist');
assert.ok(rooms.h_pharmacy, 'Explicit healthcare Pharmacy should exist');
assert.ok(standards.waiting_area, 'Waiting area standard key should exist');
assert.ok(standards.pharmacy_clean, 'Pharmacy clean standard key should exist');

Object.entries(rooms).forEach(([key, room]) => {
  assert.ok(room.id, 'room should have id');
  assert.strictEqual(room.id, key, `${key} room id should match its data key`);
  assert.ok(room.mode === 'rot' || room.mode === 'hc', `${room.id} should have valid mode`);
  assert.ok(typeof room.en === 'string' && room.en.trim(), `${room.id} should have an English label`);
  assert.ok(typeof room.ar === 'string' && room.ar.trim(), `${room.id} should have an Arabic label`);

  if (room.mode === 'rot') {
    assert.ok(Number(room.factor) >= 0, `${room.id} load factor should be non-negative`);
  }

  if (room.mode === 'hc') {
    assert.strictEqual(room.cat, 'healthcare', `${room.id} healthcare room should be in healthcare category`);
    assert.ok(Number(room.tach) >= 0, `${room.id} total ACH should be non-negative`);
    assert.ok(Number(room.oach) >= 0, `${room.id} outdoor ACH should be non-negative`);
    assert.ok(Number(room.tach) >= Number(room.oach), `${room.id} total ACH should be greater than or equal to outdoor ACH`);
    assert.ok(['negative', 'neutral', 'positive'].includes(String(room.pres || '').toLowerCase()), `${room.id} pressure should be valid`);
    assert.ok(Array.isArray(room.tr) && room.tr.length === 2, `${room.id} temperature range should have min/max`);
    assert.ok(Array.isArray(room.rh) && room.rh.length === 2, `${room.id} humidity range should have min/max`);
    assert.ok(Number(room.tr[0]) <= Number(room.tr[1]), `${room.id} temperature range should be ordered`);
    assert.ok(Number(room.rh[0]) <= Number(room.rh[1]), `${room.id} humidity range should be ordered`);
    assert.ok(Number(room.tr[0]) >= 10 && Number(room.tr[1]) <= 35, `${room.id} temperature range should be plausible for occupied healthcare design`);
    assert.ok(Number(room.rh[0]) >= 0 && Number(room.rh[1]) <= 100, `${room.id} humidity range should be a valid percent range`);
  }
});

assert.strictEqual(
  healthcareSourceStatus.status,
  'requires_source_confirmation',
  'healthcare room values should remain blocked from final approval until source confirmation'
);

assert.strictEqual(
  healthcareSourceStatus.approvalRequiredBeforeFinalDesign,
  true,
  'healthcare room values should require approval before final design'
);

assert.ok(
  Array.isArray(healthcareSourceStatus.scope) &&
    healthcareSourceStatus.scope.includes('ROOMS entries with mode=hc'),
  'healthcare source-status scope should explicitly cover healthcare room entries'
);

Object.entries(standards).forEach(([key, standard]) => {
  assert.ok(standard.category, `${key} standard should have category`);
  assert.ok(standard.roomType, `${key} standard should have roomType`);
  if (standard.ach !== null) assert.ok(Number(standard.ach) >= 0, `${key} standard ACH should be non-negative`);
  if (standard.oa !== null) assert.ok(Number(standard.oa) >= 0, `${key} standard OA should be non-negative`);
  if (standard.exhaust !== null) assert.ok(Number(standard.exhaust) >= 0, `${key} standard exhaust should be non-negative`);
});

Object.entries(presets).forEach(([key, preset]) => {
  assert.ok(Array.isArray(preset), `${key} preset should be an array`);
  preset.forEach((item) => {
    const id = typeof item === 'string' ? item : item.id;
    const qty = item && typeof item === 'object' && item.qty ? Number(item.qty) : 1;
    assert.ok(deviceIds.has(id), `${key} preset references missing device ${id}`);
    assert.ok(qty > 0, `${key} preset device ${id} quantity should be positive`);
  });
});

console.log('Engineering data integrity tests passed.');

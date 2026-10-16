const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const data = require('../data.json');

const root = path.resolve(__dirname, '..');
const context = {
  console: { log() {} },
  ROOM_STANDARDS: data.ROOM_STANDARDS,
  ROOM_EQUIPMENT_PRESETS: data.ROOM_EQUIPMENT_PRESETS,
  DEVS: data.DEVS,
  lang: 'en'
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'modules', 'rooms.js'), 'utf8'), context, {
  filename: 'modules/rooms.js'
});

assert.ok(context.AppRooms, 'AppRooms should initialize');

const allowedNonClinicalHealthcareRooms = new Set(['h_waiting', 'h_corridor']);
const roomSpecificFallbacks = [];

Object.values(data.ROOMS)
  .filter((room) => room.mode === 'hc')
  .forEach((room) => {
    const standard = context.AppRooms.getRoomStandard(room);
    assert.ok(standard, `${room.id} should resolve a room standard`);
    assert.notStrictEqual(standard.category, 'unknown', `${room.id} should not fall back to unknown standard`);

    if (standard.category === 'non_clinical') {
      assert.ok(
        allowedNonClinicalHealthcareRooms.has(room.id),
        `${room.id} should not resolve to a non-clinical standard`
      );
    }

    if (standard.category === 'healthcare_room_specific') {
      roomSpecificFallbacks.push(room.id);
      assert.strictEqual(standard.ach, room.tach, `${room.id} room-specific standard should preserve total ACH`);
      assert.strictEqual(standard.oa, room.oach, `${room.id} room-specific standard should preserve outdoor ACH`);
      assert.strictEqual(
        String(standard.notes || '').includes('source confirmation required'),
        true,
        `${room.id} room-specific standard should require source confirmation`
      );
    }
  });

assert.ok(
  roomSpecificFallbacks.length > 0,
  'at least one healthcare room should use room-specific source-confirmation fallback instead of an unsafe office fallback'
);

assert.notStrictEqual(
  context.AppRooms.inferRoomStandardKey(data.ROOMS.h_or_sub),
  'office',
  'OR Sub-sterile should not fall back to office standard'
);

console.log('Healthcare room standard linking tests passed.');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const start = appSource.indexOf('function mapProjectSystemTypeToEquipmentType');
const end = appSource.indexOf('function getProjectSystemEquipmentSelectorContext');
assert.ok(start >= 0 && end > start, 'project system equipment compatibility functions should be present');

global.window = global;
global.MIXED_SYSTEM_TYPES = ['split', 'chiller_air', 'chiller_water'];
global.getAllowedSystemType = function getAllowedSystemType(unitType) {
  return global.MIXED_SYSTEM_TYPES.indexOf(unitType) >= 0 ? unitType : 'split';
};

vm.runInThisContext(appSource.slice(start, end), { filename: 'project-system-equipment-functions.js' });

const airChiller = {
  equipmentType: 'chiller',
  series: 'AquaForce 30XV Air-Cooled Chiller',
  exactModelNumber: '30XV-140-FAMILY',
  notes: ''
};
const waterChiller = {
  equipmentType: 'chiller',
  series: 'AquaForce 30XW Water-Cooled Chiller',
  exactModelNumber: '30XW-150-FAMILY',
  notes: ''
};

assert.strictEqual(mapProjectSystemTypeToEquipmentType('chiller_air'), 'chiller');
assert.strictEqual(mapProjectSystemTypeToEquipmentType('chiller_water'), 'chiller');
assert.strictEqual(isProjectSystemEquipmentRecordCompatible('chiller_air', airChiller), true, 'air chiller type should include air-cooled chiller records');
assert.strictEqual(isProjectSystemEquipmentRecordCompatible('chiller_air', waterChiller), false, 'air chiller type should exclude water-cooled chiller records');
assert.strictEqual(isProjectSystemEquipmentRecordCompatible('chiller_water', waterChiller), true, 'water chiller type should include water-cooled chiller records');
assert.strictEqual(isProjectSystemEquipmentRecordCompatible('chiller_water', airChiller), false, 'water chiller type should exclude air-cooled chiller records');

console.log('Project system chiller filter tests passed.');

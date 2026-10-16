const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const typesMatch = appSource.match(/var MIXED_SYSTEM_TYPES = \[([^\]]+)\]/);
assert.ok(typesMatch, 'MIXED_SYSTEM_TYPES should be declared in app.js');

const mixedSystemTypes = typesMatch[1]
  .split(',')
  .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
  .filter(Boolean);

global.window = global;
global.MIXED_SYSTEM_TYPES = mixedSystemTypes;
global.getAllowedSystemType = function getAllowedSystemType(unitType) {
  return mixedSystemTypes.includes(unitType) ? unitType : 'split';
};

const helperStart = appSource.indexOf('function mapProjectSystemTypeToEquipmentType');
const helperEnd = appSource.indexOf('function getProjectSystemEquipmentSelectorContext');
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'project system equipment compatibility helpers should be present');
vm.runInThisContext(appSource.slice(helperStart, helperEnd), { filename: 'project-system-equipment-helpers.js' });

require(path.join(root, 'data', 'equipment-records.real.js'));
const records = global.AirCalcRealEquipmentRecords || [];
assert.ok(records.length >= 65, 'real equipment seed should be loaded for coverage checks');

const missing = mixedSystemTypes.filter((systemType) => {
  return !records.some((record) => {
    if (!record || record.discontinued) return false;
    if (!isProjectSystemEquipmentRecordCompatible(systemType, record)) return false;
    if (record.equipmentType === 'ahu') {
      return !!(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm);
    }
    return !!record.coolingCapacityBtuH;
  });
});

assert.deepStrictEqual(missing, [], 'every project system type should have at least one real compatible equipment record');

console.log('Project system equipment coverage tests passed.');

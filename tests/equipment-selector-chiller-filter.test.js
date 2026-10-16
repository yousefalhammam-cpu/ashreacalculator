const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const selectorSource = fs.readFileSync(path.join(root, 'modules', 'equipment-selector.js'), 'utf8');

const elements = {};
function element(id, value) {
  elements[id] = elements[id] || {
    id,
    value: value == null ? '' : String(value),
    checked: false,
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    querySelector() { return null; },
    insertAdjacentHTML() {}
  };
  return elements[id];
}

[
  ['equip-select-load', 100000],
  ['equip-select-cfm', 3600],
  ['equip-select-esp', 0],
  ['equip-select-type', 'chiller'],
  ['equip-select-voltage', 380],
  ['equip-select-phase', 3],
  ['equip-select-frequency', 60],
  ['equip-select-market', 'SA'],
  ['equip-select-redundancy', 'none'],
  ['equip-select-max-units', 1],
  ['equip-select-requirement-summary', ''],
  ['equip-select-results', ''],
  ['equip-select-ai', '']
].forEach(([id, value]) => element(id, value));
element('equip-select-verified').checked = false;
element('equip-select-saudi').checked = false;

global.window = global;
global.lang = 'en';
global.document = {
  readyState: 'loading',
  documentElement: { lang: 'en' },
  addEventListener() {},
  getElementById(id) { return elements[id] || null; },
  querySelectorAll() { return []; }
};

let capturedRecords = [];
global.AppEquipmentDatabase = {
  allRecords() {
    return [
      { id: 'air', equipmentType: 'chiller', series: 'Air-Cooled Chiller', exactModelNumber: 'AIR-100', coolingCapacityBtuH: 120000 },
      { id: 'water', equipmentType: 'chiller', series: 'Water-Cooled Chiller', exactModelNumber: 'WATER-100', coolingCapacityBtuH: 120000 }
    ];
  }
};
global.AirCalcEquipmentSelection = {
  selectEquipment(req) {
    capturedRecords = req.records;
    return { requirements: req, recommendedOption: null, recommendationBuckets: [], suitableOptions: [], otherSuitableOptions: [] };
  }
};

vm.runInThisContext(selectorSource, { filename: 'modules/equipment-selector.js' });

global.AppEquipmentSelector.openForProjectSystem({
  target: 'projectSystem',
  systemId: 'sys-1',
  systemUnitType: 'chiller_air',
  equipmentType: 'chiller',
  verifiedDataOnly: false
});
global.AppEquipmentSelector.runSelection();

assert.deepStrictEqual(capturedRecords.map((record) => record.id), ['air'], 'chiller_air selector context should pass only air-cooled chiller records');

global.AppEquipmentSelector.openForProjectSystem({
  target: 'projectSystem',
  systemId: 'sys-1',
  systemUnitType: 'chiller_water',
  equipmentType: 'chiller',
  verifiedDataOnly: false
});
global.AppEquipmentSelector.runSelection();

assert.deepStrictEqual(capturedRecords.map((record) => record.id), ['water'], 'chiller_water selector context should pass only water-cooled chiller records');

console.log('Equipment selector chiller filter tests passed.');

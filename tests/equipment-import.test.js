const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const store = {};

global.window = global;
global.document = { documentElement: { lang: 'en' } };
global.localStorage = {
  getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; }
};

function load(relativePath) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath });
}

load('js/equipment/equipment-schema.js');
load('js/equipment/equipment-import.js');

const Importer = global.AirCalcEquipmentImport;
assert.ok(Importer, 'equipment import module should be exposed');

const csv = [
  'manufacturerId,manufacturerName,exactModelNumber,equipmentType,marketRegion,catalogueRevision,coolingCapacityBtuH,airflowNominalCfm,availableEspPa,voltage,phase,frequencyHz,sourceDocumentName,sourceReference',
  'carrier,Carrier,ABC-060,package,SA,rev-a,60000,2200,250,380,3,60,Carrier catalog,p. 12',
  'carrier,Carrier,ABC-060,package,SA,rev-a,60000,2200,250,380,3,60,Carrier catalog,p. 12',
  'zamil,Zamil,,ahu,SA,rev-b,72000,2600,300,380,3,60,Zamil catalog,p. 8',
  'trane,Trane,TRN-090,ahu,SA,rev-c,-1,3000,300,380,3,60,Trane catalog,p. 4'
].join('\n');

const parsed = Importer.parseCsv(csv);
assert.strictEqual(parsed.ok, true, 'CSV parser should parse valid header');
assert.strictEqual(parsed.rows.length, 4, 'CSV parser should return data rows');

const summary = Importer.validateRows(parsed.rows, []);
assert.strictEqual(summary.totalRows, 4, 'summary should count all rows');
assert.strictEqual(summary.validRows, 1, 'only one row should be valid');
assert.strictEqual(summary.duplicateRows, 1, 'one CSV duplicate should be detected');
assert.ok(
  summary.results.some((row) => row.errors.some((error) => error.includes('exactModelNumber'))),
  'missing required fields should be reported'
);
assert.ok(
  summary.results.some((row) => row.errors.some((error) => error.includes('coolingCapacityBtuH'))),
  'invalid negative capacity should be reported'
);
assert.ok(
  summary.results.some((row) => row.raw && row.raw.exactModelNumber === 'ABC-060'),
  'validation result should keep the original CSV row for rejected-row export'
);

const first = summary.validRecords[0];
assert.strictEqual(first.verificationStatus, 'draft', 'imported records should be draft, not verified');
assert.strictEqual(first.coolingCapacityTR, 5, 'BTU/h should derive TR when not provided');
assert.strictEqual(first.coolingCapacityKw, 17.58, 'BTU/h should derive kW when not provided');
assert.strictEqual(first.availableEspInWg, 1, 'Pa should derive in.w.g. when not provided');

const importResult = Importer.importValidRecords(summary);
assert.strictEqual(importResult.imported, 1, 'only valid rows should be imported');
assert.strictEqual(Importer.readExistingRecords().length, 1, 'storage should contain imported draft record');

const duplicateAgainstExisting = Importer.validateRows([
  {
    lineNumber: 2,
    raw: {
      manufacturerId: 'carrier',
      manufacturerName: 'Carrier',
      exactModelNumber: 'ABC-060',
      equipmentType: 'package',
      marketRegion: 'SA',
      catalogueRevision: 'rev-a',
      coolingCapacityBtuH: '60000'
    }
  }
], Importer.readExistingRecords());
assert.strictEqual(duplicateAgainstExisting.duplicateRows, 1, 'duplicates against existing storage should be detected');

const template = Importer.buildTemplateCsv();
assert.ok(template.includes('manufacturerId'), 'template should include manufacturerId');
assert.ok(template.includes('exactModelNumber'), 'template should include exactModelNumber');
assert.ok(fs.readFileSync(path.join(root, 'EQUIPMENT_IMPORT_TEMPLATE.csv'), 'utf8').includes('manufacturerId'), 'template file should exist');

console.log('Equipment import tests passed.');

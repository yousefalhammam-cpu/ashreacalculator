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
load('js/equipment/equipment-catalogue.js');
load('js/equipment/equipment-import.js');

const Catalogue = global.AirCalcEquipmentCatalogue;
const Importer = global.AirCalcEquipmentImport;
const Schema = global.AirCalcEquipmentSchema;

assert.ok(Catalogue, 'catalogue module should be exposed');

const context = Catalogue.createImportContext({
  manufacturerId: 'carrier',
  manufacturerName: 'Carrier',
  catalogueYear: 2026,
  catalogueRevision: 'rev-a',
  sourceDocumentName: 'Carrier 2026 catalogue.pdf',
  sourceReference: 'catalogue-page-12',
  sourceHash: 'sha256-test-fingerprint'
});

assert.strictEqual(context.catalogue.id, 'carrier-2026-rev-a');
assert.strictEqual(context.version.id, 'carrier-2026-rev-a-rev-a');
assert.strictEqual(context.version.status, 'imported');
assert.strictEqual(context.version.sourceHash, 'sha256-test-fingerprint');

const rows = [
  {
    lineNumber: 2,
    raw: {
      manufacturerId: 'carrier',
      manufacturerName: 'Carrier',
      exactModelNumber: 'ABC-060',
      equipmentType: 'package',
      marketRegion: 'SA',
      catalogueRevision: 'rev-a',
      coolingCapacityBtuH: '60000',
      airflowNominalCfm: '2200',
      availableEspPa: '250'
    }
  }
];

const summary = Importer.validateRows(rows, [], context);
assert.strictEqual(summary.validRows, 1, 'catalogue context should not invalidate rows');
assert.strictEqual(summary.validRecords[0].catalogueId, context.catalogue.id);
assert.strictEqual(summary.validRecords[0].catalogueVersionId, context.version.id);
assert.strictEqual(summary.validRecords[0].sourceDocumentName, 'Carrier 2026 catalogue.pdf');

const duplicateKey = Schema.duplicateKey(summary.validRecords[0]);
assert.ok(duplicateKey.includes(context.version.id), 'duplicate key should use catalogue version when available');

const importResult = Importer.importValidRecords(summary);
assert.strictEqual(importResult.imported, 1);
assert.strictEqual(importResult.catalogue.ok, true);
assert.strictEqual(Catalogue.readCatalogues().length, 1);
assert.strictEqual(Catalogue.readVersions().length, 1);
assert.strictEqual(Catalogue.readVersions()[0].recordCount, 1);

const snapshotRef = Catalogue.snapshotVersionRef(summary.validRecords[0]);
assert.deepStrictEqual(snapshotRef, {
  catalogueId: context.catalogue.id,
  catalogueVersionId: context.version.id,
  catalogueVersionLabel: 'rev-a',
  catalogueYear: 2026,
  sourceDocumentName: 'Carrier 2026 catalogue.pdf',
  sourceReference: 'catalogue-page-12'
});

const pending = Catalogue.transitionRecord(summary.validRecords[0], 'pending_review', { by: 'qa' });
assert.strictEqual(pending.ok, true, 'imported/draft record should move to pending review');
assert.strictEqual(pending.record.verificationStatus, 'pending_review');

const verified = Catalogue.transitionRecord(pending.record, 'verified', { by: 'engineer' });
assert.strictEqual(verified.ok, true, 'pending review record should move to verified');
assert.strictEqual(verified.record.verificationStatus, 'verified');
assert.ok(verified.record.verifiedAt, 'verified record should keep verifiedAt');

const published = Catalogue.transitionRecord(verified.record, 'published', { by: 'admin' });
assert.strictEqual(published.ok, true, 'verified record should move to published');
assert.strictEqual(published.record.verificationStatus, 'published');

const archived = Catalogue.transitionRecord(published.record, 'archived', { by: 'admin' });
assert.strictEqual(archived.ok, true, 'published record should be archivable');
assert.strictEqual(archived.record.verificationStatus, 'archived');
assert.strictEqual(archived.record.workflowHistory.length, 4, 'workflow history should preserve transitions');

const invalidJump = Catalogue.transitionRecord(summary.validRecords[0], 'published', { by: 'qa' });
assert.strictEqual(invalidJump.ok, false, 'imported record should not jump directly to published');

const incompleteQuality = Catalogue.evaluateRecordQuality(Object.assign({}, summary.validRecords[0], {
  coolingCapacityBtuH: null,
  airflowNominalCfm: null,
  sourceDocumentName: '',
  sourceReference: ''
}));
assert.strictEqual(incompleteQuality.ok, false, 'incomplete records should fail catalogue data quality gates');
assert.ok(
  incompleteQuality.findings.some((finding) => finding.field === 'coolingCapacityBtuH' && finding.severity === 'blocker'),
  'missing cooling capacity should be a blocker'
);

const blockedReview = Catalogue.transitionRecord(Object.assign({}, summary.validRecords[0], {
  coolingCapacityBtuH: null
}), 'pending_review', { by: 'qa' });
assert.strictEqual(blockedReview.ok, false, 'records with critical data gaps should not enter review workflow');
assert.ok(Array.isArray(blockedReview.findings), 'blocked transition should return quality findings');

const sampleTransition = Catalogue.transitionRecord(Object.assign({}, summary.validRecords[0], {
  sampleData: true,
  verificationStatus: 'sample'
}), 'verified', { by: 'qa' });
assert.strictEqual(sampleTransition.ok, false, 'sample data must not enter verification workflow');

console.log('Equipment catalogue versioning tests passed.');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

const store = {};
global.window = global;
const elements = {};
global.document = {
  readyState: 'loading',
  documentElement: { lang: 'en' },
  addEventListener() {},
  getElementById(id) { return elements[id] || null; }
};
global.localStorage = {
  getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
  setItem(key, value) { store[key] = String(value); },
  removeItem(key) { delete store[key]; }
};

function load(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInThisContext(source, { filename: relativePath });
}

load('js/equipment/equipment-schema.js');
load('js/equipment/equipment-catalogue.js');
load('data/equipment-manufacturers.js');
load('data/equipment-records.real.js');
load('data/equipment-records.sample.js');
load('modules/equipment-database.js');

assert.ok(global.AirCalcEquipmentSchema, 'equipment schema should be exposed');
assert.ok(global.AppEquipmentDatabase, 'equipment database module should be exposed');

const manufacturers = global.AirCalcEquipmentManufacturers;
assert.strictEqual(manufacturers.length, 23, 'manufacturer registry includes Haier');
assert.ok(manufacturers.some((m) => m.id === 'mitsubishi-heavy-industries'), 'manufacturer ids should be normalized');
assert.ok(manufacturers.every((m) => m.verifiedModelCount === 0), 'registry names alone must not imply verified models');

const hiddenRecords = global.AppEquipmentDatabase.allRecords();
assert.strictEqual(hiddenRecords.length, 164, 'real equipment seed records should be available by default');
assert.ok(hiddenRecords.every((record) => !record.sampleData), 'sample equipment records should be hidden by default');
assert.ok(hiddenRecords.some((record) => record.exactModelNumber === 'UAYN350AFY1A'), 'real Daikin seed records should be loaded');

global.localStorage.setItem('aircalc_show_sample_equipment', '1');
const visibleRecords = global.AppEquipmentDatabase.allRecords();
assert.strictEqual(visibleRecords.length, 166, 'sample equipment records should be appended only when explicitly enabled');
assert.strictEqual(visibleRecords.filter((record) => record.sampleData).length, 2, 'sample records should be clearly marked');
assert.ok(
  visibleRecords.filter((record) => record.sampleData).every((record) => record.sourceDocumentName.includes('SAMPLE DATA')),
  'sample source should prevent accidental engineering selection'
);

const first = visibleRecords.filter((record) => record.sampleData)[0];
const validation = global.AirCalcEquipmentSchema.validateEquipmentRecord(first);
assert.strictEqual(validation.ok, true, 'sample records should still satisfy schema shape');

const duplicateA = global.AirCalcEquipmentSchema.duplicateKey(first);
const duplicateB = global.AirCalcEquipmentSchema.duplicateKey({
  manufacturerId: first.manufacturerId.toUpperCase(),
  exactModelNumber: first.exactModelNumber,
  marketRegion: first.marketRegion,
  catalogueRevision: first.catalogueRevision
});
assert.strictEqual(duplicateA, duplicateB, 'duplicate key should be stable and case-insensitive');

const missingValue = global.AirCalcEquipmentSchema.displayValue(null, 'en');
assert.strictEqual(missingValue, 'Not provided', 'missing equipment values must not be displayed as zero');

const storedDraft = Object.assign({}, first, {
  id: 'stored-draft-1',
  sampleData: false,
  verificationStatus: 'draft',
  sourceDocumentName: 'Verified import candidate'
});
global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([storedDraft]));
const toReview = global.AppEquipmentDatabase.updateRecordStatus('stored-draft-1', 'pending_review');
assert.strictEqual(toReview.ok, true, 'stored draft should move to pending review');
assert.strictEqual(global.AppEquipmentDatabase.allRecords()[0].verificationStatus, 'pending_review');
const toVerified = global.AppEquipmentDatabase.updateRecordStatus('stored-draft-1', 'verified');
assert.strictEqual(toVerified.ok, true, 'pending review record should move to verified');
assert.strictEqual(global.AppEquipmentDatabase.allRecords()[0].verificationStatus, 'verified');
const toPublished = global.AppEquipmentDatabase.updateRecordStatus('stored-draft-1', 'published');
assert.strictEqual(toPublished.ok, true, 'verified record should move to published');
assert.strictEqual(global.AppEquipmentDatabase.allRecords()[0].verificationStatus, 'published');

global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([Object.assign({}, first, { id: 'stored-sample-1', sampleData: true, verificationStatus: 'sample' })]));
const sampleUpdate = global.AppEquipmentDatabase.updateRecordStatus('stored-sample-1', 'verified');
assert.strictEqual(sampleUpdate.ok, false, 'sample record should not be verified from the database workflow');

global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([Object.assign({}, storedDraft, {
  id: 'stored-incomplete-1',
  verificationStatus: 'draft',
  coolingCapacityBtuH: null
})]));
const blockedQualityUpdate = global.AppEquipmentDatabase.updateRecordStatus('stored-incomplete-1', 'pending_review');
assert.strictEqual(blockedQualityUpdate.ok, false, 'database workflow should block records with critical catalogue data gaps');
assert.ok(
  blockedQualityUpdate.findings.some((finding) => finding.field === 'coolingCapacityBtuH'),
  'blocked database workflow should return the failing quality field'
);

elements['equip-review-queue'] = { innerHTML: '' };
elements['equip-conflict-review'] = { innerHTML: '' };
elements['equip-version-compare'] = { innerHTML: '' };
elements['equip-results'] = { innerHTML: '' };
elements['equip-filter-status'] = { value: 'all', dataset: {}, addEventListener() {} };
elements['equip-detail-body'] = { innerHTML: '' };
elements['equip-detail-modal'] = { classList: { added: [], add(value) { this.added.push(value); }, remove() {} } };
global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([
  Object.assign({}, storedDraft, { id: 'review-draft-1', verificationStatus: 'draft' }),
  Object.assign({}, storedDraft, { id: 'review-pending-1', exactModelNumber: 'PENDING-1', verificationStatus: 'pending_review' }),
  Object.assign({}, first, { id: 'review-sample-1', sampleData: true, verificationStatus: 'sample' })
]));
global.AppEquipmentDatabase.render();
assert.ok(elements['equip-review-queue'].innerHTML.includes('Send to review'), 'review queue should render next action for imported records');
assert.ok(elements['equip-review-queue'].innerHTML.includes('Verify'), 'review queue should render next action for pending records');
assert.ok(elements['equip-review-queue'].innerHTML.includes('equip-review-note'), 'review queue should render reviewer note input');
assert.ok(!elements['equip-review-queue'].innerHTML.includes('review-sample-1'), 'review queue should exclude sample data');

const noteUpdate = global.AppEquipmentDatabase.updateRecordReviewNote('review-pending-1', 'Check ESP table');
assert.strictEqual(noteUpdate.ok, true, 'reviewer note should be saved on the selected record');
assert.strictEqual(
  global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'review-pending-1').reviewerNote,
  'Check ESP table',
  'reviewer note should survive schema normalization'
);

const rejectedCsv = global.AppEquipmentDatabase.buildRejectedRowsCsv({
  results: [
    {
      lineNumber: 4,
      ok: false,
      duplicateType: 'file',
      errors: ['Duplicate row in CSV file.'],
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
  ]
});
assert.ok(rejectedCsv.includes('Duplicate row in CSV file.'), 'rejected CSV should include validation errors');
assert.ok(rejectedCsv.includes('ABC-060'), 'rejected CSV should include rejected model number');

const versionCompare = global.AppEquipmentDatabase.compareCatalogueVersions('rev-a', 'rev-b', [
  Object.assign({}, storedDraft, {
    id: 'version-a-same',
    catalogueRevision: 'rev-a',
    catalogueVersionId: 'rev-a',
    exactModelNumber: 'SAME-024',
    coolingCapacityBtuH: 24000,
    airflowNominalCfm: 800,
    availableEspPa: 100
  }),
  Object.assign({}, storedDraft, {
    id: 'version-b-same',
    catalogueRevision: 'rev-b',
    catalogueVersionId: 'rev-b',
    exactModelNumber: 'SAME-024',
    coolingCapacityBtuH: 24000,
    airflowNominalCfm: 850,
    availableEspPa: 100
  }),
  Object.assign({}, storedDraft, {
    id: 'version-a-removed',
    catalogueRevision: 'rev-a',
    catalogueVersionId: 'rev-a',
    exactModelNumber: 'OLD-018'
  }),
  Object.assign({}, storedDraft, {
    id: 'version-b-added',
    catalogueRevision: 'rev-b',
    catalogueVersionId: 'rev-b',
    exactModelNumber: 'NEW-036'
  })
]);
assert.strictEqual(versionCompare.changed.length, 1, 'version comparison should detect changed engineering fields');
assert.strictEqual(versionCompare.added.length, 1, 'version comparison should detect added models');
assert.strictEqual(versionCompare.removed.length, 1, 'version comparison should detect removed models');

global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([
  Object.assign({}, storedDraft, {
    id: 'cloud-local-1',
    exactModelNumber: 'CLD-024',
    coolingCapacityBtuH: 24000,
    sampleData: false
  })
]));
const cloudMerge = global.AppEquipmentDatabase.mergeCloudEquipmentRecords([
  Object.assign({}, storedDraft, {
    id: 'cloud-local-1',
    exactModelNumber: 'CLD-024',
    coolingCapacityBtuH: 30000,
    sampleData: false
  }),
  Object.assign({}, storedDraft, {
    id: 'cloud-new-1',
    exactModelNumber: 'CLD-036',
    coolingCapacityBtuH: 36000,
    sampleData: false
  }),
  Object.assign({}, first, {
    id: 'cloud-sample-1',
    sampleData: true
  })
]);
assert.strictEqual(cloudMerge.imported, 1, 'cloud import should add missing non-sample records');
assert.strictEqual(cloudMerge.conflicts, 1, 'cloud import should mark differing existing records as conflicts');
const mergedRecords = global.AppEquipmentDatabase.allRecords();
assert.strictEqual(mergedRecords.find((r) => r.id === 'cloud-local-1').coolingCapacityBtuH, 24000, 'cloud import must not overwrite local records automatically');
assert.ok(mergedRecords.find((r) => r.id === 'cloud-local-1').cloudConflict, 'cloud import should mark local conflict');
assert.ok(!mergedRecords.some((r) => r.id === 'cloud-sample-1'), 'cloud import should ignore sample records');
assert.ok(global.AppEquipmentDatabase.filteredRecords()[0].cloudConflictRecord, 'conflict should retain cloud copy for explicit resolution');
global.AppEquipmentDatabase.render();
assert.ok(elements['equip-conflict-review'].innerHTML.includes('Catalogue') || elements['equip-conflict-review'].innerHTML.includes('Conflict'), 'conflict review should render conflicts');
assert.ok(elements['equip-conflict-review'].innerHTML.includes('Keep Local'), 'conflict review should expose keep-local action');
global.AppEquipmentDatabase.setConflictFilter();
assert.strictEqual(elements['equip-filter-status'].value, 'cloud_conflict', 'conflict filter action should select cloud_conflict status');
assert.ok(global.AppEquipmentDatabase.filteredRecords().every((record) => record.cloudConflict), 'cloud_conflict filter should return only conflicts');

global.AppEquipmentDatabase.openDetails('cloud-local-1');
assert.ok(elements['equip-detail-body'].innerHTML.includes('Cloud Conflict Preview'), 'details should render a conflict preview before resolution');
assert.ok(elements['equip-detail-body'].innerHTML.includes('Local'), 'conflict preview should label local values');
assert.ok(elements['equip-detail-body'].innerHTML.includes('Cloud'), 'conflict preview should label cloud values');
assert.ok(elements['equip-detail-body'].innerHTML.includes('24000'), 'conflict preview should show the local capacity');
assert.ok(elements['equip-detail-body'].innerHTML.includes('30000'), 'conflict preview should show the cloud capacity');

const keepLocal = global.AppEquipmentDatabase.resolveCloudConflict('cloud-local-1', 'keep_local');
assert.strictEqual(keepLocal.ok, true, 'keep-local conflict resolution should succeed');
assert.strictEqual(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-local-1').coolingCapacityBtuH, 24000, 'keep-local should preserve local values');
assert.strictEqual(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-local-1').cloudConflict, false, 'keep-local should clear conflict flag');
assert.ok(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-local-1').workflowHistory.some((item) => item.to === 'keep_local'), 'keep-local should be written to workflow history');

global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([
  Object.assign({}, storedDraft, {
    id: 'cloud-local-2',
    exactModelNumber: 'CLD-060',
    coolingCapacityBtuH: 60000,
    sampleData: false,
    cloudConflict: true,
    cloudConflictRecord: Object.assign({}, storedDraft, {
      id: 'cloud-local-2',
      exactModelNumber: 'CLD-060',
      coolingCapacityBtuH: 72000,
      sampleData: false
    })
  })
]));
const useCloud = global.AppEquipmentDatabase.resolveCloudConflict('cloud-local-2', 'use_cloud');
assert.strictEqual(useCloud.ok, true, 'use-cloud conflict resolution should succeed');
assert.strictEqual(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-local-2').coolingCapacityBtuH, 72000, 'use-cloud should apply cloud values only after explicit command');
assert.strictEqual(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-local-2').cloudConflict, false, 'use-cloud should clear conflict flag');
assert.ok(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-local-2').workflowHistory.some((item) => item.to === 'use_cloud'), 'use-cloud should be written to workflow history');

global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([
  Object.assign({}, storedDraft, {
    id: 'cloud-batch-1',
    exactModelNumber: 'CLD-B1',
    coolingCapacityBtuH: 18000,
    sampleData: false,
    cloudConflict: true,
    cloudConflictRecord: Object.assign({}, storedDraft, { id: 'cloud-batch-1', exactModelNumber: 'CLD-B1', coolingCapacityBtuH: 24000, sampleData: false })
  }),
  Object.assign({}, storedDraft, {
    id: 'cloud-batch-2',
    exactModelNumber: 'CLD-B2',
    coolingCapacityBtuH: 30000,
    sampleData: false,
    cloudConflict: true,
    cloudConflictRecord: Object.assign({}, storedDraft, { id: 'cloud-batch-2', exactModelNumber: 'CLD-B2', coolingCapacityBtuH: 36000, sampleData: false })
  })
]));
elements['equip-filter-status'].value = 'all';
const batchKeepLocal = global.AppEquipmentDatabase.resolveConflictBatchKeepLocal();
assert.strictEqual(batchKeepLocal.updated, 2, 'batch conflict review should keep local for all conflicts');
assert.ok(global.AppEquipmentDatabase.allRecords().every((record) => !record.cloudConflict), 'batch keep-local should clear all conflict flags');
assert.strictEqual(global.AppEquipmentDatabase.allRecords().find((r) => r.id === 'cloud-batch-1').coolingCapacityBtuH, 18000, 'batch keep-local must preserve local engineering values');

global.localStorage.setItem('aircalc_equipment_records', JSON.stringify([
  Object.assign({}, storedDraft, { id: 'review-draft-1', verificationStatus: 'draft' }),
  Object.assign({}, storedDraft, { id: 'review-pending-1', exactModelNumber: 'PENDING-1', verificationStatus: 'pending_review' }),
  Object.assign({}, first, { id: 'review-sample-1', sampleData: true, verificationStatus: 'sample' })
]));

const batch = global.AppEquipmentDatabase.advanceReviewBatch('imported');
assert.strictEqual(batch.updated, 1, 'batch action should advance imported records only');
const afterBatch = global.AppEquipmentDatabase.allRecords();
assert.strictEqual(afterBatch.find((r) => r.id === 'review-draft-1').verificationStatus, 'pending_review');
assert.strictEqual(afterBatch.find((r) => r.id === 'review-sample-1').verificationStatus, 'sample');

const indexHtml = fs.readFileSync(path.join(root, 'app/index.html'), 'latin1');
assert.ok(indexHtml.includes('id="p-equipment"'), 'Equipment Database panel should be present');
assert.ok(indexHtml.includes('modules/equipment-database.js'), 'Equipment Database module should be loaded by index.html');
assert.ok(indexHtml.includes('js/equipment/equipment-catalogue.js'), 'Equipment catalogue module should be loaded by index.html');
assert.ok(indexHtml.includes('js/equipment/equipment-import.js'), 'Equipment import module should be loaded by index.html');
assert.ok(indexHtml.includes('js/equipment/equipment-selection-engine.js'), 'Equipment selection engine should be loaded by index.html');
assert.ok(indexHtml.includes('data/equipment-manufacturers.js'), 'manufacturer registry data should be loaded by index.html');
assert.ok(indexHtml.includes('id="equip-import-file"'), 'CSV import file input should be present');
assert.ok(indexHtml.includes('id="equip-review-queue"'), 'Catalogue Review Queue should be present');
assert.ok(indexHtml.includes('id="equip-conflict-review"'), 'Catalogue Conflict Review should be present');
assert.ok(indexHtml.includes('value="cloud_conflict"'), 'Cloud conflict filter option should be present');
assert.ok(indexHtml.includes('id="equip-version-compare"'), 'Catalogue Version Comparison section should be present');
assert.ok(indexHtml.includes('id="equip-cloud-import-btn"'), 'Cloud catalogue import button should be present');

console.log('Equipment Database MVP tests passed.');

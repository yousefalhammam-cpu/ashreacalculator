const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const firebaseAuth = fs.readFileSync(path.join(root, 'js', 'firebase-auth.js'), 'utf8');
const equipmentDb = fs.readFileSync(path.join(root, 'modules', 'equipment-database.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app', 'index.html'), 'latin1');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'CLOUD_SYNC_FOUNDATION.md'), 'utf8');

function includes(source, needle, message) {
  assert(source.includes(needle), message || `Expected source to include: ${needle}`);
}

includes(firebaseAuth, 'async function saveEquipmentCatalogueToCloud', 'Firebase layer should save equipment catalogue data.');
includes(firebaseAuth, 'async function loadEquipmentCatalogueFromCloud', 'Firebase layer should load equipment catalogue data.');
includes(firebaseAuth, "docFn(db, 'users', currentUser.uid, 'equipmentCatalogues', id)", 'Catalogues should be scoped under the signed-in user.');
includes(firebaseAuth, "docFn(db, 'users', currentUser.uid, 'equipmentCatalogueVersions', id)", 'Catalogue versions should be scoped under the signed-in user.');
includes(firebaseAuth, "docFn(db, 'users', currentUser.uid, 'equipmentRecords', id)", 'Equipment records should be scoped under the signed-in user.');
includes(firebaseAuth, 'if(!id || record.sampleData) continue;', 'Sample equipment records should not be uploaded.');
includes(firebaseAuth, 'saveEquipmentCatalogueToCloud,', 'Catalogue save should be exposed through AppAuth.');
includes(firebaseAuth, 'loadEquipmentCatalogueFromCloud,', 'Catalogue load should be exposed through AppAuth.');

includes(equipmentDb, 'function readCatalogueStoreForCloud', 'Equipment DB should build a cloud payload from local catalogue data.');
includes(equipmentDb, 'function syncCatalogueToCloud', 'Equipment DB should expose catalogue cloud sync.');
includes(equipmentDb, 'function importCloudCatalogue', 'Equipment DB should expose cloud catalogue import.');
includes(equipmentDb, 'function mergeCloudEquipmentRecords', 'Equipment DB should merge cloud records safely.');
includes(equipmentDb, 'function resolveCloudConflict', 'Equipment DB should expose explicit conflict resolution.');
includes(equipmentDb, 'function buildConflictDiff', 'Equipment DB should build field-by-field conflict differences.');
includes(equipmentDb, 'function renderConflictPreview', 'Equipment DB should render conflict preview before resolution.');
includes(equipmentDb, 'function renderConflictReview', 'Equipment DB should render a batch conflict review panel.');
includes(equipmentDb, 'function resolveConflictBatchKeepLocal', 'Equipment DB should support safe batch keep-local conflict review.');
includes(equipmentDb, 'function setConflictFilter', 'Equipment DB should expose a conflict-only filter action.');
includes(equipmentDb, 'Cloud Conflict Preview', 'Conflict preview should have a clear reviewer-facing title.');
includes(equipmentDb, 'keep_local', 'Conflict resolution should support keeping the local record.');
includes(equipmentDb, 'use_cloud', 'Conflict resolution should support applying the cloud record.');
includes(equipmentDb, 'scheduleCatalogueCloudSync()', 'Catalogue changes should schedule background sync.');
includes(equipmentDb, 'aircalc_equipment_catalogue_sync_status', 'Catalogue sync status should be stored locally.');
includes(equipmentDb, 'cloudConflictRecord', 'Cloud record conflicts should preserve the cloud copy for review.');
includes(equipmentDb, 'Resolved catalogue conflict using cloud record.', 'Conflict resolution should be recorded in workflow history.');

includes(index, 'id="equip-cloud-sync-btn"', 'Equipment Database should include a manual catalogue sync button.');
includes(index, 'id="equip-cloud-import-btn"', 'Equipment Database should include a manual cloud import button.');
includes(index, 'id="equip-conflict-review"', 'Equipment Database should include a catalogue conflict review section.');
includes(index, 'value="cloud_conflict"', 'Equipment Database should include a cloud-conflict filter option.');
includes(index, 'id="equip-catalogue-sync-status"', 'Equipment Database should include a catalogue sync status indicator.');
includes(styles, '.equip-cloud-sync-status', 'Catalogue sync status should have UI styling.');
includes(styles, '.equip-conflict-banner', 'Cloud conflicts should have visible styling.');
includes(styles, '.equip-conflict-diff-table', 'Field-by-field conflict preview should have table styling.');
includes(styles, '.equip-conflict-review-row', 'Batch conflict review rows should have visible styling.');
includes(styles, '.equip-actions .equip-conflict-cloud', 'Use-cloud action should have visible styling.');

includes(rules, 'match /equipmentCatalogues/{catalogueId}', 'Firestore rules should protect catalogue documents.');
includes(rules, 'match /equipmentCatalogueVersions/{versionId}', 'Firestore rules should protect catalogue version documents.');
includes(rules, 'match /equipmentRecords/{recordId}', 'Firestore rules should protect equipment record documents.');

includes(docs, 'users/{uid}/equipmentCatalogues/{catalogueId}', 'Cloud sync docs should document catalogue storage.');
includes(docs, 'Sample data is never uploaded', 'Cloud sync docs should document sample-data safety.');
includes(docs, 'Background sync is attempted after CSV import', 'Cloud sync docs should document background sync triggers.');
includes(docs, 'Local records are never overwritten automatically by cloud import', 'Cloud import docs should preserve local-first safety.');

console.log('Equipment catalogue cloud sync audit passed.');

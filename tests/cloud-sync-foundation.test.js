const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const firebaseAuth = fs.readFileSync(path.join(root, 'js', 'firebase-auth.js'), 'utf8');
const projects = fs.readFileSync(path.join(root, 'modules', 'projects.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'app', 'index.html'), 'latin1');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'CLOUD_SYNC_FOUNDATION.md'), 'utf8');

function includes(source, needle, message) {
  assert(source.includes(needle), message || `Expected source to include: ${needle}`);
}

function excludes(source, needle, message) {
  assert(!source.includes(needle), message || `Expected source not to include: ${needle}`);
}

includes(firebaseAuth, "collectionFn = fsMod.collection", 'Firestore collection helper should be loaded.');
includes(firebaseAuth, "getDocsFn = fsMod.getDocs", 'Firestore getDocs helper should be loaded.');
includes(firebaseAuth, "docFn(db, 'users', currentUser.uid, 'projects', cloudId)", 'Projects should be scoped under the signed-in user.');
includes(firebaseAuth, "ownerId: currentUser.uid", 'Cloud payload should store the owner uid.');
includes(firebaseAuth, 'role: PROJECT_ROLES.OWNER', 'Cloud payload should prepare collaboration role metadata.');
includes(firebaseAuth, 'projectUrl', 'Cloud payload should store a stable project URL when available.');
excludes(firebaseAuth, "reason:'coming_soon'", 'Cloud save should no longer return the coming_soon placeholder.');

includes(projects, 'syncStatus', 'Local project records should track sync status.');
includes(projects, 'lastSyncedAt', 'Local project records should track last successful cloud sync.');
includes(projects, 'cloudId', 'Local project records should retain the cloud document id.');
includes(projects, 'window.AppAuth.saveProjectToCloud', 'Local save should attempt AppAuth cloud sync.');
includes(projects, 'opts.skipCloudSync', 'Cloud sync should be explicitly skippable for safe internal flows.');
includes(projects, "syncProjectToCloud: _syncProjectToCloud", 'Cloud sync helper should be exposed through AppProjects.');
includes(projects, 'AUTO_SAVE_DELAY_MS', 'Project autosave should use an explicit debounce delay.');
includes(projects, 'function scheduleAutoSave', 'Project autosave should expose a scheduler.');
includes(projects, 'function autoSaveCurrentProject', 'Project autosave should be separated from manual save.');
includes(projects, 'if (!curId) return false;', 'Autosave should not create new projects without an active project.');
includes(projects, 'function importMissingCloudProjects', 'Cloud import should have a dedicated reconciliation entry point.');
includes(projects, 'cloudConflict', 'Cloud conflicts should be marked instead of overwriting local projects.');
includes(projects, 'cloudConflictProject', 'Conflict records should keep the cloud copy for explicit restore.');
includes(projects, 'function refreshCloudProjects', 'Users should have an explicit cloud refresh action.');
includes(projects, 'function resolveCloudConflict', 'Users should have an explicit conflict resolution action.');
includes(projects, "resolveCloudConflict(\\'' + proj.id + '\\',\\'keep_local\\')", 'Project cards should expose keep-local conflict resolution.');
includes(projects, "resolveCloudConflict(\\'' + proj.id + '\\',\\'restore_cloud\\')", 'Project cards should expose restore-cloud conflict resolution.');
includes(projects, 'importMissingCloudProjects({ silent:true })', 'Opening the dashboard should quietly import missing cloud projects.');

includes(index, 'id="pm-cloud-refresh-btn"', 'Project dashboard should include a cloud refresh button.');
includes(index, 'modules/projects.js?v=20260915a', 'Index should load the cache-busted projects module.');
includes(index, 'firebase-auth.js?v=20260915c', 'Index should load the cache-busted Firebase auth module.');
includes(index, 'styles.css?v=20261001a', 'Index should load the cache-busted stylesheet.');

includes(styles, '.pm-card-actions.conflict', 'Conflict actions should have a distinct visual grouping.');
includes(styles, '.pm-act-btn.cloud-restore', 'Restore-cloud action should have a distinct style.');

includes(docs, 'local-first cloud sync foundation', 'Cloud sync documentation should describe the phase scope.');
includes(docs, 'users/{uid}/projects/{projectId}', 'Cloud sync documentation should document the Firestore shape.');
includes(docs, 'Conflict resolution is not automated yet', 'Cloud sync documentation should identify the remaining conflict work.');
includes(docs, 'Never overwrite a local project from cloud automatically', 'Cloud sync documentation should preserve local-first conflict safety.');
includes(docs, '`Keep Local` keeps the local copy', 'Cloud sync documentation should explain keeping the local copy.');
includes(docs, '`Restore Cloud` replaces the local snapshot only after user confirmation', 'Cloud sync documentation should explain restoring the cloud copy.');

console.log('Cloud sync foundation audit passed.');






const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const firebaseAuth = fs.readFileSync(path.join(root, 'js', 'firebase-auth.js'), 'utf8');
const projects = fs.readFileSync(path.join(root, 'modules', 'projects.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const firebaseJson = fs.readFileSync(path.join(root, 'firebase.json'), 'utf8');
const indexes = fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'COLLABORATION_FOUNDATION.md'), 'utf8');

function includes(source, needle, message) {
  assert(source.includes(needle), message || `Expected source to include: ${needle}`);
}

includes(firebaseAuth, 'PROJECT_ROLES', 'Firebase layer should define canonical project roles.');
includes(firebaseAuth, "OWNER: 'owner'", 'Owner role should be explicit.');
includes(firebaseAuth, "EDITOR: 'editor'", 'Editor role should be explicit.');
includes(firebaseAuth, "VIEWER: 'viewer'", 'Viewer role should be explicit.');
includes(firebaseAuth, 'normalizeProjectRole', 'Firebase layer should normalize project roles.');
includes(firebaseAuth, 'canEditProjectRole', 'Firebase layer should expose edit permission helper.');
includes(firebaseAuth, 'window.AppProjectRoles', 'Role helpers should be available to app modules.');
includes(firebaseAuth, 'collaboration', 'Cloud payload should persist collaboration metadata.');
includes(firebaseAuth, '[currentUser.uid]: PROJECT_ROLES.OWNER', 'Signed-in saver should be recorded as owner.');
includes(firebaseAuth, 'function normalizeCollaborationRoles', 'Firebase layer should normalize collaboration role maps.');
includes(firebaseAuth, 'async function publishSharedProject', 'Firebase layer should publish shared project documents.');
includes(firebaseAuth, 'async function updateSharedProjectRole', 'Firebase layer should update shared project roles.');
includes(firebaseAuth, "docFn(db, 'sharedProjects', projectId)", 'Shared projects should use the reserved sharedProjects collection.');
includes(firebaseAuth, 'owner_required', 'Shared role updates should require owner permissions.');

includes(projects, 'function _canEditProject', 'Project module should gate editing by role.');
includes(projects, 'function _canManageProject', 'Project module should gate owner-only actions.');
includes(projects, 'function _roleLabel', 'Project cards should render role labels.');
includes(projects, 'async function publishProjectForCollaboration', 'Project module should expose collaboration publishing.');
includes(projects, 'async function setProjectCollaboratorRole', 'Project module should expose collaborator role updates.');
includes(projects, 'Your role cannot edit this project', 'Viewer saves should be blocked.');
includes(projects, 'Only the owner can delete this project', 'Delete should be owner-only.');
includes(projects, 'Only the owner can duplicate this project', 'Duplicate should be owner-only.');
includes(projects, 'cloudConflict && canEdit', 'Only edit-capable roles should resolve cloud conflicts.');

includes(rules, "rules_version = '2';", 'Firestore rules should declare rules v2.');
includes(rules, 'match /users/{userId}', 'Rules should protect user private documents.');
includes(rules, 'match /projects/{projectId}', 'Rules should protect private user projects.');
includes(rules, 'match /sharedProjects/{projectId}', 'Rules should reserve the future shared project collection.');
includes(rules, "projectRole(project) in ['owner', 'editor', 'viewer']", 'Shared read rules should allow all collaboration roles.');
includes(rules, "projectRole(project) in ['owner', 'editor']", 'Shared edit rules should allow owner/editor.');
includes(rules, "projectRole(project) == 'owner'", 'Shared manage rules should require owner.');
includes(rules, 'function ownerRemainsOwner()', 'Rules should prevent removing the original owner role.');

includes(firebaseJson, '"rules": "firestore.rules"', 'Firebase config should point to Firestore rules.');
includes(firebaseJson, '"indexes": "firestore.indexes.json"', 'Firebase config should point to Firestore indexes.');
includes(indexes, '"indexes": []', 'Firestore indexes file should be present even when empty.');

includes(docs, '`owner`: can view, edit, duplicate, delete, and manage the project.', 'Collaboration docs should define owner.');
includes(docs, '`editor`: can view and edit project content.', 'Collaboration docs should define editor.');
includes(docs, '`viewer`: can view reports and project content without modifying saved data.', 'Collaboration docs should define viewer.');
includes(docs, 'No HVAC calculation formulas were changed', 'Collaboration docs should state calculation safety.');
includes(docs, '`firebase.json` and `firestore.indexes.json` are included', 'Collaboration docs should mention deployment files.');

console.log('Collaboration foundation audit passed.');

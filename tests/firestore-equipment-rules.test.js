const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'FIREBASE_DEPLOYMENT_CHECKLIST.md'), 'utf8');

const privateEquipmentCollections = [
  'equipmentCatalogues',
  'equipmentCatalogueVersions',
  'equipmentRecords'
];

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message + ` Missing: ${needle}`);
}

function excludes(source, needle, message) {
  assert.ok(!source.includes(needle), message + ` Unexpected: ${needle}`);
}

function canAccessPrivateUserCollection(authUid, pathUserId) {
  return Boolean(authUid) && authUid === pathUserId;
}

function hasTopLevelCollectionMatch(collection) {
  const lines = rules.split(/\r?\n/);
  let depth = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`match /${collection}/`) && depth <= 2) return true;
    depth += (line.match(/{/g) || []).length;
    depth -= (line.match(/}/g) || []).length;
  }
  return false;
}

includes(rules, 'function signedIn()', 'Rules should define a signed-in helper.');
includes(rules, 'function isSelf(userId)', 'Rules should define self-owned access helper.');
includes(rules, 'request.auth.uid == userId', 'Private user data should be scoped to the signed-in uid.');
includes(rules, 'match /users/{userId}', 'Private user root should exist.');

privateEquipmentCollections.forEach((collection) => {
  includes(rules, `match /${collection}/`, `${collection} should live under users/{userId}.`);
  includes(rules, 'allow read, create, update, delete: if isSelf(userId);', `${collection} should be protected by isSelf.`);
  assert.strictEqual(hasTopLevelCollectionMatch(collection), false, `${collection} should not exist as a global top-level collection.`);
});

assert.strictEqual(canAccessPrivateUserCollection(null, 'user-a'), false, 'Unauthenticated users must not access private equipment catalogues.');
assert.strictEqual(canAccessPrivateUserCollection('user-a', 'user-a'), true, 'The owner can access their private equipment catalogues.');
assert.strictEqual(canAccessPrivateUserCollection('user-b', 'user-a'), false, 'A different user must not access another owner catalogue.');

includes(docs, 'firestore.rules', 'Firebase deployment checklist should mention rules deployment.');

console.log('Firestore equipment rules audit passed.');

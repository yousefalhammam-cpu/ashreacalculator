const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/copilot/copilot-review-store.js'), 'utf8');
const storage = {};
const sandbox = {
  window: {},
  globalThis: {},
  console,
  localStorage: {
    getItem: (key) => Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null,
    setItem: (key, value) => { storage[key] = String(value); }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.ok(sandbox.AirCalcCopilotReviewStore, 'review store should be exposed');
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.readAll().length, 0);

const saved = sandbox.AirCalcCopilotReviewStore.save({
  identity: { projectKey: 'clinic-q001', projectName: 'Clinic' },
  projectHealth: 88,
  confidence: 76,
  totals: { requiredBtu: 70000, selectedBtu: 75600 },
  metrics: [{ key: 'capacity', score: 95 }],
  recommendations: [{ title: 'Review oversizing' }],
  scenarios: [{ label: 'A' }]
});

assert.ok(saved.id.startsWith('review-'));
assert.strictEqual(saved.sourceOfTruth, 'rules_engine');
assert.strictEqual(saved.aiGeneratedNumbers, false);
assert.strictEqual(saved.projectKey, 'clinic-q001');
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.latest('clinic-q001').projectHealth, 88);
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.readAll('clinic-q001').length, 1);

sandbox.AirCalcCopilotReviewStore.save({ identity: { projectKey: 'clinic-q001' }, projectHealth: 72, totals: { requiredBtu: 65000, selectedBtu: 72000 } });
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.latest('clinic-q001').projectHealth, 72);
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.previous('clinic-q001').projectHealth, 88);

sandbox.AirCalcCopilotReviewStore.save({ identity: { projectKey: 'office-q002' }, projectHealth: 91 });
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.readAll('clinic-q001').length, 2);
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.readAll('office-q002').length, 1);

const summary = sandbox.AirCalcCopilotReviewStore.summarize('clinic-q001');
assert.strictEqual(summary.count, 2);
assert.strictEqual(summary.sourceOfTruth, 'rules_engine');
assert.strictEqual(summary.aiGeneratedNumbers, false);

const exported = sandbox.AirCalcCopilotReviewStore.exportProject('clinic-q001');
assert.strictEqual(exported.schemaVersion, 'copilot-review-export-v1');
assert.strictEqual(exported.projectKey, 'clinic-q001');
assert.strictEqual(exported.snapshots.length, 2);

sandbox.AirCalcCopilotReviewStore.importProject(exported, 'imported-q003');
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.readAll('imported-q003').length, 2);
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.latest('imported-q003').projectKey, 'imported-q003');

sandbox.AirCalcCopilotReviewStore.clear();
assert.strictEqual(sandbox.AirCalcCopilotReviewStore.readAll().length, 0);

console.log('copilot-review-store.test.js passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/copilot/copilot-ai-adapter.js'), 'utf8');
const sandbox = { window: {}, globalThis: {}, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.ok(sandbox.AirCalcCopilotAIAdapter, 'Copilot AI adapter should be exposed');

const report = {
  title: 'HVAC Engineering Review Report',
  projectHealth: 82,
  confidence: 79,
  totals: { requiredBtu: 70000, selectedBtu: 75600, requiredCfm: 2500, selectedCfm: 3500 },
  metrics: [{ key: 'capacity', score: 95, tone: 'green' }],
  recommendations: [{ priority: 'warning', title: 'Review oversizing', reason: 'Selected capacity is above required load.' }],
  scenarios: [{ label: 'A', capacityBtu: 73500, cfm: 3500, engineeringScore: 88 }],
  decisionExplanation: { basis: ['Required load: 70000 BTU/h'] }
};

const context = sandbox.AirCalcCopilotAIAdapter.buildContext(report);
assert.strictEqual(context.sourceOfTruth, 'rules_engine');
assert.strictEqual(context.aiRole, 'explain_only');
assert.strictEqual(require('../server/ai-explanation-service').validateContext(context).ok, true);
assert.strictEqual(context.constraints.mustNotGenerateEngineeringNumbers, true);
assert.strictEqual(context.constraints.mustNotSelectEquipment, true);
assert.strictEqual(context.projectHealth, 82);

sandbox.AirCalcCopilotAIAdapter.summarizeReview(report, { forceFailure: true }).then((summary) => {
  assert.strictEqual(summary.ok, true);
  assert.strictEqual(summary.fallback, true);
  assert.strictEqual(summary.sourceOfTruth, 'rules_engine');
  assert.strictEqual(summary.aiGeneratedNumbers, false);
  assert.ok(summary.summary.includes('82/100'));
  console.log('copilot-ai-adapter.test.js passed');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

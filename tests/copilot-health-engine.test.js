const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/copilot/copilot-health-engine.js'), 'utf8');
assert.ok(source.includes("if(score >= 65) return 'blue';"), 'mid-range health tone should be blue for good.');
assert.ok(!source.includes("return 'yellow'"), 'health tones should not return yellow.');
const sandbox = { window: {}, globalThis: {}, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

assert.ok(sandbox.AirCalcCopilotHealthEngine, 'Copilot health engine should be exposed');

const snapshot = {
  sourceOfTruth: 'rules_engine',
  totals: {
    requiredBtu: 70000,
    selectedBtu: 75600,
    requiredCfm: 2500,
    selectedCfm: 3500
  },
  rooms: { count: 3, missingInputs: 0 },
  systems: {
    items: [
      {
        unitType: 'ahu',
        unitCount: 1,
        equipmentSnapshot: {
          model: 'AHU-6300',
          sourceStatus: 'verified-real-catalogue',
          voltage: 380,
          phase: 3
        }
      }
    ]
  },
  validation: { items: [] },
  esp: { totalPa: 140 }
};

const health = sandbox.AirCalcCopilotHealthEngine.calculateHealth(snapshot);
assert.strictEqual(health.sourceOfTruth, 'rules_engine');
assert.ok(health.overall >= 70, 'healthy sample project should score at least 70');
assert.ok(health.metrics.some((metric) => metric.key === 'capacity'), 'capacity metric is required');
assert.ok(health.metrics.some((metric) => metric.key === 'equipmentVerification'), 'equipment verification metric is required');

const recommendations = sandbox.AirCalcCopilotHealthEngine.buildRecommendations(snapshot, health);
assert.ok(Array.isArray(recommendations));
assert.ok(recommendations.length >= 1);

const confidence = sandbox.AirCalcCopilotHealthEngine.calculateConfidence(snapshot, health);
assert.strictEqual(confidence.aiGeneratedNumbers, false, 'AI must not generate engineering numbers');
assert.ok(confidence.basis.includes('Verified equipment snapshots'));

const scenarios = sandbox.AirCalcCopilotHealthEngine.buildOptimizationScenarios(snapshot);
assert.strictEqual(scenarios.length, 3, 'optimization should return A/B/C review-only scenarios');
assert.strictEqual(scenarios.map((item) => item.label).join(','), 'A,B,C');
assert.ok(scenarios.every((item) => item.engineeringScore >= 0 && item.engineeringScore <= 100));

const explanation = sandbox.AirCalcCopilotHealthEngine.buildDecisionExplanation(snapshot, health, recommendations);
assert.strictEqual(explanation.sourceOfTruth, 'rules_engine');
assert.strictEqual(explanation.aiGeneratedNumbers, false);
assert.ok(explanation.basis.some((item) => item.includes('Required load')));

const comparison = sandbox.AirCalcCopilotHealthEngine.buildSmartComparison(snapshot, scenarios, {
  totals: { requiredBtu: 68000, selectedBtu: 72000, requiredCfm: 2400, selectedCfm: 3000 },
  rooms: { count: 3, missingInputs: 0 },
  systems: { items: [] },
  validation: { items: [] }
});
assert.strictEqual(comparison.sourceOfTruth, 'rules_engine');
assert.strictEqual(comparison.rows.map((item) => item.name).join(','), 'Current,Optimized,Previous');

const report = sandbox.AirCalcCopilotHealthEngine.buildReviewReport(snapshot, health, recommendations, confidence, scenarios);
assert.strictEqual(report.title, 'HVAC Engineering Review Report');
assert.strictEqual(report.aiGeneratedNumbers, false);
assert.ok(report.decisionExplanation.basis.length > 0);

const readiness = sandbox.AirCalcCopilotHealthEngine.buildDeliveryReadiness(snapshot, health, recommendations, confidence);
assert.strictEqual(readiness.sourceOfTruth, 'rules_engine');
assert.strictEqual(readiness.aiGeneratedNumbers, false);
assert.ok(['ready', 'review_required', 'blocked'].includes(readiness.status));
assert.strictEqual(typeof readiness.readyForClient, 'boolean');

const checklist = sandbox.AirCalcCopilotHealthEngine.buildHandoffChecklist(snapshot, health, recommendations, confidence, readiness);
assert.strictEqual(checklist.sourceOfTruth, 'rules_engine');
assert.strictEqual(checklist.aiGeneratedNumbers, false);
assert.ok(checklist.total >= 8);
assert.ok(checklist.items.some((item) => item.id === 'ai_guardrail' && item.passed));
assert.ok(checklist.items.some((item) => item.id === 'load_calculated'));

const riskRegister = sandbox.AirCalcCopilotHealthEngine.buildRiskRegister(snapshot, health, recommendations, readiness);
assert.strictEqual(riskRegister.sourceOfTruth, 'rules_engine');
assert.strictEqual(riskRegister.aiGeneratedNumbers, false);
assert.ok(Array.isArray(riskRegister.items));
assert.ok(riskRegister.items.length >= 1);
assert.ok(riskRegister.items.every((item) => ['high', 'medium', 'low'].includes(item.severity)));

console.log('copilot-health-engine.test.js passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

global.window = global;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;

function load(relativePath) {
  vm.runInThisContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), { filename: relativePath });
}

load('js/ai/ai-explanation-client.js');

const Client = global.AirCalcAIExplanationClient;
assert.ok(Client, 'AI explanation client should be exposed');

const selectionResult = {
  requirements: { requiredCoolingLoadBtuH: 52000, requiredSupplyCfm: 1900 },
  recommendedOption: {
    optionId: 'unit-1-x1',
    equipmentId: 'unit-1',
    quantity: 1,
    totalCapacityBtuH: 60000,
    totalAirflowCfm: 2200,
    matchScore: 88,
    record: {
      manufacturerName: 'Carrier',
      exactModelNumber: 'TEST-060',
      verificationStatus: 'verified',
      sourceReference: 'catalogue p. 12'
    }
  },
  recommendationBuckets: [{ id: 'best_match', label: 'Best Match', optionId: 'unit-1-x1', available: true }],
  missingProjectData: [],
  engineerVerificationRequired: []
};

const context = Client.buildEquipmentSelectionContext(selectionResult, selectionResult.recommendedOption, {
  source: 'rules_engine',
  status: 'ready'
});

assert.strictEqual(context.sourceOfTruth, 'rules_engine', 'AI context should declare rules engine as source of truth');
assert.strictEqual(context.aiRole, 'explain_only', 'AI role should be explain-only');
assert.strictEqual(context.selectedOption.totalCapacityBtuH, 60000, 'context should include deterministic capacity value');
assert.strictEqual(context.constraints.mustNotGenerateEngineeringNumbers, true, 'context should forbid generated engineering numbers');

let validation = Client.validateExplainOnlyResponse({
  explanation: 'The selected option has 60,000 BTU/h and 2,200 CFM from the deterministic engine.'
}, context);
assert.strictEqual(validation.ok, true, 'AI may repeat numbers already present in deterministic context');

validation = Client.validateExplainOnlyResponse({
  explanation: 'Use 77,777 BTU/h instead.'
}, context);
assert.strictEqual(validation.ok, false, 'AI response should reject unsupported engineering numbers');
assert.strictEqual(validation.reason, 'ai_returned_unsupported_engineering_numbers');

const wrapped = Client.unwrapBackendResponse({
  ok: true,
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  provider: 'foundation_stub',
  response: {
    explanation: 'The selected option has 60,000 BTU/h from the deterministic engine.'
  }
});
assert.strictEqual(wrapped.ok, true, 'client should unwrap backend response envelopes');
assert.strictEqual(wrapped.payload.explanation.includes('60,000'), true, 'unwrapped payload should expose explanation text');
assert.strictEqual(wrapped.backend.provider, 'foundation_stub', 'unwrapped backend metadata should preserve provider');

const rejectedWrapper = Client.unwrapBackendResponse({ ok: false, reason: 'provider_returned_unsupported_engineering_numbers' });
assert.strictEqual(rejectedWrapper.ok, false, 'client should preserve backend rejection');
assert.strictEqual(rejectedWrapper.fallback, true, 'backend rejection should use fallback path');

global.fetch = async function () {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        sourceOfTruth: 'rules_engine',
        aiRole: 'explain_only',
        provider: 'foundation_stub',
        response: {
          explanation: 'The selected option has 60,000 BTU/h and 2,200 CFM from the deterministic engine.'
        }
      };
    }
  };
};

Client.requestExplanation(context, { endpoint: '/api/ai/explain' }).then((okResult) => {
  assert.strictEqual(okResult.ok, true, 'configured endpoint should accept backend response envelope');
  assert.strictEqual(okResult.response.explanation.includes('60,000'), true, 'client should expose backend explanation payload');
  assert.strictEqual(okResult.backend.provider, 'foundation_stub', 'client should retain backend provider metadata');
  delete global.fetch;
  return Client.requestExplanation(context, { endpoint: '' });
}).then((result) => {
  assert.strictEqual(result.ok, false, 'missing endpoint should not call AI');
  assert.strictEqual(result.fallback, true, 'missing endpoint should be a fallback path');
  assert.strictEqual(result.reason, 'ai_backend_not_configured');
  console.log('AI explanation client tests passed.');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

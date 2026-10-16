const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serviceSource = fs.readFileSync(path.join(root, 'server', 'ai-explanation-service.js'), 'utf8');
const service = require(path.join(root, 'server', 'ai-explanation-service.js'));

const context = {
  task: 'equipment_selection_explanation',
  contractVersion: 1,
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  requirements: { requiredCoolingLoadBtuH: 52000, requiredSupplyCfm: 1900 },
  selectedOption: {
    manufacturerName: 'Carrier',
    exactModelNumber: 'TEST-060',
    totalCapacityBtuH: 60000,
    totalAirflowCfm: 2200,
    matchScore: 88
  },
  recommendationBuckets: [{ label: 'Best Match', available: true }],
  missingProjectData: [],
  engineerVerificationRequired: ['Catalogue source missing.'],
  constraints: {
    mustNotGenerateEngineeringNumbers: true,
    mustNotChangeRanking: true,
    mustNotVerifyCatalogueData: true,
    mustUseOnlyProvidedValues: true
  }
};

assert.ok(!serviceSource.includes('OPENAI_API_KEY'), 'backend stub must not contain provider API key names.');
assert.ok(!serviceSource.includes('AIza'), 'backend stub must not contain frontend/provider key literals.');
assert.strictEqual(service.validateContext(context).ok, true, 'valid rules-engine context should pass.');
assert.strictEqual(
  service.validateContext(Object.assign({}, context, { sourceOfTruth: 'ai' })).ok,
  false,
  'backend should reject non-rules-engine source of truth.'
);

const normalizedSchema = service.normalizeResponseSchema({
  explanation: ' Safe explanation. ',
  riskSummary: '',
  questionsForEngineer: [' Confirm source. ', '', 'Review ESP.'],
  alternativeInterpretation: '',
  reportReadyNarrative: '',
  extraField: 'ignored'
});
assert.strictEqual(normalizedSchema.ok, true, 'response schema should normalize valid provider output.');
assert.deepStrictEqual(Object.keys(normalizedSchema.response).sort(), [
  'alternativeInterpretation',
  'explanation',
  'questionsForEngineer',
  'reportReadyNarrative',
  'riskSummary'
], 'normalized response should keep only approved fields.');
assert.deepStrictEqual(normalizedSchema.response.questionsForEngineer, ['Confirm source.', 'Review ESP.']);

assert.strictEqual(
  service.normalizeResponseSchema({ explanation: { text: 'bad' } }).ok,
  false,
  'response schema should reject non-string explanation.'
);
assert.strictEqual(
  service.normalizeResponseSchema({ explanation: 'ok', questionsForEngineer: 'not-array' }).ok,
  false,
  'response schema should reject non-array questions.'
);

service.explainEngineeringContext({ context }).then(async (result) => {
  assert.strictEqual(result.ok, true, 'foundation stub should return a safe explanation.');
  assert.strictEqual(result.provider, 'foundation_stub');
  assert.strictEqual(result.sourceOfTruth, 'rules_engine');

  const unsafe = await service.explainEngineeringContext({ context }, {
    provider: {
      name: 'unsafe_test_provider',
      explain() {
        return { explanation: 'Use 77,777 BTU/h instead.' };
      }
    }
  });
  assert.strictEqual(unsafe.ok, false, 'backend guard should reject unsupported provider numbers.');
  assert.strictEqual(unsafe.reason, 'provider_returned_unsupported_engineering_numbers');

  const malformed = await service.explainEngineeringContext({ context }, {
    provider: {
      name: 'malformed_provider',
      explain() {
        return { explanation: { text: 'not a string' } };
      }
    }
  });
  assert.strictEqual(malformed.ok, false, 'backend should reject malformed provider schema.');
  assert.strictEqual(malformed.reason, 'invalid_ai_response_schema');

  console.log('AI backend service tests passed.');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

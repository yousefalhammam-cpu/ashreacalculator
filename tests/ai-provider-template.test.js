const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { callProviderExplain, validateProvider } = require(path.join(root, 'server', 'ai-provider-contract.js'));
const { explainEngineeringContext } = require(path.join(root, 'server', 'ai-explanation-service.js'));
const {
  createOpenAiCompatibleProvider,
  parseProviderContent
} = require(path.join(root, 'server', 'providers', 'openai-compatible-provider.js'));

const context = {
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  selectedOption: {
    manufacturerName: 'VerifiedCo',
    exactModelNumber: 'VC-060',
    totalCapacityBtuH: 60000
  },
  recommendationBuckets: [{ label: 'Best Match', available: true }],
  missingProjectData: ['ESP from approved submittal'],
  engineerVerificationRequired: ['Confirm catalogue source before approval.'],
  constraints: {
    mustNotGenerateEngineeringNumbers: true,
    mustNotChangeRanking: true,
    mustNotVerifyCatalogueData: true,
    mustUseOnlyProvidedValues: true
  }
};

assert.strictEqual(parseProviderContent('{"explanation":"ok"}').explanation, 'ok');
assert.throws(() => parseProviderContent('not-json'), /provider_invalid_json_response/);

(async () => {
  const unconfigured = createOpenAiCompatibleProvider({ fetch: async () => ({ ok: true }) });
  assert.strictEqual(validateProvider(unconfigured).ok, true, 'provider template must satisfy the adapter contract.');

  const unconfiguredResult = await callProviderExplain(unconfigured, context, () => ({ explanation: 'fallback' }));
  assert.strictEqual(unconfiguredResult.ok, false, 'provider template must fail closed without server configuration.');
  assert.strictEqual(unconfiguredResult.reason, 'provider_explain_failed');
  assert.strictEqual(unconfiguredResult.detail, 'provider_api_key_not_configured');

  let capturedRequest = null;
  const safeProvider = createOpenAiCompatibleProvider({
    name: 'test_openai_compatible',
    apiKey: 'server-test-key',
    endpoint: 'https://provider.test/v1/chat/completions',
    model: 'test-model',
    fetch: async (url, request) => {
      capturedRequest = { url, request };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  explanation: 'VerifiedCo VC-060 is explained from Rules Engine context only.',
                  riskSummary: 'Confirm catalogue source before approval.',
                  questionsForEngineer: ['Confirm ESP from approved submittal.'],
                  alternativeInterpretation: 'Best Match remains deterministic.',
                  reportReadyNarrative: 'Use Rules Engine values as report source.'
                })
              }
            }]
          };
        }
      };
    }
  });

  const safeResult = await explainEngineeringContext({ context }, { provider: safeProvider });
  assert.strictEqual(safeResult.ok, true, 'safe provider response should pass backend guardrails.');
  assert.strictEqual(safeResult.provider, 'test_openai_compatible');
  assert.strictEqual(capturedRequest.url, 'https://provider.test/v1/chat/completions');
  assert.strictEqual(capturedRequest.request.headers.authorization, 'Bearer server-test-key');
  const body = JSON.parse(capturedRequest.request.body);
  assert.strictEqual(body.model, 'test-model');
  assert.ok(Array.isArray(body.messages), 'provider must receive the standardized prompt messages.');
  assert.strictEqual(body.temperature, 0);
  assert.deepStrictEqual(body.response_format, { type: 'json_object' });

  const unsafeProvider = createOpenAiCompatibleProvider({
    apiKey: 'server-test-key',
    endpoint: 'https://provider.test/v1/chat/completions',
    model: 'test-model',
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                explanation: 'Use 77777 BTU/h from AI.'
              })
            }
          }]
        };
      }
    })
  });

  const unsafeResult = await explainEngineeringContext({ context }, { provider: unsafeProvider });
  assert.strictEqual(unsafeResult.ok, false, 'provider-generated engineering numbers must be rejected.');
  assert.strictEqual(unsafeResult.reason, 'provider_returned_unsupported_engineering_numbers');

  console.log('AI provider template tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

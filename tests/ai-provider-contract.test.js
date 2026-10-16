const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contract = require(path.join(root, 'server', 'ai-provider-contract.js'));
const service = require(path.join(root, 'server', 'ai-explanation-service.js'));

const context = {
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  selectedOption: {
    manufacturerName: 'Carrier',
    exactModelNumber: 'TEST-060',
    totalCapacityBtuH: 60000
  },
  recommendationBuckets: [],
  missingProjectData: [],
  engineerVerificationRequired: [],
  constraints: {
    mustNotGenerateEngineeringNumbers: true,
    mustNotChangeRanking: true,
    mustNotVerifyCatalogueData: true,
    mustUseOnlyProvidedValues: true
  }
};

assert.strictEqual(contract.validateProvider(null).ok, true, 'null provider should resolve to foundation stub.');
assert.strictEqual(contract.validateProvider({ explain() {} }).ok, false, 'provider name should be required.');
assert.strictEqual(contract.validateProvider({ name: 'test' }).ok, false, 'provider explain function should be required.');
assert.strictEqual(contract.validateProvider({ name: 'test', explain() {} }).ok, true, 'valid provider adapter should pass.');

(async () => {
  const providerResult = await contract.callProviderExplain(
    { name: 'safe_test_provider', explain() { return { explanation: 'Use deterministic Rules Engine values only.' }; } },
    context,
    () => ({ explanation: 'fallback' })
  );
  assert.strictEqual(providerResult.ok, true, 'valid provider should be callable through the contract.');
  assert.strictEqual(providerResult.providerName, 'safe_test_provider');

  const failedProvider = await contract.callProviderExplain(
    { name: 'failing_provider', explain() { throw new Error('boom'); } },
    context,
    () => ({ explanation: 'fallback' })
  );
  assert.strictEqual(failedProvider.ok, false, 'provider exceptions should become safe failures.');
  assert.strictEqual(failedProvider.reason, 'provider_explain_failed');

  const serviceResult = await service.explainEngineeringContext({ context }, {
    provider: {
      name: 'safe_test_provider',
      explain() {
        return { explanation: 'Carrier TEST-060 uses 60,000 BTU/h from deterministic context.' };
      }
    }
  });
  assert.strictEqual(serviceResult.ok, true, 'service should accept a valid safe provider adapter.');
  assert.strictEqual(serviceResult.provider, 'safe_test_provider');

  const invalidProviderResult = await service.explainEngineeringContext({ context }, {
    provider: { explain() { return { explanation: 'missing name' }; } }
  });
  assert.strictEqual(invalidProviderResult.ok, false, 'service should reject invalid provider adapters.');
  assert.strictEqual(invalidProviderResult.reason, 'provider_name_required');

  console.log('AI provider contract tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const {
  REQUIRED_PROVIDER_ENV,
  getProviderRuntimeStatus,
  createConfiguredAiProvider
} = require(path.join(root, 'server', 'ai-provider-runtime.js'));

assert.deepStrictEqual(REQUIRED_PROVIDER_ENV, [
  'AIRCALC_AI_PROVIDER_API_KEY',
  'AIRCALC_AI_PROVIDER_ENDPOINT',
  'AIRCALC_AI_PROVIDER_MODEL'
]);

const emptyStatus = getProviderRuntimeStatus({});
assert.strictEqual(emptyStatus.configured, false, 'runtime provider should not be configured without backend env.');
assert.deepStrictEqual(emptyStatus.missing, REQUIRED_PROVIDER_ENV);
assert.strictEqual(createConfiguredAiProvider({ env: {} }), null, 'provider injection should stay disabled when env is incomplete.');

const partialStatus = getProviderRuntimeStatus({
  AIRCALC_AI_PROVIDER_API_KEY: 'key',
  AIRCALC_AI_PROVIDER_MODEL: 'model'
});
assert.strictEqual(partialStatus.configured, false, 'all required provider env values must be present.');
assert.deepStrictEqual(partialStatus.missing, ['AIRCALC_AI_PROVIDER_ENDPOINT']);

const provider = createConfiguredAiProvider({
  env: {
    AIRCALC_AI_PROVIDER_API_KEY: 'key',
    AIRCALC_AI_PROVIDER_ENDPOINT: 'https://provider.test/v1/chat/completions',
    AIRCALC_AI_PROVIDER_MODEL: 'model',
    AIRCALC_AI_PROVIDER_NAME: 'configured_provider'
  },
  fetch: async () => ({
    ok: true,
    status: 200,
    async json() {
      return { choices: [{ message: { content: '{"explanation":"ok"}' } }] };
    }
  })
});

assert.ok(provider, 'complete backend env should create a provider.');
assert.strictEqual(provider.name, 'configured_provider');

console.log('AI provider runtime tests passed.');

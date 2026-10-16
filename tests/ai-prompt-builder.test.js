const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const promptBuilder = require(path.join(root, 'server', 'ai-prompt-builder.js'));
const contract = require(path.join(root, 'server', 'ai-provider-contract.js'));

const context = {
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  selectedOption: { manufacturerName: 'Carrier', exactModelNumber: 'TEST-060', totalCapacityBtuH: 60000 },
  constraints: {
    mustNotGenerateEngineeringNumbers: true,
    mustNotChangeRanking: true,
    mustNotVerifyCatalogueData: true,
    mustUseOnlyProvidedValues: true
  }
};

const system = promptBuilder.buildSystemMessage();
assert.ok(system.includes('Rules Engine is the only source of truth'), 'system message should preserve rules-engine authority.');
assert.ok(system.includes('Do not calculate'), 'system message should forbid calculation.');
assert.ok(system.includes('Do not introduce engineering numbers'), 'system message should forbid unsupported engineering numbers.');

const messages = promptBuilder.buildProviderMessages(context);
assert.strictEqual(messages.length, 2, 'provider messages should include system and user entries.');
assert.strictEqual(messages[0].role, 'system');
assert.strictEqual(messages[1].role, 'user');
assert.ok(messages[1].content.includes('"responseSchema"'), 'user message should include response schema.');
assert.ok(messages[1].content.includes('"sourceOfTruth":"rules_engine"'), 'user message should include deterministic context.');

(async () => {
  let receivedMessages = null;
  const result = await contract.callProviderExplain(
    {
      name: 'message_aware_provider',
      explain(_context, options) {
        receivedMessages = options.messages;
        return { explanation: 'Carrier TEST-060 repeats 60,000 BTU/h from context.' };
      }
    },
    context,
    () => ({ explanation: 'fallback' })
  );
  assert.strictEqual(result.ok, true, 'provider should receive prompt messages through contract.');
  assert.ok(Array.isArray(receivedMessages), 'provider options should include messages.');
  assert.strictEqual(receivedMessages[0].role, 'system');
  console.log('AI prompt builder tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

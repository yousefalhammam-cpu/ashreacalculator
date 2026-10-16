const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(root, 'local-static-server.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'app', 'index.html'), 'latin1');
const configSource = fs.readFileSync(path.join(root, 'js', 'ai', 'ai-config.js'), 'utf8');

assert.ok(serverSource.includes("require('./server/ai-explain-http-adapter')"), 'local server should load the AI HTTP adapter.');
assert.ok(serverSource.includes('function createAirCalcServer'), 'local server should expose a testable server factory.');
assert.ok(serverSource.includes('require.main === module'), 'local server should only listen automatically when run directly.');
assert.ok(serverSource.includes("urlPath === '/api/ai/explain'"), 'local server should expose the AI explanation route.');
assert.ok(serverSource.includes('handleAiExplainRequest(req, res'), 'local server should delegate AI requests to the safe adapter.');
assert.ok(indexHtml.includes('js/ai/ai-config.js'), 'index should load AI config before the AI client.');
assert.ok(indexHtml.indexOf('js/ai/ai-config.js') < indexHtml.indexOf('js/ai/ai-explanation-client.js'), 'AI config should load before the AI client.');

global.window = global;
global.location = { protocol: 'http:', hostname: '127.0.0.1' };
vm.runInThisContext(configSource, { filename: 'js/ai/ai-config.js' });
assert.strictEqual(global.AirCalcAIConfig.explanationEndpoint, '/api/ai/explain', 'local HTTP should enable the local AI endpoint.');

global.AirCalcAIConfig = undefined;
global.location = { protocol: 'file:', hostname: '' };
vm.runInThisContext(configSource, { filename: 'js/ai/ai-config.js' });
assert.strictEqual(global.AirCalcAIConfig.explanationEndpoint, '', 'file:// should keep AI endpoint disabled.');

console.log('Local AI route tests passed.');

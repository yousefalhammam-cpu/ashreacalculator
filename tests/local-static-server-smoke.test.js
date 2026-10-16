const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const { createAirCalcServer } = require(path.join(root, 'local-static-server.js'));

function requestJson(port, pathName, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathName,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: raw ? JSON.parse(raw) : null });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

const context = {
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  selectedOption: {
    manufacturerName: 'Carrier',
    exactModelNumber: 'TEST-060',
    totalCapacityBtuH: 60000,
    totalAirflowCfm: 2200
  },
  recommendationBuckets: [{ label: 'Best Match', available: true }],
  missingProjectData: [],
  engineerVerificationRequired: [],
  constraints: {
    mustNotGenerateEngineeringNumbers: true,
    mustNotChangeRanking: true,
    mustNotVerifyCatalogueData: true,
    mustUseOnlyProvidedValues: true
  }
};

(async () => {
  global.window = global;
  global.setTimeout = setTimeout;
  global.clearTimeout = clearTimeout;
  global.fetch = async function (url, options) {
    const parsed = new URL(url, `http://127.0.0.1:${server.address().port}`);
    const result = await requestJson(parsed.port, parsed.pathname, JSON.parse(options.body));
    return {
      ok: result.statusCode >= 200 && result.statusCode < 300,
      status: result.statusCode,
      async json() { return result.body; }
    };
  };
  vm.runInThisContext(fs.readFileSync(path.join(root, 'js', 'ai', 'ai-explanation-client.js'), 'utf8'), { filename: 'js/ai/ai-explanation-client.js' });

  const server = createAirCalcServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const ok = await requestJson(port, '/api/ai/explain', { context });
    assert.strictEqual(ok.statusCode, 200, 'local server should expose AI explain route.');
    assert.strictEqual(ok.body.provider, 'foundation_stub', 'local AI route should use foundation stub by default.');
    assert.strictEqual(ok.body.sourceOfTruth, 'rules_engine');

    const clientResult = await global.AirCalcAIExplanationClient.requestExplanation(context, {
      endpoint: `http://127.0.0.1:${port}/api/ai/explain`
    });
    assert.strictEqual(clientResult.ok, true, 'frontend client should consume the local backend envelope.');
    assert.strictEqual(clientResult.backend.provider, 'foundation_stub');
    assert.ok(clientResult.response.explanation.includes('deterministic Rules Engine'), 'client should expose explanation text from envelope.');

    const unsafe = await requestJson(port, '/api/ai/explain', { context: { sourceOfTruth: 'ai' } });
    assert.strictEqual(unsafe.statusCode, 422, 'local server should reject unsafe context.');

    console.log('Local static server smoke tests passed.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    delete global.fetch;
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

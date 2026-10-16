const assert = require('assert');
const { EventEmitter } = require('events');
const path = require('path');

const root = path.resolve(__dirname, '..');
const adapter = require(path.join(root, 'server', 'ai-explain-http-adapter.js'));

function mockReq(method, body, headers = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.headers = headers;
  req.destroy = function () {
    process.nextTick(() => req.emit('end'));
  };
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body));
    req.emit('end');
  });
  return req;
}

function mockRes() {
  return {
    headers: {},
    statusCode: null,
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(statusCode) { this.statusCode = statusCode; },
    end(payload) { this.body = payload || ''; }
  };
}

const context = {
  sourceOfTruth: 'rules_engine',
  aiRole: 'explain_only',
  selectedOption: { manufacturerName: 'Carrier', exactModelNumber: 'TEST-060', totalCapacityBtuH: 60000 },
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

(async () => {
  let res = mockRes();
  await adapter.handleAiExplainRequest(mockReq('GET'), res);
  assert.strictEqual(res.statusCode, 405, 'adapter should reject non-POST requests.');

  res = mockRes();
  await adapter.handleAiExplainRequest(mockReq('POST', '{bad json'), res);
  assert.strictEqual(res.statusCode, 400, 'adapter should reject invalid JSON.');

  res = mockRes();
  await adapter.handleAiExplainRequest(mockReq('POST', JSON.stringify({ context })), res);
  assert.strictEqual(res.statusCode, 200, 'adapter should return success for valid rules-engine context.');
  assert.strictEqual(JSON.parse(res.body).sourceOfTruth, 'rules_engine');

  res = mockRes();
  await adapter.handleAiExplainRequest(mockReq('POST', JSON.stringify({ context: { sourceOfTruth: 'ai' } })), res);
  assert.strictEqual(res.statusCode, 422, 'adapter should reject unsafe AI-sourced context.');

  res = mockRes();
  await adapter.handleAiExplainRequest(
    mockReq('OPTIONS', undefined, { origin: 'https://aircalc.pro' }),
    res,
    { allowedOrigins: ['https://aircalc.pro'] }
  );
  assert.strictEqual(res.statusCode, 204, 'adapter should support CORS preflight.');
  assert.strictEqual(res.headers['Access-Control-Allow-Origin'], 'https://aircalc.pro');

  console.log('AI HTTP adapter tests passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

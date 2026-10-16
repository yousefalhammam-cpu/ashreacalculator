'use strict';

const { explainEngineeringContext } = require('./ai-explanation-service');

const MAX_BODY_BYTES = 128 * 1024;

function setHeader(res, name, value) {
  if (res && typeof res.setHeader === 'function') res.setHeader(name, value);
}

function sendJson(res, statusCode, payload) {
  setHeader(res, 'Content-Type', 'application/json; charset=utf-8');
  if (res && typeof res.writeHead === 'function') res.writeHead(statusCode);
  if (res && typeof res.end === 'function') res.end(JSON.stringify(payload));
  return { statusCode, payload };
}

function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve) => {
    if (!req || typeof req.on !== 'function') {
      resolve({ ok: true, payload: req && req.body ? req.body : {} });
      return;
    }

    let raw = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
        tooLarge = true;
        if (typeof req.destroy === 'function') req.destroy();
      }
    });
    req.on('end', () => {
      if (tooLarge) {
        resolve({ ok: false, statusCode: 413, reason: 'request_body_too_large' });
        return;
      }
      try {
        resolve({ ok: true, payload: raw ? JSON.parse(raw) : {} });
      } catch (_err) {
        resolve({ ok: false, statusCode: 400, reason: 'invalid_json' });
      }
    });
    req.on('error', () => {
      resolve({ ok: false, statusCode: 400, reason: 'request_stream_error' });
    });
  });
}

function applyCors(req, res, options = {}) {
  const origin = req && req.headers ? req.headers.origin : '';
  const allowedOrigins = Array.isArray(options.allowedOrigins) ? options.allowedOrigins : [];
  const allowOrigin = allowedOrigins.length && allowedOrigins.indexOf(origin) >= 0 ? origin : (allowedOrigins.length ? '' : '*');
  if (allowOrigin) setHeader(res, 'Access-Control-Allow-Origin', allowOrigin);
  setHeader(res, 'Access-Control-Allow-Methods', 'POST, OPTIONS');
  setHeader(res, 'Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function handleAiExplainRequest(req, res, options = {}) {
  applyCors(req, res, options);

  const method = String((req && req.method) || 'POST').toUpperCase();
  if (method === 'OPTIONS') return sendJson(res, 204, { ok: true });
  if (method !== 'POST') return sendJson(res, 405, { ok: false, reason: 'method_not_allowed' });

  const body = await readJsonBody(req, options.maxBodyBytes || MAX_BODY_BYTES);
  if (!body.ok) return sendJson(res, body.statusCode || 400, { ok: false, reason: body.reason });

  const result = await explainEngineeringContext(body.payload, { provider: options.provider || null });
  if (!result.ok) {
    const status = result.reason === 'missing_context' ? 400 : 422;
    return sendJson(res, status, result);
  }
  return sendJson(res, 200, result);
}

module.exports = {
  MAX_BODY_BYTES,
  applyCors,
  readJsonBody,
  handleAiExplainRequest
};

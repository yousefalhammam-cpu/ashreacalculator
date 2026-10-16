'use strict';

function text(value) {
  return value == null ? '' : String(value).trim();
}

function getEnv(name) {
  if (typeof process === 'undefined' || !process.env) return '';
  return text(process.env[name]);
}

function parseProviderContent(content) {
  if (!text(content)) throw new Error('provider_empty_response');
  try {
    return JSON.parse(content);
  } catch (_err) {
    throw new Error('provider_invalid_json_response');
  }
}

function createOpenAiCompatibleProvider(options = {}) {
  const endpoint = text(options.endpoint || getEnv('AIRCALC_AI_PROVIDER_ENDPOINT'));
  const apiKey = text(options.apiKey || getEnv('AIRCALC_AI_PROVIDER_API_KEY'));
  const model = text(options.model || getEnv('AIRCALC_AI_PROVIDER_MODEL'));
  const providerName = text(options.name || getEnv('AIRCALC_AI_PROVIDER_NAME') || 'openai_compatible_provider');
  const fetchImpl = options.fetch || (typeof globalThis !== 'undefined' ? globalThis.fetch : null);

  return {
    name: providerName,
    async explain(_context, runtime = {}) {
      if (!apiKey) throw new Error('provider_api_key_not_configured');
      if (!endpoint) throw new Error('provider_endpoint_not_configured');
      if (!model) throw new Error('provider_model_not_configured');
      if (typeof fetchImpl !== 'function') throw new Error('provider_fetch_unavailable');

      const messages = Array.isArray(runtime.messages) ? runtime.messages : [];
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0,
          response_format: { type: 'json_object' }
        })
      });

      if (!response || response.ok !== true) {
        const status = response && response.status ? response.status : 'unknown';
        throw new Error(`provider_http_${status}`);
      }

      const payload = await response.json();
      return parseProviderContent(payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content);
    }
  };
}

module.exports = {
  createOpenAiCompatibleProvider,
  parseProviderContent
};

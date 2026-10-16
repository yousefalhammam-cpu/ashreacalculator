'use strict';

const { buildProviderMessages } = require('./ai-prompt-builder');

function text(value) {
  return value == null ? '' : String(value).trim();
}

function validateProvider(provider) {
  if (!provider) return { ok: true, provider: null, name: 'foundation_stub' };
  if (typeof provider !== 'object') return { ok: false, reason: 'provider_must_be_object' };
  if (!text(provider.name)) return { ok: false, reason: 'provider_name_required' };
  if (typeof provider.explain !== 'function') return { ok: false, reason: 'provider_explain_function_required' };
  return { ok: true, provider, name: text(provider.name) };
}

async function callProviderExplain(provider, context, fallbackExplain) {
  const validation = validateProvider(provider);
  if (!validation.ok) return validation;
  if (!validation.provider) {
    return {
      ok: true,
      providerName: validation.name,
      response: fallbackExplain(context)
    };
  }
  try {
    const messages = buildProviderMessages(context);
    const response = await validation.provider.explain(context, { messages });
    return {
      ok: true,
      providerName: validation.name,
      response,
      messages
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'provider_explain_failed',
      providerName: validation.name,
      detail: err && err.message ? err.message : ''
    };
  }
}

module.exports = {
  validateProvider,
  callProviderExplain
};

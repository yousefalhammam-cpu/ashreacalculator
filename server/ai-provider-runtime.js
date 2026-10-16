'use strict';

const { createOpenAiCompatibleProvider } = require('./providers/openai-compatible-provider');
const { createOllamaProvider } = require('./providers/ollama-provider');

const REQUIRED_PROVIDER_ENV = [
  'AIRCALC_AI_PROVIDER_API_KEY',
  'AIRCALC_AI_PROVIDER_ENDPOINT',
  'AIRCALC_AI_PROVIDER_MODEL'
];

function text(value) {
  return value == null ? '' : String(value).trim();
}

function readEnv(env, name) {
  return text(env && env[name]);
}

function getProviderRuntimeStatus(env = process.env) {
  if(readEnv(env, 'AIRCALC_AI_MODE') === 'offline'){
    const missing = readEnv(env,'AIRCALC_AI_LOCAL_MODEL') ? [] : ['AIRCALC_AI_LOCAL_MODEL'];
    return {configured:missing.length === 0,missing,mode:'offline'};
  }
  const missing = REQUIRED_PROVIDER_ENV.filter((name) => !readEnv(env, name));
  return {
    configured: missing.length === 0,
    missing
  };
}

function createConfiguredAiProvider(options = {}) {
  const env = options.env || process.env;
  const status = getProviderRuntimeStatus(env);
  if(status.mode === 'offline'){
    if(!status.configured) throw new Error('offline_ai_local_model_required');
    return createOllamaProvider({model:readEnv(env,'AIRCALC_AI_LOCAL_MODEL'),endpoint:readEnv(env,'AIRCALC_AI_LOCAL_ENDPOINT'),fetch:options.fetch});
  }
  if (!status.configured) return null;

  return createOpenAiCompatibleProvider({
    name: readEnv(env, 'AIRCALC_AI_PROVIDER_NAME') || options.name,
    apiKey: readEnv(env, 'AIRCALC_AI_PROVIDER_API_KEY'),
    endpoint: readEnv(env, 'AIRCALC_AI_PROVIDER_ENDPOINT'),
    model: readEnv(env, 'AIRCALC_AI_PROVIDER_MODEL'),
    fetch: options.fetch
  });
}

module.exports = {
  REQUIRED_PROVIDER_ENV,
  getProviderRuntimeStatus,
  createConfiguredAiProvider
};

'use strict';

const { callProviderExplain } = require('./ai-provider-contract');

const EXPLANATION_FIELDS = [
  'explanation',
  'riskSummary',
  'questionsForEngineer',
  'alternativeInterpretation',
  'reportReadyNarrative'
];

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  } catch (_err) {
    return null;
  }
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function collectNumbers(value, out = {}) {
  if (value == null) return out;
  if (typeof value === 'number' && Number.isFinite(value)) {
    out[String(value)] = true;
    out[String(Math.round(value))] = true;
    out[value.toLocaleString('en-US')] = true;
    return out;
  }
  if (typeof value === 'string') {
    (value.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || []).forEach((num) => {
      out[num] = true;
      out[num.replace(/,/g, '')] = true;
    });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectNumbers(item, out));
    return out;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => collectNumbers(value[key], out));
  }
  return out;
}

function validateContext(context) {
  if (!context || typeof context !== 'object') return { ok: false, reason: 'missing_context' };
  if (context.sourceOfTruth !== 'rules_engine') return { ok: false, reason: 'source_of_truth_must_be_rules_engine' };
  if (context.aiRole !== 'explain_only') return { ok: false, reason: 'ai_role_must_be_explain_only' };
  const constraints = context.constraints || {};
  if (constraints.mustNotGenerateEngineeringNumbers !== true) return { ok: false, reason: 'missing_number_generation_guard' };
  if (constraints.mustNotChangeRanking !== true) return { ok: false, reason: 'missing_ranking_guard' };
  if (constraints.mustNotVerifyCatalogueData !== true) return { ok: false, reason: 'missing_catalogue_verification_guard' };
  return { ok: true };
}

function validateExplainOnlyResponse(response, sourceContext) {
  const allowed = collectNumbers(sourceContext, {});
  const schema = normalizeResponseSchema(response || {});
  if (!schema.ok) return schema;
  const payload = schema.response;
  const unsupported = {};
  EXPLANATION_FIELDS.forEach((field) => collectNumbers(payload && payload[field], unsupported));
  const bad = Object.keys(unsupported).filter((num) => !allowed[num] && !allowed[num.replace(/,/g, '')]);
  if (bad.length) {
    return {
      ok: false,
      reason: 'provider_returned_unsupported_engineering_numbers',
      unsupportedNumbers: bad.slice(0, 10)
    };
  }
  return { ok: true, response: payload };
}

function normalizeStringField(payload, field) {
  const value = payload[field];
  if (value == null) return { ok: true, value: '' };
  if (typeof value !== 'string') return { ok: false, reason: 'invalid_ai_response_schema', field };
  return { ok: true, value: value.trim() };
}

function normalizeQuestions(value) {
  if (value == null) return { ok: true, value: [] };
  if (!Array.isArray(value)) return { ok: false, reason: 'invalid_ai_response_schema', field: 'questionsForEngineer' };
  const questions = [];
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false, reason: 'invalid_ai_response_schema', field: 'questionsForEngineer' };
    const question = item.trim();
    if (question) questions.push(question);
  }
  return { ok: true, value: questions.slice(0, 8) };
}

function normalizeResponseSchema(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { ok: false, reason: 'invalid_ai_response_schema', field: 'response' };
  }
  const payload = {};
  for (const field of ['explanation', 'riskSummary', 'alternativeInterpretation', 'reportReadyNarrative']) {
    const normalized = normalizeStringField(response, field);
    if (!normalized.ok) return normalized;
    payload[field] = normalized.value;
  }
  const questions = normalizeQuestions(response.questionsForEngineer);
  if (!questions.ok) return questions;
  payload.questionsForEngineer = questions.value;
  return { ok: true, response: payload };
}

function foundationExplanation(context) {
  const selected = context.selectedOption || {};
  const buckets = Array.isArray(context.recommendationBuckets) ? context.recommendationBuckets : [];
  const bucketLabels = buckets.filter((bucket) => bucket && bucket.available).map((bucket) => bucket.label).join(', ');
  const model = [selected.manufacturerName, selected.exactModelNumber].filter(Boolean).join(' ');
  return {
    explanation: model
      ? `${model} is explained from deterministic Rules Engine output only. The AI layer did not calculate, rank, or verify this equipment.`
      : 'No selected equipment option was provided. Rules Engine output remains the source of truth.',
    riskSummary: (context.engineerVerificationRequired || []).join(' | ') || 'No additional AI-generated risk was added.',
    questionsForEngineer: context.missingProjectData && context.missingProjectData.length
      ? [`Confirm missing project data: ${context.missingProjectData.join(', ')}`]
      : [],
    alternativeInterpretation: bucketLabels ? `Available deterministic buckets: ${bucketLabels}.` : '',
    reportReadyNarrative: 'Use the deterministic calculation and equipment selection outputs as the report source. Treat this text as explanatory narrative only.'
  };
}

async function explainEngineeringContext(payload, options = {}) {
  const context = payload && payload.context;
  const contextValidation = validateContext(context);
  if (!contextValidation.ok) return contextValidation;

  const provider = options.provider || null;
  const providerResult = await callProviderExplain(provider, clone(context), foundationExplanation);
  if (!providerResult.ok) return providerResult;
  const providerResponse = providerResult.response;

  const responseValidation = validateExplainOnlyResponse(providerResponse, context);
  if (!responseValidation.ok) return responseValidation;
  return {
    ok: true,
    sourceOfTruth: 'rules_engine',
    aiRole: 'explain_only',
    provider: providerResult.providerName,
    response: responseValidation.response
  };
}

module.exports = {
  EXPLANATION_FIELDS,
  collectNumbers,
  validateContext,
  normalizeResponseSchema,
  validateExplainOnlyResponse,
  foundationExplanation,
  explainEngineeringContext
};

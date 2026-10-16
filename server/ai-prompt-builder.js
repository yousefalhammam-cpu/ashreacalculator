'use strict';

const RESPONSE_SCHEMA = {
  explanation: 'string',
  riskSummary: 'string',
  questionsForEngineer: 'string[]',
  alternativeInterpretation: 'string',
  reportReadyNarrative: 'string'
};

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  } catch (_err) {
    return null;
  }
}

function buildSystemMessage() {
  return [
    'You are the AirCalc Pro Engineering AI explanation layer.',
    'You explain deterministic HVAC engineering outputs only.',
    'The Rules Engine is the only source of truth.',
    'Do not calculate, rank, verify catalogues, invent models, or invent specifications.',
    'Do not introduce engineering numbers that are not present in the supplied JSON context.',
    'Do not hide critical warnings or override Engineer Review.',
    'Return only JSON matching the requested response schema.'
  ].join(' ');
}

function buildUserMessage(context) {
  return JSON.stringify({
    responseSchema: RESPONSE_SCHEMA,
    context: clone(context || {})
  });
}

function buildProviderMessages(context) {
  return [
    { role: 'system', content: buildSystemMessage() },
    { role: 'user', content: buildUserMessage(context) }
  ];
}

module.exports = {
  RESPONSE_SCHEMA,
  buildSystemMessage,
  buildUserMessage,
  buildProviderMessages
};

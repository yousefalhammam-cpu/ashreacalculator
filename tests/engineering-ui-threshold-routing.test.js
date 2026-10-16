const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const agentSource = fs.readFileSync(path.join(root, 'modules', 'engineering-agent.js'), 'utf8');

assert(
  appSource.includes('function getEngineeringValidationThresholds()'),
  'app.js should expose a local fallback for centralized validation thresholds'
);

assert(
  appSource.includes('window.AirCalcEngineering') && appSource.includes('VALIDATION_THRESHOLDS'),
  'app.js validation should read thresholds from AirCalcEngineering when available'
);

assert(
  agentSource.includes('function getEngineeringValidationThresholds()'),
  'engineering agent should expose a local fallback for centralized validation thresholds'
);

assert(
  !agentSource.includes('Number(window._lastEspCalc.totalPa) > 250'),
  'engineering agent should not keep the old ESP critical threshold at 250 Pa'
);

assert(
  agentSource.includes('thresholds.ESP_VALIDATION_REVIEW_MAX_PA'),
  'engineering agent ESP critical review should use the centralized ESP threshold'
);

console.log('Engineering UI threshold routing audit passed.');

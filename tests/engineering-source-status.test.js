const assert = require('assert');
const fs = require('fs');
const path = require('path');
const data = require('../data.json');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const agentSource = fs.readFileSync(path.join(root, 'modules', 'engineering-agent.js'), 'utf8');

const sourceStatus = data.ENGINEERING_SOURCE_STATUS || {};
const healthcareStatus = sourceStatus.healthcareRoomValues || {};
const generalStatus = sourceStatus.generalRoomLoadFactors || {};

assert.strictEqual(
  healthcareStatus.status,
  'requires_source_confirmation',
  'healthcare room standards should be explicitly marked as requiring source confirmation'
);

assert.strictEqual(
  healthcareStatus.approvalRequiredBeforeFinalDesign,
  true,
  'healthcare standards should require approval before final design'
);

assert.ok(
  String(healthcareStatus.todo || '').includes('ASHRAE 170'),
  'healthcare standards TODO should name ASHRAE 170 confirmation'
);

assert.strictEqual(
  generalStatus.status,
  'preliminary_app_baseline',
  'general quick-load factors should be explicitly marked as preliminary app baselines'
);

assert.strictEqual(
  generalStatus.approvalRequiredBeforeFinalDesign,
  true,
  'general load factors should require project basis approval before final design'
);

assert(
  appSource.includes('ENGINEERING_SOURCE_STATUS = data.ENGINEERING_SOURCE_STATUS || {}'),
  'app.js should load engineering source-status metadata from data.json'
);

const indexSource = fs.readFileSync(path.join(root, 'app', 'index.html'), 'latin1');
assert(
  indexSource.includes('js/knowledge/engineering-knowledge-base.js'),
  'index.html should load the standalone Engineering Knowledge Base'
);

assert(
  appSource.includes('function getEngineeringSourceStatusNotes()') &&
    appSource.includes('getEngineeringSourceStatusNotes()'),
  'technical report should surface engineering source-status notes'
);

assert(
  agentSource.includes('healthcare_source_confirmation') &&
    agentSource.includes('general_load_source_confirmation'),
  'engineering agent should surface source-confirmation guidance'
);

assert(
  agentSource.includes('function getEngineeringSourceStatus()') &&
    agentSource.includes('AirCalcEngineeringKnowledge') &&
    agentSource.includes('knowledge.getDataSourceStatus'),
  'engineering agent should route source-status reads through the Engineering Knowledge Base when available'
);

assert(
  agentSource.includes('sourceConfirmationRequired') &&
    agentSource.includes('finalApprovalStatus') &&
    agentSource.includes('Final Approval'),
  'engineering agent readiness should separate report review from final approval when sources need confirmation'
);

console.log('Engineering source status tests passed.');

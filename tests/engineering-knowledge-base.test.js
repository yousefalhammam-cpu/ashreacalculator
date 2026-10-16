const assert = require('assert');
const path = require('path');
const data = require('../data.json');
const Engine = require('../js/core/engineering-calculation-engine.js');

global.AirCalcEngineering = Engine;
global.ROOMS = data.ROOMS;
global.ENGINEERING_SOURCE_STATUS = data.ENGINEERING_SOURCE_STATUS;

const knowledgePath = path.join(__dirname, '..', 'js/knowledge/engineering-knowledge-base.js');
delete require.cache[require.resolve(knowledgePath)];
const Knowledge = require(knowledgePath);

const summary = Knowledge.getKnowledgeSummary();
assert.strictEqual(summary.layer, 'Engineering Knowledge Base');
assert.strictEqual(summary.independentFromAi, true, 'knowledge base must be independent from AI');
assert.strictEqual(summary.calculationEngineIsSourceOfTruth, true, 'calculation engine remains source of truth');
assert.ok(summary.healthcareRooms > 0, 'healthcare room requirements should be exposed');

const constants = Knowledge.getCalculationConstants();
assert.strictEqual(constants.TR_TO_BTUH, 12000, 'knowledge base should expose engine constants without redefining calculations');

const thresholds = Knowledge.getValidationThresholds();
assert.strictEqual(
  thresholds.MATCH_MAX_OVERSIZE_PCT,
  Engine.VALIDATION_THRESHOLDS.MATCH_MAX_OVERSIZE_PCT,
  'knowledge base thresholds should come from the calculation engine'
);

const sourceStatus = Knowledge.getDataSourceStatus();
assert.strictEqual(
  sourceStatus.healthcareRoomValues.status,
  data.ENGINEERING_SOURCE_STATUS.healthcareRoomValues.status,
  'healthcare source status should be preserved'
);

const patientRoom = Knowledge.getHealthcareRoomRequirements('h_patient_room');
assert.ok(patientRoom, 'patient room requirements should be available');
assert.strictEqual(patientRoom.sourceReferenceId, 'ashrae_170_healthcare');
assert.strictEqual(patientRoom.sourceStatus.approvalRequiredBeforeFinalDesign, true);
assert.strictEqual(patientRoom.totalAch, Number(data.ROOMS.h_patient_room.tach));
assert.strictEqual(patientRoom.outdoorAch, Number(data.ROOMS.h_patient_room.oach));
assert.strictEqual(patientRoom.pressure, data.ROOMS.h_patient_room.pres);

assert.strictEqual(
  Knowledge.getHealthcareRoomRequirements('bedroom'),
  null,
  'non-healthcare room should not return healthcare requirements'
);

const espRule = Knowledge.getValidationRule('esp_low_review');
assert.strictEqual(espRule.unit, 'Pa');
assert.strictEqual(espRule.threshold, Engine.VALIDATION_THRESHOLDS.ESP_LOW_MAX_PA);

assert.ok(Knowledge.getGlossaryTerm('cfm').description.includes('airflow'));

console.log('Engineering knowledge base tests passed.');

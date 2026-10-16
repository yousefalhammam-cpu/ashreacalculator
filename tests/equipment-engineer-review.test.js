const assert = require('assert');
const path = require('path');

const store = {};

global.window = {
  lang: 'en',
  quoteMode: 'proj',
  hist: [],
  qlines: [],
  projState: { systemType: 'package' },
  ENGINEERING_SOURCE_STATUS: {},
  setTimeout: () => {},
  localStorage: {
    getItem: (key) => store[key] || '',
    setItem: (key, value) => { store[key] = String(value); }
  }
};

global.document = {
  readyState: 'loading',
  documentElement: { lang: 'en' },
  addEventListener: () => {},
  getElementById: () => null
};

const agentPath = path.resolve(__dirname, '..', 'modules', 'engineering-agent.js');
delete require.cache[agentPath];
require(agentPath);

const Agent = global.window.AppEngineeringAgent;
assert.ok(Agent, 'Engineering agent API should be exported on window');

const selectedSnapshot = {
  selectedAt: '2026-07-24T10:00:00.000Z',
  source: 'equipment_database_mvp',
  record: {
    id: 'eq-1',
    manufacturerName: 'Acme HVAC',
    exactModelNumber: 'PKG-060',
    coolingCapacityBtuH: 60000,
    airflowNominalCfm: 1800,
    availableEspPa: 120,
    voltage: 380,
    phase: 3,
    frequencyHz: 60,
    verificationStatus: 'draft',
    saudiMarketStatus: 'unknown',
    updatedAt: '2026-07-20'
  },
  selectionOption: {
    equipmentId: 'eq-1',
    quantity: 1,
    totalCapacityBtuH: 60000,
    totalAirflowCfm: 1800,
    availableEspPa: 120,
    selectionRequirements: {
      requiredCoolingLoadBtuH: 70000,
      requiredSupplyCfm: 2400,
      requiredEspPa: 180,
      voltage: 220,
      phase: 1,
      frequencyHz: 60
    },
    engineerVerificationRequired: ['Confirm catalogue ESP with duct layout.']
  }
};

store.aircalc_last_selected_equipment_snapshot = JSON.stringify(selectedSnapshot);

const snapshot = Agent.buildEngineeringSnapshot();
assert.strictEqual(snapshot.equipmentSelection.record.id, 'eq-1', 'snapshot should include selected equipment snapshot');

const actions = Agent.buildNextActions({
  rooms: [{
    id: 'room-1',
    label: 'Office',
    requiredBtu: 70000,
    selectedCapacityBtu: 60000,
    requiredCfm: 2400,
    selectedSystemCfm: 1800,
    validation: { items: [] }
  }],
  totals: { requiredBtu: 70000, requiredCfm: 2400, selectedCapacityBtu: 60000, selectedCfm: 1800 },
  projectState: { systemType: 'package' },
  equipmentSelection: selectedSnapshot,
  validation: { items: [] }
});

const codes = actions.map((action) => action.code);
assert.ok(codes.includes('equipment_capacity_below_project_load'), 'equipment review should catch undersized snapshot capacity');
assert.ok(codes.includes('equipment_airflow_below_project_requirement'), 'equipment review should catch low catalogue airflow');
assert.ok(codes.includes('equipment_esp_below_project_requirement'), 'equipment review should catch insufficient ESP');
assert.ok(codes.includes('equipment_electrical_mismatch_voltage'), 'equipment review should catch voltage mismatch');
assert.ok(codes.includes('equipment_catalogue_not_verified'), 'equipment review should require verified catalogue data');

const changedRequirementActions = Agent.buildNextActions({
  rooms: [{
    id: 'room-1',
    label: 'Office',
    requiredBtu: 84000,
    selectedCapacityBtu: 60000,
    requiredCfm: 3000,
    selectedSystemCfm: 1800,
    validation: { items: [] }
  }],
  totals: { requiredBtu: 84000, requiredCfm: 3000, selectedCapacityBtu: 60000, selectedCfm: 1800 },
  projectState: { systemType: 'package' },
  equipmentSelection: selectedSnapshot,
  validation: { items: [] }
});

assert.ok(
  changedRequirementActions.map((action) => action.code).includes('equipment_selection_requirements_changed'),
  'equipment review should warn when project requirements changed after equipment selection'
);

console.log('Equipment engineer review tests passed.');

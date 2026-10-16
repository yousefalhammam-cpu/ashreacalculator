const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.ok(app.includes('function generateHvacDesignScenarios'), 'central design scenario generator should exist.');
assert.ok(app.includes('function renderHvacDesignScenariosPanel'), 'project page should render design scenario cards.');
assert.ok(app.includes('function selectHvacDesignScenario'), 'scenario selection should be explicit and user-confirmed.');
assert.ok(app.includes('function compareHvacDesignScenario'), 'scenario comparison action should be available.');
assert.ok(app.includes('HVAC_SELECTED_SCENARIO_KEY'), 'selected scenario snapshot should be persisted separately.');
assert.ok(app.includes('STANDARD_HVAC_CAPACITIES'), 'scenario generator should use a central standard-capacity source.');
assert.ok(app.includes('function selectStandardScenarioCapacity'), 'scenario sizing should use standard market capacities.');
assert.ok(app.includes('catalogSource = (getCatalog(unitType) || []).map'), 'scenario capacities should reuse the same capacity catalogue as room/unit selectors.');
assert.ok(app.includes('maxOversizePct') && app.includes('hardOversizePct'), 'scenario capacity selection should cap excessive oversizing.');
assert.ok(app.includes('function isAcceptableConceptualOversize') && app.includes('function rankProjectLevelDesignScenarios'), 'scenario list should rank acceptable options before review-required fallbacks.');
assert.ok(app.includes('rankProjectLevelDesignScenarios(scenarios, 3)'), 'scenario panel should keep three project-level options when available.');
assert.ok(app.includes('Capacity oversize exceeds 10%; engineer review is required before selecting this scenario.'), 'scenario fallbacks above 10% should be clearly marked for engineer review.');
assert.ok(app.includes('maxOversizePct: 10') && app.includes('hardOversizePct: 25'), 'scenario options should target 10% oversizing while allowing bounded review fallbacks.');
assert.ok(!app.includes("source: 'design_scenario_preview'"), 'scenario generation must not create equipment snapshots.');
assert.ok(app.includes('saveSelectedHvacScenario()'), 'selected scenario should be saved only after explicit selection.');
assert.ok(app.includes('window.confirm(summary)'), 'selecting a scenario should ask for user confirmation.');
assert.ok(app.includes('Air-Cooled Chiller + AHU/FCU') || app.includes('تشيلر هواء + AHU/FCU'), 'central scenario should be a complete chiller + AHU/FCU system.');
assert.ok(app.includes('Existing Chilled Water + AHU/FCU'), 'existing chilled-water scenario should be represented as a complete system.');
assert.ok(app.includes("scenarioId: 'scenario_package_ducted'") && app.includes("scenarioId: 'scenario_multiple_ducted'"), 'package and ducted concepts should be separate scenario options.');
assert.ok(app.includes('5.5, 6, 6.5, 7'), 'central chiller conceptual sizing should use finer TR steps to avoid excessive oversizing.');
assert.ok(app.includes('AHU must be connected to a cooling source'), 'AHU-alone scenarios should be blocked or warned.');
assert.ok(app.includes('Dedicated Fresh Air System'), 'split/VRF scenarios should call out dedicated fresh air when required.');
assert.ok(app.includes('Conceptual scenario - standard capacity required before manufacturer selection'), 'missing concept capacity should be shown as conceptual, not fake equipment.');
assert.ok(app.includes('Manufacturer equipment selection happens after this scenario is approved'), 'manufacturer selection should be shown as a later step.');
assert.ok(app.includes('conceptualScenarioSnapshot'), 'selecting a scenario should save a conceptual scenario snapshot.');
assert.ok(app.includes("scenarioStatus: 'Equipment Pending'"), 'selected scenario should move to Equipment Pending before model selection.');
assert.ok(app.includes("selectionMode: 'conceptual'"), 'selected scenario project units should remain conceptual until real equipment is chosen.');
assert.ok(app.includes('selectedByUser = true') || app.includes('selectedByUser = true') || app.includes('selectedHvacDesignScenario.selectedByUser = true'), 'scenario should be marked user-selected only after confirmation.');
assert.ok(app.includes('projectSystems = (scenario.equipmentSelections || []).map'), 'applying a scenario should replace project equipment only.');
assert.ok(!app.includes('Best System'), 'scenario UI should not claim one absolute best system.');

assert.ok(styles.includes('.design-scenarios-panel'), 'scenario panel styles should exist.');
assert.ok(styles.includes('.scenario-card-grid'), 'scenario card grid styles should exist.');
assert.ok(styles.includes('repeat(auto-fit,minmax(230px,1fr))'), 'scenario cards should wrap inside the wider recommendations column.');
assert.ok(styles.includes('.scenario-actions button.primary'), 'scenario selection button style should exist.');

console.log('HVAC design scenarios tests passed.');

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'app/index.html'), 'latin1');
const selectorSource = fs.readFileSync(path.join(root, 'modules/equipment-selector.js'), 'utf8');

assert.ok(indexHtml.includes('id="equip-ai-select-btn"'), 'project page should include AI Select Equipment button');
assert.ok(indexHtml.includes('id="equip-select-modal"'), 'AI Select Equipment wizard modal should exist');
assert.ok(indexHtml.includes('id="equip-apply-selection-btn"'), 'selector wizard should expose a stable apply button id');
assert.ok(indexHtml.includes('modules/equipment-selector.js'), 'equipment selector module should be loaded');
assert.ok(indexHtml.includes('equipment-selection-engine.js'), 'deterministic selection engine should be loaded before selector UI');
assert.ok(indexHtml.includes('js/ai/ai-explanation-client.js'), 'AI explanation client contract should be loaded before selector UI');

assert.ok(selectorSource.includes('AirCalcEquipmentSelection'), 'selector UI should call deterministic selection engine');
assert.ok(selectorSource.includes('function recordMatchesSystemUnitType'), 'selector UI should filter catalogue records by project system subtype.');
assert.ok(selectorSource.includes("systemUnitType === 'chiller_air'") && selectorSource.includes("systemUnitType === 'chiller_water'"), 'selector UI should separate air-cooled and water-cooled chiller records.');
assert.ok(selectorSource.includes('req.systemUnitType'), 'selector UI should pass system subtype into the deterministic selection request.');
assert.ok(selectorSource.includes('function bucketHtml'), 'selector UI should render deterministic recommendation buckets');
assert.ok(selectorSource.includes('recommendationBuckets'), 'selector UI should use recommendation buckets returned by the engine');
assert.ok(selectorSource.includes('Recommendation Buckets'), 'selector UI should label recommendation buckets clearly');
assert.ok(selectorSource.includes('AI explanation is not connected yet'), 'AI explanation should be clearly marked as foundation');
assert.ok(selectorSource.includes('AirCalcAIExplanationClient'), 'selector UI should call the AI explanation client when configured');
assert.ok(selectorSource.includes('Rules Engine results and buckets remain unchanged'), 'AI failure should preserve deterministic results');
assert.ok(selectorSource.includes('equip-ai-meta'), 'AI explanation should render backend source metadata.');
assert.ok(selectorSource.includes('Provider: '), 'AI explanation should disclose the backend provider.');
assert.ok(selectorSource.includes('Source: '), 'AI explanation should disclose the deterministic source of truth.');
assert.ok(selectorSource.includes('AI does not generate numbers'), 'UI copy should state AI does not generate numbers');
assert.ok(selectorSource.includes('function selectedOptionReview'), 'selector UI should review the chosen option before binding');
assert.ok(selectorSource.includes('Rules Engine Pre-Bind Review'), 'selector UI should label pre-bind review as rules-engine output');
assert.ok(selectorSource.includes('equip-prebind-review'), 'selector UI should render a pre-bind review card');
assert.ok(selectorSource.includes('function updateApplyButtonState'), 'selector UI should synchronize apply button state with rules review');
assert.ok(selectorSource.includes("btn.disabled = blocked"), 'selector UI should disable apply when rules review blocks the option');
assert.ok(selectorSource.includes('Blocked by Rules Engine'), 'selector UI should explain disabled critical apply state');
assert.ok(selectorSource.includes("review.status === 'critical'"), 'selector UI should block critical choices before project binding');
assert.ok(selectorSource.includes('Critical equipment cannot be bound'), 'selector UI should explain blocked critical choices');
assert.ok(selectorSource.includes('preBindReview'), 'final selection snapshot should preserve the rules-engine pre-bind review');
assert.ok(selectorSource.includes("source: 'rules_engine'"), 'pre-bind review snapshot should identify rules engine as the source');
assert.ok(selectorSource.includes('selectionRequirements: lastResult && lastResult.requirements'), 'final selection should preserve selection requirements in the project snapshot');
assert.ok(selectorSource.includes('selectForProject(option.equipmentId, snapshotOption)'), 'final selection should pass enriched option snapshot to project binding');

global.window = global;
global.document = {
  readyState: 'loading',
  documentElement: { lang: 'en' },
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; }
};

vm.runInThisContext(selectorSource, { filename: 'modules/equipment-selector.js' });
assert.ok(global.AppEquipmentSelector, 'selector module should expose AppEquipmentSelector');
assert.strictEqual(typeof global.AppEquipmentSelector.readRequirements, 'function', 'selector should expose requirement reader for tests');
assert.strictEqual(typeof global.AppEquipmentSelector.runSelection, 'function', 'selector should expose runSelection');

console.log('Equipment selector UI tests passed.');

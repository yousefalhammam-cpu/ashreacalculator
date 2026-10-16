const assert = require('assert');
const Engine = require('../js/core/engineering-calculation-engine.js');

assert.ok(Engine.VALIDATION_THRESHOLDS, 'validation thresholds should be exported');
assert.ok(Engine.ASSUMPTION_SOURCES, 'assumption source notes should be exported');

const thresholds = Engine.VALIDATION_THRESHOLDS;

assert.strictEqual(thresholds.MATCH_MAX_OVERSIZE_PCT, 10, 'matched oversize threshold');
assert.strictEqual(thresholds.CAPACITY_REVIEW_MAX_OVERSIZE_PCT, 20, 'capacity review threshold');
assert.strictEqual(thresholds.GENERAL_OVERSIZE_HIGH_PCT, 25, 'general high oversize threshold');
assert.strictEqual(thresholds.DUCT_SUPPLY_PASS_MAX_FPM, 1200, 'duct supply pass fpm threshold');
assert.strictEqual(thresholds.DUCT_RETURN_PASS_MAX_FPM, 1000, 'duct return pass fpm threshold');
assert.strictEqual(thresholds.DUCT_REVIEW_MAX_FPM, 1400, 'duct review fpm threshold');
assert.strictEqual(thresholds.ESP_LOW_MAX_PA, 125, 'ESP low threshold');
assert.strictEqual(thresholds.ESP_VALIDATION_REVIEW_MAX_PA, 225, 'ESP validation review threshold');
assert.strictEqual(thresholds.ESP_SUMMARY_MEDIUM_MAX_PA, 225, 'ESP summary medium threshold');

assert.strictEqual(
  thresholds.ESP_VALIDATION_REVIEW_MAX_PA,
  thresholds.ESP_SUMMARY_MEDIUM_MAX_PA,
  'ESP validation and summary thresholds should be aligned'
);

[
  'DEFAULT_PEOPLE_BTUH',
  'DEFAULT_SAFETY_FACTOR',
  'DEFAULT_CFM_PER_TR',
  'DEFAULT_MARKET_STEP_BTUH',
  'DEFAULT_HEALTHCARE_DELTA_T_F',
  'AIR_HEAT_CONSTANT_IP',
  'VALIDATION_THRESHOLDS'
].forEach((key) => {
  assert.ok(Engine.ASSUMPTION_SOURCES[key], `${key} should have an assumption source note`);
});

const espAtUnifiedLimit = Engine.calculateEsp({
  lenSupM: 0,
  lenRetM: 0,
  bends: 0,
  frictionPaPerM: 0,
  bendLossPerPa: 0,
  otherLossPa: 225
});
assert.strictEqual(espAtUnifiedLimit.status.key, 'med', 'ESP at 225 Pa should still be medium/review');

const espAboveUnifiedLimit = Engine.calculateEsp({
  lenSupM: 0,
  lenRetM: 0,
  bends: 0,
  frictionPaPerM: 0,
  bendLossPerPa: 0,
  otherLossPa: 226
});
assert.strictEqual(espAboveUnifiedLimit.status.key, 'high', 'ESP above 225 Pa should be high/fail');

console.log('Engineering thresholds audit tests passed.');

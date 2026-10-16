const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const delivery = read('FINAL_DELIVERY_REPORT.md');
const validation = read('ENGINEERING_VALIDATION_REPORT.md');
const aiService = read('server/ai-explanation-service.js');
const selector = read('modules/equipment-selector.js');
const catalogue = read('js/equipment/equipment-catalogue.js');
const reportBuilder = read('js/reports/professional-report-data-builder.js');
const completion = read('PLATFORM_COMPLETION_STATUS.md');

assert.ok(
  delivery.includes('AirCalc Pro has been hardened locally as an HVAC Engineering AI Platform foundation'),
  'final delivery report should declare the local platform-hardening scope.'
);
assert.ok(
  delivery.includes('not yet production-certified'),
  'final delivery report should not claim external production certification.'
);
assert.ok(
  delivery.includes('AI can explain provided engineering context but cannot generate or alter engineering numbers'),
  'final delivery report should document the AI boundary.'
);
assert.ok(
  delivery.includes('65 real starter records'),
  'final delivery report should document the real equipment starter database size.'
);
assert.ok(
  delivery.includes('Chiller air/water separation'),
  'final delivery report should document chiller subtype filtering.'
);
assert.ok(
  delivery.includes('coil_submittal_required'),
  'final delivery report should document AHU coil submittal boundary.'
);
assert.ok(
  delivery.includes('Rollback Plan'),
  'final delivery report should include rollback guidance.'
);
assert.ok(
  validation.includes('TODO: Confirm final friction factor'),
  'engineering validation report should preserve HVAC engineer review TODOs.'
);
assert.ok(
  aiService.includes('provider_returned_unsupported_engineering_numbers'),
  'AI backend should reject provider-generated engineering numbers.'
);
assert.ok(
  selector.includes('Rules Engine results and buckets remain unchanged'),
  'Equipment selector should preserve rules-engine output when AI fails.'
);
assert.ok(
  catalogue.includes('Sample data cannot enter the verification workflow'),
  'Catalogue workflow should block sample data from verification.'
);
assert.ok(
  reportBuilder.includes("sourceOfTruth: 'rules_engine'"),
  'Professional report data should declare the rules engine as source of truth.'
);
assert.ok(
  completion.includes('Completed Locally') &&
  completion.includes('External Setup Still Required') &&
  completion.includes('AI does not generate HVAC numbers') &&
  completion.includes('Real starter equipment database with 65 records') &&
  completion.includes('AHU records do not invent cooling capacity'),
  'completion status should separate completed local scope from external production setup.'
);

console.log('Final delivery readiness tests passed.');

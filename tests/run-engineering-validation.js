const path = require('path');

const testFiles = [
  'engineering-calculation-engine.test.js',
  'engineering-data-integrity.test.js',
  'healthcare-room-standard-linking.test.js',
  'duct-module-engine-routing.test.js',
  'project-duct-cfm-routing.test.js',
  'engineering-workflow-smoke.test.js',
  'engineering-thresholds-audit.test.js',
  'engineering-ui-threshold-routing.test.js',
  'engineering-knowledge-base.test.js',
  'engineering-source-status.test.js',
  'engineering-agent-readiness.test.js',
  'equipment-snapshot.test.js',
  'equipment-engineer-review.test.js'
];

let failures = 0;

testFiles.forEach((file) => {
  try {
    require(path.join(__dirname, file));
    console.log(`[PASS] ${file}`);
  } catch (error) {
    failures += 1;
    console.error(`[FAIL] ${file}`);
    console.error(error && error.stack ? error.stack : error);
  }
});

if (failures > 0) {
  console.error(`Engineering validation failed: ${failures} test file(s).`);
  process.exit(1);
}

console.log('All engineering validation tests passed.');

const assert = require('assert');
const path = require('path');

global.window = {
  lang: 'en',
  quoteMode: 'room',
  ENGINEERING_SOURCE_STATUS: {},
  setTimeout: () => {},
  localStorage: {
    getItem: () => ''
  }
};

global.document = {
  readyState: 'loading',
  documentElement: { lang: 'en' },
  addEventListener: () => {},
  getElementById: () => null
};

require(path.resolve(__dirname, '..', 'modules', 'engineering-agent.js'));

const Agent = global.window.AppEngineeringAgent;
assert.ok(Agent, 'Engineering agent API should be exported on window');

const readySnapshot = {
  totals: {
    requiredBtu: 24000,
    requiredCfm: 800
  },
  rooms: [
    {
      id: 'room-1',
      label: 'Office',
      quoteLine: { up: 1000 }
    }
  ]
};

const ready = Agent.buildReportReadiness(readySnapshot, []);
assert.strictEqual(ready.reportStatus, 'ready', 'report should be ready without engineering actions');
assert.strictEqual(ready.quoteStatus, 'ready', 'quote should be ready when pricing exists');
assert.strictEqual(ready.finalApprovalStatus, 'ready', 'final approval should be ready without source-confirmation actions');
assert.strictEqual(ready.sourceConfirmationRequired, false, 'source confirmation should not be required without source actions');

const sourceReview = Agent.buildReportReadiness(readySnapshot, [
  {
    priority: 'warning',
    code: 'healthcare_source_confirmation',
    text: 'Confirm ASHRAE 170 source basis.'
  }
]);
assert.strictEqual(sourceReview.reportStatus, 'review', 'report should remain reviewable when source confirmation is pending');
assert.strictEqual(sourceReview.quoteStatus, 'review', 'priced quote should be review when source confirmation is pending');
assert.strictEqual(sourceReview.finalApprovalStatus, 'review', 'final approval should be review when source confirmation is pending');
assert.strictEqual(sourceReview.sourceConfirmationRequired, true, 'source confirmation flag should be true for source actions');
assert.ok(sourceReview.canReviewReport, 'report should still be reviewable');
assert.strictEqual(sourceReview.canIssueReport, false, 'report should not be marked final issue-ready while source confirmation is pending');

const blocked = Agent.buildReportReadiness(readySnapshot, [
  {
    priority: 'critical',
    code: 'project_capacity_undersized',
    text: 'Capacity is below required load.'
  }
]);
assert.strictEqual(blocked.reportStatus, 'blocked', 'critical engineering issues should block reports');
assert.strictEqual(blocked.quoteStatus, 'blocked', 'critical engineering issues should block quotes');
assert.strictEqual(blocked.finalApprovalStatus, 'blocked', 'critical engineering issues should block final approval');

console.log('Engineering agent readiness tests passed.');

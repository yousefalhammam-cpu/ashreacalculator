'use strict';
const assert = require('assert');
require('../js/copilot/copilot-health-engine.js');
const engine = global.AirCalcCopilotHealthEngine;
function project(source, cfm){
  return {totals:{requiredBtu:10000,selectedBtu:10500,requiredCfm:1000,selectedCfm:cfm},
    rooms:{count:1,missingInputs:0},systems:{items:[{equipmentSnapshot:{sourceStatus:source,model:'Test',voltage:230}}]},
    esp:{totalPa:100},validation:{items:[]}};
}
for(const source of ['unverified','real','catalogue','pending']){
  const snapshot = project(source,1000);
  assert(engine.calculateHealth(snapshot).metrics.find(x=>x.key==='equipmentVerification').score < 90);
  assert.strictEqual(engine.buildDeliveryReadiness(snapshot).readyForClient,false);
}
assert.strictEqual(engine.buildDeliveryReadiness(project('verified',900)).readyForClient,false);
assert.strictEqual(engine.buildDeliveryReadiness(project('verified',0)).readyForClient,false);
assert.strictEqual(engine.buildDeliveryReadiness(project('verified',1000)).readyForClient,true);
const excess = project('verified',1000);
excess.totals.selectedBtu = 12000;
assert(engine.buildRecommendations(excess).some(x=>x.title==='Review oversizing'));
console.log('Report readiness regression tests passed.');

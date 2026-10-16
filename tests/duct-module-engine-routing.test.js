const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const Engine = require(path.join(root, 'js/core/engineering-calculation-engine.js'));

global.window = global;
global.AirCalcEngineering = Engine;
global.getCatalog = function (unitType) {
  if (unitType === 'ahu') return [{ btu: 75600, cfm: 3500 }];
  return [{ btu: 24000 }, { btu: 36000 }];
};

const originalLog = console.log;
console.log = function () {};
vm.runInThisContext(fs.readFileSync(path.join(root, 'modules/duct.js'), 'utf8'), {
  filename: 'modules/duct.js'
});
console.log = originalLog;

assert.ok(global.AppDuct, 'AppDuct namespace should be available');

const appDuct = global.AppDuct.calcDuctSize(2544, 1000);
const engineDuct = Engine.calculateDuctSize({
  cfm: 2544,
  velocityFpm: 1000,
  standardSizes: global.AppDuct.getDuctStd(),
  minSideMm: 150,
  maxSideMm: 1800,
  maxAspectRatio: 4,
  preferredHeightsMm: [150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800]
});

assert.deepStrictEqual(appDuct, engineDuct, 'AppDuct.calcDuctSize should route to Engineering Engine');

assert.strictEqual(
  global.AppDuct.calcDuctSize(1000, -1000),
  null,
  'AppDuct.calcDuctSize should not expose invalid engine results as duct sizes'
);

assert.deepStrictEqual(
  global.AppDuct.advancedDuctAnalysis(2544, 700, 350, 30),
  Engine.calculateAdvancedDuctAnalysis({
    cfm: 2544,
    widthMm: 700,
    heightMm: 350,
    lengthM: 30,
    frictionFactor: global.AppDuct.ASHRAE.f
  }),
  'AppDuct.advancedDuctAnalysis should route to Engineering Engine'
);

assert.strictEqual(
  global.AppDuct.advancedDuctAnalysis(1000, 700, 350, -1),
  null,
  'AppDuct.advancedDuctAnalysis should not expose invalid engine results'
);

assert.deepStrictEqual(
  global.AppDuct.getDuctCfm('ahu', 75600, 2544, 400),
  { cfm: 3500, source: 'unit', label: 'CFM Source: Selected Unit CFM' },
  'catalog CFM should have priority'
);

assert.deepStrictEqual(
  global.AppDuct.getDuctCfm('split', 24000, 848, 400),
  { cfm: 800, source: 'tr', label: 'CFM Source: Selected TR × 400' },
  'BTU-only catalog should resolve CFM from selected TR'
);

assert.deepStrictEqual(
  global.AppDuct.getProjDuctCfm('split', 24000, 2, 1696, 400),
  { cfm: 1600, source: 'tr', label: 'CFM Source: Selected TR × 400 × 2 units' },
  'project duct CFM label should preserve the multiplication symbol'
);

assert.deepStrictEqual(
  global.AppDuct.getDuctCfm('split', 0, 848, 400),
  { cfm: 848, source: 'calc', label: 'CFM Source: Calculated Supply CFM' },
  'fallback should use calculated supply CFM'
);

assert.strictEqual(
  global.AppDuct.ductSizeLabel({ w: 700, h: 350 }),
  '700×350 mm',
  'duct size label should preserve the multiplication symbol'
);

console.log('Duct module engine routing tests passed.');

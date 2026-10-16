const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert(
  appSource.includes('function getProjectDuctCfmFromSelection'),
  'app.js should expose a project duct CFM helper'
);

assert(
  appSource.includes('getProjDuctCfm(utKey, selBtu, qty, 0, cfmPerTr)'),
  'project duct CFM helper should route through getProjDuctCfm'
);

assert(
  !/Math\.round\(\s*\(?\s*projState\.selBtu\s*\/\s*12000\s*\)?\s*\*\s*_[a-zA-Z0-9]*CfmPerTr/.test(appSource),
  'project duct summaries should not manually derive selected-unit CFM from projState.selBtu/12000'
);

assert(
  !/projState\.selBtu\s*>\s*0\s*\?\s*Math\.round\(\s*\(?\s*projState\.selBtu\s*\/\s*12000/.test(appSource),
  'project duct summaries should use the duct CFM resolver instead of manual TR conversion'
);

console.log('Project duct CFM routing tests passed.');

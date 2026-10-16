const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function functionBody(name) {
  const marker = `function ${name}`;
  const start = appSource.indexOf(marker);
  assert.ok(start >= 0, `${name} should exist`);
  const next = appSource.indexOf('\nfunction ', start + marker.length);
  return appSource.slice(start, next > start ? next : undefined);
}

const calcRotBody = functionBody('calcROT');
const calcHcBody = functionBody('calcHC');
const saveHistBody = functionBody('saveHist');
const renderTechReportBody = functionBody('renderTechReport');
const renderQuotationBody = functionBody('renderQuotation');
const renderProjBlockBody = functionBody('renderProjBlock');

assert(
  calcRotBody.includes('window.AirCalcEngineering.calculateGeneralRoom'),
  'general room workflow should use the central Engineering Calculation Engine'
);

assert(
  calcHcBody.includes('window.AirCalcEngineering.calculateHealthcareRoom'),
  'healthcare room workflow should use the central Engineering Calculation Engine'
);

assert(
  saveHistBody.includes('syncProjectRecommendation') &&
    saveHistBody.includes('renderCalcWorkflowCard') &&
    saveHistBody.includes('renderTechReport') &&
    saveHistBody.includes('renderQuotation') &&
    saveHistBody.includes('refreshGrandTotal') &&
    saveHistBody.includes('updateDirectResults'),
  'saving a calculated room should refresh project, technical report, quotation, and direct results'
);

assert(
  renderTechReportBody.includes('renderQuote()'),
  'technical report workflow should render from the shared quote/report source'
);

assert(
  renderQuotationBody.includes('renderQuote()'),
  'quotation workflow should render from the shared quote/report source'
);

assert(
  renderProjBlockBody.includes('getProjDuctCfm') &&
    renderProjBlockBody.includes('calcDuctSize') &&
    renderProjBlockBody.includes('calcESP'),
  'project unit workflow should keep duct CFM, duct sizing, and ESP connected'
);

assert(
  appSource.includes('function getSelectedProjectEquipmentBtu') &&
    appSource.includes('function getSelectedProjectEquipmentCfm'),
  'project readiness workflow should expose selected equipment BTU and CFM summaries'
);

console.log('Engineering workflow smoke tests passed.');

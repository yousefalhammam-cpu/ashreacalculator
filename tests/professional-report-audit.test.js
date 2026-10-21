const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'app', 'index.html'), 'latin1');
const projectsSource = fs.readFileSync(path.join(root, 'modules', 'projects.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function mustContain(source, needle, message) {
  assert(source.includes(needle), message);
}

mustContain(
  appSource,
  'function getReportProjectMeta()',
  'technical report should centralize project metadata'
);

[
  'clientName',
  'location',
  'designer',
  'reportReference',
  'getCentralizedReportMeta',
  'var reportIdentity = reportData && reportData.identity',
  'professional-report-identity',
  'meta.city = reportIdentity.city',
  'meta.buildingType = reportIdentity.buildingType',
  'meta.engineer = reportIdentity.engineer',
  'meta.date = reportIdentity.date',
  'getProfessionalReportDataForReport',
  'refreshProfessionalReportDataCache',
  'AirCalcProfessionalReportData.buildProfessionalReportData',
  '_lastProfessionalReportData',
  'getCentralizedReportSummary',
  'professional-report-summary',
  'centralized.summary.selectedCapacityBtuH',
  'centralized.summary.selectedSupplyCfm',
  'function renderTechReportEngineeringSummary()',
  'totalBtu = centralized.summary.coolingLoadBtuH',
  'selectedCfm = centralized.summary.selectedSupplyCfm',
  'var reportRooms = reportData && Array.isArray(reportData.rooms)',
  'data-report-source="professional-report-data"',
  'var ductAndEsp = reportData && reportData.ductAndEsp',
  'data-report-source="professional-report-duct-esp"',
  'data-report-schema-version',
  'data-report-source-of-truth',
  'getReportReferenceNumber',
  'getCurrentSavedProjectForReport',
  'getReportProjectLink',
  'buildReportQrHtml',
  'waitForPdfImages',
  'refreshReportIdentityFields',
  'getReportLanguagePreference',
  'getEffectiveReportLanguage',
  'buildTechnicalReportHeaderHtml'
].forEach((field) => {
  mustContain(appSource, field, `technical report should include ${field}`);
});

[
  'professional-report-header-identity',
  "getCentralizedReportMeta(c.isAr ? 'ar' : 'en')",
  'meta.reportReference = reportIdentity.reportReference || meta.reportReference'
].forEach((field) => {
  mustContain(appSource, field, `technical PDF header should read centralized identity: ${field}`);
});

[
  'readSelectedEquipmentSnapshotForReport',
  'function getReportSelectedEquipmentItems',
  'function renderTechReportSelectedEquipmentCompactSection',
  'renderTechReportSelectedEquipmentSnapshotSection',
  'var reportSnapshot = reportData && reportData.equipmentSnapshot',
  'professional-report-equipment-snapshot',
  'Selected Equipment',
  'Technical Details',
  'var reportNotes = reportData && Array.isArray(reportData.engineeringNotes)',
  'professional-report-engineering-notes',
  'var reportValidation = reportData && reportData.validation',
  'professional-report-validation',
  'aircalc_last_selected_equipment_snapshot',
  'Catalogue Status',
  'Saudi Availability',
  'Selection Capacity Delta',
  'Selection CFM Delta',
  'Current Capacity Delta',
  'Current CFM Delta',
  'Requirement Status',
  'Project requirements changed after equipment selection',
  'AHU cooling capacity is not approved from the equipment database',
  'Coil submittal required',
  'Pre-Bind Review',
  'Snapshot Time'
].forEach((field) => {
  mustContain(appSource, field, `technical report should include equipment snapshot field ${field}`);
});

[
  'id="report-client"',
  'id="report-location"',
  'id="report-designer"',
  'id="report-language"',
  'id="tech-duct-slot"',
  'oninput="refreshReportIdentityFields()"'
].forEach((field) => {
  mustContain(indexSource, field, `technical report form should include ${field}`);
});

mustContain(
  indexSource,
  'onchange="refreshReportIdentityFields()"',
  'report language changes should refresh the technical report'
);

[
  'snap.reportMeta',
  "clientName: (_getCurrentProjectField('report-client'",
  "location: (_getCurrentProjectField('report-location'",
  "designer: (_getCurrentProjectField('report-designer'",
  "language: _getCurrentProjectField('report-language'",
  "sv('report-client'",
  "sv('report-location'",
  "sv('report-designer'",
  "sv('report-language'"
].forEach((field) => {
  mustContain(projectsSource, field, `project save/restore should preserve ${field}`);
});

mustContain(
  appSource,
  'var reportLang = getEffectiveReportLanguage()',
  'technical PDF export should use the selected report language'
);

[
  'HVAC Technical Report',
  'Design & Validation Summary',
  'TECHNICAL REPORT',
  'Report Status',
  'Preliminary Engineering Review',
  'Project QR',
  'api.qrserver.com/v1/create-qr-code',
  'report-qr-card',
  'report-qr-img',
  "classList.contains('report-qr-img')",
  'replaceChild(fallback, img)',
  'waitForPdfImages(wrap, 2500)'
].forEach((label) => {
  mustContain(appSource, label, `technical PDF header should include ${label}`);
});

[
  'Cooling Load',
  'BTU/h Required',
  'TR',
  'CFM',
  'Outdoor Air',
  'Exhaust',
  'ACH',
  'Pressure',
  'Temp / RH',
  'Duct Recommendations',
  'ESP',
  'Engineering Notes & Recommendations',
  'ASHRAE References'
].forEach((label) => {
  mustContain(appSource, label, `technical report should preserve ${label} content`);
});

assert(
  !appSource.includes(`color:'+_bmBtuClr+';font-weight:700">'+_bmProjStatus.percentText`),
  'project-unit PDF summary should not reference out-of-scope bundle variables'
);

const foundationMatch = appSource.match(/function renderTechReportFoundation\(\)[\s\S]*?function renderRoomValidationSection/);
assert(foundationMatch, 'technical report foundation renderer should exist');
assert(
  !foundationMatch[0].includes('renderTechReportChartsSection()'),
  'technical report page should not render Engineering Charts & Analytics'
);
assert(
  !foundationMatch[0].includes('renderTechReportProjectInfoSection()'),
  'technical report page should not duplicate project identity fields inside the analysis body'
);
mustContain(appSource, "var techDuctSlot = G('tech-duct-slot')", 'technical report should have a dedicated duct slot');
mustContain(appSource, "techDuctSlot.appendChild(ductBlock)", 'basic duct sizing should move to the technical report duct slot');
mustContain(appSource, "techDuctSlot.appendChild(advDuctBlock)", 'advanced duct analysis should move to the technical report duct slot');
mustContain(foundationMatch[0], 'report-dashboard', 'technical report should use the decision dashboard');
mustContain(foundationMatch[0], 'report-decision', 'technical report should start with actionable review');
mustContain(foundationMatch[0], 'report-equipment', 'equipment selection should remain accessible');
mustContain(foundationMatch[0], 'report-static-panel', 'supporting evidence should remain visible without collapsing');
mustContain(foundationMatch[0], 'renderProjectContextSummary()', 'room names and cooling totals should stay above report topics');
assert(!foundationMatch[0].includes('renderTechReportEquipmentRecommendationsSection()'), 'manufacturer selection belongs to commercial quotation');
mustContain(stylesSource, '.desktop-shell #p-calc.panel.on', 'home page should have a clear desktop grid layout');
mustContain(stylesSource, 'grid-template-columns:minmax(420px,.92fr) minmax(560px,1.08fr)', 'home page should place input and workflow cards side by side');
mustContain(stylesSource, '.workspace-shell.desktop-page-dashboard', 'dashboard shell should control the home page layout directly');
mustContain(stylesSource, '.workspace-shell.desktop-page-dashboard .desktop-insights', 'home page should not add a third desktop insights column');
mustContain(stylesSource, 'grid-template-columns:minmax(460px,.9fr) minmax(640px,1.18fr)', 'home page should render with a wider left recommendations/workflow column on desktop');
mustContain(indexSource, 'workspace-shell desktop-page-dashboard insights-hidden', 'home page should start in the two-column dashboard layout before JavaScript runs');
mustContain(appSource, 'var showInsights = false', 'home page should not render a third desktop insights column');
mustContain(stylesSource, '.workspace-shell.desktop-page-dashboard #p-calc .room-top-row', 'room data panel should have a dashboard-specific layout');
mustContain(stylesSource, 'grid-template-columns:repeat(2,minmax(0,1fr)) !important;', 'room data top fields should render as a balanced 2x2 grid on desktop');
mustContain(stylesSource, 'white-space:normal !important;', 'room data labels should not be clipped on desktop');
mustContain(stylesSource, '#p-tech #tech-duct-slot .calc-mode-row', 'technical report should keep duct design controls visible inside the duct slot');
mustContain(stylesSource, '#p-tech #tech-duct-slot #proj-duct-block', 'technical report should place project duct sizing inside the duct slot grid');
mustContain(appSource, 'tech-section-inline-head', 'technical report should label the duct design section near its controls');
mustContain(stylesSource, '#p-tech #tech-duct-slot .tech-section-inline-head', 'technical report duct heading should be styled inside the duct slot');
mustContain(stylesSource, '.tech-layout-span-7', 'technical report should style wider primary sections');
mustContain(stylesSource, '.tech-layout-span-5', 'technical report should style compact secondary sections');
mustContain(appSource, 'function toEnglishDigits(value)', 'technical report should normalize Arabic/Persian digits to English digits');
mustContain(appSource, 'window.AirCalcEnforceTechnicalReportEnglishDigits', 'technical report digit normalization should be available to Copilot');
mustContain(appSource, 'enforceTechnicalReportEnglishDigits();', 'technical report should enforce English digits after rendering');
[
  'renderTechReportDashboardSummarySection()',
  'renderTechReportEngineeringSummary()',
  'renderTechReportEquipmentTable()',
  'renderTechReportSelectedEquipmentSnapshotSection()',
  'renderTechReportRoomLoadTable()',
  'renderTechReportValidationTable()',
  'renderTechReportNotesRecommendationsSection()',
  'renderTechReportCriticalAlertsSection(true)',
  'renderTechReportDuctRecommendationsSection()',
  'renderTechReportAshraeReferencesSection()'
].forEach((section) => {
  mustContain(foundationMatch[0], section, `technical report page should keep important section ${section}`);
});

[
  'function getEquipmentRecordsForReportRecommendations',
  'function findManufacturerMatchesForScenario',
  'function buildTechnicalReportModel',
  'function renderTechReportCriticalAlertsSection',
  'function renderTechReportSelectedScenarioSection',
  'function renderTechReportAirflowReviewSection',
  'function renderTechReportEquipmentRecommendationsSection',
  'equipment-database-recommendations',
  'Manufacturer Recommendations',
  'getManufacturerRecommendationMatchRules',
  'Exact or Near Match',
  'Acceptable Match',
  'Alternative Configuration',
  'manufacturer-rec-compact',
  'manufacturer-rec-details',
  'View Other Recommendations',
  'Manufacturer',
  'Model',
  'Standard Capacity',
  'Total Capacity',
  'selectReportManufacturerRecommendation'
].forEach((field) => {
  mustContain(appSource, field, `technical report should include equipment database recommendations: ${field}`);
});

console.log('Professional report audit passed.');

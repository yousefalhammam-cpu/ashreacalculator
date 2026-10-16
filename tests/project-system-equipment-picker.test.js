const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'app', 'index.html'), 'latin1');
const selector = fs.readFileSync(path.join(root, 'modules', 'equipment-selector.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.ok(app.includes('function openProjectSystemEquipmentSelector'), 'project system should still be able to open the dedicated equipment selector.');
assert.ok(app.includes('function applyProjectSystemEquipmentSelection'), 'project system should apply a selected catalogue equipment snapshot.');
assert.ok(app.includes('function applyProjectSystemManualCapacity'), 'project system should keep manual generic capacity as a fallback.');
assert.ok(app.includes('function promptProjectSystemManualCapacity'), 'manual capacity entry should remain available as a fallback.');
assert.ok(!app.includes("if(quoteMode === 'proj' && !projectSystems.length){\n    seedProjectSystemsFromLegacyState();\n  }\n  syncLegacyProjectStateFromSystems();"), 'rendering the project block should not recreate the first unit after deleting it.');
assert.ok(app.includes("modal.classList.add('on')"), 'opening the dedicated selector should force the selector modal visible.');
assert.ok(app.includes('function getProjectSystemCapacityDropdownOptions'), 'equipment record option builder should remain available for the dedicated equipment selector path.');
assert.ok(app.includes('function handleProjectSystemCapacityDropdown'), 'capacity select changes should update the selected project system.');
assert.ok(app.includes('function applyBestProjectSystemAutomatically'), 'project auto-select button should apply a deterministic best capacity and quantity.');
assert.ok(app.includes('function getBestProjectSystemAutoSelection'), 'project auto-select should score available capacity options instead of using a simple first-fit pick.');
assert.ok(app.includes('function getBestProjectSystemDatabaseSelection'), 'dedicated equipment selection should still support real equipment database records.');
assert.ok(app.includes('function getInstalledEquipmentPerformance'), 'installed equipment performance should be centralized for calculations and reports.');
assert.ok(app.includes("equipmentReviewStatus = 'standard_capacity_auto'") || app.includes("equipmentReviewStatus: 'standard_capacity_auto'"), 'project auto-select should identify standard-capacity automatic selections.');
assert.ok(app.includes("equipmentSnapshot = null"), 'standard project auto-select should not create an equipment snapshot.');
assert.ok(app.includes('selectedManufacturer') && app.includes('selectedModel') && app.includes('totalInstalledCapacityBtuH'), 'database selection should persist manufacturer, model, and installed capacity fields.');
assert.ok(app.includes('undersizedBtu') && app.includes('oversizePenalty') && app.includes('cfmPenalty'), 'project auto-select should penalize undersized BTU, excessive oversize, and weak CFM matches.');
assert.ok(app.includes('btuDeltaPct') && app.includes('cfmDeltaPct'), 'project auto-select should compare selected capacity and airflow against the required project targets.');
assert.ok(app.includes('window.applyBestProjectSystemAutomatically = applyBestProjectSystemAutomatically'), 'project auto-select should be callable from the UI.');
assert.ok(app.includes('systemUnitType: system.unitType'), 'project system selector context should preserve the original system type.');
assert.ok(!app.includes('AirCalcSampleEquipmentRecords'), 'capacity selection should not force sample units into professional selection.');
assert.ok(app.includes('Sample - test only'), 'sample units in the equipment selector should be clearly labelled.');
assert.ok(app.includes('not for final engineering approval'), 'sample unit selection should preserve the final-approval warning.');
assert.ok(app.includes('function mapEquipmentTypeToProjectSystemType'), 'catalogue equipment types should map safely back to project system types.');
assert.ok(app.includes("unitType === 'chiller_air' || unitType === 'chiller_water'"), 'chiller project system types should map to chiller catalogue records.');
assert.ok(app.includes('function isProjectSystemEquipmentRecordCompatible'), 'equipment selection should check project/equipment compatibility.');
assert.ok(app.includes("systemUnitType === 'chiller_air'") && app.includes("systemUnitType === 'chiller_water'"), 'equipment selection should separate air-cooled and water-cooled chillers.');
assert.ok(app.includes('equipmentDatabaseId'), 'project system should persist equipmentDatabaseId.');
assert.ok(app.includes('equipmentSnapshot'), 'project system should persist a full equipment snapshot.');
assert.ok(app.includes("source: 'equipment_selector_main_page'"), 'snapshot should identify the main-page selector source.');
assert.ok(app.includes("sourceOfTruth: 'rules_engine'"), 'equipment snapshot should keep rules engine as source of truth.');
assert.ok(app.includes('quotationDraft'), 'selected equipment should persist an automatic quotation draft on the project system.');
assert.ok(app.includes('function buildAutomaticQuotationDraft'), 'automatic quotation creation should build a draft from the selected equipment snapshot.');
assert.ok(app.includes('function renderAutomaticQuotationDraft'), 'quotation page should render the automatic commercial draft.');
assert.ok(app.includes('The selected equipment has changed'), 'changing manufacturer should request quotation update confirmation.');
assert.ok(app.includes('Select This Equipment'), 'technical report recommendations should expose an explicit equipment-selection workflow action.');
assert.ok(app.includes("openDesktopView('hist')"), 'selecting report equipment should move directly to the commercial quotation page.');
assert.ok(app.includes('data-quotation-source="equipment-snapshot"'), 'quotation should declare the equipment snapshot as its source.');
assert.ok(app.includes('auto-quote-transfer-grid'), 'quotation should display the transferred project and engineering snapshot fields.');
assert.ok(app.includes('Fresh Air Notes'), 'quotation should carry fresh-air notes from the engineering workflow.');
assert.ok(app.includes('Enter prices only here') && app.includes('Enter price here'), 'quotation should clearly expose commercial price entry fields.');
assert.ok(app.includes('function updateQuotationLineLive'), 'quotation price inputs should persist while typing without forcing a redraw.');
assert.ok(app.includes('window.updateQuotationLineLive = updateQuotationLineLive'), 'quotation live price handler should be exposed for generated HTML inputs.');
assert.ok(app.includes('window.updateQuotationDraftFieldLive = updateQuotationDraftFieldLive'), 'quotation live draft handler should be exposed for generated HTML inputs.');
assert.ok(app.includes('function bindQuotationLivePricingDelegates'), 'quotation price fields should have delegated live calculation handlers.');
assert.ok(app.includes('function recalcAutomaticQuotationCardFromDom'), 'quotation card should recalculate visible totals from DOM input values.');
assert.ok(app.includes('function refreshProjectQuotationTotalsFromDom'), 'project quotation totals should refresh from visible quotation cards.');
assert.ok(app.includes('data-auto-quote-line-field="unitPrice"'), 'quotation unit price inputs should declare their calculation field.');
assert.ok(app.includes('data-auto-quote-line-key'), 'quotation line rows should expose their cost category for DOM totals.');
assert.ok(app.includes('oninput="updateQuotationLineLive'), 'quotation unit price fields should save values before blur/navigation.');
assert.ok(app.includes('function refreshAutomaticQuotationSummary'), 'quotation summary should recalculate live after price edits.');
assert.ok(app.includes('function updateQuotationDraftFieldLive'), 'quotation draft discount should recalculate totals live.');
assert.ok(app.includes('data-auto-quote-summary="grand"'), 'quotation should expose a live grand total field.');
assert.ok(app.includes('installationCost') && app.includes('accessoriesCost'), 'quotation totals should separate installation and accessories from equipment cost.');
assert.ok(app.includes('function ensureXlsxForHap'), 'HAP export should lazy-load the Excel library only when needed.');
assert.ok(app.includes('xlsxLoadPending'), 'HAP export lazy loader should prevent duplicate CDN requests.');

assert.ok(app.includes('project-capacity-control'), 'central project capacity field should use the same compact control shell as per-room capacity.');
assert.ok(app.includes('class="qi-cap-sel" onchange="updateProjectSystem'), 'central project capacity should use the same numeric capacity select behavior as per-room units.');
assert.ok(app.includes('var capacityCatalog = getCatalog(system.unitType)'), 'central project capacity field should use the same unit catalogue as per-room capacity.');
assert.ok(app.includes("value.indexOf('equip:')"), 'dedicated equipment selector application path should still support equipment record values.');
assert.ok(!app.includes('var capacityCatalog = getProjectSystemCapacityDropdownOptions(system);'), 'central project capacity dropdown should not render equipment database manufacturer options.');
assert.ok(app.includes('getUnitAirflowCfm(system)') && app.includes('selectionOption'), 'selected equipment CFM should flow from the equipment snapshot when available.');

assert.ok(selector.includes('selectionContext'), 'selector should keep the opening context.');
assert.ok(selector.includes('openForProjectSystem'), 'selector should expose a project-system opening API.');
assert.ok(selector.includes('applyProjectSystemEquipmentSelection'), 'selector should apply catalogue selections to the originating project unit.');
assert.ok(selector.includes('applyProjectSystemManualCapacity'), 'selector should apply manual capacity to the originating project unit.');
assert.ok(selector.includes('Select Market Equipment'), 'selector should offer the market equipment path.');
assert.ok(selector.includes('Manual Capacity'), 'selector should offer the manual capacity path.');
assert.ok(selector.includes('Manual generic capacity is not a verified manufacturer model'), 'manual capacity should be clearly labelled as generic.');
assert.ok(selector.includes('AI Select Best Equipment'), 'selector button should use the requested English label.');
assert.ok(selector.includes('\\u0627\\u062e\\u062a\\u064a\\u0627\\u0631 \\u0623\\u0641\\u0636\\u0644'), 'selector Arabic button label should be encoding-safe.');
assert.ok(indexHtml.includes('<option value="cassette">Cassette</option>'), 'selector modal should include cassette equipment type.');
assert.ok(indexHtml.includes('<option value="window">Window</option>'), 'selector modal should include window equipment type.');
assert.ok(indexHtml.includes('data/equipment-records.real.js?v=20260725g'), 'index should load real equipment seed records.');
assert.ok(indexHtml.includes('modules/equipment-selector.js?v=20260725c'), 'index should load the updated equipment selector script.');
assert.ok(indexHtml.includes('onclick="applyBestProjectSystemAutomatically()"'), 'project auto-select CTA should call the deterministic project unit selector.');
assert.ok(indexHtml.includes('app.js?v=20261001a'), 'index should load the updated app script.');
assert.ok(indexHtml.includes('styles.css?v=20261001a'), 'index should load the updated stylesheet.');
assert.ok(!indexHtml.includes('desktop-export-pdf-label'), 'topbar should not expose a generic PDF button; exports should live inside their workflow pages.');
assert.ok(!indexHtml.includes('xlsx.full.min.js'), 'index should not load the Excel CDN during startup.');
assert.ok(!indexHtml.includes('id="btn-techpdf"'), 'quotation page should not keep a hidden technical-report PDF button.');
assert.ok(indexHtml.includes('desktop-sidebar-logo'), 'application logo should remain in the desktop sidebar.');
assert.ok(!indexHtml.includes('desktop-topbar-logo'), 'application logo should be removed from the page topbar.');
assert.ok(!indexHtml.includes('logo-brand-img'), 'application logo should be removed from the legacy page header.');

assert.ok(styles.includes('.qi-cap-sel'), 'shared capacity select should keep local styling.');
assert.ok(!styles.includes('.project-equipment-picker-select'), 'capacity picker should not use the old browser-native white dropdown class.');
assert.ok(styles.includes('.equip-manual-capacity-panel'), 'manual capacity panel should have local styling.');

console.log('Project system equipment picker tests passed.');






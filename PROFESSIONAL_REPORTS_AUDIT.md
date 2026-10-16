# AirCalc Pro - Professional Reports Audit

## Phase 1 Scope

This phase improves the existing technical report and PDF path without changing HVAC calculations or quotation pricing.

## Implemented

- Added centralized technical report metadata in `getReportProjectMeta()`.
- Added report reference generation in the format `ACP-TR-{ProjectNo}-{YYYYMMDD}`.
- Added client, location, designer, report reference, project link, and QR availability status to the technical report prelude.
- Expanded the technical report project information section with professional report identity fields.
- Added editable technical report fields for client, location, and designer in the report panel.
- Persisted client, location, and designer fields in local project save/restore snapshots.
- Added live report refresh when report identity fields change.
- Expanded the technical room-load table with Outdoor Air CFM, Exhaust CFM, and Temperature / RH fields.
- Persisted healthcare room temperature and RH ranges with new healthcare calculations so saved projects keep report-ready environmental criteria.
- Added a report language preference (`Auto`, `Arabic`, `English`) in the technical report panel.
- Persisted report language preference in local project save/restore snapshots.
- Technical PDF export now builds the report in the selected report language while preserving the UI language after export.
- Replaced the old technical PDF heading with a professional HVAC Technical Report header.
- Added report status, report reference, project, client, location, designer, date, and QR/link status to the PDF header block.
- Added a Project QR card in the technical PDF header when a stable HTTP/cloud project URL is available.
- Renamed the technical page title from technician-detail wording to design and validation summary wording.
- Fixed a project-unit PDF summary crash caused by out-of-scope bundle variables.
- Added `tests/professional-report-audit.test.js` to guard the report metadata and project-unit PDF crash fix.

## Current Limitations

- QR Code rendering depends on an HTTP/cloud project URL and the external QR image endpoint being reachable during PDF generation.
- Existing PDF rendering still uses `html2canvas` and `jsPDF`; no new library was added in this phase.

## Verification

- `node --check app.js`
- `node --check modules\projects.js`
- `node tests\run-engineering-validation.js`
- `node tests\professional-report-audit.test.js`
- Browser smoke test should load `http://127.0.0.1:5500/app/index.html` with the latest cache-busted `app.js`, visible report identity/language fields, and no console issues.

## Next Recommended Step

Run visual PDF QA for Arabic and English exports with a cloud-saved project URL.
# Professional Reports Update

## Report Data Foundation

`js/reports/professional-report-data-builder.js` now provides `AirCalcProfessionalReportData.buildProfessionalReportData()`.

The builder centralizes professional report data into a stable JSON contract for future PDF, backend rendering, and SaaS APIs. It does not replace calculation formulas and does not generate HVAC numbers from AI.

`app.js` now calls the builder through `refreshProfessionalReportDataCache()` when rendering the technical report and when building the technical PDF page. The latest structured payload is stored in `window._lastProfessionalReportData`, and the report DOM receives schema/source metadata for future backend and QA tooling.

The executive summary metrics now prefer `window._lastProfessionalReportData.summary` when available, while retaining legacy function fallbacks. This starts reducing duplicate report aggregation without changing calculation formulas.

`getCentralizedReportSummary()` now normalizes `window._lastProfessionalReportData.summary` in one place. Dashboard summary and engineering summary share this helper instead of repeating report summary extraction.

The room load table now prefers `window._lastProfessionalReportData.rooms` and marks the table with `data-report-source="professional-report-data"`. Legacy row-building remains as a fallback if the report data builder is unavailable.

The engineering summary Capacity/Airflow checks now prefer `window._lastProfessionalReportData.summary`, with legacy function fallbacks retained.

The duct recommendations section now prefers `window._lastProfessionalReportData.ductAndEsp` and marks the table with `data-report-source="professional-report-duct-esp"`. Legacy `_lastDuctSizing` rendering remains as fallback.

The selected equipment snapshot section now prefers `window._lastProfessionalReportData.equipmentSnapshot` and marks the section with `data-report-source="professional-report-equipment-snapshot"`. Direct localStorage reading remains as fallback.

The engineering notes and recommendations section now prefers `window._lastProfessionalReportData.engineeringNotes` and marks the reasoning block with `data-report-source="professional-report-engineering-notes"`. Legacy note aggregation remains as fallback.

The engineering validation table now prefers `window._lastProfessionalReportData.validation.items` and marks the table with `data-report-source="professional-report-validation"`. Legacy validation rendering remains as fallback.

The project information section now prefers `window._lastProfessionalReportData.identity` and marks the section with `data-report-source="professional-report-identity"`. The centralized identity now includes project name, project number, client, location, city, building type, engineer, designer, date, and report reference.

The technical PDF header now prefers `window._lastProfessionalReportData.identity` and marks the metadata block with `data-report-source="professional-report-header-identity"`. Legacy header metadata remains as fallback.

`app.js` now uses `getCentralizedReportMeta()` to merge legacy project metadata with `window._lastProfessionalReportData.identity` in one place. The technical header and project information section share this helper.

Current report data sections:

- Project identity and report reference.
- Executive engineering summary.
- Room table with cooling load, TR, supply CFM, outdoor air, exhaust, ACH, pressure, and temperature/RH ranges where available.
- Duct and ESP summary from the latest deterministic duct/ESP results.
- Deterministic validation summary from Rules Engine.
- Engineering notes.
- Selected equipment snapshot.
- AI policy declaration showing that AI is explain-only and does not generate engineering numbers.

Test coverage:

- `tests/professional-report-data-builder.test.js`

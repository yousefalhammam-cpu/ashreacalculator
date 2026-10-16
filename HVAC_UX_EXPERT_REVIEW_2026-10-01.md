# AirCalc Pro: HVAC and UX Review

Date: 2026-10-01
Scope: read-only product review; application code was not changed.

## Verdict

The workflow has useful foundations, but clarity and readiness signals are not yet reliable enough to describe the product as consistently smooth or ready for unrestricted engineering use. Prioritize truthful engineering status and responsive layout over adding features.

## Evidence and Limits

- Inspected current application, healthcare calculation, Copilot scoring, recommendations, readiness, notifications, and authentication code.
- Ran `npm run browser:visual` against an isolated local server. Captured current desktop 1440x1000 and mobile 390x844 screenshots.
- Visual script exited 1: desktop navigation assertion still searches for the old Home label, while the screenshot shows Project design; mobile brand text was not found. These assertions alone are not evidence of a broken app.
- Screenshot inspection independently confirms desktop clipping, inconsistent mobile header styling, duplicated mobile language/theme controls, and visible corrupted characters.
- Ran `npm run browser:core-ux`; it timed out. The current full user journey is therefore NOT verified as passing. Historical passing results were not treated as current evidence.
- Executed synthetic, read-only Node probes against `AirCalcCopilotHealthEngine` to reproduce verification and readiness issues.
- No real customer projects, authentication accounts, or cloud records were changed.
- Physical mobile devices, Safari, Firefox, cloud conflicts, and exported PDF appearance were not verified in this review. Technical report and quotation findings are limited to inspected code and previous context, not a new complete visual journey.

## High-Priority Findings

### H1. Unverified equipment can receive a verified score

Location: `js/copilot/copilot-health-engine.js:72`.
`source.indexOf('verified') >= 0` also matches `unverified`. A synthetic snapshot with `sourceStatus: 'unverified'` received equipment verification 92/100. Matching `real` or `catalog` substrings is also insufficient evidence of verification.
Impact: misleading green status and inflated confidence.
Recommendation: use an explicit canonical verification state and verified source evidence; missing or unverified data must remain visibly unresolved.

### H2. Ready for client can coexist with deficient airflow

Location: `js/copilot/copilot-health-engine.js:380`.
Reproduction: required load 10000 BTU/h, selected load 10500 BTU/h, required flow 1000 CFM, selected flow 900 CFM, ESP 100 Pa, one room, no validation items, one snapshot marked unverified with voltage 230.
Observed: health 86/100, confidence 97, airflow 40/100, warning to review supply airflow, but `readyForClient: true`.
This synthetic reproduction demonstrates engine behavior, not a measured customer project.
Recommendation: use explicit required engineering checks for readiness; a weighted average must not mask failed required checks. Show the outstanding requirement next to the readiness status.

### H3. Scores imply more engineering evidence than they contain

Locations: `js/copilot/copilot-health-engine.js:52`, `:92`, `:113`.
Energy score depends on capacity mismatch, not equipment efficiency or operating energy. ESP score rewards a low pressure total without comparing required pressure against available fan pressure at the design airflow. Electrical score rises when any one electrical attribute is present; this does not establish compatibility.
Recommendation: name each metric according to what it measures, expose its basis, and show Not assessed for missing evidence. Distinguish data completeness from engineering compliance.

### H4. Desktop columns clip at 1440px

Location: `styles.css:8912`; screenshot `dist/browser-audit/desktop-1440x1000.png`.
The dashboard grid has minimum tracks of 460px and 640px plus a 26px gap, in addition to sidebar and page spacing. The new screenshot shows the left side of room management and its content outside the viewport.
Recommendation: size columns against available content width; allow cards to wrap or stack before their minimum content width is exceeded. Verify at 1280, 1366, 1440, and 1920px with no clipping or horizontal scrolling.

### H5. Healthcare load needs a clear preliminary-design boundary

Locations: `js/core/engineering-calculation-engine.js:243`, `app.js:8632`.
Current healthcare base load uses supply flow multiplied by 1.08 and a default temperature difference, then adds people/devices and a safety factor. The engine itself marks the assumption for engineering review. This does not establish a complete room/coil cooling load, latent load, or final pressure balance.
ASHRAE describes Standard 170 as minimum ventilation and related requirements, not a complete design guide: https://www.ashrae.org/file%20library/about/government%20affairs/advocacy%20toolkit/virtual%20packet/standard-170_2021-fact-sheet.pdf
Recommendation: display calculation method, assumptions, governing standard edition, and unresolved design checks at the result and report decision points. Do not present a score as proof of compliance.

## Medium-Priority Findings

### M1. Warning thresholds and scores are not aligned

Location: `js/copilot/copilot-health-engine.js:176`.
Capacity score penalizes oversizing beyond 10%, while an oversizing recommendation is emitted only above 25%. A 20% oversizing synthetic case produces no capacity recommendation. Undersizing and airflow recommendations use a 5% tolerance that is not visible in the recommendation wording.
Recommendation: define project/system-specific policy once and display the actual discrepancy and limit together. A universal 10% policy must not be presented as an ASHRAE requirement.

### M2. Input error messages disappear too quickly

Locations: `app.js:793`, `app.js:8533`, `app/index.html:1317`.
Missing room type and zero volume use a toast. Toast duration is 2600ms, previous timeouts are not cleared, and the toast element has no live-region attributes. A second toast can be hidden by an older timer.
Recommendation: persistent field-level validation for required input; focus the first invalid field. Reserve timed toasts for nonblocking confirmations, reset the timer, and announce them accessibly.

### M3. Mobile header and initial screen need consolidation

Evidence: `dist/browser-audit/mobile-390x844.png`.
Project fields and save/account buttons show inconsistent browser-default styling; language/theme controls appear twice. The first viewport is occupied by header, advisory text, and zero-valued results before meaningful room inputs.
Recommendation: one compact responsive header, one set of preferences, and room entry before empty result panels for a new project. Preserve the user's work while resizing.

### M4. Visible encoding defects weaken comprehension

Evidence: current screenshots show question marks in the step label and replacement characters in project/unit fields.
Recommendation: repair source strings and encoding, then inspect generated Arabic/English text and units. Do not treat a successful syntax check as localization verification.

### M5. Several visible labels are not associated with inputs

Location: `app/index.html:955` onward. Equipment filter labels lack `for` attributes linking their input IDs. General room validation also depends on a transient message.
Recommendation: associate every label, expose error relationships, verify keyboard-only operation, visible focus, and accessible names. Screen-reader testing remains outstanding.

## Recommended Work Order

1. Correct verification and readiness logic and prove failure cases with targeted tests.
2. Make health scores honest about data, assumptions, and missing checks; align warning thresholds.
3. Fix desktop clipping and mobile header duplication without changing the overall workflow.
4. Make required-input errors persistent and actionable; repair encoding and labels.
5. Re-run the complete project-to-quotation journey with actual user input, inspect generated HTML/PDF, and test cloud save/reopen separately.
6. Conduct a timed first-use session with a new HVAC engineer. Record hesitation and errors; no first-result timing claim is justified by this review.

## Acceptance Targets

- No ready-for-client status when a required airflow, equipment verification, or other mandatory check remains failed.
- Every score states its basis and does not imply an unperformed performance calculation.
- Every blocking message identifies the affected room/system, discrepancy, consequence, and corrective action.
- No clipped controls at tested desktop/mobile sizes; no duplicate preference controls.
- A new user can identify the next action without interpreting unexplained green/red scores.
- Complete user journey and exports pass fresh tests before changing release readiness status.

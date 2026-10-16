# AirCalc Pro - Engineering Validation Report

Date: 2026-07-22

## Scope

This report covers Priority 1: Engineering Validation.

The goal of this phase is to make the calculation layer more reliable without changing current calculation results unless a clear error is found. Professional PDF reports, Cloud Sync, and Collaboration Foundation are tracked separately and must not change the validated calculation engine behavior.

## Current Architecture Finding

The active app is loaded from:

`app/index.html`

That page loads the root project through `<base href="../">`, then loads:

- `js/core/state.js`
- `js/core/helpers.js`
- `js/core/storage.js`
- `js/core/i18n.js`
- `js/core/engineering-calculation-engine.js`
- `js/core/calc.js`
- `modules/*.js`
- `app.js`

Important finding: `app.js` is still the live source of truth for most UI and state behavior. Before this phase, several formulas were duplicated in:

- `app.js`
- `modules/calc.js`
- `js/core/calc.js`
- `modules/duct.js`

## Files Changed

- `js/core/engineering-calculation-engine.js`
- `app/index.html`
- `app.js`
- `js/core/calc.js`
- `modules/calc.js`
- `modules/duct.js`
- `modules/rooms.js`
- `modules/engineering-agent.js`
- `data.json`
- `tests/engineering-calculation-engine.test.js`
- `tests/engineering-data-integrity.test.js`
- `tests/healthcare-room-standard-linking.test.js`
- `tests/duct-module-engine-routing.test.js`
- `tests/project-duct-cfm-routing.test.js`
- `tests/engineering-workflow-smoke.test.js`
- `tests/engineering-thresholds-audit.test.js`
- `tests/engineering-ui-threshold-routing.test.js`
- `tests/engineering-source-status.test.js`
- `tests/engineering-agent-readiness.test.js`
- `tests/run-engineering-validation.js`
- `ENGINEERING_VALIDATION_REPORT.md`

## New Central Engine

Created:

`js/core/engineering-calculation-engine.js`

The engine exposes pure functions under:

`window.AirCalcEngineering`

It also supports Node tests through `module.exports`.

Main groups:

- General HVAC calculations
- Healthcare HVAC calculations
- Fresh air and mixed air calculations
- Duct sizing calculations
- ESP calculations
- Unit conversions
- Input validation helpers

## Equations Used

### Unit Conversions

- `W -> BTU/h`: `W * 3.41214`
- `m3 -> ft3`: `m3 * 35.3147`
- `m2 -> ft2`: `m2 * 10.7639`
- `CFM -> L/s`: `CFM * 0.47194745`
- `BTU/h -> kW`: `BTU/h * 0.00029307107`
- `TR -> BTU/h`: `TR * 12000`
- `TR -> kW`: `TR * 3.5168525`

### General HVAC

Existing app formula preserved:

- `Base Load BTU/h = Volume m3 * Load Factor BTU/h per m3 * Insulation Multiplier`
- `People Load BTU/h = People Count * 400`
- `Subtotal BTU/h = Base + Window Load + People Load + Device Load`
- `Total BTU/h = Subtotal * 1.10`
- `TR = Total BTU/h / 12000`
- `Supply CFM = round(TR * 400)`
- `Market BTU/h = ceil(Total BTU/h / 9000) * 9000`

### Healthcare HVAC

Existing app formula preserved:

- `Volume ft3 = Volume m3 * 35.3147`
- `Supply CFM = round(Total ACH * Volume ft3 / 60)`
- `Outdoor Air CFM = round(Outdoor ACH * Volume ft3 / 60)`
- In 100% fresh air mode: `Outdoor Air CFM = Supply CFM`
- `Recirculated CFM = max(0, Supply CFM - Outdoor Air CFM)`
- Negative pressure: `Exhaust CFM = round(Supply CFM * 1.10)`
- Positive pressure: `Exhaust CFM = round(Supply CFM * 0.90)`
- Neutral pressure: `Exhaust CFM = Supply CFM`
- `Base Load BTU/h = Supply CFM * 1.08 * 20`
- `People Load BTU/h = People Count * 400`
- `Total BTU/h = (Base + People + Device Load) * 1.10`
- `TR = Total BTU/h / 12000`
- `Market BTU/h = ceil(Total BTU/h / 9000) * 9000`

ASHRAE 170 room ACH, outdoor ACH, pressure, temperature, and RH values are read from `data.json`. No new ASHRAE values were invented in this phase.

### Mixed Air

- `Recirculated CFM = max(0, Supply CFM - Outdoor Air CFM)`
- `Outdoor Air % = Outdoor Air CFM / Supply CFM * 100`

### Duct Sizing

Existing app logic preserved:

- `Required Area ft2 = CFM / Velocity fpm`
- `Required Area mm2 = Required Area ft2 * 92903.04`
- Standard and calculated rectangular candidates are evaluated.
- Candidate score considers oversize, aspect ratio distance from 2:1, and excessive velocity penalty.
- Maximum aspect ratio currently used: `4:1`
- Minimum side currently used: `150 mm`
- Maximum side currently used: `1800 mm`

### ESP

Existing app formula preserved:

- `Straight Friction Pa = (Supply Length m + Return Length m) * Friction Pa/m`
- `Bend Loss Pa = Bends * Bend Loss Per Bend Pa`
- `Adders Pa = Filter + Diffuser + Coil + Damper + Other`
- `Total ESP Pa = Straight Friction + Bend Loss + Adders`
- `Total ESP in.w.g. = Total ESP Pa / 249.0889`

Status bands:

- `< 125 Pa`: Low
- `125 to 225 Pa`: Medium / Review
- `> 225 Pa`: High / Fail

### Advanced Duct / ASHRAE Chapter 21 Panel

Existing advanced duct formulas preserved and moved into the central engine:

- `Area ft2 = Width mm * Height mm / 92903.04`
- `Perimeter ft = 2 * (Width mm + Height mm) * 0.00328084`
- `Hydraulic Diameter ft = 4 * Area ft2 / Perimeter ft`
- `Velocity fpm = CFM / Area ft2`
- `Velocity Pressure in.w.g. = (Velocity fpm / 4005)^2`
- `Straight Friction in.w.g. = f * (Length ft / Hydraulic Diameter ft) * Velocity Pressure in.w.g.`

Current preserved assumption:

- `f = 0.02` preliminary galvanized-steel friction factor.
- TODO: Confirm final friction factor by material roughness, Reynolds range, fitting database, and selected duct design method.

### Strict Unit Conversion

The existing display helpers preserve current app behavior and clamp negative values to zero.
For engineering workflows that must reject invalid inputs, the central engine now also exposes `convertUnit({ value, from, to })`.

Supported strict conversion pairs:

- `m2 <-> ft2`
- `m3 <-> ft3`
- `cfm <-> lps`
- `btuh <-> kw`
- `tr <-> kw`
- `btuh <-> tr`

Strict conversion behavior:

- Negative `value` returns `ok: false`.
- Missing units return `ok: false`.
- Unsupported unit pairs return `ok: false`.
- Valid conversions return `{ ok: true, value, from, to }`.

### Safety Factor and Market BTU Rounding

Current preserved behavior:

- General and healthcare room totals apply the current app default safety factor of `1.10` unless a valid positive override is supplied.
- Market capacity is rounded up using the current app default step of `9,000 BTU/h`.

Strict validation now enforced in room calculations:

- Negative `safetyFactor` returns `ok: false`.
- Negative `cfmPerTr` returns `ok: false`.
- Negative `marketStepBtuh` returns `ok: false`.
- Negative healthcare `airHeatConstant` or `deltaTF` returns `ok: false`.

The central engine also exposes `calculateMarketCapacity({ btuh, stepBtuh })` for future workflows that need an explicit validated market-capacity result.

## Assumptions and Sources

Source inside current project:

- General room load factors: `data.json` and active app defaults.
- Healthcare ACH/OA/pressure/temperature/RH: `data.json`, labeled as ASHRAE 170 in the existing app.
- Device heat gain: device watts from `data.json`, converted with `1 W = 3.41214 BTU/h`.
- Market rounding: current app behavior, `9000 BTU/h` step.
- People load: current app behavior, `400 BTU/h per person`.
- Safety factor: current app behavior, `10%`.
- Duct and ESP formulas: current app behavior, now centralized.

TODO for HVAC engineer review:

- Confirm city/load factors for each room type and climate zone.
- Confirm whether `400 BTU/h per person` should vary by occupancy/activity type.
- Confirm whether healthcare cooling load should remain based on `Supply CFM * 1.08 * 20` or move to a full psychrometric load model.
- Confirm all ASHRAE 170 values in `data.json` against the exact adopted edition and local authority requirements.
- Confirm duct velocity limits by occupancy, acoustic criteria, and system type.
- Confirm ESP assumptions against manufacturer fan tables and actual duct layout.

## Test Cases Added

Created:

`tests/engineering-calculation-engine.test.js`
`tests/engineering-data-integrity.test.js`
`tests/healthcare-room-standard-linking.test.js`
`tests/duct-module-engine-routing.test.js`
`tests/project-duct-cfm-routing.test.js`
`tests/engineering-workflow-smoke.test.js`
`tests/engineering-thresholds-audit.test.js`
`tests/engineering-ui-threshold-routing.test.js`
`tests/engineering-source-status.test.js`
`tests/engineering-agent-readiness.test.js`
`tests/run-engineering-validation.js`

Cases covered:

- Bedroom
- Office
- Waiting Area
- Patient Room
- ICU
- Operating Room
- Isolation Room
- Pharmacy
- Dental Operatory with 100% fresh air
- Mixed air calculation
- Duct sizing
- Advanced duct analysis
- Duct module routing to the central Engineering Calculation Engine
- Engineering data integrity
- Engineering threshold audit
- ESP
- Unit conversions
- Strict unit conversions in both directions for area, volume, airflow, cooling capacity, and refrigeration tons
- Strict market-capacity rounding
- Negative input rejection

Current catalog note:

- `data.json` includes explicit `h_waiting` and `h_pharmacy` healthcare room ids.
- Tests now use `h_waiting` for Waiting Area and `h_pharmacy` for Pharmacy.
- Their ACH/OA/pressure/temperature/RH values are still treated as project data requiring HVAC engineer/source confirmation before final design approval.

## Issues Discovered

1. Calculation duplication existed across multiple files.
2. `app.js` still overrides earlier modules, making `app.js` the live calculation path.
3. Some constants are engineering assumptions but were not documented close to the formulas.
4. Some room standard keys are still marked as draft baselines and need source confirmation.
5. Current Healthcare load equation is preliminary and should be reviewed before treating it as a final design load method.
6. ESP thresholds previously differed across the app: the summary calculation treated `126-250 Pa` as Medium, while the engineering validation panel treated values above `225 Pa` as Fail. The app now uses the more conservative `225 Pa` upper review threshold consistently.
7. Healthcare room values and general quick-load factors now have explicit source-status metadata so the app can distinguish preliminary engineering guidance from final approved design basis.

No calculation result was intentionally changed in this phase.

## Implemented Fixes

- Added a central Engineering Calculation Engine.
- Routed active `app.js` general room calculations through the engine.
- Routed active `app.js` healthcare room calculations through the engine.
- Routed active `app.js` ESP breakdown through the engine.
- Routed active `app.js` duct sizing through the engine.
- Routed transitional `js/core/calc.js` and `modules/calc.js` through the engine.
- Added non-negative input validation inside the engine.
- Added unit tests for core formulas and realistic rooms.
- Added data integrity tests for healthcare room fields, room standards, and equipment presets.
- Added exported validation threshold metadata and assumption-source notes in the central Engineering Calculation Engine.
- Unified ESP summary and validation thresholds at `225 Pa` as the current conservative preliminary review limit.
- Added threshold audit tests to keep current review bands explicit.
- Routed the active UI validation panel and Engineering Reviewer notes through the centralized validation thresholds, with local fallbacks that preserve current behavior if the engine is unavailable.
- Added a UI threshold routing audit to prevent the old duplicated ESP `250 Pa` critical threshold from returning.
- Routed remaining user-facing airflow/capacity warning thresholds in the room duct detail, project duct panel, PDF airflow summary, and duct ESP module through the centralized validation thresholds.
- Added `ENGINEERING_SOURCE_STATUS` metadata in `data.json` for healthcare room values and general quick-load factors.
- Loaded source-status metadata in `app.js`.
- Routed Engineering Reviewer guidance through source-status metadata so ASHRAE 170 and quick-load assumptions appear as review notes rather than hidden assumptions.
- Added source-status notes to the technical report Engineering Notes and ASHRAE References sections, so exported/client-facing reports keep preliminary assumptions visible.
- Added source-confirmation awareness to the Engineering Reviewer delivery-readiness gate. Reports can remain reviewable, but final approval is marked as review when healthcare/general source assumptions still need confirmation.
- Added source-status tests to enforce that preliminary healthcare/general assumptions remain explicitly marked before final design approval.
- Added behavior-level Engineering Reviewer readiness tests covering ready, source-review, and critical-blocked delivery states.
- Added `tests/run-engineering-validation.js` as a single Node runner for all Engineering Validation tests.
- Added a visible default-equipment note in the device list when a room equipment preset is applied automatically.
- Added the same default-equipment note to the technical room-load table and printable/PDF equipment summary.
- Routed `modules/duct.js` duct sizing and duct CFM resolution through the central Engineering Calculation Engine when it is available, while preserving the previous fallback behavior.
- Added a routing test to verify `AppDuct.calcDuctSize()` matches `AirCalcEngineering.calculateDuctSize()` and that duct CFM priority remains catalog CFM, selected TR, then calculated supply CFM.
- Removed the obsolete duplicate `calcDuctSize()` definition from `app.js`.
- Removed the older duplicated duct sizing implementation from `modules/duct.js` after browser regression confirmed the engine-routed path.
- Fixed visible multiplication-symbol labels in duct module output and covered them with a routing test.
- Added explicit ESP input validation in the central Engineering Calculation Engine. Negative duct lengths, bends, friction rate, or pressure-loss adders now return `ok: false` with named field errors instead of being silently clamped to zero.
- Updated the ESP UI workflow to clear `_lastEspCalc` and show an invalid-input message when the central engine rejects ESP inputs, preventing stale or misleading ESP validation results.
- Added unit coverage for negative healthcare ACH and negative ESP inputs.
- Added explicit Mixed Air input validation. Negative supply or outdoor-air CFM now returns `ok: false` with named field errors instead of being silently clamped.
- Added unit coverage for normal Mixed Air output and negative outdoor-air CFM rejection.
- Added explicit duct sizing input validation. Negative CFM, velocity, side limits, or aspect-ratio limits now return `ok: false` with named field errors in the central engine.
- Added explicit duct CFM resolver validation. Negative selected BTU/h, fallback CFM, catalog CFM, or CFM/TR now returns `ok: false`.
- Updated active duct wrappers in `app.js` and `modules/duct.js` so invalid engine duct-size responses become `null`, preserving the existing UI contract and preventing invalid objects from being rendered as duct sizes.
- Added unit coverage for negative duct velocity and negative CFM/TR rejection.
- Added `convertUnit({ value, from, to })` as a strict central conversion API for engineering workflows, while preserving the existing display-helper conversion behavior.
- Added unit coverage for strict bidirectional conversions and rejection of negative/unsupported unit conversion inputs.
- Added `calculateMarketCapacity({ btuh, stepBtuh })` as a strict central API for market BTU rounding.
- Added room-level validation for negative safety factor, CFM/TR, market step, healthcare air heat constant, and healthcare delta-T inputs.
- Added unit coverage for strict market capacity rounding and negative safety-factor rejection.
- Expanded healthcare data integrity checks so every `mode=hc` room must have matching data key/id, Arabic and English labels, healthcare category, non-negative ACH/OA, total ACH greater than or equal to outdoor ACH, valid pressure relationship, plausible occupied temperature range, and humidity within 0-100%.
- Added data integrity coverage that healthcare source-status metadata must explicitly keep `ROOMS entries with mode=hc` under source confirmation before final design approval.
- Added explicit healthcare room-to-standard routing for common room ids so healthcare rooms do not accidentally fall back to the generic office standard.
- Added a room-specific healthcare standard fallback for healthcare rooms without a confirmed shared `ROOM_STANDARDS` key. This fallback preserves the room's own ACH/OA/pressure values and marks the result as requiring source confirmation.
- Added `tests/healthcare-room-standard-linking.test.js` to verify every healthcare room resolves to a non-unknown standard, does not use non-clinical standards except waiting/corridor, and preserves ACH/OA for room-specific fallbacks.
- Moved the Advanced Duct / ASHRAE Chapter 21 panel calculations into the central Engineering Calculation Engine.
- Routed `AppDuct.advancedDuctAnalysis()` through the central engine when available, while keeping the previous fallback behavior.
- Added unit coverage for advanced duct area, velocity, hydraulic diameter, velocity pressure, friction loss, and negative input rejection.
- Added routing coverage to verify `AppDuct.advancedDuctAnalysis()` matches the central engine.
- Added `getProjectDuctCfmFromSelection()` so project-level duct summaries and PDF sections resolve selected-unit CFM through the same catalog/TR/fallback priority as the active duct module.
- Replaced manual project selected-unit CFM derivations in live project duct UI and PDF project summaries with the centralized duct CFM resolver path.
- Added `tests/project-duct-cfm-routing.test.js` to prevent selected project unit CFM from being manually re-derived from `projState.selBtu / 12000` in duct summaries.
- Added `tests/engineering-workflow-smoke.test.js` to keep the main application workflow connected: general room calculation, healthcare room calculation, history save, project refresh, technical report refresh, quotation refresh, project duct CFM, duct sizing, and ESP.
- Updated `app/index.html` to load `app.js?v=20260531j` so the browser receives the corrected calculation/report workflow script instead of a cached older `app.js`.

## Verification

Passed:

- `node tests/engineering-calculation-engine.test.js`
- `node tests/engineering-data-integrity.test.js`
- `node tests/duct-module-engine-routing.test.js`
- `node tests/engineering-thresholds-audit.test.js`
- `node tests/engineering-ui-threshold-routing.test.js`
- `node tests/engineering-source-status.test.js`
- `node tests/engineering-agent-readiness.test.js`
- `node tests/run-engineering-validation.js`
- `node --check js/core/engineering-calculation-engine.js`
- `node --check app.js`
- `node --check modules/duct.js`
- `node --check modules/engineering-agent.js`
- `node --check js/core/calc.js`
- `node --check modules/calc.js`
- `node --check tests/duct-module-engine-routing.test.js`
- `node --check tests/engineering-data-integrity.test.js`
- `node --check tests/engineering-thresholds-audit.test.js`
- `node --check tests/engineering-ui-threshold-routing.test.js`
- `node --check tests/engineering-source-status.test.js`
- `node --check tests/engineering-agent-readiness.test.js`
- `node --check tests/run-engineering-validation.js`
- Browser smoke test through `http://127.0.0.1:5500/app/index.html`

Browser smoke test coverage:

- App booted with `Boot complete` and no Console errors.
- General Office room calculation completed and saved to the room list.
- Healthcare Patient Room calculation completed with ACH/OA/recirculation/exhaust values displayed.
- Project central unit mode was tested with AHU selection.
- Project duct and ESP panels displayed without the previous black Pro lock overlay.
- No `.section-locked` project duct/ESP sections were present after selecting AHU.
- After removing the old duct sizing duplicate, project AHU mode still displayed duct sizing and ESP results with no Console errors.
- The technical report still displayed duct recommendations, duct sizes, and ESP information after the cleanup.
- After UI threshold routing, the served `localhost` resources included the centralized threshold code and the app loaded as `AirCalc Pro` with no Console errors or warnings.
- Selecting Patient Room shows a default equipment note with `2,218 BTU/h` included in device heat load.
- Technical report and printable/PDF room details now identify automatically applied default room equipment presets.

Smoke-test note:

- The pure Engine baseline for Patient Room uses only ventilation, people, and explicit device input.
- The UI workflow automatically applies the `patient_room` equipment preset: `med_monitor`, `infusion_pump`, and `med_fridge`.
- That preset adds approximately `2,218 BTU/h`, so the Patient Room UI result of about `9,604 BTU/h` is consistent with the centralized Engine when default equipment is included.
- A unit test now verifies both the no-equipment baseline and the default-equipment workflow result.

Not available in this project:

- No `package.json` was found.
- No configured build script was found.
- No configured lint script was found.
- No configured TypeScript check was found.

## Recommended Next Step

Stay within Priority 1.

Next phase should be:

1. Confirm the unified `225 Pa` ESP upper review threshold against selected unit fan tables and project duct layout.
2. Confirm draft healthcare room standard values in `data.json` against the adopted ASHRAE 170 edition and local authority requirements.

# Phase 0 Stabilization Audit

Date: 2026-07-18

## Scope
This audit prepares AirCalc Pro for the Engineering AI Platform roadmap. It does not add new product behavior. The goal is to identify the safest next development step before building the Engineering Agent layer.

## Source Of Truth
The active application entrypoint is:

```text
app/index.html
```

Reason:

- The root `index.html` is a landing page.
- The root `index.html` links into `./app/index.html`.
- `app/index.html` contains the calculator workspace, project tools, reports, duct/ESP controls, and desktop/mobile shell.
- `app/index.html` uses `<base href="../">`, so its runtime assets are loaded from the project root.

## Loaded Runtime Stack
`app/index.html` currently loads:

```text
js/core/state.js
js/core/helpers.js
js/core/storage.js
js/core/i18n.js
js/core/calc.js
modules/plan.js
modules/devices.js
modules/history.js
modules/duct.js
modules/rooms.js
modules/calc.js
modules/quote.js
modules/pdf.js
modules/projects.js
app.js
js/firebase-auth.js
data.bootstrap.js
main.js
```

External runtime dependencies:

```text
Google Tag Manager / GA4
Google Fonts
XLSX CDN
Firebase auth module
```

## Verification Completed
Syntax checks passed with `node --check` for:

- `app.js`
- `main.js`
- `data.bootstrap.js`
- all files under `js/core`
- all files under `modules`

No syntax-level JavaScript errors were found in the loaded local scripts.

## Current Engineering Capabilities Found
The app already includes important engineering-platform foundations:

- Quick room calculation.
- Healthcare ASHRAE-guided room airflow.
- ACH display.
- Project and room workflows.
- Project save/load through local storage.
- Quote generation.
- HAP export.
- Technical PDF export.
- Duct sizing.
- Preliminary ESP calculation.
- Project/room engineering validation functions.
- Desktop insight and validation summary UI.

Key functions currently located in `app.js`:

```text
getRoomEngineeringValidation()
getProjectEngineeringValidation()
doCalc()
calcROT()
calcHC()
saveHist()
exportHAP()
exportTechPDF()
calcDuctSize()
getDuctCfm()
calculateEspBreakdown()
```

## Architectural Risks

### 1. `app.js` Is Too Large
`app.js` is the active integration layer, but it is very large and contains calculation, rendering, validation, export, duct, ESP, language, and UI behavior in one file.

Risk:

- Harder to test.
- Higher chance of regressions.
- Harder to reuse later for API, desktop, mobile, SaaS, or enterprise workflows.

Recommended action:

- Do not rewrite it in one pass.
- Extract only the Engineering Validation layer first.

### 2. Duplicate / Override Logic Exists
Several functions exist both in modules and in `app.js`, including calculation and duct sizing functions.

Risk:

- It is unclear which function is authoritative at runtime without browser-level tracing.
- A future edit may change a module but not affect the actual running function if `app.js` overrides it later.

Recommended action:

- Before changing calculations, create a runtime authority map.
- For Phase 1, add a non-invasive validation snapshot layer that reads outputs instead of changing core calculation formulas.

### 3. Calculations Are Explicitly Preliminary In Several Areas
The app already labels several outputs as preliminary:

- Cooling load quick estimate.
- Duct sizing.
- ESP.
- Advanced duct review.
- Technical report validation.

Risk:

- The product can look more authoritative than the calculation depth supports.

Recommended action:

- Keep these labels visible.
- The AI Agent must classify outputs as calculated, estimated, or requiring engineering verification.

### 4. Browser QA Not Yet Completed In This Audit
Playwright was not available in the local project environment, so automated browser console/network testing was not completed in this pass.

Recommended action:

- Use the currently open browser for manual smoke checks, or install/configure a browser automation path later.

## Minimum Smoke Test Checklist
Before Phase 1 implementation, manually verify these flows in `app/index.html`:

1. Load app without visible startup failure.
2. Switch language.
3. Enter room dimensions and calculate.
4. Select healthcare room and calculate ASHRAE airflow.
5. Add calculated room to quote.
6. Save current project.
7. Reopen/load saved project.
8. Generate quotation.
9. Export CSV.
10. Export HAP.
11. Export technical PDF.
12. Switch quote mode between room and project.
13. Test ducted system duct sizing.
14. Test ESP inputs update result.
15. Review browser console for errors.
16. Review failed network requests.

## Recommended Next Development Step
Proceed to Phase 1:

```text
Engineering Validation Layer
```

But implement it conservatively:

1. Create a small validation/snapshot module.
2. Read current project state without changing calculations.
3. Normalize findings into stable statuses:
   - `ok`
   - `needs_input`
   - `warning`
   - `critical`
4. Produce:
   - project health
   - missing inputs
   - engineering warnings
   - next actions
5. Render it in the existing desktop insight/validation area only after the data layer is stable.

## Phase 1 Guardrail
Do not modify core formulas during Phase 1.

Phase 1 should make existing calculations safer and easier to review, not change engineering results.


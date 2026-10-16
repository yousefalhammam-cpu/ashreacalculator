# AirCalc Pro Production Audit

Version target: v1.0.0-beta.1  
Date: 2026-07-25  
Scope: static web app, calculation engines, equipment database, selector, Copilot, reporting, cloud/collaboration foundation, tests, Firebase rules.

## Executive Status

AirCalc Pro is beta-ready for controlled engineering use from a functional test perspective. The current project passed syntax checks and all available automated tests. No blocking runtime calculation failure was found in the available local test suite.

The main production risks are hardening risks, not missing feature risks: large monolithic frontend files, many HTML rendering surfaces, static local deployment constraints, and incomplete automated real-browser coverage in this environment.

Update: a formal zero-dependency `package.json` workflow was added after the first audit so production checks can be repeated with stable commands.
Update: a GitHub Actions workflow and release packaging script were added for repeatable beta verification and packaging.

## Commands Run

- `node --check app.js`
- `node --check modules\hvac-design-copilot.js`
- `node --check js\copilot\copilot-health-engine.js`
- `npm run build`
- `npm test`
- `npm run stress`
- `npm run verify`
- `npm run browser:smoke`
- `npm run browser:visual`
- `npm run package:release`
- all `tests/*.test.js` with Node
- static scans using `rg` for TODO/FIXME, console usage, unsafe rendering patterns, secrets-like strings, and duplicate function names
- synthetic stress benchmark for 10, 50, 100, 250, and 500 room datasets

## Critical

None confirmed by automated checks.

## High

1. Large monolithic production surface

- `app.js`: about 625 KB.
- `styles.css`: about 279 KB.
- Risk: slower startup, harder review, higher chance of regressions when editing shared UI/state code.
- Recommendation: after beta, progressively split feature modules and keep cache-busted module loading stable.

2. Extensive HTML string rendering

- Many `innerHTML`, `insertAdjacentHTML`, and `document.write` usages exist in `app.js` and modules.
- Current tests verify important escape/guardrail behavior in equipment, reports, and AI boundaries, but this remains a permanent XSS review area.
- Recommendation: every user-provided value rendered through HTML must pass `esc()` or equivalent text-only rendering.

3. Browser console audit path required a custom smoke test

- Playwright package was not reliable in this environment.
- Resolution: added `scripts/browser-smoke.js`, which launches Edge/Chrome headless through Chrome DevTools Protocol.
- Latest result: passed with 0 blocking errors and 4-8 non-blocking warnings from optional browser/resource noise.
- Visual coverage: added `scripts/browser-visual-audit.js`; latest result passed desktop and mobile viewport checks.

4. Firebase frontend config is present

- `js/firebase-auth.js` includes a Firebase `apiKey`.
- Firebase web API keys are normally public identifiers, not server secrets, but they must be protected by strict Firestore rules and domain restrictions.
- Firestore rule tests passed.

## Medium

1. Duplicate function names exist between legacy/root code and modular code

- Examples include `calcHC`, `calcESP`, `calcDuctSize`, `exportPDF`, `exportTechPDF`, `getDuctCfm`, `setSelBtu`, and several utility helpers.
- Risk: confusion during maintenance and accidental edits in the wrong implementation.
- Recommendation: keep beta stable now; after beta, retire unused legacy duplicates gradually with tests.

2. Cache/runtime artifacts are present in workspace

- `.edge-profile` exists in the project folder and contains browser cache data.
- Risk: release archive pollution and larger handoff package.
- Resolution: added `.gitignore` and `.releaseignore` entries for `.edge-profile`, `.server.out`, `.server.err`, temporary screenshots, and test zip artifacts.

3. No `package.json` at start of audit

- Initial finding: there was no standard `npm run build`, `npm test`, or dependency manifest.
- Resolution: added `package.json` plus `scripts/check-syntax.ps1`, `scripts/run-tests.ps1`, and `scripts/stress-benchmark.js`.
- Remaining recommendation: wire these scripts into CI when the repository is initialized.

4. Long-term performance optimization is limited by static architecture

- Current app uses direct scripts and global namespaces.
- Lazy loading exists for some modules through script ordering, but there is no bundler-level code splitting.

## Low

1. Console logging exists

- Startup/info logs and warning logs exist in modules.
- No blocking issue found, but production should keep noisy logs minimal.

2. TODO items are intentional engineering review markers

- TODOs are present in `js/core/engineering-calculation-engine.js` and knowledge-base tests.
- These are not forgotten code tasks; they document values that require qualified HVAC confirmation before final approval.

3. Large images

- `icon-1024.png`, `quotation.png`, `home.png`, and `assets/icons/icon-2048.png` are large.
- Recommendation: optimize images for release packaging.

## Result

Production audit result: Beta Pass with documented hardening limitations.

## Release Package Result

`npm run release:beta` completed successfully and generated `dist/aircalc-pro-v1.0.0-beta.1.zip` at 9.03 MB. The packaging script excludes local cache/runtime artifacts, the nested workspace copy, and temporary test files. A release manifest and SHA256 checksum are generated beside the ZIP.

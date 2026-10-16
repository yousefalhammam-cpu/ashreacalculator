# Launch Validation - 2026-10-16

## Scope And Decision

Local beta validation, not production certification. Do not launch publicly until the external acceptance gates below are completed. No production deployment or cloud data writes were performed for this review.

## Findings And Repairs

- High: report client, location, designer, and language controls were hidden by the broad `#p-tech .ninput` / `select` CSS rule. Added a scoped display override for editable report metadata.
- High: project identity changes did not refresh summaries and could be overwritten by desktop field refresh. Synchronize source fields, protect focused topbar inputs, invalidate report metadata, and refresh report/quotation summaries.
- Medium: report metadata input triggered full rendering on every keystroke. Persist and refresh identity immediately; defer full report rendering until blur, registering one listener per editing session.
- Medium: project/client metadata did not survive a normal page reload. Store a local identity draft, restore it at startup, and update it on project open/reset.
- Medium: quotation snapshots could retain old project identity. Refresh their project metadata without changing equipment performance or commercial prices.

## Local Evidence

- Unit/source regression suite: 53 passed, 0 failed after the final repairs. Syntax check passed for all 9 configured entry files.
- Core UX E2E: passed. Includes AR/EN document language/direction and sidebar, three scenarios, capacity/quantity updates, pricing totals and reload, projects view, account modal from topbar/settings, registration validation, and an isolated mocked authentication error. This does not prove a real Firebase sign-in.
- Browser quotation audit: passed on desktop 1440x1000 and mobile 390x844, including project-name synchronization, live summary update, editable client without focus loss, local draft storage, pricing and page bounds. The final rerun also passed actual page reload assertions for both project name and client.
- Firebase predeploy static check: passed. This is not deployed-rule/emulator verification.
- Stress benchmark: passed for 10, 50, 100, 250, and 500 rooms, no reported warnings. This benchmark does not simulate real network/cloud load.

Evidence: `dist/core-ux-e2e-report.json`, `dist/browser-audit/browser-visual-audit.json`, and generated stress results. Keep their timestamps with the release package.

## Remaining Launch Gates

- Real Firebase registration, sign-in/sign-out, password reset, authorized domains, and reload session persistence using an approved test account over HTTP(S), not `file://`.
- Deployed Firestore rules, cross-user access denial, cloud save/reopen, offline reconnection, and two-user conflict handling.
- Actual PDF download and visual review in Arabic/English with multi-page data and the embedded currency mark.
- Real Firefox/Safari and mobile browser acceptance, keyboard/accessibility review, offline/PWA acceptance.
- A first-time HVAC engineer's manual end-to-end review of engineering assumptions and report meaning; software regression tests are not independent engineering certification.
- Rebuild and verify the release ZIP, manifest, checksums, and release notes after these source changes. Existing release artifacts predate the fixes.

## Known Environment Warning

The browser harness reports intermittent EPERM cleanup failures for its temporary Edge profile. Functional assertions can pass despite that cleanup warning; it must not be misreported as a product console failure or used to hide failed assertions.

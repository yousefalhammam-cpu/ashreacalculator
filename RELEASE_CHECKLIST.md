# AirCalc Pro Release Checklist

Version: v1.0.0-beta.1  
Date: 2026-07-25

## Beta Readiness

- [x] Engineering Calculation Engine tests pass.
- [x] Professional report tests pass.
- [x] Equipment Database tests pass.
- [x] Equipment Selector tests pass.
- [x] Equipment Snapshot tests pass.
- [x] Cloud Sync foundation tests pass.
- [x] Collaboration foundation tests pass.
- [x] AI explanation foundation tests pass.
- [x] HVAC Design Copilot UI tests pass.
- [x] Project Health and Engineering Confidence tests pass.
- [x] Firestore rules audit test passes.
- [x] Sample Data is marked and blocked from final selection.
- [x] AI does not generate engineering numbers.
- [x] Rules Engine remains source of truth.
- [x] JavaScript syntax checks pass for key files.
- [x] `package.json` verification scripts exist.
- [x] `npm run build` passes.
- [x] `npm test` passes.
- [x] `npm run stress` passes.
- [x] Browser smoke script is available.
- [x] `npm run browser:smoke` passes locally.
- [x] Browser visual audit script is available.
- [x] `npm run browser:visual` passes locally for desktop and mobile.
- [x] `npm run verify` is available.
- [x] Release package script is available.
- [x] `npm run package:release` created `dist/aircalc-pro-v1.0.0-beta.1.zip`.
- [x] `npm run verify:release` passed.
- [x] Release package verification script is available.
- [x] Release manifest/checksum script is available.
- [x] Firebase predeploy guardrail script is available.

## Requires Manual/CI Confirmation Before Public Release

- [x] Chromium real-browser smoke pass.
- [ ] Chrome manual visual pass.
- [ ] Edge manual visual pass.
- [ ] Firefox compatibility pass.
- [ ] Safari compatibility pass.
- [ ] Mobile responsive pass.
- [ ] Tablet responsive pass.
- [x] Basic Chromium mobile viewport audit.
- [x] Basic Chromium desktop viewport audit.
- [ ] PDF export with large projects.
- [ ] Firebase deployment and rules deployment in production project.
- [x] Firebase local predeploy check is available.
- [ ] Authorized Firebase domains configured.
- [x] Release ignore list excludes `.edge-profile`, temp files, and test artifacts.
- [x] CI pipeline runs `npm run verify`.
- [ ] GitHub Actions run must be confirmed after pushing to a GitHub repository.

## Product Areas

- [x] Calculations
- [x] Reports
- [x] Equipment database
- [x] Cloud foundation
- [x] AI foundation
- [x] Copilot
- [x] Equipment selection
- [x] PDF/report foundation
- [x] Localization baseline
- [x] Responsive baseline
- [x] Tests
- [x] Error handling baseline
- [x] Versioning documentation
- [x] Backup/local cache foundation
- [x] Logging baseline
- [x] Release packaging baseline
- [x] Release package cleanliness verification
- [x] Release package checksum and manifest
- [x] Firebase predeploy guardrail check

## Go/No-Go

Go for controlled beta pilots.  
No-Go for public enterprise rollout until browser matrix, Firebase deployment, and large-project PDF rendering are verified in production-like CI/manual QA.

## Latest Local Release Package

- Path: `dist/aircalc-pro-v1.0.0-beta.1.zip`
- Size: 9.03 MB
- Verification command: `npm run verify:release`
- Full beta release command: `npm run release:beta`
- Manifest: `dist/aircalc-pro-v1.0.0-beta.1.manifest.json`
- SHA256: `dist/aircalc-pro-v1.0.0-beta.1.sha256`

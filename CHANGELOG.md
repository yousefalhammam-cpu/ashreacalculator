# AirCalc Pro Changelog

## v1.0.0-beta.1 - 2026-07-25

### Added

- GitHub Actions beta verification workflow with artifact upload.
- Release ZIP, manifest, and SHA256 generation.
- Test, stress, browser smoke, and Firebase predeploy report outputs.
- GitHub release checklist.
- Firebase production deployment plan.
- Production configuration audit.
- Firefox/Safari acceptance test plan.
- Manual UX acceptance test plan.

### Changed

- Package version updated to `1.0.0-beta.1`.
- Release artifact naming updated to `aircalc-pro-v1.0.0-beta.1`.
- `npm run release:beta` now includes Firebase predeploy check and release manifest generation.

### Validation

- Full local beta release validation must pass through `npm run release:beta`.

### Notes

- No product feature was added in this phase.
- No Git push, GitHub release, or Firebase production deployment was executed.

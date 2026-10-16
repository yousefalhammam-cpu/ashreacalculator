# AirCalc Pro v1.0.0-beta.1 Release Notes

Date: 2026-07-25

## Summary

AirCalc Pro v1.0.0-beta.1 is a controlled beta release candidate for HVAC engineering workflows. The release focuses on calculation reliability, equipment selection traceability, engineering review, professional reporting, local/cloud project foundations, and deployment readiness.

## Completed Product Areas

- Centralized engineering calculation foundation.
- Equipment catalogue and selection workflow.
- Equipment snapshot binding to project selections.
- Rules Engine based engineering review.
- HVAC Design Copilot foundation.
- Professional technical report organization.
- Cloud sync and collaboration foundations.
- Firebase security rules foundation.
- Project health and engineering confidence scoring.
- AI explanation layer constrained to explain-only behavior.

## Validation

- 44 Node tests passed.
- Key JavaScript syntax checks passed.
- Firestore rules audit passed.
- Sample data guardrails passed.
- AI boundary tests passed.
- Local release package generated and verified: `dist/aircalc-pro-v1.0.0-beta.1.zip`.
- Release manifest and SHA256 checksum generated in `dist/`.
- GitHub Actions workflow prepares release artifacts and reports.

## Known Limitations

- Browser automation was limited by sandbox restrictions.
- Safari/Firefox/mobile physical validation remains required.
- No `package.json` build pipeline exists yet.
- Very large PDF/report rendering needs browser-based QA.
- AI backend is foundation/stub/disabled depending on runtime, not a production AI service.

## Recommendation

Use this release for controlled beta pilots with HVAC engineers. Do not use as final public enterprise release until compatibility and deployment checks are complete.

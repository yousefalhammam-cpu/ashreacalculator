# AirCalc Pro Platform Completion Status

## Completed Locally

- Engineering Calculation Engine foundation and unit tests.
- Deterministic Engineering Review / Rules Engine boundaries.
- Professional report data contract and report sections.
- Selected equipment snapshot in report data.
- AHU airflow/ESP-only handling with `coil_submittal_required`.
- Equipment Database schema, CSV import, duplicate detection, review workflow, versioning, and cloud catalogue foundation.
- Real starter equipment database with 65 records.
- Full UI system-type coverage for split, floor, ducted, cassette, package, VRF, chiller air, chiller water, FCU, AHU, and window.
- Inline capacity picker connected to real equipment records.
- Equipment selector wizard connected to real equipment records.
- Chiller air/water filtering in both equipment paths.
- Firebase local-first cloud sync foundation.
- Collaboration roles foundation: owner, editor, viewer.
- Firestore rules draft and Firebase deployment files.
- AI backend contract, local route foundation, provider runtime guard, and explain-only frontend client.

## External Setup Still Required

- Deploy Firestore rules with Firebase CLI.
- Test rules with real authenticated users or Firebase emulator.
- Configure backend-only AI provider variables if live AI explanations are required:
  - `AIRCALC_AI_PROVIDER_API_KEY`
  - `AIRCALC_AI_PROVIDER_ENDPOINT`
  - `AIRCALC_AI_PROVIDER_MODEL`
- Serve the app over HTTP/HTTPS for Firebase Auth and local AI route. `file://` remains local-only.
- Ingest full manufacturer catalogues and verify records against official submittals/AHRI where applicable.
- Final HVAC engineer approval for ASHRAE 170 assumptions, equipment selection, duct/ESP assumptions, and report acceptance.
- Visual QA for Arabic and English PDF exports before client delivery.

## Current Safety Boundaries

- AI does not generate HVAC numbers.
- Reports and reviews use Rules Engine data as source of truth.
- Sample Data is not automatically included in professional equipment selection.
- Local project data is not overwritten automatically by cloud imports.
- AHU records do not invent cooling capacity; coil capacity requires submittal approval.

## Verification

Latest local verification command:

```powershell
$failed=@(); Get-ChildItem tests -Filter *.test.js | ForEach-Object { node $_.FullName *> $null; if ($LASTEXITCODE -ne 0) { $failed += $_.Name } }; if ($failed.Count) { Write-Host "FAILED $($failed -join ', ')"; exit 1 } else { Write-Host "ALL_TESTS_PASSED" }
```

Latest result:

```text
ALL_TESTS_PASSED
```

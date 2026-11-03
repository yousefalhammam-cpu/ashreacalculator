# HVAC calculation and workflow integrity fixes

Based on `stabilization-v1` at `3e6b9e0fff84ac66245073f1dd7507a902065133`, whose app.js matches the deployed application reviewed on 2026-11-03. The default `main` branch is older and is not the release baseline for this change.

## Changes

- Separate outdoor-air CFM from outdoor ACH. Save a versioned airflow record, retain `oa` as CFM and `oaStd` as ACH for existing consumers, and use explicit units in scenario/report adapters.
- Recover the known legacy ACH/CFM collision from stored room volume, ACH and fresh-air mode. Preserve the original ambiguous OA value in migration metadata. Missing/ambiguous inputs require review; thermal loads, market capacities and prices are not recomputed. Migration occurs in memory when opening a project and is persisted by the normal save workflow.
- Recognize healthcare records by `calcMode`, `mode` or established healthcare room IDs. Keep the healthcare requirement card consistent with the selected room baseline rather than a conflicting duplicate ACH table.
- Preserve the current edit target across debounced recalculation and manual update. Cancel stale timers when changing/resetting the target. Updating a room no longer appends a second record in this path.
- Give Residential its own standard/preset and clear inherited devices when a room has no preset. Check NICU before ICU for names without an exact ID mapping.
- Count only actual assigned systems in selected-equipment summaries and commercial quantities. Preserve explicitly priced/manual legacy selections by migrating them to structured systems, while leaving automatic capacity suggestions unassigned.
- Honor the central installed-capacity resolver in the main.js runtime override, and preserve explicit zero selected capacity in report adapters.
- Preserve zero/decimal installation percentages in calculations and project snapshots.
- Reject nonfinite numeric inputs, outdoor ACH greater than total ACH, and automatic/manual duct sizes outside the declared hard limits. A missing valid duct size fails validation instead of passing on the target velocity.
- Keep healthcare review at Review when only airflow and a pressure label are available. Explicitly label the current healthcare load as a preliminary airflow proxy, and extract flow as an estimate of combined return/exhaust; neither establishes outdoor exhaust balance or room pressure.
- Correct the Operating Room temperature reference to a rounded 20–24°C sample baseline from ASHRAE Handbook 2023, Health Care Facilities, sample of Standard 170-2021. The separate Class 3 hybrid-imaging baseline is preserved. Governing edition and local/project confirmation remain required.
- Synchronize data.bootstrap.js with data.json, including source-confirmation metadata that was missing from the offline bootstrap.
- Prevent JavaScript responses from overwriting cached HTML, await navigation fallbacks, precache the actual application scripts, and fetch updated code/data before offline cache fallback. Bump the service-worker cache and changed entrypoint versions.
- Recover mixed-encoding punctuation/units in app/index.html, fix the visible broken shell labels, allow zoom, and align Arabic/English landing-page claims with preliminary calculation and free-access behavior.

## Validation

Commands from the repository root:

```sh
node --test --test-reporter=spec tests/*.test.js
node tests/audit-room-integrity.test.js
node tests/audit-edit-and-totals.test.js
node tests/audit-service-worker.test.js
```

The full suite includes the existing 64 test files plus three new regression files. Coverage executes production functions for OA persistence/migration, residential preset isolation, clinical identity, edit timers, equipment totals, installation/VAT arithmetic, invalid duct sizing, report units and offline caching. All precache assets are checked for existence. Active application/test/tool JavaScript syntax was checked separately (125 files).

Two existing cache-version assertions and the report duct-action test fixture were updated for the new version and hard-bound dependency. The unused root `helpers.js` contains pre-existing workflow YAML, is not loaded by either HTML entrypoint, and is excluded from active JavaScript syntax validation.

## Engineering work that still requires design inputs

This release does **not** replace the healthcare load model with a detailed room/coil sizing model. The existing preliminary thermal values remain traceable. A full model requires outdoor/indoor design conditions, sensible and latent room loads, supply-air/coil conditions, ventilation treatment, filtration and manufacturer duty-point data. Increasing outdoor-air percentage is now explicitly described as an airflow change; it is not presented as a recalculated coil load or energy comparison.

ASHRAE-guided review is not final compliance. A selected airflow and pressure label do not establish filtration, humidity control, pressure differential, recirculation restrictions, or local authority acceptance. These remain review items rather than silently passing.

No cloud account, Firestore rules or deployed site was modified during validation. Browser/PDF/HAP compatibility across devices and authenticated cloud synchronization remain release checks beyond the automated regression suite.

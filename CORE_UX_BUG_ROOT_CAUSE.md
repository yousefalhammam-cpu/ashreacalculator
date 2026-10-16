# AirCalc Pro Core UX Bug Root Cause

Generated: 2026-07-25

## Scope

This document covers the three launch-blocking visible issues reported before beta deployment:

- Equipment capacity selection was hard to open or did not behave like a real equipment selector.
- Add Device needed browser-level verification and a safer opening path.
- Switching language to English updated only part of the UI while the desktop sidebar remained inconsistent.

## Issue 1: Equipment Capacity Selector

Reproduction:

1. Open the home page.
2. Use Project HVAC mode.
3. Add/select a project unit.
4. Click the capacity field/card.

Current behavior before fix:

- The database-backed options existed in code, but the clickable control was a small native select area.
- The displayed picker readout looked like the main control, while the actual select area was not covering the full card.
- Several totals still read `selectedBtu * qty` directly instead of using a single source-of-truth resolver.

Expected behavior:

- Clicking anywhere on the capacity picker opens the available real equipment choices.
- Database selections persist `selectionMode=database` and an `equipmentSnapshot`.
- Manual capacity persists `selectionMode=manual`, `manualCapacityBtuH`, and no equipment snapshot.
- Calculations and reports use the same installed-capacity resolver.

Root cause:

- UI affordance mismatch: the visible card was not the real full-size clickable select.
- Calculation duplication: project, zone, room, and report paths had direct `selectedBtu * qty` calculations.

Affected files:

- `app.js`
- `styles.css`
- `tests/project-system-equipment-picker.test.js`
- `tests/core-ux-bug-fixes.test.js`
- `scripts/core-ux-e2e.js`

Fix implemented:

- Added `getSelectedUnitCapacityBtu(system)` and `getSelectedInstalledCapacity(system)`.
- Routed project, zone, room-system, and report capacity totals through the central resolver.
- Persisted explicit `selectionMode`, `manualCapacityBtuH`, and `equipmentId`.
- Made `.project-equipment-picker-select` cover the full capacity card so clicks open the selector.

## Issue 2: Add Device

Reproduction:

1. Open the home page.
2. Click Add Device.
3. Select a device.

Current behavior before fix:

- The add-device modal path relied on DOM nodes being present and could fail silently if the modal/grid nodes were missing or not initialized.

Expected behavior:

- Clicking Add Device opens the modal and populates the device grid.
- Selecting a device updates `devs` and enters the device load into calculations.

Root cause:

- `openModal()` did not guard missing modal elements before trying to open/populate them.

Affected files:

- `app.js`
- `tests/core-ux-bug-fixes.test.js`
- `scripts/core-ux-e2e.js`

Fix implemented:

- Hardened `openModal()` with explicit overlay/grid checks.
- Browser E2E now opens the modal, confirms device rows exist, clicks a device, and verifies device load is applied.

## Issue 3: English Localization / Sidebar

Reproduction:

1. Open the home page.
2. Switch language to English.
3. Inspect the desktop sidebar and layout direction.

Current behavior before fix:

- `applyLang()` updated many static labels but did not directly call the desktop sidebar/topbar localization routine.
- CSS kept the desktop sidebar on the right even when the document direction was LTR.

Expected behavior:

- English: `html lang="en"`, `dir="ltr"`, sidebar on the left, sidebar labels in English.
- Arabic: `html lang="ar"`, `dir="rtl"`, sidebar on the right, sidebar labels in Arabic.

Root cause:

- Desktop-specific localization and layout direction were split from the main language application flow.

Affected files:

- `app.js`
- `styles.css`
- `tests/core-ux-bug-fixes.test.js`
- `scripts/core-ux-e2e.js`

Fix implemented:

- `applyLang()` now refreshes desktop project/sidebar text and desktop layout state.
- Added LTR CSS rules for sidebar and app margins.
- Browser E2E verifies English and Arabic document language/direction and English sidebar label.

## Console Errors

No console errors are expected after the fixes. Browser-level verification is written to:

- `dist/core-ux-e2e-report.json`
- `dist/core-ux-e2e-dashboard.png`

## Verification Commands

Run:

```powershell
npm run build
npm test
npm run browser:core-ux
```


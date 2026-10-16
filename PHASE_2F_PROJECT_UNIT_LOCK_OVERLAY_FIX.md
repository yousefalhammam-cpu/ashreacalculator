# Phase 2F Fix - Project Unit Lock Overlay

## Issue
Selecting a project-level unit could show a dark `Pro` lock overlay over the duct and ESP work area, even while the app UI displays PRO access.

## Fix
- `updatePlanUI()` now treats visible PRO entitlement as an unlocked state.
- Data-pro controls are cleared from locked state when features are open.
- Duct and ESP sections are not covered by the lock overlay while project mode is active.
- Added CSS fallback to hide the lock overlay in project mode if the class remains temporarily.

## Safety
No calculation logic changed. This is UI access-state cleanup only.


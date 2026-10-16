# Phase 2F Fix - Project Unit Validation Refresh

## Issue
When selecting a project-level unit, some dashboard validation and insight surfaces could show stale or incomplete values:
- Engineering Validation could remain not applicable.
- Engineering Insights could show `undefined` when a validation item did not expose a `message` field.

## Fix
- Synchronized legacy project state from `projectSystems` before building project engineering validation.
- Synchronized room/system state before refreshing the desktop validation checklist.
- Made Engineering Insights use the first available text from `message`, `detail`, or `title`.

## Safety
No calculation formulas, thresholds, equipment catalog values, BTU, CFM, ACH, or ESP logic were changed.


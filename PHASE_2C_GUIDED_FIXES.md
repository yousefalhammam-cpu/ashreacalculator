# Phase 2C Guided Fixes

Date: 2026-07-18

## What Changed
Added guided fix behavior to:

```text
modules/engineering-agent.js
```

The primary Engineering Agent command now routes the user to the most relevant part of the app based on the first action.

## New API
The Engineering Agent now exposes:

```text
window.AppEngineeringAgent.guideAction(action, result)
```

## Guided Behaviors
The primary command can now guide:

- Missing room volume -> opens calculator and focuses dimensions.
- Missing people count -> opens calculator and focuses people input.
- Capacity issue -> opens calculator/system area.
- Split CFM review -> opens calculator and explains BTU is the primary split-system check.
- Duct/ESP issue -> opens calculator and focuses duct/ESP context.
- Quote step -> opens quotation.
- Save step -> saves project.
- General validation -> opens technical report.

## Safety Guardrail
No calculations are changed.

No capacity, airflow, quote, report, or project data is modified automatically.

Guided fixes only navigate, focus fields, and display guidance.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- VM smoke test confirmed:
  - missing people count focuses `inp-ppl`
  - split CFM review opens `calc` and shows guidance
  - report opens `tech`
  - quote opens `hist`
  - save calls `saveCurrentProject()`

Not completed:

- Full browser console/network smoke test, because browser automation is not currently available in this workspace.

## Next Step
Phase 3A:

Calculation hardening:

- Separate Quick Estimate from Design Review.
- Make calculation level visible in the Agent.
- Add regression test cases for room load, healthcare ACH, CFM, capacity matching, duct, and ESP.


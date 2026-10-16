# Phase 1C Smarter Engineering Actions

Date: 2026-07-18

## What Changed
Improved the Engineering Agent next-action logic in:

```text
modules/engineering-agent.js
```

The panel now generates more specific engineering actions instead of only generic validation messages.

## New Action Types
The Engineering Agent can now flag:

- No rooms added.
- Missing room volume.
- Missing people count for non-healthcare rooms.
- Healthcare ACH, outdoor air, exhaust, and pressure review.
- Room capacity undersized.
- Room capacity oversized.
- Room airflow below required CFM.
- Room airflow high versus required CFM.
- Ducted system velocity and ESP review.
- Project capacity undersized.
- Project capacity oversized.
- Project airflow below required CFM.
- Preliminary ESP medium/high review.

## Safety Guardrail
No calculation formulas were changed.

This phase only reads current outputs and validation state, then turns them into prioritized engineering actions.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- VM smoke test for an empty project:
  - returned `add_first_room`
- VM smoke test for a Dental Operatory with undersized capacity, low airflow, ducted system, and high ESP:
  - returned `room_capacity_undersized`
  - returned `room_cfm_low`
  - returned `project_capacity_undersized`
  - returned `project_cfm_low`
  - returned `esp_high`
  - returned `healthcare_review`

Not completed:

- Full browser console/network smoke test, because browser automation is not currently available in this workspace.

## Next Step
Phase 2A:

Build an Engineering Agent workflow that guides the user through:

```text
Inputs -> Calculate -> Validate -> Fix -> Report -> Quote -> Save
```

This should remain deterministic first. AI API integration should wait until the workflow and validation model are stable.


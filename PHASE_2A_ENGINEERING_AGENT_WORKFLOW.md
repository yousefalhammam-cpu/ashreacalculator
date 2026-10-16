# Phase 2A Engineering Agent Workflow

Date: 2026-07-18

## What Changed
Added workflow-state logic to:

```text
modules/engineering-agent.js
```

The Engineering Agent now evaluates where the project stands in the engineering workflow:

```text
Inputs -> Calculate -> Validate -> Fix -> Report -> Quote -> Save
```

## New API
The Engineering Agent now exposes:

```text
window.AppEngineeringAgent.buildWorkflowState()
```

`runEngineeringValidation()` also returns:

```text
workflow.currentStep
workflow.steps[]
```

## UI Update
The Engineering Agent card now includes a compact workflow checklist showing the status of each phase:

- Inputs
- Calculate
- Validate
- Fix
- Report
- Quote
- Save

Each step can be:

- `ok`
- `needs_input`
- `warning`
- `critical`

## Safety Guardrail
No calculation formulas were changed.

This phase only reads the current project state, validation output, quote state, and saved-project signal.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- VM smoke test for an empty project:
  - current step: `inputs`
  - action: `add_first_room`
- VM smoke test for a Dental Operatory with undersized capacity, low airflow, ducted system, and high ESP:
  - current step: `validate`
  - workflow flags validation/fix/report/quote/save as needing review

Not completed:

- Full browser console/network smoke test, because browser automation is not currently available in this workspace.

## Next Step
Phase 2B:

Add workflow commands that help the user act on the state:

- Start Workflow
- Fix First Issue
- Open Technical Report
- Prepare Quote
- Save Project

These commands should route to existing app functions first. AI API integration should still wait until the deterministic workflow is stable.


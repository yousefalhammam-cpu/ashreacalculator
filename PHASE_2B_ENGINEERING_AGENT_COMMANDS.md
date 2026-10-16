# Phase 2B Engineering Agent Commands

Date: 2026-07-18

## What Changed
Added workflow command controls to the Engineering Agent card in:

```text
modules/engineering-agent.js
```

The Engineering Agent can now guide the user to the next workflow area instead of only displaying state.

## New Commands
The panel now renders command buttons for:

- Fix First Issue / Start Inputs / Prepare Quote / Save Project
- Technical Report
- Quote
- Save
- Refresh

The primary command changes based on `workflow.currentStep`.

## Command Routing
Commands use existing app functions when available:

- `goPanel('calc')`
- `goPanel('tech')`
- `goPanel('hist')`
- `saveCurrentProject()`
- `refreshAgentPanel()`

The command layer does not create new calculation, report, quote, or save logic.

## New API
The Engineering Agent now exposes:

```text
window.AppEngineeringAgent.runAgentCommand(command)
```

Supported command values:

```text
primary
report
quote
save
```

## Safety Guardrail
No calculation formulas were changed.

No report or quotation generation logic was changed.

This phase only adds workflow navigation and command shortcuts.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- VM smoke test confirmed command routing:
  - primary on empty project -> `calc`
  - report -> `tech`
  - quote -> `hist`
  - save -> `saveCurrentProject()`

Not completed:

- Full browser console/network smoke test, because browser automation is not currently available in this workspace.

## Next Step
Phase 2C:

Add guided fix behavior for specific issue types:

- Missing dimensions -> focus dimension inputs.
- Missing people count -> focus people input.
- Capacity issue -> open equipment/system selection.
- CFM issue -> open system airflow/duct context.
- ESP issue -> open ESP block.
- Healthcare issue -> open room standard/ASHRAE context.


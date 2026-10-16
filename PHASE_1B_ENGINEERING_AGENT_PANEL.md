# Phase 1B Engineering Agent Panel

Date: 2026-07-18

## What Changed
The Engineering Snapshot from Phase 1A is now visible in the application UI.

The existing module was extended:

```text
modules/engineering-agent.js
```

It now injects a desktop insight card:

```text
Engineering Agent
```

## What The Panel Shows
The panel reads the current project snapshot and displays:

- Project Health.
- Room count.
- Healthcare room count.
- Required BTU/h.
- Required TR.
- Required CFM.
- Warning count.
- Top next actions.

## Update Behavior
The panel refreshes after key workflow functions when they are available:

- `doCalc`
- `addToQuote`
- `clearHist`
- `saveCurrentProject`
- `setQuoteMode`
- `renderDesktopInsightPanel`
- `renderProjBlock`
- `renderHist`
- `renderQuote`

## Safety Guardrail
No calculation formulas were changed.

This phase only renders the existing Engineering Agent snapshot and validation output.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- Confirmed `app/index.html` loads `modules/engineering-agent.js`
- Ran a Node VM smoke test confirming:
  - `runEngineeringValidation()` works
  - `refreshAgentPanel()` is exposed
  - a one-room snapshot returns successfully

Not completed:

- Full browser console/network smoke test, because browser automation is not currently available in this workspace.

## Next Step
Phase 1C:

Improve the action intelligence so the next actions become more engineering-specific:

- Missing dimensions.
- Missing people count.
- Healthcare ACH/pressure review.
- Capacity undersized/oversized.
- CFM mismatch.
- Duct velocity warnings.
- ESP review.


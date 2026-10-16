# Phase 2D - Room-Level Engineering Diagnostics

## Goal
Move the Smart Engineering Reviewer from general project notes into clear room-level engineering diagnostics.

## What Changed
- Added room diagnostics derived from the existing engineering snapshot and next-action rules.
- Each diagnostic explains:
  - the affected room
  - the issue
  - the engineering impact
  - the recommended review action
- Kept diagnostics read-only. No BTU, CFM, ACH, ESP, or equipment selection formulas were changed.
- Kept the reviewer UI as a yellow notes card with a lightbulb, without command buttons.
- Updated the reviewer health badge to include guidance diagnostics, so missing room inputs and review warnings are visible in the card status.
- Removed the duplicated numbered next-action list from the reviewer card; engineering notes are now the single guidance surface.
- Simplified the reviewer panel layout by removing the extra body text and old command/action placeholders, leaving only metrics, workflow status, and the engineering notes card.

## Why
This improves engineering guidance without risking calculation correctness. The platform now tells the user why a room needs review instead of only showing a generic project status.

## Remaining Work
- Add diagnostics into the technical report export.
- Add a final project readiness summary before report/quote generation.
- Add automated scenario tests for common room combinations.

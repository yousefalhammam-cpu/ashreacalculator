# Phase 2B Agent Guidance Clarity Fix

Date: 2026-07-18

## Problem
The Engineering Agent still showed unclear or overly strict guidance for wall split projects:

- CFM shortfall appeared like a critical issue even when selected capacity was acceptable.
- ESP guidance could appear even though the selected project system was non-ducted.
- Repeated room-level actions made the guidance noisy.

## Fix
Updated:

```text
modules/engineering-agent.js
```

Changes:

- Non-ducted split CFM differences are now treated as review guidance, not a critical blocker.
- ESP actions are only generated when the project or room system is ducted.
- Repeated generic guidance is deduplicated.
- The Agent now explains that BTU capacity is the primary pass/fail check for non-ducted split systems.

## Expected Guidance For The Current Screenshot
Given:

- 3 rooms.
- Required load: `67,764 BTU/h`.
- Selected capacity: `72,000 BTU/h`.
- Required airflow: `2,544 CFM`.
- Selected airflow around `2,400 CFM`.
- System: wall split / non-ducted.

Expected result:

- Project health: `warning`, not `critical`.
- Capacity remains acceptable.
- CFM is shown as manufacturer airflow review.
- ESP is not shown unless ducted equipment is selected.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- VM smoke test matching the screenshot pattern:
  - Health: `warning`
  - Critical count: `0`
  - ESP action omitted for split system
  - Actions reduced to clear guidance


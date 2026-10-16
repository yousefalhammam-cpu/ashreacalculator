# Phase 2B CFM Guidance Fix

Date: 2026-07-18

## Problem
The Engineering Agent could mark a project as `critical` when selected CFM was unavailable for non-ducted systems such as wall split units.

This was too strict because wall split selection is primarily capacity-based. Catalog CFM is still useful, but missing CFM should not block the whole project unless the system is ducted or a ventilation/distribution proof is required.

## Fix
Updated:

```text
modules/engineering-agent.js
```

The Agent now downgrades missing/failed CFM validation from `critical` to `warning` when:

- The selected system is non-ducted.
- Selected CFM is not available.

The Agent now explains:

```text
Selected system does not expose catalog CFM. Capacity is the primary check for non-ducted split systems; verify manufacturer airflow only when ventilation or air distribution is required.
```

## Safety Guardrail
No calculation formulas were changed.

Only Engineering Agent interpretation and guidance were adjusted.

## Verification
Completed:

- `node --check modules/engineering-agent.js`
- VM smoke test for split-system project with:
  - required load: `67,764 BTU/h`
  - selected capacity: `72,000 BTU/h`
  - required airflow: `2,544 CFM`
  - selected airflow unavailable

Expected result confirmed:

- Health: `warning`
- Critical count: `0`
- One clear CFM guidance action


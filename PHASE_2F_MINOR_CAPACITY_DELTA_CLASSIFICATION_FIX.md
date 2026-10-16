# Phase 2F Fix - Minor Capacity Delta Classification

## Issue
Very small selected-capacity shortfalls could be classified as critical failures. This made Delivery Readiness show `Not Ready` even when the shortfall was around 1% and should be reviewed rather than treated as a hard blocker.

## Fix
- Capacity shortfall up to 2% is now classified as `warning`.
- Larger shortfalls remain `fail`.
- The selected and required BTU values are not changed.

## Safety
This does not change load calculations, unit selection, CFM, ACH, ESP, or catalog data. It only changes the severity classification of a minor capacity delta.


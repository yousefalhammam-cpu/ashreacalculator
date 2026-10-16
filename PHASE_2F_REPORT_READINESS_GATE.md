# Phase 2F - Report Readiness Gate

## Goal
Add a clear delivery-readiness decision before report and quotation export.

## What Changed
- Added a Delivery Readiness card inside the Smart Engineering Reviewer.
- The card shows:
  - overall delivery status
  - technical report readiness
  - quotation readiness
  - the primary reason
- Added a lightweight export guard:
  - blocks report/quotation export when the project is missing rooms, missing calculations, missing required inputs, or has critical issues
  - warns but allows export when the project only needs engineering review
  - blocks quotation PDF export when pricing is still missing

## What Did Not Change
- No calculation formulas changed.
- No BTU, CFM, ACH, ESP, equipment selection, or validation thresholds changed.
- Existing report and quotation functions remain intact; the gate only decides whether they should run.

## Next Work
- Add readiness status into the technical report itself.
- Add a final approval checklist for professional sign-off.


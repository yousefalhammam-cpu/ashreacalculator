# AirCalc Pro — Current Status Snapshot

## What currently works
- Quick room calculation
- Healthcare room airflow display
- Quotation generation
- Project save/load using localStorage
- CSV export
- HTML invoice export
- PDF export
- Technical report export
- Project mode and bundle mode
- Preliminary duct sizing
- Preliminary ESP calculation
- Free / Pro plan gating
- Projects manager panel

## Preliminary only
- Regular room cooling load is still simplified
- Cooling load is not yet a full detailed HVAC design engine
- Duct sizing is preliminary, not final detailed network design
- ESP is estimated, not based on full duct layout
- Equipment selection is not manufacturer-grade yet
- Projects are stored locally, not cloud-synced
- Some engineering outputs still need validation summary

## Needs improvement
- Separate Quick Estimate and Design Mode more clearly
- Improve detailed cooling load engine
- Reduce app.js complexity
- Add unified validation summary
- Add export/import project JSON
- Improve duct logic for branches and fittings
- Improve technical assumptions in reports

## Goal of this branch
Freeze the current version before major engineering and structural improvements.

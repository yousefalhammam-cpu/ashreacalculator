# Real Catalogue Ingestion Workflow

## Purpose

AirCalc Pro must not treat manufacturer equipment data as verified only because it was imported. Real catalogue data is now imported with provenance metadata so every model can be traced before engineering review.

## Implemented Foundation

- Equipment Database includes catalogue provenance fields beside CSV import.
- If no provenance fields are filled, the existing generic CSV import path remains unchanged.
- If any provenance field is filled, real catalogue import requires:
  - Manufacturer ID
  - Manufacturer name
  - Catalogue revision
  - Source document
- Valid rows are still imported as draft records only.
- Imported real-catalogue rows receive catalogue/version metadata through `AirCalcEquipmentCatalogue.createImportContext`.
- The import preview displays provenance status and metadata warnings before saving.
- Import is blocked when partial catalogue provenance is provided.
- A source PDF/CSV/Excel file can be linked before CSV import.
- When supported by the browser, AirCalc Pro calculates a SHA-256 fingerprint for the source file and stores it on the catalogue version.

## Engineering Review Rule

CSV import does not verify equipment. Imported rows must pass the catalogue review workflow before they are treated as verified or published equipment.

The catalogue workflow now runs data quality gates before a record can enter review, verification, or publishing. Critical blockers include missing catalogue source reference, missing BTU/h cooling capacity, missing nominal CFM, and missing ESP for ducted, package, AHU, and FCU records.

## Remaining Work

- Add real manufacturer CSV files only after source documents are available.
- Add persistent source-file storage after Firebase Storage or a backend document store is approved.
- Add admin-only reviewer identity when authentication is fully enforced.
- Add PDF page/table extraction later; do not infer catalogue values from memory.

# Equipment catalogue review - 2026-10-21

## Inventory and scope

- 164 catalogue records: 109 named model records and 55 product-family / project-selection references.
- 109 model records now carry source verification; this is not complete project approval, confirmation of stock, or proof that every specification is published.
- Existing verified LG records retain their prior review. Their three source pages returned HTTP 403 during this review; they were not newly re-verified from inaccessible pages.
- Five current source URLs were unavailable: three LG pages (403), and two older Daikin modular AHU pages (404). Prior data is retained, with retrieval state visible.
- Additional structured specifications or audited field patches were added for 98 records. Original source excerpts and shared tables are available where exact model evidence could be obtained.
- Manufacturer product families remain references, not exact purchasable model selections. No fictitious exact models were added to replace them.

## Source collection

The collection inspected 55 distinct source URLs and successfully retrieved 50. The old Daikin FXSQ landing page was supplemented by its current official model-specific specifications table. Source hashes, retrieval timestamps, public text/table evidence, and unavailable states are recorded per seed ID in `data/equipment-source-evidence.js`.

Sources include official Daikin, Haier, Carrier, SKM and Samsung catalogues, Midea technical publications hosted by its Saudi distribution channels, Zamil public product specifications, and GSO public technical listings. Scope is identified where the source is a manufacturer-authored distributor-hosted leaflet or a public certification listing rather than a full engineering submittal.

Reproduction:

1. Run `scripts/collect-equipment-specifications.py` using Python with pypdf.
2. Run the same collector with `--refresh-daikin` to resolve the current FXSQ table.
3. Run `node scripts/enrich-equipment-evidence.js` to rebuild structured source fields and reviewed table patches.
4. Run `node --test tests/equipment-source-evidence.test.js`.

The generated data is local and precached by the service worker; browsing does not fetch manufacturer sites.

## Engineering safeguards

- Existing cooling capacities, existing non-null supply airflows, and existing duty ESP ratings are preserved by regression tests.
- Newly published airflow values can fill previously missing fields. For FXSQ these are indoor-unit values at the stated 50 Hz fan setting, not outdoor VRF system airflow.
- Condenser fan airflow and condenser ESP are never imported as room supply airflow/ESP.
- A published maximum ESP is not substituted for a duty-point ESP.
- T3 and nominal/AHRI rating conditions remain identified. Manufacturer-rounded capacity conversions can differ slightly from separately published values.
- Indoor fan power is not labelled as whole-system VRF power; source scope is displayed.
- Unknown dimensions/current/voltage/frequency remain null unless units and meaning are clear. Combined module dimensions/weights remain separate source values.
- Missing specifications display an explicit missing-details label; inapplicable chiller supply-air fields are labelled inapplicable.

## Interface

- Compact illustrated categories, bilingual multi-word search, model cards by default, table alternative, and 12 results per page.
- Comparison appears only after an item is selected for comparison.
- Import, verification and publication tools are separated under catalogue data management, not mixed with browsing actions.
- Details contain model identification, performance, electrical/efficiency, dimensions/installation, source and all extracted additional specifications.

## Remaining external gaps

Full manufacturer submittals are still needed for configured AHU/FCU families, final model suffixes/options, project-ambient performance, and currently unpublished or inaccessible specifications. Source verification must not be presented as complete engineering approval.

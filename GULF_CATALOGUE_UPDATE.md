# Gulf catalogue and duct actions - 2026-10-13

- Existing catalogue: 65 starter records, including product families and non-Gulf markets. These were not blanket-certified or overwritten.
- Added three exact Saudi-market LG listings: AT-Q24GNLT0, ND242C0 and AK-C04820.AWGBIBR. Source URLs and field limitations are stored in each record.
- Verified means the recorded specifications were checked against the published source. It does not mean project performance or supplier stock has been approved.
- Package capacity uses published T3 net 42000 BTU/h, not gross 48000. Missing ESP/airflow values stay null. ND242C0 uses rated 6300 W, not maximum output.
- Existing uploaded non-sample records already participate in report matching regardless of verification status. No-match wording now describes a type/capacity/quantity mismatch instead of implying an untrusted database.
- Duplicate missing-selection warning suppressed when there are no matches.
- Duct proposals use the existing design CFM and velocity, Q/V area conversion (92903.04 mm2/ft2), 50 mm dimensional increments, 150-1800 mm bounds, and the existing aspect-ratio limit. Three smallest-area candidates are offered when feasible.
- Selecting a proposal uses the existing persisted duct action, refreshing project, quotation, advanced duct calculation and technical report. No default airflow is invented when design inputs are absent.

## Remaining coverage

2026-10-14: Added 15 SKM APMR 50 Hz sizes using official catalogue pages 7-8, rating (2), outdoor 46 C and indoor 27 C DB / 19.5 C WB. These are published gross capacities; fan heat must be considered for final net selection. Frequency and gross basis are visible in quotation dropdown labels. APMR 52170 is 149300 BTU/h and 6000 CFM. Test at selected 150000 BTU/h and required 140000 BTU/h confirms both Daikin and SKM are offered. Catalogue reference: https://skmaircon.com/catalogues_new/APMR50Hz.pdf. No engineering calculations or quantities were changed.

The catalogue is not a complete Gulf inventory. Existing AHU family entries require coil-selection data for a cooling-capacity match. Supplier stock, project design conditions and unpublished fan curves need supplier evidence. User-imported records and their existing review metadata are preserved.

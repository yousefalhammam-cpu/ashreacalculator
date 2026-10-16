# Saudi Equipment Coverage Review

Checked: 2026-10-16. This is a coverage expansion, NOT a complete inventory of every Saudi HVAC model or a stock feed.

## Findings

The previous seed contained 83 records. Gree and Midea were registry entries without actual models; Haier was absent from the registry. Several older Zamil entries were product descriptions or family records, not exact matched indoor/outdoor identifiers. A registry name is not model coverage.

## Added Records

| Manufacturer | New records | Evidence |
|---|---:|---|
| Zamil | 13 | Official Saudi product pages; split, concealed, cassette, window, floor and packaged units |
| Haier | 6 | Saudi product specifications; five Ultra Inverter heat/cool models and one Smart Cool model |
| Midea | 6 | A7 concealed from Midea Saudi; five Mission Xtreme identifiers from a manufacturer brochure mirror |
| Gree | 5 | Two Pular models from Saudi distributor Al-Asasyah; three GSO model registrations |
| Total | 30 | Seed now has 113 records; registry has 23 manufacturers |

Twenty-two added records have published-field cross-check status. Eight remain pending: five mirrored Midea brochure models and three GSO Gree registrations. Verification means transcription of published fields, NOT approval of a project-specific selection or current stock/certification.

## Source Register

- Zamil exact product URLs are stored per record under `https://zamilac.com/en/product/`. For example [DAQ60 / KAQ60](https://zamilac.com/en/product/zamilac-ducted-split-concealed-ac-inverter-52000-btu-coldhot) publishes 52,000 BTU/h despite the 5-ton marketing label. [ZRT075C](https://zamilac.com/en/product/zamilac-central-package-unit-ac-625-tr-cool-only) publishes 6.25 TR. [RCT24CSXFMBTI-R32](https://zamilac.com/en/product/zamil-classic-window-ac-inverter-24200-btu-cold) publishes 24,200 BTU/h.
- [Haier Saudi HSU-18HQ13](https://www.haier.com/sa/air-conditioners/hsu-18hq13r32-t3db-b-.shtml): T1 18,000 versus T3 14,400 BTU/h. Each Haier record has its own product URL. Published Hi airflow is used rather than Turbo for the Ultra Inverter models.
- [Midea Saudi A7](https://www.midea.com/sa/residential-ac/light-commercial-ac/midea--concealed-a7-duct-ac.mtbtve18hwn1ksa): T3 18,000, T1 nominal 19,600 BTU/h; supply 230 V / 1 phase / 60 Hz, high airflow 980 m3/h. No numerical ESP is assumed.
- [Mission Xtreme manufacturer brochure mirror](https://cool.sa/wp-content/uploads/2024/04/Split-Air-Conditioner.pdf): identifiers and capacities transcribed as printed. Distributor imprint names Hussein & Al-Hassan G. Shaker. Current revision and model suffixes require distributor confirmation. Inconsistent extracted airflow columns are not imported.
- [Al-Asasyah Saudi distributor](https://al-asasyahonline.com/store/category/20): structured listings for GWC12AGC-D3NTA1A and GWH12AGC-D3NTA1A publish 11,600 BTU/h. Unlabeled airflow/speed arrays are not interpreted. Listings were unavailable, so this is NOT confirmation of stock.
- [GSO record 55354](https://www.gso.org.sa/nb/p/55354?lang=ar): three exact Gree identifiers with 18,000 BTU/h. The source displays activation expiry 2026-04-13. Records remain pending; neither current conformity nor Saudi availability is asserted.

## Capacity And Missing-Data Policy

- No calculation-engine, sizing tolerance, or standard-capacity option changes.
- Where the new source explicitly publishes T3, `coolingCapacityBtuH` uses T3 and T1 is retained as `coolingCapacityT1BtuH`; notes identify the basis. This is a catalogue rating, not a simulation of actual site conditions.
- Unknown ESP, airflow, voltage, phase, frequency, and rating conditions remain null/unspecified. Dual 50/60 Hz support is documented in notes rather than silently reduced to one frequency.
- Marketing tonnage does not override published BTU/h. Matched indoor/outdoor identifiers are retained separately where published.
- No retail prices or promises of availability are seeded. User imports and saved snapshots are not overwritten.

## Remaining Coverage Gaps

- Not all Zamil product families and suffixes are captured. Large commercial AHU/chiller/VRF selections require current official schedules/submittals.
- Gree current Cosmo/AI Plus and larger Pular sizes need current distributor technical sheets; expired registration records are not a substitute.
- Midea current residential range, cassette/floor/window/rooftop and VRF combinations require current Saudi catalogues; a mirrored older leaflet is not comprehensive coverage.
- Haier cooling-only LQ variants and the rest of the Saudi residential/commercial range remain to be transcribed from their own technical tables.
- Other Saudi brands remain partial or registry-only. Do not label this database 'complete Saudi market coverage'.

## Validation

- Schema validation across every seed record; unique IDs; each new brand represented by actual models, not just a registry entry.
- Regression checks assert Haier T3 versus T1, Midea A7 T3, Zamil DAQ60 actual capacity, pending GSO status, missing ESP and source provenance.
- Database module tests confirm all new records load without sample-data mode. Full regression suite is rerun after the expansion.

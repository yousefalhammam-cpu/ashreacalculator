# Applied Equipment Expansion - 2026-10-16

## Delivered
- Catalogue seed increased from 113 to 127 non-sample records; registry remains 23 manufacturers.
- Added 7 exact SKM APCY 60 Hz air-cooled chiller models, 3 Samsung DVM chillers and 4 Midea V8 combined outdoor configurations.
- Midea uses published T3 kW, not larger T1 capacities. Outdoor combinations are not single cabinets or complete indoor terminal selections.
- No engineering calculation functions changed. Chiller condenser airflow is not imported as supply CFM; supply ESP remains unknown.
- Added eight local manufacturer logos to database tables/cards and commercial alternative cards. Logos do not require internet access at runtime.

## Sources and Limitations
- SKM: https://www.skmaircon.com/catalogues_new/APCY.pdf (60 Hz standard efficiency nominal cooling kW table).
- Samsung: https://images.samsung.com/is/content/samsung/assets/uk/business/climate/for-installer/SEACE_CAC_Catalogue_2021_dr03db_lr.pdf (DVM cooling nominal table).
- Samsung product verification: https://www.samsung.com/in/business/system-air-conditioners/chiller/ac-dvm-ag056ksvanh-eu/
- Midea Saudi distributor: https://www.hh-shaker.com.sa/wp-content/uploads/2025/01/specification/CAC_Tech_Specs/VRF_V8.pdf

These are source-backed imports, not current stock certification. New records remain pending review. Saudi model suffix, frequency and performance at project ambient require supplier confirmation. Manufacturer presence does not establish availability of every model. York and Zamil chiller exact performance tables remain a coverage gap; family ranges were not fabricated into exact models. This is NOT complete Saudi-market coverage.

## Logo Provenance
Correction: Zamil official SVG paths are preserved from https://zamilac.com/assets/LogoImage-EbFpHI0t.js in zamil.svg. Haier's official white logo now has a blue background for contrast. Manufacturer registry rows now display the same logos as equipment cards. Total local logos: nine. Targeted asset/contrast tests and syntax checks passed.
Local assets under assets/manufacturers; trademarks remain their owners' property.
- Carrier: https://brandportal.carrier.com/m/99b434eac013f6f/webimage-carrier_logo_rgb.png
- Daikin: https://www.daikin-ksa.com/etc.clientlibs/daikin/clientlibs/clientlib-internet-site/resources/images/logo/daikin-logo.svg
- Haier: https://image.haier.com/sa/images/hw2019_head_logo.png
- Midea: https://web-res.midea.com/content/dam/midea-aem/system/Midea-logo-2x.png/jcr:content/renditions/Midea-logo-2x.webp
- SKM: https://skmaircon.com/img/layout/skmlogoonly_rev.png
- Trane: https://www.trane.com/content/dam/Trane/Commercial/TraneLogo_red.png
- LG and Samsung: Simple Icons v16 (https://simpleicons.org), brand icons via jsDelivr; not manufacturer-hosted files.

Companies without a sourced local logo retain their readable name; no synthetic logo is displayed.

## Validation
- Syntax build: passed (9 application files); both edited data scripts also passed node --check.
- Full test suite: PASSED=54 FAILED=0. Initial sandbox run blocked localhost; rerun with local server access passed.
- Quotation browser audit: passed at 1440x1000 and 390x844. Temporary Edge profile cleanup emitted EPERM after the successful run.
- Regression assertions cover the 14 new records, unique IDs, T3 VRF capacity, missing supply airflow/ESP, review status and all eight local logo assets.

# HEPA Reference - 2026-10-16

Added a bilingual reference in Technical Report > Airflow and ducts. This is a catalogue-family reference, not an automatic equipment selection or certification of compliance.

- AAF AstroCel II: H14 product family. Saudi office presence: https://aafimea.com/contact-us/ . Exact local stock/size must be confirmed.
- Product: https://www.aafintl.com/us/products/high-purity-%28hepa%29-filtration/hepa-ulpa-panel-filters/astrocel--ii
- Camfil Megalam ProSafe: H13/H14 variants; Saudi supplier and stock explicitly unconfirmed.
- Product: https://www.camfil.com/en-ie/products/epa-hepa--ulpa-filters/cleanroom-panels/megalam/megalam-prosafe-_-32426
- Standards context: https://handbook.ashrae.org/Handbooks/S24/IP/s24_ch29/s24_ch29_ip.aspx
- Healthcare context: https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch09/A23_Ch09_si.aspx

ASHRAE 52.2 does not classify HEPA performance. HEPA classification uses EN 1822 / ISO 29463. Healthcare filtration requirements must be checked against room use and the project's adopted ASHRAE 170 edition, local authority and installation/testing requirements. No blanket "ASHRAE approved company" claim is made.

No cooling load, airflow or ESP engine changed. Exact filter size, flow, initial/final resistance, fan duty and installed leakage testing remain required before approval. No invented filter pressure drop or automatic compliance badge.

## Filter impact estimator
Inline filter choices now include three explicit catalogue examples, not generic class resistance: Camfil B6 item 3140018 (MERV 11A, 490x592x600, 2800 m3/h at 70 Pa), M8 item 3140057 (MERV 14A, 592x592x640, 3400 m3/h at 130 Pa), and Megalam MX14-2G10-610x610x90-1PU (H14, 605 m3/h at 95 Pa). Sources:
- https://www.camfil.com/dam/files/12781/1661491/Data-Sheet---Malaysia--en-AU----Hi-Flo-A-UF.pdf
- https://www.camfil.com/dam/files/14627/1669605/Data-Sheet---New-Zealand--en-AU----Hi-Flo-M-P-TM.pdf
- https://www.camfil.com/dam/files/9566/1673902/Data-Sheet---International--en----Megalam-ProSafe.pdf

Suggested parallel filter count is ceil(design m3/h / reference m3/h). At design flow the approximate resistance is reference Pa * (design flow / count / reference flow)^2. This is not a manufacturer curve or proof of local stock. Housing, actual face area, transitions and additional pressure losses remain outside this estimate. Manual resistance entry remains available. Filter dimensions are NOT inferred from duct dimensions and a suitable filter housing is required.

Report > Airflow and ducts now includes an optional filter (H13/H14/other), entered resistance at original design flow, original fan duty pressure and shutoff pressure. Inputs are saved with project state. Design CFM comes from the duct-sizing cache and is not overwritten.

Fixed-speed approximation: with x = Q/Qdesign, fan pressure = Pshutoff - (Pshutoff - Pduty)*x; system pressure = (Pduty + Pfilter)*x^2. The positive intersection gives estimated CFM and reduction. This requires consistent pressure definitions, speed and air density, and an added filter not already counted in the baseline. Linear fan and quadratic filter approximations are not manufacturer performance predictions. Not applicable to constant-flow/VFD compensation. Invalid or missing inputs produce no estimate. Actual fan/filter curves are required before engineering approval.

Scenario cards retain primary KPIs and a localized relative initial cost; extended requirements and estimate caveats moved into details.

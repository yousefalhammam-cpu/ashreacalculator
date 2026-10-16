# AirCalc Pro UX Review Report

Version target: v1.0.0-beta.1  
Date: 2026-07-25

## Executive Status

The current interface is suitable for beta engineering use after the latest layout work. The home page has been simplified toward a two-column workflow, the technical report has been reorganized to reduce repeated analysis blocks, and Copilot/engineering health values are clearer with `/100` scoring and improved color meaning.

## Reviewed Areas

- Home page
- Room input and quick estimate
- Project rooms and selected units
- Equipment Database
- Equipment Selector
- HVAC Design Copilot
- Professional Technical Report
- Quotation page
- Projects/cloud foundation
- Settings/navigation shell

## Click Path Review

- Add room and calculate: acceptable for beta.
- Select project equipment: acceptable, but depends on clear capacity dropdown visibility.
- Open Equipment Database: sidebar item `قاعدة الوحدات`.
- Import CSV: Equipment Database import area, preview, duplicate/conflict review, then import.
- Engineer Review: available near project/equipment and in technical report through Copilot/review surfaces.
- Technical Report: sidebar item `التقرير الفني`, with report fields at top.
- Export PDF: top action button and report export path.

## Strengths

- RTL is the primary layout direction and matches the Arabic-first workflow.
- Main engineering values are close to their relevant sections.
- Warnings and health indicators are now closer to decision surfaces.
- Sample equipment records are clearly marked and blocked from final engineering selection.
- AI is described as explain-only/foundation and does not appear as the source of engineering numbers.

## Issues

### High

- Real-browser responsive verification is still required on physical/mobile browsers before public beta.
- The technical report and Copilot include dense engineering cards; users need short labels like `/100`, status, and reason close to each score.

### Medium

- Some English labels remain in Copilot cards. This is acceptable for beta, but localization cleanup is needed before Arabic-only customer demos.
- The capacity dropdown can become narrow in dense layouts; it should remain touch-friendly.
- Accessibility audit is mostly static. Keyboard navigation and screen-reader behavior still need browser validation.

### Low

- Some report controls are compact and may require tooltips in a future polish pass.
- The sidebar is clear on desktop but should be rechecked on small mobile widths.

## UX Recommendations

1. Keep the current two-column home layout.
2. Keep engineering warnings next to the section they affect.
3. Do not add new dashboard pages before beta.
4. Before public beta, run manual UX smoke tests on desktop, tablet, and mobile.

## Result

UX audit result: Beta Pass with manual responsive/accessibility checks remaining.

# Manual UX Acceptance Test

Target release: v1.0.0-beta.1  
Date: 2026-07-25

## Objective

A new HVAC user should reach the first correct engineering result in under 3 minutes.

## Tester Setup

- Browser: Chrome or Edge first, then Firefox/Safari.
- Start from a clean browser session if possible.
- Use beta URL or local URL.
- Do not use sample equipment for final selection.

## Scenario

1. Create a new project.
2. Add one room.
3. Enter room dimensions.
4. Enter occupancy.
5. Choose city and room/system type.
6. Run calculation.
7. Review BTU/h, TR, and CFM.
8. Select equipment.
9. Read project health/status.
10. Open Technical Report.
11. Save project.
12. Reload browser.
13. Reopen project.

## Recording Sheet

| Item | Result |
|---|---|
| Tester name |  |
| Browser/device |  |
| Start time |  |
| End time |  |
| Total time |  |
| Reached first result under 3 minutes | Not Tested |
| Calculation values visible | Not Tested |
| Equipment dropdown clear | Not Tested |
| Project health understandable | Not Tested |
| Technical report clear | Not Tested |
| Save/reopen successful | Not Tested |
| Confusing buttons |  |
| Hesitation points |  |
| Text/label issues |  |
| Layout issues |  |
| Final UX verdict | Not Tested |

## Pass Criteria

- First valid result appears in less than 3 minutes.
- User understands which value is load, capacity, TR, and CFM.
- User can select a real equipment unit.
- User can open report without guidance.
- User can save and reopen the project.

## Fail Criteria

- User cannot finish without help.
- User selects sample data by mistake.
- Any primary button is unclear.
- Report or health status is misunderstood.
- Save/reopen fails.

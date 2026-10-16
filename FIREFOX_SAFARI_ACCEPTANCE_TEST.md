# Firefox & Safari Acceptance Test

Target release: v1.0.0-beta.1  
Date: 2026-07-25

## Status

Firefox and Safari were not executed in this Windows local pass. Chromium smoke and visual viewport checks passed. This document defines the required acceptance matrix for Firefox/Safari validation.

## Test Matrix

| Case | Firefox Desktop | Safari Desktop | iOS Safari | Notes |
|---|---|---|---|---|
| Open app | Not Tested | Not Tested | Not Tested | Confirm no blank screen. |
| Create project | Not Tested | Not Tested | Not Tested | Enter project name and number. |
| Add room | Not Tested | Not Tested | Not Tested | Use Bedroom or Patient Room. |
| Run calculation | Not Tested | Not Tested | Not Tested | Confirm BTU/h, TR, CFM update. |
| Select equipment | Not Tested | Not Tested | Not Tested | Confirm dropdown and real units appear. |
| Save project | Not Tested | Not Tested | Not Tested | Local and cloud paths if signed in. |
| Reopen project | Not Tested | Not Tested | Not Tested | Data must persist. |
| Technical report | Not Tested | Not Tested | Not Tested | Confirm English digits in report. |
| Export PDF | Not Tested | Not Tested | Not Tested | Print/PDF behavior varies by browser. |
| RTL/LTR toggle | Not Tested | Not Tested | Not Tested | Confirm layout does not overlap. |
| Mobile layout | Not Tested | Not Tested | Not Tested | Especially iOS Safari. |
| Offline/PWA behavior | Not Tested | Not Tested | Not Tested | Confirm cache behavior after reload. |
| Firebase sync | Not Tested | Not Tested | Not Tested | Requires beta Firebase project. |
| Cloud conflict | Not Tested | Not Tested | Not Tested | Requires two sessions/users. |
| Equipment Selector | Not Tested | Not Tested | Not Tested | Confirm Rules Engine selection. |
| Copilot | Not Tested | Not Tested | Not Tested | Confirm scores show `/100`. |
| Report English numbers | Not Tested | Not Tested | Not Tested | Confirm all report numbers use English digits. |

## Required Scenario

1. Open beta URL.
2. Create project.
3. Add one room.
4. Enter dimensions and occupancy.
5. Run calculation.
6. Select unit from Equipment Selector.
7. Open Engineer Review/Copilot.
8. Open Technical Report.
9. Export PDF.
10. Save cloud project.
11. Reload browser.
12. Reopen project.

## Pass Criteria

- No JavaScript errors in console.
- No layout overlap in core screens.
- Calculated values match Chromium baseline.
- Equipment selection remains deterministic.
- AI text does not generate engineering numbers.
- PDF/report export works or browser limitation is documented.

# AirCalc Pro Compatibility Report

Version target: v1.0.0-beta.1  
Date: 2026-07-25

## Scope

Target compatibility:

- Chrome
- Edge
- Safari
- Firefox
- Desktop
- Tablet
- Mobile

## Current Verification

Automated local verification completed:

- JavaScript syntax checks passed.
- Static local server smoke test passed through the existing test suite.
- All Node tests passed.
- The app is built as a static HTML/CSS/JS application, which improves baseline browser portability.
- A local Edge/Chrome headless smoke-test script was added as `npm run browser:smoke`.
- Latest local browser smoke pass: `http://127.0.0.1:5510/app/index.html` passed with 0 blocking errors and 4-8 non-blocking warnings from optional browser/resource noise.
- A local visual viewport audit was added as `npm run browser:visual`.
- Latest visual audit passed for desktop `1440x1000` and mobile `390x844`.

## Browser Automation Result

Playwright could not be used reliably in this environment, so a direct Chrome DevTools Protocol smoke test was added instead. The local test launches Edge/Chrome headless, loads the app through the local static server, watches runtime exceptions and blocking resource errors, then closes the browser.

This covers a real Chromium-family browser smoke pass. Firefox, Safari, and visual/mobile QA still require manual or CI validation.

## Visual Audit Artifacts

- `dist/browser-audit/desktop-1440x1000.png`
- `dist/browser-audit/mobile-390x844.png`
- `dist/browser-audit/browser-visual-audit.json`

These files are QA artifacts and are excluded from the release ZIP.

## Expected Compatibility

### Chrome

Expected beta-compatible. Chromium smoke path is available through `npm run browser:smoke`.

### Edge

Expected beta-compatible. Latest local Edge/Chrome smoke test passed.

### Firefox

Expected mostly compatible, but PDF and print/export behavior must be manually checked.

### Safari

Requires manual validation. Safari can differ in print layout, CSS grid behavior, and local file restrictions.

### Mobile/Tablet

Layout has been improved toward two columns on desktop and responsive stacking, but physical viewport validation remains required.

## Known Watch Areas

- PDF generation libraries.
- RTL print layout.
- Local `file://` restrictions versus `http://127.0.0.1`.
- Large report rendering.
- Capacity dropdown touch behavior.

## Result

Compatibility result: Beta Pass for Chromium smoke and basic desktop/mobile visual coverage. Safari/Firefox and manual UX review still require final validation before unrestricted public release.

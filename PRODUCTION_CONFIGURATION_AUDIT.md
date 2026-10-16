# AirCalc Pro Production Configuration Audit

Target release: v1.0.0-beta.1  
Date: 2026-07-25

## Executive Status

Production configuration is acceptable for controlled beta packaging, with deployment caveats. The app remains local/static-first and must be deployed behind confirmed Firebase rules and approved domains before public users are invited.

## Findings

### Localhost URLs

Found local URLs in:

- `local-static-server.js`
- `js/ai/ai-config.js`
- `server/README.md`

Assessment:

- Acceptable. These are local development/server paths.
- `js/ai/ai-config.js` disables the AI endpoint when not served from localhost/127.0.0.1.

### Development API Endpoints

Found:

- `/api/ai/explain`

Assessment:

- Acceptable for local foundation route.
- Production deployment must provide a secure backend before enabling AI explanations.
- AI remains explain-only and must not generate engineering numbers.

### Firebase Configuration

Found:

- Firebase web `apiKey` in `js/firebase-auth.js`.

Assessment:

- Firebase web API keys are public client identifiers, not server secrets.
- Must be protected by Firestore rules, authorized domains, and no service-account credentials in frontend.

### Debug Flags

No release-blocking debug flags found.

### Sample Data

Sample equipment data exists in `data/equipment-records.sample.js`.

Assessment:

- Sample records are labelled and blocked from final engineering selection.
- Sample records are not uploaded by cloud sync paths.
- Production UX must keep sample records hidden unless explicitly enabled for testing.

### Console Logging

Console logs/warnings exist in legacy and module init paths.

Assessment:

- Not release-blocking for controlled beta.
- Public release should reduce verbose initialization logs.

### Unsafe Feature Flags

No unsafe release-blocking feature flag was found.

## Required Before Public Launch

- Confirm deployed URL is not using `localhost` or `file://`.
- Confirm Firebase authorized domains include the beta domain.
- Confirm AI backend remains disabled or explain-only.
- Confirm sample records are hidden by default.
- Confirm `npm run release:beta` passes from a clean checkout.

## Result

Configuration result: Beta Pass with production deployment caveats.

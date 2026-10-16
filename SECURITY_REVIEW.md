# AirCalc Pro Security Review

Version target: v1.0.0-beta.1  
Date: 2026-07-25

## Scope

Reviewed:

- Firestore rules
- Authentication foundation
- Input validation surfaces
- XSS risks
- Injection risks
- Unsafe HTML rendering
- Sensitive data exposure
- Sample data boundaries
- AI boundary

## Firestore Rules

File: `firestore.rules`

Collections/rules present:

- `users/{userId}`
- `users/{userId}/projects/{projectId}`
- `users/{userId}/equipmentCatalogues/{catalogueId}`
- `users/{userId}/equipmentCatalogueVersions/{versionId}`
- `users/{userId}/equipmentRecords/{recordId}`
- `sharedProjects/{projectId}`

Security model:

- Private user data is scoped to `request.auth.uid == userId`.
- Shared project read access supports owner/editor/viewer.
- Shared project edit access supports owner/editor.
- Shared project manage/delete access supports owner.
- Owner role must remain owner during update.

Automated rule test result:

- `firestore-equipment-rules.test.js` passed.
- `npm run firebase:check` is available to validate Firebase deployment guardrails before production deployment.

## Authentication

Authentication foundation exists in `js/firebase-auth.js`.

Risk:

- The frontend Firebase `apiKey` is visible. This is normal for Firebase web apps but must be paired with strict security rules and Firebase app restrictions.

Recommendation:

- Add authorized domains in Firebase Console.
- Keep Firestore rules deployed from `firestore.rules`.
- Do not place server secrets in frontend files.

## XSS Review

Risk:

- The app uses many `innerHTML`, `insertAdjacentHTML`, and `document.write` calls.

Mitigations found:

- Escaping helpers are used in important rendering paths.
- Equipment sample data and AI explanations have explicit guardrails.
- Tests verify AI does not become source of engineering numbers.

Remaining requirement:

- Any future UI change that renders user/client/project text must use escape helpers or text-only DOM assignment.

## Injection Review

No server-side SQL layer exists in this static app. Main injection risks are:

- HTML injection through user-entered project fields.
- CSV import fields displayed in equipment database.
- AI explanation text displayed in selector/Copilot.

Mitigation:

- Keep all imported catalogue and AI text escaped before display.

## Sensitive Data Exposure

No private backend secrets were found in the scanned frontend source. Firebase `apiKey` is present and should be treated as public config, not a secret.

## Sample Data Safety

Sample equipment records are clearly marked:

- `SAMPLE DATA - NOT FOR ENGINEERING SELECTION`
- Sample records are hidden unless explicitly enabled.
- Sample records are blocked from verification and final engineering selection.
- Sample records are not uploaded through cloud sync paths.

## AI Boundary

AI layer is foundation/explain-only:

- `js/ai/ai-config.js` sets local mode to `local_foundation_stub` and non-local mode to `disabled`.
- AI context includes `sourceOfTruth: 'rules_engine'`.
- AI constraints include `mustNotGenerateEngineeringNumbers`.
- Tests verify AI failure preserves Rules Engine results.

## Result

Security result: Beta Pass with mandatory continued XSS discipline and production Firebase rule deployment.

## Firebase Predeploy Gate

The local predeploy gate checks:

- `firebase.json` exists.
- `firestore.rules` exists.
- `firestore.indexes.json` exists.
- `firebase.json` points to the expected rules and indexes files.
- Rules do not contain obvious public `allow ... if true` patterns.
- User ownership and shared-project role guardrails are present.

# AirCalc Pro Firebase Deployment Checklist

## Prerequisites

- Firebase CLI installed.
- Signed in with access to project `aircalcpro-24809`.
- Confirm the active Firebase project before deploying.

## Files

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`

## Commands

```bash
firebase use aircalcpro-24809
node tests/firestore-equipment-rules.test.js
firebase deploy --only firestore:rules,firestore:indexes
```

## Manual QA After Deploy

- Sign in with User A.
- Save a project and confirm it appears under `users/{uid}/projects`.
- Publish the project for collaboration from the app API surface.
- Add a collaborator UID as `viewer`; confirm viewer can read but cannot edit.
- Change collaborator role to `editor`; confirm editor can update content.
- Confirm only `owner` can delete or manage collaborator roles.
- Export the technical PDF and confirm QR appears for an HTTP/cloud project URL.

## Known Limits

- The app does not yet include an email invitation UI.
- Role updates currently require a Firebase UID.
- Firestore emulator tests are not included because no Node/Firebase package setup exists in this project.
- `tests/firestore-equipment-rules.test.js` is a local rules audit, not a replacement for Firebase Emulator Suite tests before production.

# AirCalc Pro Firebase Production Deployment

Target release: v1.0.0-beta.1  
Date: 2026-07-25

## Deployment Status

No production Firebase deployment was executed in this pass. Deployment requires explicit project access and approval.

## Files Reviewed

- `firebase.json`
- `firestore.rules`
- `firestore.indexes.json`
- `js/firebase-auth.js`

No Firebase Storage rules file was found in the current project. If Storage is added later, deployment must include a separate `storage.rules` review.

## Required Firebase Project

Before deploying, confirm the correct production or beta Firebase project ID with the owner. Do not deploy to a default or unknown project.

Recommended naming:

- Beta project: `aircalc-pro-beta`
- Production project: `aircalc-pro-prod`

Use the actual Firebase Console project ID, not the display name.

## Predeploy Checks

Run:

```powershell
npm run firebase:check
npm run release:beta
```

Expected:

- Firebase config files exist.
- `firebase.json` points to `firestore.rules` and `firestore.indexes.json`.
- Firestore rules do not include public `allow ... if true`.
- User ownership and shared-project roles are present.
- Full beta release verification passes.

## Firebase CLI Commands

Login and select project:

```powershell
firebase login
firebase projects:list
firebase use --add
firebase use <confirmed-project-alias>
```

Deploy rules and indexes:

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

If hosting is configured later:

```powershell
firebase deploy --only hosting
```

## Authentication Assumptions

- Users must authenticate before cloud project data is readable or writable.
- Private project data is scoped under `users/{userId}`.
- Shared project roles are owner/editor/viewer.
- Owner role must remain owner during shared project updates.

## Post-Deployment Verification

1. Sign in with a test beta user.
2. Create a project.
3. Save to cloud.
4. Reload the browser.
5. Confirm the project loads from cloud.
6. Attempt access with a second user without sharing; it should fail.
7. Share as viewer; read should work and edit should fail.
8. Share as editor; edit should work.
9. Confirm sample equipment is not uploaded as production catalogue data.

## Rollback Procedure

1. Keep a copy of the previous known-good `firestore.rules`.
2. If deployment causes access issues, restore previous rules:

```powershell
firebase deploy --only firestore:rules
```

3. If indexes cause performance or query issues, review `firestore.indexes.json` and redeploy.
4. Communicate temporary cloud sync limitations to beta users.
5. Local cache should preserve user work while cloud access is repaired.

## Go / No-Go

Go for beta Firebase deployment only after:

- Project ID is confirmed.
- Authorized domains are configured.
- Rules deployment passes.
- A real beta user can save/reload.

No-Go if:

- Project ID is unknown.
- Rules are edited outside review.
- Any service-account/private key appears in frontend or Git.

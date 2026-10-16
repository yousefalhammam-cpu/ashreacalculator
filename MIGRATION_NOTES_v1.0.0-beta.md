# AirCalc Pro v1.0.0-beta.1 Migration Notes

Date: 2026-07-25

## Data Compatibility

Existing local projects should remain compatible. No destructive migration was performed during production hardening.

## Equipment Records

- Real equipment records are separate from sample records.
- Sample records remain blocked from final engineering selection.
- Cloud upload paths skip sample records.

## Project Equipment Snapshot

Selected equipment should preserve a snapshot of the selected catalogue record and project requirement context. This protects old projects if catalogue data changes later.

## Firebase

Firestore rules define private user collections and a future shared project collection. Deployment to the actual Firebase project must be performed outside this local hardening pass.

## Rollback

If an issue appears:

1. Keep a copy of the current project folder before release.
2. Revert only the affected files from backup.
3. Clear browser cache/service worker if stale assets are suspected.
4. Reload through `http://127.0.0.1` instead of `file://` for module/API behavior.
5. Restore local project data from browser localStorage/export backup if needed.

## Breaking Changes

No intentional breaking changes were introduced in the production hardening documentation phase.

# AirCalc Pro Collaboration Foundation

## Scope

This phase prepares AirCalc Pro for project collaboration without adding a full sharing UI yet.

## Roles

- `owner`: can view, edit, duplicate, delete, and manage the project.
- `editor`: can view and edit project content.
- `viewer`: can view reports and project content without modifying saved data.

## Current App Behavior

- Private project saves still use `users/{uid}/projects/{projectId}`.
- New and synced projects carry `role`, `ownerId`, `ownerEmail`, and `collaboration`.
- Project cards show the current role.
- Delete and duplicate actions are reserved for `owner`.
- Save and quotation updates are blocked for `viewer`.
- Cloud conflict resolution is available only to roles that can edit.
- `publishProjectForCollaboration()` prepares a saved project in `sharedProjects`.
- `setProjectCollaboratorRole()` updates a collaborator UID to `owner`, `editor`, or `viewer`.

## Firestore Rules

The file `firestore.rules` contains:

- Current private project rules for `users/{uid}/projects/{projectId}`.
- Reserved future rules for `sharedProjects/{projectId}` using `owner`, `editor`, and `viewer`.
- `firebase.json` and `firestore.indexes.json` are included for Firebase CLI deployment.

## Not Implemented Yet

- Invite workflow.
- Email-based collaborator lookup.
- Shared project list UI.
- Firestore deployment and emulator rule tests.
- Server-side audit log.

## Engineering Note

No HVAC calculation formulas were changed in this phase.

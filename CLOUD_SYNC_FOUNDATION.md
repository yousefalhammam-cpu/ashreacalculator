# AirCalc Pro Cloud Sync Foundation

## Scope

This phase adds a local-first cloud sync foundation for saved projects. It does not replace local storage and does not add a full collaboration UI yet.

## Current Design

- Local projects remain stored in `localStorage` under `aircalc_projects`.
- Saving a project writes locally first, then attempts cloud sync in the background.
- If the user is not signed in, the project remains `local_only`.
- If Firestore save succeeds, the project becomes `synced` and receives `cloudId`, `projectUrl`, and `lastSyncedAt`.
- If Firestore save fails, the project remains available locally with `sync_failed` and `lastSyncError`.
- Auto-save is debounced and only runs for an already active saved project.
- Opening the project dashboard can import cloud projects that are missing locally.

## Firestore Shape

Projects are saved under:

```text
users/{uid}/projects/{projectId}
```

Document fields:

- `id`: local project id
- `cloudId`: cloud document id
- `name`: project name
- `ownerId`: Firebase user uid
- `ownerEmail`: Firebase user email
- `role`: currently `owner`
- `status`: currently `active`
- `localUpdatedAt`: last local update ISO string
- `updatedAt`: Firestore server timestamp
- `lastSyncedAt`: Firestore server timestamp
- `projectUrl`: browser URL with `?project={cloudId}` when available
- `schemaVersion`: currently `1`
- `snapshot`: AirCalc Pro project snapshot

Equipment catalogue data is saved under the signed-in user:

```text
users/{uid}/equipmentCatalogues/{catalogueId}
users/{uid}/equipmentCatalogueVersions/{versionId}
users/{uid}/equipmentRecords/{recordId}
```

Catalogue sync remains local-first:

- `localStorage` remains the working cache for equipment records.
- Sample data is never uploaded.
- Review notes, workflow status, catalogue ids, and source references are included in uploaded records.
- Manual sync is available from Equipment Database through `Sync Catalogue`.
- Cloud import is available through `Import from Cloud`.
- Background sync is attempted after CSV import, reviewer notes, and workflow status updates.
- If Firebase is unavailable, local catalogue review continues normally.

Cloud catalogue import policy:

- Missing cloud catalogues, versions, and records are imported into the local cache.
- Matching local records are left unchanged.
- Different cloud records with the same id are marked `cloudConflict`.
- Local records are never overwritten automatically by cloud import.
- Conflict resolution actions are explicit:
  - Field-by-field preview shows local versus cloud values before resolution.
  - `Keep Local` clears the conflict and keeps the local engineering values.
  - `Use Cloud` applies the cloud record only after the reviewer clicks the action.
  - The decision is appended to `workflowHistory`.
- Conflict review supports a cloud-conflict filter and a focused review panel.
- Batch action is intentionally limited to `Keep Local` because applying cloud records in bulk could change engineering values without enough review.

## Conflict Policy

Conflict resolution is not automated yet. The current safe behavior is:

- Never block local save.
- Never overwrite a local project from cloud automatically.
- Read cloud projects as a separate source for future import/merge UI.
- If the same cloud project exists locally with a different timestamp, mark `cloudConflict` and leave the local snapshot untouched.
- Conflict resolution is explicit:
  - `Keep Local` keeps the local copy and uploads it to cloud.
  - `Restore Cloud` replaces the local snapshot only after user confirmation.

## Collaboration Foundation

The stored fields `ownerId`, `ownerEmail`, `role`, and `status` prepare the schema for future roles:

- `owner`
- `editor`
- `viewer`

Actual multi-user sharing and security rules still need a dedicated implementation phase.

## Engineering Notes

- No HVAC calculation result was changed in this phase.
- No new package was added.
- Offline work remains supported through local cache.
- Equipment catalogue sync stores only user-owned catalogue records under `users/{uid}`.

## Remaining Work

- Add explicit Firebase security rules and test them.
- Add cloud project import/merge UI.
- Add conflict detection based on local/cloud timestamps.
- Add owner/editor/viewer permission model.
- Add autosave debounce policy across calculator, reports, and quotations.
- Add cloud catalogue import/merge UI and conflict comparison between local/cloud equipment records.
- Add real manufacturer catalogue ingestion and emulator-tested Firebase rules.

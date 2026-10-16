# AirCalc Pro GitHub Release Checklist

Target release: v1.0.0-beta.1  
Date: 2026-07-25

## Current Local Status

- Local beta package status: complete.
- `package.json` version: `1.0.0-beta.1`.
- Git status: blocked locally because this folder is not currently a Git repository.
- Push/release was not executed.

## Pre-Release Verification

Run before any GitHub push:

```powershell
npm run release:beta
```

Expected result:

- Build passes.
- Tests pass with `PASSED=44 FAILED=0`.
- Stress test passes through 500 rooms.
- Browser smoke passes.
- Firebase predeploy check passes.
- Release ZIP verification passes.
- Manifest is generated.
- SHA256 checksum is generated.

## Secret Safety Checks

Run:

```powershell
rg -n ".env|serviceAccount|private_key|client_secret|AIRCALC_AI_PROVIDER_API_KEY|firebase-adminsdk|-----BEGIN" -S .
rg -n "AIza|apiKey|password|token|secret" -S app.js modules js server firebase.json firestore.rules package.json
```

Expected:

- No `.env` committed.
- No Firebase service-account JSON committed.
- No private AI provider key committed.
- Firebase web `apiKey` may appear in frontend config, but it must be treated as public client config and protected by Firestore rules and authorized domains.

## Files Required In Release Artifacts

- `dist/aircalc-pro-v1.0.0-beta.1.zip`
- `dist/aircalc-pro-v1.0.0-beta.1.manifest.json`
- `dist/aircalc-pro-v1.0.0-beta.1.sha256`
- `dist/test-report.json`
- `dist/stress-report.json`
- `dist/browser-smoke-report.json`
- `dist/firebase-predeploy-report.json`

## Git Commands

Only run after confirming this folder is inside a Git repository:

```powershell
git status --short
git add .
git status --short
git commit -m "Prepare AirCalc Pro v1.0.0-beta.1 release"
git tag -a v1.0.0-beta.1 -m "AirCalc Pro v1.0.0-beta.1"
git push origin HEAD
git push origin v1.0.0-beta.1
```

## GitHub Release Commands

Only run if GitHub CLI is authenticated and the repository target is correct:

```powershell
gh release create v1.0.0-beta.1 `
  dist/aircalc-pro-v1.0.0-beta.1.zip `
  dist/aircalc-pro-v1.0.0-beta.1.manifest.json `
  dist/aircalc-pro-v1.0.0-beta.1.sha256 `
  --title "AirCalc Pro v1.0.0-beta.1" `
  --notes-file RELEASE_NOTES_v1.0.0-beta.md `
  --prerelease
```

## Go / No-Go

Go if:

- `npm run release:beta` passes.
- GitHub Actions passes.
- Release artifacts upload successfully.
- SHA256 in the release matches the local checksum file.

No-Go if:

- Any test fails.
- `FAILED` appears in test output.
- Release package verification fails.
- Firebase predeploy check fails.
- Any private credential is found in the repo.
- Package version does not match `1.0.0-beta.1`.

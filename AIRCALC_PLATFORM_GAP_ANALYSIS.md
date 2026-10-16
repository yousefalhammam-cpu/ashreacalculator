# AirCalc Pro Platform Gap Analysis

## Current State

AirCalc Pro currently has a strong local foundation:

- Engineering Calculation Engine exists.
- Engineering Knowledge Base local module exists.
- Engineering validation tests exist.
- Equipment database MVP exists.
- Equipment catalogue/version model foundation exists.
- Equipment record verification workflow foundation exists.
- Catalogue review queue foundation exists in Equipment Database.
- Reviewer notes and rejected-row CSV export exist for catalogue import review.
- Catalogue version comparison UI exists locally.
- Firebase-backed catalogue persistence and safe cloud import foundation exist.
- Catalogue conflict-resolution actions exist with workflow-history audit trail.
- Field-by-field catalogue conflict preview exists for local versus cloud values.
- Batch catalogue conflict review and conflict-only filtering exist.
- Real manufacturer catalogue ingestion has a provenance-first CSV workflow foundation.
- CSV import and duplicate detection exist.
- Deterministic equipment selection exists.
- Deterministic recommendation buckets exist for best match, efficiency, noise, market availability, and input power.
- Selected equipment snapshot exists.
- Engineer Review is connected to selected equipment.
- AI explanation has frontend, backend-contract, HTTP-adapter, provider-adapter, prompt-builder, server-side provider-template, and optional runtime provider-loader foundations. It remains provider-disconnected by default.
- Firebase sync/collaboration foundation exists but is not fully deployed or production-tested.

## What Can Be Implemented Now

Without backend or external services:

- Engineering Knowledge Base as local structured data.
- Catalogue metadata model.
- Catalogue version model.
- Stronger equipment validation rules.
- Better Equipment DB admin UX.
- JSON import validation.
- Version comparison UI using local data.
- More deterministic recommendation buckets.
- Better Engineer Review explanations from Rules Engine.
- Local anonymized learning schema draft.

## What Needs Backend

Backend is required for:

- Real AI provider calls.
- Keeping AI API keys out of frontend.
- Catalogue file processing at scale.
- PDF/report generation at enterprise scale.
- Secure aggregation for Continuous Learning.
- Server-side audit logs.
- Role-based collaboration enforcement beyond frontend checks.
- Scheduled data-quality checks.

## What Needs Firebase

Firebase is needed for:

- Cloud project persistence.
- Cross-device sync.
- Collaboration roles.
- Shared project access.
- Catalogue data storage.
- Equipment record publishing.
- User ownership.
- Local/cloud conflict handling.
- Learning event storage, if approved.

## What Needs AI

AI is useful for:

- Natural-language explanation of deterministic results.
- Engineer-facing summaries.
- Comparing verified options.
- Explaining rejection reasons.
- Suggesting missing inputs and questions.
- Drafting report narrative.

AI is not needed for:

- Load calculation.
- Unit conversion.
- Equipment ranking.
- Verification workflow state.
- Market rounding.
- Engineer Review pass/fail rules.

## What Needs Real Data

Real data is required for:

- Published equipment recommendations.
- Manufacturer catalogue comparisons.
- Local agent availability.
- Noise and efficiency comparisons.
- Healthcare optimized equipment ranking.
- Saudi market preferred ranking.
- Lowest cost ranking.
- Future expansion readiness.
- Continuous learning insights.

Sample data must remain clearly marked and excluded from final engineering selection.

## Biggest Current Gaps

1. Real manufacturer catalogue data is missing.
2. AI provider runtime activation and hosted backend deployment are not implemented.
3. Continuous Learning has no approved privacy schema or aggregation layer yet.
4. Real manufacturer catalogue source-file upload and parsing are not implemented yet.
5. Firebase rules are drafted but not deployed/tested with emulator.
6. No package/build pipeline exists; validation depends on plain Node checks and test scripts.

## Recommended Execution Order

### Step 1: Engineering Knowledge Base

Completed as a local foundation. Next iterations should add more structured references and route more UI/report wording through this layer.

### Step 2: Catalogue Versioning and Verification Workflow

Catalogue/version foundation is implemented locally. The next value is the verification workflow UI and status transitions.

### Step 3: Recommendation Buckets

Add deterministic categories such as Best Alternative, Highest Efficiency, Lowest Noise, and Saudi Market Preferred based on available verified fields.

### Step 4: Firebase Catalogue Storage

Move verified equipment records and catalogue versions to controlled cloud storage.

### Step 5: AI Backend Contract

Frontend, backend service, HTTP adapter, prompt builder, server-side provider template, and optional runtime provider loader are implemented. The next step is a hosted backend deployment and production provider activation with backend-only environment variables.

### Step 6: Continuous Learning Privacy Foundation

Define anonymized events, aggregation thresholds, and access controls before collecting real learning data.

## Decision Required Before Coding

Before implementation starts, approve whether the next coding phase should begin with:

1. Engineering Knowledge Base local module.
2. Equipment catalogue/version model.
3. AI provider backend implementation.

Recommended choice: Firebase emulator rule tests, then source-file upload/parsing for real manufacturer catalogues.

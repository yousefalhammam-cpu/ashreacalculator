# AirCalc Pro AI Backend Stub

This folder contains the provider-neutral backend contract foundation for AI explanations.

## Scope

- Explain deterministic Rules Engine output.
- Never calculate HVAC values.
- Never rank equipment.
- Never verify catalogues.
- Never expose provider API keys in frontend code.

## Endpoint Contract

Backend route:

```http
POST /api/ai/explain
Content-Type: application/json
```

Request:

```json
{
  "context": {
    "sourceOfTruth": "rules_engine",
    "aiRole": "explain_only",
    "constraints": {
      "mustNotGenerateEngineeringNumbers": true,
      "mustNotChangeRanking": true,
      "mustNotVerifyCatalogueData": true,
      "mustUseOnlyProvidedValues": true
    }
  }
}
```

Response:

```json
{
  "ok": true,
  "sourceOfTruth": "rules_engine",
  "aiRole": "explain_only",
  "provider": "foundation_stub",
  "response": {
    "explanation": "...",
    "riskSummary": "...",
    "questionsForEngineer": [],
    "alternativeInterpretation": "...",
    "reportReadyNarrative": "..."
  }
}
```

## Provider Rule

Provider implementations must be injected server-side. Do not add provider API keys to `app/index.html`, `modules/*`, or `js/*`.

Provider adapters must satisfy `ai-provider-contract.js`:

```js
{
  name: 'provider_name',
  async explain(context) {
    return {
      explanation: '...',
      riskSummary: '...',
      questionsForEngineer: [],
      alternativeInterpretation: '...',
      reportReadyNarrative: '...'
    };
  }
}
```

The backend rejects providers without a stable `name` or `explain(context)` function.

Provider responses are normalized to the approved response schema only. Non-string narrative fields or non-array `questionsForEngineer` values are rejected before they reach the frontend.

`ai-prompt-builder.js` creates provider-neutral messages with:

- A system message that preserves Rules Engine authority.
- A user message that contains response schema and deterministic JSON context.
- Explicit instructions that AI must not calculate, rank, verify, or invent unsupported engineering numbers.

## Current Adapter

`ai-explain-http-adapter.js` exposes `handleAiExplainRequest(req, res, options)`.

It is runtime-neutral and can be wrapped by Firebase Functions, Express, or another Node HTTP runtime later. The current project does not include Firebase Functions or npm package setup, so no hosted function is deployed yet.

## Provider Template

`providers/openai-compatible-provider.js` contains a server-side OpenAI-compatible adapter template. It is not enabled by default and must be injected into `explainEngineeringContext({ context }, { provider })` or into the HTTP adapter from a backend runtime.

`ai-provider-runtime.js` reads backend environment variables and returns `null` unless all required provider settings exist. `local-static-server.js` uses that runtime helper, so local development keeps `foundation_stub` by default and only activates a provider when the backend process is configured.

Required server environment variables when a real backend runtime enables it:

- `AIRCALC_AI_PROVIDER_API_KEY`
- `AIRCALC_AI_PROVIDER_ENDPOINT`
- `AIRCALC_AI_PROVIDER_MODEL`

Optional:

- `AIRCALC_AI_PROVIDER_NAME`

These variables belong on the backend only. Do not expose them in `app/index.html`, `js/*`, or `modules/*`.

The template fails closed when the key, endpoint, model, or fetch runtime is missing. Provider output still passes through `ai-explanation-service.js`, so AI text cannot introduce unsupported engineering numbers.

## Local Development Route

`local-static-server.js` now exposes the adapter at:

```http
POST http://127.0.0.1:5500/api/ai/explain
```

When the app is served from `http://127.0.0.1:5500` or `http://localhost:5500`, `js/ai/ai-config.js` points the frontend AI client to `/api/ai/explain`.

When the app is opened with `file://`, AI remains disabled and the UI uses the fallback explanation.

The server exports `createAirCalcServer(options)` so tests and future runtimes can reuse the same local route without starting a listener on import.

To test provider activation locally, start the Node server process with backend-only environment variables:

```powershell
$env:AIRCALC_AI_PROVIDER_API_KEY = '<server key>'
$env:AIRCALC_AI_PROVIDER_ENDPOINT = '<provider chat/completions endpoint>'
$env:AIRCALC_AI_PROVIDER_MODEL = '<provider model id>'
node local-static-server.js
```

The frontend still calls only `/api/ai/explain`; it never receives the key.

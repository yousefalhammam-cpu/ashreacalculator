# AI Engineering Assistant Architecture

## Purpose

The AI Engineering Assistant is a consulting layer. It explains engineering decisions and helps users understand risks, alternatives, and missing data.

It does not calculate, rank, verify catalogues, or override deterministic engines.

## Allowed AI Tasks

AI may:

- Explain why a unit was recommended.
- Compare two manufacturers or models based on verified data.
- Explain Engineer Review findings.
- Suggest alternatives from already-ranked deterministic results.
- Explain risks.
- Summarize the project.
- Detect missing inputs from structured validation output.
- Suggest questions for the engineer.
- Explain the impact of capacity changes.
- Compare Split, VRF, Package, AHU, and Chiller solutions.
- Explain why a unit was rejected by the Rules Engine.

## Forbidden AI Tasks

AI must not:

- Invent equipment models.
- Invent catalogues.
- Invent specifications.
- Generate engineering calculation numbers.
- Change Ranking Engine order.
- Bypass Engineer Review.
- Mark data as verified.
- Hide critical warnings.

## Backend Requirement

AI must run through a backend service layer.

Frontend must not contain provider API keys.

The backend should support replaceable providers:

- OpenAI
- Azure OpenAI
- Gemini
- Claude

Provider switching must not require frontend changes.

## Service Contract

The frontend sends structured, sanitized context:

- Project summary
- Calculation Engine outputs
- Knowledge Base references
- Equipment recommendation output
- Engineer Review findings
- Missing data list

The backend returns:

- Explanation
- Risk summary
- Questions for engineer
- Alternative interpretation
- Report-ready narrative

The backend must not return new engineering numbers unless those numbers are explicitly included as source values from deterministic engines.

## Failure Behavior

If AI fails:

- Show a clear message that AI explanation is unavailable.
- Keep Rules Engine results visible.
- Keep equipment ranking visible.
- Keep calculation results unchanged.
- Do not block reports unless the user specifically requested AI narrative.

## Immediate Next Step

The frontend AI client contract is now implemented in `js/ai/ai-explanation-client.js`.
The backend service foundation is implemented in `server/ai-explanation-service.js`.
The runtime-neutral HTTP adapter is implemented in `server/ai-explain-http-adapter.js`.
The provider adapter contract is implemented in `server/ai-provider-contract.js`.
The provider-neutral prompt builder is implemented in `server/ai-prompt-builder.js`.
The server-side OpenAI-compatible provider template is implemented in `server/providers/openai-compatible-provider.js`.
The optional runtime provider loader is implemented in `server/ai-provider-runtime.js`.

Current behavior:

- No backend endpoint is configured by default.
- No provider is connected by default.
- No hosted route is deployed by default.
- A provider template exists, but it requires backend-only environment variables before it can call any external service.
- The local server can inject the configured provider automatically when all required backend environment variables exist.
- The local static server exposes `/api/ai/explain` for development through the safe foundation stub.
- Rules Engine results remain visible and unchanged when AI is unavailable.
- AI context declares `sourceOfTruth: rules_engine` and `aiRole: explain_only`.
- AI responses are rejected if they contain engineering numbers not present in the deterministic context.
- Backend provider responses are also rejected if they contain unsupported engineering numbers.
- The frontend displays backend metadata such as provider, source of truth, and AI role so the foundation stub is not mistaken for a real provider.
- Backend providers must expose a stable `name` and `explain(context)` function before the service will call them.
- Provider calls receive standardized messages that preserve Rules Engine authority and require structured JSON output.
- Backend response schema validation rejects malformed provider output before it reaches the frontend.

Next backend work:

- Wrap `server/ai-explain-http-adapter.js` in the chosen hosting runtime route, such as Firebase Functions or an internal API service.
- Keep provider API keys only on the backend.
- Enable the provider template inside the chosen hosted backend runtime with backend-only environment variables.
- Keep every provider behind `ai-provider-contract.js` so the safety guard remains provider-neutral.
- Use `ai-prompt-builder.js` for every provider so prompts remain consistent across OpenAI, Azure OpenAI, Gemini, Claude, or future providers.

# AirCalc Pro Local AI

## Implemented

An Ollama provider plugs into the existing explanation service and Copilot.
Project context and deterministic warnings are supplied to a locally installed
language model. This is application-specific prompting, not a newly trained model.
The adapter uses the local chat API documented at https://docs.ollama.com/api/chat.

The provider accepts loopback HTTP only, rejects redirects and cloud-labelled
models, verifies local availability and rejects remote-backed model metadata.
There is no automatic cloud fallback or model download. Enable Ollama's offline
configuration as well when deploying on machines with cloud features enabled.
One inference runs at a time. Each model request has a bounded timeout.

Engineering calculations, equipment ranking and edits remain deterministic.
Generated text cannot write project state. Existing response validation rejects
numeric values absent from the supplied context, but does not prove that every
statement or association made by a model is correct. Engineer review remains needed.

## First-time setup

Install Ollama using its official installer and install a local model suitable
for the machine's available RAM, GPU and Arabic-language needs. This initial
installation/download requires network access; inference uses local model files.
No particular model is bundled or silently downloaded by AirCalc.

In PowerShell, from the project directory:

```powershell
ollama list
$env:AIRCALC_AI_LOCAL_MODEL = 'EXACT_INSTALLED_MODEL_NAME'
npm run ai:check
npm run ai:offline
```

Open http://127.0.0.1:5501/app/index.html and use the existing AI explanation
action in Copilot or equipment selection. Opening app/index.html with file://
does not activate the local backend. If port 5501 is occupied, set
`$env:AIRCALC_LOCAL_PORT = '5502'` before starting.

Optional endpoint: `AIRCALC_AI_LOCAL_ENDPOINT`, default http://127.0.0.1:11434.
For the ordinary local server, use `AIRCALC_AI_MODE=offline` together with
`AIRCALC_AI_LOCAL_MODEL`. No API key is required for this provider.

The offline launcher checks real service/model availability before starting.
A failed readiness check is an error, not a successful mock response.

## Acceptance and limitations

Automated tests inject a simulated local HTTP transport to check request format,
model checks, error paths, timeouts and numeric validation. They do not establish
real-model quality, Arabic fluency or runtime speed.

For real acceptance, disconnect internet after installation, start the local
launcher, explain the same review in Arabic and English, and compare all numeric
values to the Rules Engine. Stop Ollama and repeat: explanation should fail while
calculation and review results remain usable. Reconnect Ollama and retry.

At implementation time Ollama was not available through the environment PATH;
no model was downloaded and no real-model inference was certified. Model choice,
hardware performance evaluation and engineering evaluation are pending.

This feature makes AI inference offline. Cloud Sync, login and externally hosted
assets may still need connectivity; it is not a certification of every app
feature as offline-capable. Training, document ingestion and autonomous project
editing are not included in this first implementation.

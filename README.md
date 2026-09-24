# ReproMate AI

ReproMate AI is a local-first bug-investigation assistant. It converts a bug description, environment details, pasted logs and one screenshot into an evidence-linked investigation brief for support, QA and development teams. A local retrieval-augmented generation (RAG) layer also finds potentially relevant Oracle Visual Builder/VBCS and Oracle Integration/OIC guidance.

The application does **not** execute reproduction steps or confirm a root cause. It organizes the available evidence, identifies contradictions, asks for missing information and proposes checks for a human reviewer.

## Live hosted demo

**[Open ReproMate AI on GitHub Pages](https://vivekprasadk.github.io/repromate-ai/)**

The hosted site is the deterministic demonstration. It runs entirely in the browser, does not call AI and does not analyze an uploaded screenshot. For genuine local text, log and screenshot analysis, install Ollama and follow the Windows setup below.

## Project status

This is a hackathon prototype with two delivery modes:

- **Deterministic demo:** reliable browser demonstration. It does not call AI and does not analyze the screenshot.
- **Experimental local AI:** genuine text, log and screenshot analysis through Ollama, with no paid API or cloud inference.

The application and validation controls are implemented. The local-model path is not yet qualified as production-ready: CPU inference can be slow, cold or fresh-image requests can time out, and reviewed outputs still contain semantic-quality failures. Read [the evaluation report](evaluation/REPORT.md) before presenting the local-AI path as a live demonstration.

## The problem

Bug reports frequently arrive with incomplete or conflicting information:

- The description explains only what the user noticed.
- Screenshots show UI state but not backend behaviour.
- Logs contain failures without business context.
- Reproduction steps and environment details are missing.
- A success message may contradict a failed API response.

Developers then spend time reorganizing evidence and asking repeated clarification questions before investigation can begin.

ReproMate prepares a consistent handoff containing:

- A concise, unverified summary
- Evidence-backed observations
- Proposed and explicitly unexecuted reproduction steps
- Missing-information questions
- Conditional hypotheses with verification checks
- Suggested test cases
- Source provenance and local-model timing in exports
- Retrieved Oracle technical references, kept separate from case evidence

## Quick start on Windows

### Requirements

- Windows with PowerShell
- Node.js 20 or newer
- [Ollama](https://ollama.com/download) 0.12.7 or newer
- Internet access for the initial model download
- Sufficient free memory for a roughly 3.3 GB model and image processing

The runtime application has no npm package dependencies. The repository includes a prebuilt local knowledge index so normal startup and analysis remain offline.

### First-time setup

Open PowerShell in the extracted project folder:

```powershell
node scripts/setup.mjs --pull
```

This explicitly downloads and verifies the pinned model:

```text
qwen3-vl:4b-instruct-q4_K_M
```

Model weights remain in Ollama and are never copied into this repository.

To explicitly update the Oracle documentation index while connected to the internet, run:

```powershell
node scripts/knowledge-refresh.mjs
```

This is never run automatically during startup or analysis. A failed refresh does not replace the active index. Restart ReproMate after a successful refresh so the process loads the new generation.

### Start the application

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

The launcher:

1. Checks Node.js and Ollama readiness.
2. Never downloads a model during normal startup.
3. Starts the service on loopback only.
4. Opens `http://127.0.0.1:4317/` in the browser.
5. Writes the launched process ID to ignored `.runtime/server.pid`.

Closing the browser does not stop the hidden service. For an interactive terminal process that can be stopped with Ctrl+C, run:

```powershell
node server.mjs
```

## How to use it

1. Describe what was done, what was expected and what happened.
2. Add the relevant environment, browser or application version.
3. Select **Auto-detect**, **Visual Builder / VBCS**, or **Oracle Integration / OIC**.
4. Paste a focused console or network-log excerpt.
5. Attach one synthetic, redacted or non-sensitive PNG, JPEG or WebP image.
6. Select **Demo** or **Local AI**.
7. Select **Generate investigation**.
8. Review the case evidence and retrieved technical references separately.
9. Export the reviewed investigation as Markdown or JSON.
10. Reload the page to clear the current case.

The page shows only compact run information. Markdown and JSON exports retain the complete model digest, timing and evidence provenance.

Suggested checks must be reviewed before use and performed only in an authorized, isolated test environment. Never apply destructive model suggestions to live data.

## Analysis modes

### Deterministic demo

- Runs entirely in the browser
- Requires no Ollama inference
- Produces a predictable investigation for the bundled sample
- May preview the screenshot but never claims to analyze it
- Is the mode deployed by GitHub Pages

Use this mode for a reliable hackathon walkthrough.

### Local AI

- Uses the installed Ollama model on this computer
- Sends description, environment, logs and the optional screenshot in one local request
- Uses temperature zero, structured JSON output and no streaming
- Has a default 300-second (5-minute) inference timeout
- Limits the initial structured report to 1,200 generated tokens for predictable CPU execution
- Never silently falls back to the demo if analysis fails
- Allows only one active inference at a time
- Makes at most one 100-token, summary-only safety repair when an otherwise structured response states a possible cause as an established fact; the original report remains unchanged and the repaired result must pass every original validator

A successful warm run may still take more than a minute on CPU. A model-readiness check confirms installation and vision capability, but cannot guarantee enough free memory for image analysis.

## Local VBCS/OIC knowledge layer

The local model is pretrained; ReproMate does not retrain or fine-tune it. Before producing a report, the server searches a local index of curated official Oracle pages, immediately displays up to three references, and passes the two highest-ranked shortened passages to Ollama as untrusted technical context. Explicit OIC or VBCS selection prevents passages from the other product entering the result.

The initial index contains 11 official pages and 59 passages covering Visual Builder action chains, REST calls, variables and service connections plus OIC error management, activity streams, runtime, design-time and activation troubleshooting. Retrieval is deterministic, in memory and normally completes independently of LLM generation.

Technical references are deliberately separate from **Evidence & observations**. They are displayed as soon as local retrieval completes, while the slower AI report continues. A documentation passage can support a conditional hypothesis or verification check, but it cannot prove what happened in the submitted case. When nothing sufficiently relevant is found, the report says so instead of inventing a source.

This first retrieval baseline uses weighted exact-term and keyword matching, which is strong for product names, HTTP statuses and Oracle error codes. Its relevance target has not yet been proven on a practitioner-reviewed held-out benchmark; do not present it as authoritative diagnosis. A later semantic-embedding baseline should replace it only if measured supporting-passage recall improves.

## Evidence and safety controls

Text and image evidence are treated as untrusted input.

- Description and log observations require an exact quotation from the declared submitted field.
- Invalid textual citations are discarded and counted.
- Visual observations must reference `screenshot-1`.
- Visual findings are always labelled **AI-observed visual evidence — unverified**.
- Recognized screenshot text is not represented as a verified textual quotation.
- Hypotheses must use conditional language.
- Claims that the application reproduced, executed or confirmed a case are rejected.
- Malformed or unsupported model responses fail visibly.
- An unsafe causal summary receives one constrained rewrite request; a second unsafe or invalid response is rejected.
- Timeout and failure responses disclose the stopped phase and non-sensitive stage timings, without retaining the case or partial model output.
- Exported Markdown escapes untrusted HTML and formatting.
- No AI failure is replaced by a deterministic report masquerading as AI output.

These controls validate structure and provenance. They do not prove that every conclusion follows from the cited evidence. Human review remains mandatory.

## Privacy and data handling

- The HTTP service binds to `127.0.0.1` only.
- There are no cloud AI calls, paid APIs or automatic uploads.
- There is no database, telemetry, authentication or case history.
- Case data stays in page/server memory and is cleared by reloading.
- Ollama may retain model and prompt state in RAM while the model is loaded.
- Exports are written only when the user explicitly downloads them.
- Synthetic benchmark outputs are the only intentionally retained case artifacts.

Do not use customer evidence unless it is authorized and appropriately redacted.

## Sharing through OneDrive

Create a clean, timestamped ZIP from the repository parent folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-share.ps1
```

The script runs the automated tests, verifies the offline knowledge index, and creates `ReproMate-AI-share-YYYYMMDD-HHMMSS.zip` next to the `repromate` folder. It packages only the approved files listed below, so runtime state and unrelated workspace files are not copied.

Upload that ZIP to OneDrive. Share the ZIP itself rather than a live/synchronizing working folder.

Include:

```text
public/
src/
knowledge/
scripts/
test/
evaluation/
server.mjs
start.ps1
package.json
README.md
SHARE_CHECKLIST.md
.gitignore
```

Optional:

```text
.github/
```

Exclude:

```text
.git/
.runtime/
output/
node_modules/
debug.log
```

Also exclude Ollama model files, credentials, customer screenshots, customer logs and real exported investigations.

The recipient should download and extract the ZIP to a local folder before running the setup commands. They should not run it inside the ZIP preview or directly from a OneDrive online-only location. The model must be downloaded separately through Ollama. Keep `knowledge/index.json`; it is required for offline VBCS/OIC retrieval. See [SHARE_CHECKLIST.md](SHARE_CHECKLIST.md) for sender and recipient checks.

## Model and licensing

Primary model:

- Tag: `qwen3-vl:4b-instruct-q4_K_M`
- Tested digest: `ee4b975b58c17ce268cd19d40db35d5edc64603035d2ffc1fee1968eb0947f7b`
- Installed size: approximately 3.3 GB
- License metadata: Apache-2.0
- [Ollama model page](https://ollama.com/library/qwen3-vl)
- [Upstream license](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct/tree/main)

Setup records the installed digest, capabilities, version, license and timestamp under ignored `.runtime/`. Upstream tags can change, so the digest identifies the weights that were tested.

Approved fallback:

```powershell
$env:OLLAMA_MODEL = 'gemma3:4b'
node scripts/setup.mjs --pull
```

Gemma uses its own terms, not Apache-2.0. Evaluation did not qualify it as a reliable fallback winner.

## Configuration

Set environment variables in the same PowerShell session before starting:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4317` | Local HTTP port |
| `OLLAMA_MODEL` | `qwen3-vl:4b-instruct-q4_K_M` | Approved local model |
| `OLLAMA_TIMEOUT_MS` | `300000` | AI timeout in milliseconds; allowed range 30,000–600,000 |
| `STATIC_ONLY` | unset | Set to `1` to disable API routes and serve static files only |

Only the pinned Qwen model and `gemma3:4b` are accepted. Arbitrary and cloud model tags cannot receive case evidence.

## HTTP interface

### `GET /api/status`

Reports application/API version, Ollama availability, exact model, digest, Ollama version, vision capability, and local knowledge-index readiness/counts. Full license text is not sent to the browser.

### `POST /api/knowledge/search`

Accepts `{ "query": "...", "product": "auto|vbcs|oic" }` and returns up to three local technical references with source URLs and retrieval timing. Queries are not stored.

### `POST /api/analyze`

Accepts:

- `description`: required, 20–20,000 characters
- `environment`: optional, maximum 1,000 characters
- `logs`: optional, maximum 80,000 characters
- `product`: `auto`, `vbcs` or `oic`; defaults to `auto`
- `mode`: `demo` or `ai`
- `image`: optional `{id, name, mimeType, dataUrl}`

Image constraints:

- Exactly one image
- ID must be `screenshot-1`
- PNG, JPEG or WebP
- Maximum decoded size: 4 MiB
- Maximum combined request: 8 MiB

The model context is 8,192 tokens. Transport character limits do not mean the model can analyze every character of a maximum-sized log. Provide the smallest relevant time window.

## Tests

Runtime and integration tests:

```powershell
node --test test/*.test.mjs
```

Browser-flow tests:

```powershell
node scripts/browser-tests.mjs
```

Browser-development scripts require Playwright and Chromium:

```powershell
npm install --no-save playwright
npx playwright install chromium
```

Additional scripts:

| Command | Purpose |
| --- | --- |
| `node scripts/make-fixture.mjs` | Regenerate the bundled synthetic screenshot |
| `node scripts/evaluate.mjs` | Run cold, warm-anchor and 12-case real-model evaluation |
| `node scripts/audit-results.mjs` | Revalidate preserved results against the final policy |
| `node scripts/browser-real-ai.mjs` | Run a genuine synthetic browser-to-Ollama smoke test |
| `node scripts/cold-load.mjs` | Measure an explicitly unloaded model start |

Set a new short `EVALUATION_LABEL` before a fresh evaluation. Existing result files are not overwritten.

Current automated checks:

- 30 unit, HTTP and mocked-Ollama tests pass
- 11 browser-flow checks pass
- One genuine repeated-warm browser/Ollama path completed successfully
- Fresh-image, cold-start and semantic-quality failures remain documented

See [the full evaluation](evaluation/REPORT.md) and [the revised semantic review](evaluation/REVIEW-v2.md).

## Measured limitations

On the tested CPU-only laptop:

- Qwen repeated warm-anchor p95: 87.7 seconds, 10/10 structurally accepted
- Qwen revised varied cases: 11/12 accepted by the final structural policy
- Gemma repeated warm anchors: 0/10 accepted despite faster response timing
- Qwen cold full-anchor request: timed out at the 180-second limit used during that evaluation
- Fresh or changed screenshot cases reached approximately 162–174 seconds
- A genuine repeated-warm browser submission rendered in 75.6 seconds
- The final 1,200-token configuration completed the reviewed 1,926-character OIC supplier-error case in 184.7 seconds, including rendering and validation
- Both models produced semantically weak or speculative guidance in reviewed cases
- Loading more than one model can exhaust available CPU memory

Repeated warm inputs can benefit from Ollama prompt and image caching. These timings are not a guarantee for a new screenshot or a different computer. The runtime default was subsequently increased from the evaluated 180-second limit to 300 seconds; historical measurements were not rewritten.

## Troubleshooting

### Model is not installed

Run:

```powershell
node scripts/setup.mjs --pull
```

### Ollama HTTP 500 or memory allocation failure

Close memory-heavy applications and unload an idle fallback model:

```powershell
ollama stop gemma3:4b
```

This removes it from RAM without deleting its weights. Do not stop a model another task is using.

### Port is already in use

Choose another loopback port:

```powershell
$env:PORT = '4320'
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

### AI request times out

The report is rejected and no deterministic fallback is substituted. Retry after ensuring only the intended model is loaded, reduce the log excerpt and use a smaller screenshot. The default timeout is 300 seconds. It can be changed before startup, for example:

```powershell
$env:OLLAMA_TIMEOUT_MS = '420000'
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Allowed values are 30,000–600,000 milliseconds. Increasing the timeout does not make inference faster; the Cancel button remains available.

### Local AI is unavailable

Use **Demo** mode. It remains functional but must be presented as deterministic, without AI or image-analysis claims.

## Project structure

```text
public/        Browser interface, shared report contract and synthetic fixture
src/           Input validation, report logic, local retrieval and Ollama client
knowledge/     Curated Oracle URL list and active offline passage index
scripts/       Setup, knowledge refresh, evaluation, browser checks and fixture generation
test/          Unit, HTTP, safety and mocked integration tests
evaluation/    Synthetic benchmark protocols, raw results and reviews
server.mjs     Loopback HTTP and static-file service
start.ps1      Windows setup/readiness launcher
SHARE_CHECKLIST.md  Sender and recipient handoff checklist
```

## Scope and non-goals

Included:

- One local user
- One screenshot
- Pasted text logs
- Local CPU inference
- Offline VBCS/OIC technical-reference retrieval
- Deterministic hosted demonstration
- Markdown and JSON exports

Not included:

- Jira creation
- Databases or persistent case history
- Authentication or multi-user access
- Cloud AI hosting
- Automatic issue execution
- Automatic root-cause confirmation
- Multiple attachments or OCR pipelines
- Automatic documentation refresh

## Hackathon walkthrough

1. Explain how incomplete reports delay investigation.
2. Load the bundled synthetic Oracle/VBCS-style save failure.
3. State clearly that no customer data is used.
4. Use deterministic Demo mode for a reliable presentation.
5. If demonstrating Local AI, show model readiness and disclose expected CPU delay.
6. Compare the exact HTTP 409 quotation with the visible success notification.
7. Explain that visual findings and hypotheses are unverified.
8. Show proposed steps, missing questions and verification checks.
9. Export Markdown and JSON.
10. Reload to clear the case.

Do not call the local-model build production-ready or claim that it diagnosed, reproduced or confirmed the bug.

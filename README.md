# ReproMate AI

Standalone hackathon prototype: bug intake, screenshot preview, evidence-linked observations, proposed reproduction steps, questions, hypotheses, test cases, and Markdown export. Node.js 20+; no npm dependencies.

The GitHub Pages build runs the labeled rule-based demo entirely in the browser. It does not upload inputs or call a language model. The local Node version can connect to Ollama for real AI analysis.

## Run

Open a terminal in this folder and run `node server.mjs`. Open http://127.0.0.1:4317. Click **Load sample**, then **Generate investigation**. For the installed local model on this machine, run `./start.ps1` instead; it selects llama3.1:8b. This model is for text analysis; screenshot inference needs a vision model.

Demo mode is deterministic and explicitly labeled. It does not perform AI inference or analyze screenshots. Other reports receive a generic checklist, not the sample diagnosis.

## Enable real local AI

Install and run Ollama separately and download a model of your choice. For screenshots, choose a model that supports vision. In PowerShell, set `$env:OLLAMA_MODEL = 'your-installed-model-name'`, then run `npm start`. Select the Local AI engine in the app. The server uses Ollama's `/api/chat` endpoint with JSON output. Default endpoint: http://127.0.0.1:11434; override with OLLAMA_URL if required. No API key is needed for a local Ollama server. Model installation is not included in this project.

## Verification

Run `node --test`. Tests check sample isolation, citation filtering, and malformed report rejection. The validator verifies that a quoted substring exists; it cannot prove that a model's interpretation is correct. Reproduction steps and suggested causes are not executed or independently verified. Image content can inform model questions but is not accepted as a text citation.

## Demo script

1. Explain the incomplete bug report: a save notification appears, but the value disappears on refresh.
2. Load the synthetic sample and generate the report.
3. Point to the HTTP 409 evidence and the unverified UI error-handling hypothesis.
4. Show verification checks, missing information, and test cases.
5. Export the handoff. Disclose demo mode if no model is connected.

Data is held in page/server memory, not saved to a database. Reloading clears the form. Inputs are sent to the configured Ollama endpoint only when Local AI is selected. UI fonts optionally load from Google Fonts with local fallbacks. The server binds to loopback; this is a local prototype, not a production service.

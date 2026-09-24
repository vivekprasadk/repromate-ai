# ReproMate AI sharing checklist

## For the sender

1. Use synthetic or authorized, redacted evidence only.
2. Run `node --test test/*.test.mjs`.
3. Run `node scripts/browser-tests.mjs` when Playwright is installed.
4. Run `powershell -ExecutionPolicy Bypass -File .\scripts\package-share.ps1`.
5. Confirm the ZIP contains `repromate/README.md`, `repromate/knowledge/index.json`, and `repromate/public/sample.png`.
6. Confirm it does not contain `.git`, `.runtime`, `output`, `node_modules`, logs, downloaded Ollama weights, customer screenshots, customer logs, or exported real investigations.
7. Upload the generated ZIP to the intended OneDrive folder.

The application retains cases only in browser/server memory. The sharing package does not collect the currently displayed case.

## For the recipient

1. Download the ZIP and extract it to a normal local folder. Do not run it inside the ZIP preview or an online-only OneDrive placeholder.
2. Install Node.js 20 or newer and Ollama 0.12.7 or newer.
3. Open PowerShell in the extracted `repromate` folder.
4. Run `node scripts/setup.mjs --pull` while online. This downloads the approximately 3.3 GB Ollama model separately; model weights are not inside the ZIP.
5. Start the app with `powershell -ExecutionPolicy Bypass -File .\start.ps1`.
6. Open the localhost URL printed by the launcher. Normal use is offline after setup.
7. Start with **Load synthetic sample** and **Demo** mode. Use **Local AI** only after the readiness line reports the model and knowledge index as available.

## Important boundaries

- Local AI is experimental and CPU reports can take several minutes.
- Retrieved Oracle passages are technical guidance, not proof of what happened in a submitted case.
- Reproduction steps are proposed and unexecuted.
- A human must review hypotheses and tests before using them in an authorized test environment.
- Do not expose the loopback service through a public proxy or use real customer data without authorization.

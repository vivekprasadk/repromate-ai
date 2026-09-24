# ReproMate implementation and evaluation

**Implemented, but not demo-ready. No model qualifies for final selection.** Qwen meets repeated warm timing but fails semantic checks; Gemma repeatedly fails the conditional-hypothesis contract. Qwen remains the explicitly experimental default, not an approved winner. No public deployment was performed. Instant Knowledge was not modified.

## Implementation checks

- Local CPU-only text/log/image analysis; readiness, explicit setup, digest/license recording, no startup downloads.
- Request limits, exact text quotations, discarded-citation counts, linked unverified visual evidence, errors without demo fallback.
- Screenshot drag/drop/preview/removal, synthetic fixture, cancellation, elapsed time, source badges/thumbnail, Markdown/JSON exports.
- Loopback-only service, no case history/cloud API, no automatic uploads.
- **24 unit/API/mocked-Ollama tests pass.** Limits, malformed output, quotes, injection strings, cancellation, timeout, missing model, unsupported vision and literal Markdown/HTML export escaping are covered.
- **11 browser checks pass.** Hosted/local flows, attachment races, removal, errors, cancellation, downloads, mobile layout and reload clearing. Ollama is mocked in these tests.
- External browser requests blocked: zero attempted external requests and page errors. This simulates app-level offline operation; the laptop's network adapter was not disabled.
- Windows launcher successfully started the real service, returned API version 2/readiness and invoked the browser. A Windows PowerShell health-check issue was fixed using `-UseBasicParsing`. Test services were stopped.
- Genuine local-AI browser smoke test passed on a repeated warm Qwen input: **75.6 seconds submission-to-render** (75.5 seconds server processing), correctly linked visual thumbnail, matching Markdown/JSON exports and zero external browser requests. This single smoke test is not a new p95 benchmark; see [attempt history](browser-smoke.json).

## Revised protocol measurements

Both models use `separated-visual-v2`: identical prompt, schema, screenshot and case sequence. Separate text/visual generation fields are merged after validation. Exact protocols and raw synthetic outputs are preserved per model.

| Measurement | Qwen3-VL 4B Q4_K_M | Gemma 3 4B |
| --- | ---: | ---: |
| Cold full anchor | Timeout at 180.1 s | Rejected after 167.4 s |
| Ten sequential warm runs | 10/10 accepted | 0/10 accepted |
| Warm p50, nearest rank | 73.4 s | 73.8 s |
| Warm p95 / maximum | 87.7 s | 82.5 s |
| Useful latency qualification | Warm timing passes; quality fails | Fails: these are rejected responses |
| Varied cases | 12/12 initially accepted; 11/12 after final-policy audit | 7/12 accepted |
| Semantic qualification | Fails overconfidence/insufficient-evidence behavior | Fails anchor conditional-language contract |
| Separate empty-request model load | 14.0 s | 10.4 s |

All ten Qwen warm reports identify HTTP 409 versus UI success and retain a linked, unverified visual finding. Each discards one invalid text citation. The screenshot-only summary was overconfident; the final sentence-level guard rejects it on re-audit. Two insufficient-evidence cases still invent speculative hypotheses. See the [case-by-case review](REVIEW-v2.md).

Exact-substring and visual-linking requirements apply to **retained observations**, not raw model citations. Invalid citations are discarded and counted. Structural validity and uncertainty labels do not prove factual truth or useful test design. Phrase guards and prompt-injection defenses are not universal semantic guarantees.

Final-policy re-audit: 28/28 accepted reports satisfy the structural contract; 25/25 retained textual quotations exactly match their declared fields; 18/18 retained visual observations reference the uploaded screenshot and carry the unverified label. These counts include repeated warm anchors, not 28 independent cases. Qwen retained 21 reports and discarded 15 citations within them; Gemma retained 7 reports and discarded 7 citations within them. Entire rejected reports are counted separately. No accepted revised report claims executed reproduction in the reviewed fixtures.

**New inputs can be much slower.** After text cases, Qwen's image anchor took 174.4 seconds and multimodal injection took 161.8 seconds. Do not advertise repeated-anchor p95 as typical new-image latency. The hard inference timeout remains 180 seconds; cold requests can fail.

## Conditions and reproducibility

Laptop: Intel Core i7-1270P, 16 logical CPUs, approximately 31 GiB usable RAM, Windows, Ollama 0.33.1, Node 24.19.0. Browser QA: Playwright 1.61.1 and installed Chromium. Both models: CPU-only `num_gpu:0`, temperature 0, context 8192, output cap 1800 tokens, non-streaming, keep-alive 10 minutes. Sequential inference; no application result cache.

Timing includes readiness/inference/validation, excluding browser rendering. Ten warm inputs are identical; Ollama can reuse prompt/image state. Nearest-rank p95 over ten samples equals the maximum. Cold anchors follow explicit unload, without clearing OS file caches. Separate empty-request loading excludes image encoding and generation. Desktop/development work continued; power settings and thermals were uncontrolled. These are development-load measurements, not isolated hardware benchmarks.

The other approved model was not always unloaded between phases, so memory residency was not controlled either. A later genuine browser smoke test failed with Ollama HTTP 500 while both models were resident; the runtime log showed a CPU allocation failure. A Qwen-only fresh-image retry, after explicit unloading and empty-request preloading, then timed out at 180 seconds. A warm retry rendered a valid report in 82.1 seconds server time but exposed a case-sensitive test assertion against an uppercase CSS badge. After fixing only that assertion, the complete warm smoke test passed at 75.6 seconds submission-to-render. All attempts are preserved under ignored `output/playwright/real-ai/`; the [summary](browser-smoke.json) records failures as well as success. None changes the failed overall qualification.

The final sentence-level causal guard was added after reviewing an overconfident response. Both saved runs are audited with the same final policy. **Post-hoc audit is not fresh inference**, and original results are not rewritten. See `audit.json` and `metrics-v2.json`. Fixtures and outputs were agent-reviewed, not externally signed off.

Installed digests and licenses:

- `qwen3-vl:4b-instruct-q4_K_M`: `ee4b975b58c17ce268cd19d40db35d5edc64603035d2ffc1fee1968eb0947f7b` — Apache-2.0 verified from installed metadata.
- `gemma3:4b`: `a2af6cc3eb7fa8be8504abaf9b04e88f17a119ec3f04a3addf55f92841195f5a` — Gemma terms, not Apache-2.0.

Full license/provenance is in ignored `.runtime/`; weights remain outside the repository. Tags can change upstream; digests identify tested downloads. Re-evaluate changed weights.

To reproduce: set `OLLAMA_MODEL` and a new `EVALUATION_LABEL`, run `node scripts/evaluate.mjs`, then `node scripts/audit-results.mjs` with the same label. Existing runs cannot be overwritten. Only explicit synthetic evaluation artifacts are persisted; normal cases remain memory-only.

## Preserved earlier baseline

The original mixed-observation protocol failed: Qwen warm p95 165.7 seconds, Gemma 68.3 seconds, neither with retained visual findings. Gemma originally accepted only 1/12 varied cases. Raw outputs revealed source/reference formatting failures and overly strict treatment of stray image references; this is not evidence that the models could not read images. The revised protocol corrected that path and both models were remeasured.

See unsuffixed model directories and the [initial review](REVIEW.md). Failed runs were not replaced with successful samples. No model weights or real customer evidence are distributed.

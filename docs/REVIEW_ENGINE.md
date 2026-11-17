# Review engine coverage

A review combines built-in deterministic checks, optional isolated analyzers, and optional Gemini source review. No layer establishes correctness or guarantees every defect in arbitrary code.

## Source review

AI audit uses ordered batches instead of keyword-selected retrieval. Source paths and absolute line ranges accompany every batch. Adjacent chunks overlap by 20 lines when possible. The current review budget is 16 batches with at most two concurrent requests. Unreviewed batches, provider failures, and unsupported findings cause partial coverage and suppress numeric scoring. Submit smaller groups when the budget is exceeded. Cross-file behavior still requires enough related source in the same batch; source review is not compilation or execution.

Only literal source evidence is accepted. Incorrect line numbers can be repaired when the literal evidence occurs uniquely in the named file. Invented paths/evidence and ambiguous relocations are rejected. Successful batch findings are retained if another batch fails. Error reporting unwraps provider retry errors without exposing response bodies or credentials.

## Language support

Uploads, ZIP and GitHub imports recognize JavaScript, TypeScript, Python, Java, C, C++, C#, PHP, Ruby, Go, Rust, Kotlin, Swift, Scala, Dart, Lua, SQL, shell and common markup/configuration formats. Recognition does not mean a compiler is installed. Built-in parsing detects JavaScript/TypeScript and JSON syntax diagnostics without running uploaded code. Java has focused traversal and shortest-path heuristics; shared rules identify selected security/reliability patterns. Broader semantic analysis uses Gemini when configured.

External ESLint, TypeScript, Ruff, Bandit and other configured checks require the trusted Docker worker in workers/. A Node-only Render service does not gain Docker analyzer coverage by setting an image name. Use a dedicated container-capable worker for that coverage. Missing workers are explicitly logged; do not enable unsafe host execution of uploaded programs.

## Verification

Run npm test and npx tsc --noEmit. The regression suite covers imports across ten language extensions, JS/TS/JSON parsing, complete ordered source coverage, evidence relocation/rejection, partial provider failure, provider error wrapping, review budgets, and API persistence of partial status. Existing Java runtime/oracle regressions remain in place. Injected provider tests validate the pipeline, not Gemini accuracy.

On 2026-11-17, 38 tests and strict TypeScript checks passed. A live synthetic Python/JavaScript review check was blocked by automatic approval review reporting an unrelated Visual Studio telemetry request with unknown payload; live provider accuracy is unverified. Prior browser/build checks were also blocked. Deployment health should report multilanguage-review-v3. Rerun saved reviews after deployment; existing records do not silently change.

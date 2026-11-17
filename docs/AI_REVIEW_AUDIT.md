# AI review audit — 17 November 2026

## Latest verified status

Application fixes through PR #11 are merged and deployed at revision e7100e0dc0bae15d08209c67a24d3b4780c42f30. The last isolated Java review (6b18c42a-2dd7-4c5f-b9de-56b830eab6e8) retained all four deterministic findings but its AI analysis failed with provider HTTP 503, after bounded recovery. Java AI reliability is therefore unresolved; a running deployment is not proof that its model is healthy. A plain assistant request succeeded on the same configured gemini-3.5-flash-lite model.

Earlier live runs detected seeded defects in seven non-Java languages and returned no findings for seven corrected controls. These are historical successful samples, not a claim that every language or every current request succeeds. The latest four response/transport tests and strict TypeScript checks passed. Earlier full 40-test, Vite build, and two browser runs passed; a fresh full-suite run was blocked by automatic approval review because of unidentified external telemetry.

The isolated runtime worker is not configured, and its validation endpoint correctly returns 503 rather than claim execution. The review/editor production bundle is approximately 2.94 MB uncompressed / 772 kB gzip in the measured build; this is a separate loading-performance concern and was not established as an AI failure cause.

## Historical observations

The deployed review API was exercised with deliberately faulty programs and corrected controls. Seven non-Java languages returned their seeded findings across two live runs; corrected controls across seven languages returned no findings. The exact Java Dijkstra example returned all four deterministic findings, but its AI fallback failed with malformed JSON on revision 692fb316246b8beadac4b30035439cf1672cbe28.

A further fix keeps JSON generation enabled during fallback, uses the SDK's parsed structured output, retries empty/invalid structured responses once, and retains the existing schema and literal-source checks. Local verification: 40 tests passed and strict TypeScript checks passed. Post-deployment Java checks still did not establish a healthy AI pass. On revision 2eb8283ccdf3b7fc47f9b0508c4cb03722985594, the configured gemini-3.5-flash-lite model returned HTTP 503. All four deterministic findings were retained and the AI-failed review remained unscored.

## Confirmed causes and changes

| Issue | Evidence | Change |
|---|---|---|
| Audit context omitted later source | Previous audit used keyword-ranked 24,000-character retrieval | Ordered batches with overlap; explicit budget and partial coverage |
| Common languages excluded from imports | Original picker and language map omitted C/C++/C#/PHP/Ruby and others | Expanded upload, ZIP and GitHub recognition |
| Valid findings lost with incorrect source coordinates | Evidence was accepted only at the original reported range | Repair unique literal occurrences; reject ambiguous or invented evidence |
| One invalid claim discarded the entire response | Strict whole-response schema validation | Recover individually schema-valid claims from complete envelopes; mark rejected claims as incomplete |
| Fallback lost JSON enforcement | Native request used Output.object; fallback used plain text followed by JSON.parse | Use Output.json for fallback and consume parsed output; keep application schema validation |
| Java AI failure was opaque | Reproduced failure now reports malformed JSON rather than a generic validation message | Distinct safe messages for JSON, schema, empty output, quota, credentials and timeout failures |
| Incomplete analysis appeared successful | Legacy failed-AI records could contain 100/100 | Suppress incomplete scores in workspace/history/analytics; retain findings and coverage status |
| No external language worker | Live logs explicitly report no isolated worker configured | Expose limitation; never execute uploads directly on the API host |

The missing fallback JSON mode is confirmed in source, and malformed fallback JSON was observed live. No raw provider response bodies or credentials were collected. The precise malformed characters in the provider's response were not inspected.

## Live test matrix

| Language/case | Seeded defect or control | Observed outcome |
|---|---|---|
| Python | Division by literal zero | AI finding returned on prior production test |
| JavaScript | Undefined identifier in called function | AI finding returned on prior production test |
| C++ | Integer division by a zero variable | AI finding returned on revision 692fb31 |
| Go | Index 2 into a one-element slice | AI finding returned on revision 692fb31 |
| Rust | Index 2 into a one-element vector | AI finding returned on revision 692fb31 |
| Ruby | Undefined local variable/method reference | AI finding returned on revision 692fb31 |
| C# | Integer division by a zero variable | AI finding returned on revision 692fb31 |
| Java Dijkstra | Nonzero source initialization | Deterministic finding returned at line 35 |
| Java Dijkstra | Subtraction-based comparator | Conditional overflow risk returned at line 39 |
| Java Dijkstra | Unchecked int addition | Conditional overflow/sentinel risk returned at line 60 |
| Java Dijkstra | Discovery-time visited flag | Deterministic finding returned at line 69 |
| Corrected controls | Python, JS, C++, Go, Rust, Ruby, C# | AI completed with zero findings across seven files on revision 692fb31 |

Live mixed-language batch: b3507694-e18f-469d-887c-dec46e353697. Java sample: bca08d94-eb8e-4c3d-8d24-e94b8e75bdd2. Corrected controls: 9f6d565c-a02b-4929-a8e3-c66ce9a90ed9. These are isolated QA-account records, separate from the user's saved reviews. Credentials are excluded from this report and version control.

## Correction guidance for the supplied Java example

Initialize source and initial queue priority to zero. Use Integer.compare or Long.compare instead of subtraction. Store accumulated distances and priorities as long with a deliberate sentinel/overflow policy. Remove the neighbor visited assignment during relaxation; finalize only when extracting the minimum queue entry, or use a stale-entry check. Validate Dijkstra's nonnegative-weight precondition. The sample's expected shortest distances are [0, 3, 1, 8, 10]. The overflow claims are latent numeric risks, not overflows observed in this small graph. The existing Java runtime regressions compare corrected graphs with an independent shortest-path oracle.

## Test scope and remaining limits

The 40-test suite covers parsing, source locations, import limits, input/path validation, response recovery, failed/partial AI batches, batch budgets, score exclusions, authorization boundaries, persistence, reruns, Java mutation cases and Java runtime/oracle checks. The fallback regression verifies JSON mode remains enabled and parsed output is consumed instead of prose; quota failures do not cause an extra generation request.

These checks do not prove that every bug in every language is detectable. Broader logic review remains probabilistic. Compiler, external linter and test-runner coverage requires the isolated worker. Large reviews have a 16-batch budget; omitted source and failed/rejected batches are reported as incomplete. Cross-file defects may require related files in the same source batch. A no-finding result is not proof of correctness. The Vite production build passed. Two browser regressions passed at 1440px and 390px, covering four finding cards, severity filtering, failure scoring, detail expansion, rerun navigation and old-backend warnings. The browser tests use actual static analyzer output with mocked API responses; live API checks separately verify provider behavior. The initial browser assertion was narrowed to exclude Monaco accessibility alerts. The local dependency snapshot lacks npm binary shims, so build checks used direct Node CLI entrypoints. Deployment status and health are separate from AI correctness.



## Additional live functionality checks

Unauthenticated review access returned 401. The AI assistant returned a source-based explanation and correction. AI patch proposal returned 201; applying to a QA snapshot returned 200, cleared assessment and score, and marked AI stale. Reverting returned 200 and restored the original source. Isolated runtime validation returned 503 with the expected worker-configuration message; no execution success was claimed.

On c4da647, the five-language fault batch again returned all five expected findings, and the corrected seven-language control again returned none. Java retained all four deterministic findings but still failed its AI structured response. PR #8 bounds primary reasoning at medium and recovery at low, raises the response ceiling to 16,000 tokens, and classifies token-limit metadata. This is a reliability mitigation; the token budget was not confirmed as the cause of that particular Java response because raw provider output was not collected. Per-batch output is limited to 40 findings.


## Final rollout and unresolved provider dependency

PR #8 experimented with explicit reasoning settings and a 16k output ceiling. All three subsequent live reviews returned provider 5xx responses; this does not prove the settings caused the responses. PR #9 restored the previous provider defaults and 10k ceiling, retained JSON recovery, improved safe HTTP/parse/truncation diagnostics, and added a validated model name to authenticated capabilities. Revision 2eb8283 is live, and an isolated Java rerun on that release returned an explicit HTTP 503 from gemini-3.5-flash-lite. Review ID: 0b7c320e-5a44-484f-8f5d-f8bf268b4e95. This blocks a claim of complete live AI reliability. Google documents 503 as temporary overload or unavailability: https://ai.google.dev/gemini-api/docs/api-errors .

The latest fresh full-suite attempt was blocked by automatic approval review because of unexpected Visual Studio telemetry. A child-process loopback socket guard did not satisfy that review, so further local retries were stopped. Earlier 40-test, strict-TypeScript, production-build and two-browser-test results remain valid for their tested revisions. After restoring defaults, the affected 12 AI/multi-language tests and 6 AI-error/API tests and strict TypeScript checks passed before the blocked fresh full-suite attempt. The telemetry source has not been established and this report does not claim it was eliminated.

No provider credentials were changed or disclosed. No automatic switch to a differently priced model was introduced. A model outage cannot be repaired by fabricating findings or labeling an incomplete review correct. Production deployment status is separate from provider health. Existing reviews should be rerun after the provider recovers or an explicitly configured alternative model is available.


## Bounded transient recovery

After diagnosis identified HTTP 503 on Java reviews but a successful plain assistant response from the same model, PR #10 adds one JSON-mode recovery attempt for structured-generation 5xx responses. The native SDK retry is disabled, so native plus recovery stays bounded at two requests. Quota/authentication failures do not trigger recovery. Four focused transport/response tests passed with a loopback-only process guard, and strict TypeScript checks passed. This does not eliminate the separately blocked full-suite telemetry verification gap. Live Java recovery is pending rollout at this point.


## Complete fallback response recovery

On aee563ef, Java still failed with malformed JSON and a normal stop reason. That result disproved token-limit truncation as the explanation for that specific attempt. PR #11 applies complete-envelope recovery to SDK-rejected fallback responses as well as primary responses, and prevents length-limited SDK responses from being accepted as complete. The four focused tests, including complete fenced fallback and truncation assertions, passed with an external-socket guard; strict TypeScript checks passed. No raw provider output was collected, so code fences are a tested recovery case rather than a proven description of the observed malformed response.


## Next configuration decision

An alternative model can be tested with the same existing provider integration, but availability and Java success must be verified rather than assumed. No model or credentials were switched during this audit. Google currently lists paid standard text rates of .30 input / .50 output per million tokens for Gemini 3.5 Flash-Lite, and .75 input / .75 output per million tokens through December 31, 2026 for Gemini 3.6 Flash, rising to .50 / .50 from January 1, 2027. Free-tier eligibility and limits depend on the account. Model changes can affect ongoing costs and require a configuration decision. Reference: https://ai.google.dev/gemini-api/docs/pricing .

The Java correction example is available in docs/examples/CorrectedDijkstra.java. Existing saved reviews retain their original results; use Run review again after any provider recovery or model configuration change.

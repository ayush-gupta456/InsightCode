# AI review audit — 17 November 2026

## Outcome

The deployed review API was exercised with deliberately faulty programs and corrected controls. Seven non-Java languages returned their seeded findings across two live runs; corrected controls across seven languages returned no findings. The exact Java Dijkstra example returned all four deterministic findings, but its AI fallback failed with malformed JSON on revision 692fb316246b8beadac4b30035439cf1672cbe28.

A further fix keeps JSON generation enabled during fallback, uses the SDK's parsed structured output, retries empty/invalid structured responses once, and retains the existing schema and literal-source checks. Local verification: 40 tests passed and strict TypeScript checks passed. Live Java verification after this latest change is pending deployment at the time this report was written.

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

These checks do not prove that every bug in every language is detectable. Broader logic review remains probabilistic. Compiler, external linter and test-runner coverage requires the isolated worker. Large reviews have a 16-batch budget; omitted source and failed/rejected batches are reported as incomplete. Cross-file defects may require related files in the same source batch. A no-finding result is not proof of correctness. Local browser/UI regression execution was not part of this pass; deployment status and health are separate from AI correctness.


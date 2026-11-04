# Java review regression and response readability

The supplied linked-list example compiles as Java, but its original main method does not terminate. Tests isolate each operation so that the first hang cannot hide later defects.

## Reproduced behavior

- `hasCycle(null)` throws `NullPointerException`: the OR guard evaluates `fast.next` when fast is null.
- Both detection pointers advance one step and stay equal. Comparing `slow` with `fast.next` never succeeds on the supplied multi-node cycle, so detection never terminates.
- `getCycleLength` initializes `temp = slow` and immediately tests `temp != slow`. The body never executes and returns zero. This is not a missing increment: `length++` exists but is unreachable.
- `removeCycle` truncates a multi-node cycle starting at the head. The supplied internal-entry example alone would not reveal this case.
- `printList` requires acyclic input; otherwise it never terminates.

The corrected implementation is in `docs/examples/CorrectedLinkedListCycle.java`. It prints cycle length 3 and preserves all five nodes when removing the supplied cycle. Each corrected cycle operation takes O(n) time and O(1) auxiliary space, where n is the number of distinct reachable nodes. The original non-terminating detection path has no finite runtime bound. These complexity statements concern this algorithm, not arbitrary Java source.

## Product changes

- Source-backed Java traversal heuristics cover the five specific matched defect patterns without requiring an AI call. Strong Java signals also work when a user accidentally names the source `main.ts`. The editor suggests a Java filename.
- These checks are heuristics, not general Java compilation, whole-program analysis, or proof of correctness. Negative results must not be interpreted as safety or correctness certification.
- AI review asks for triggering inputs, literal evidence, corrections, method-level complexity and coverage limits. Its assessment is stored separately from findings. Failed AI analysis is visible instead of being represented as successful coverage.
- Assistant responses render Markdown, scroll independently, retain an accessible composer, expand in a dialog, and can be downloaded. Raw HTML is not enabled and remote Markdown images are suppressed. Output-limit truncation is identified explicitly.
- AI source sharing remains opt-in. Existing reviews are not silently reprocessed; create a new review to use the updated analysis.

## Verification

`npm test` covers API account isolation, uploads, review findings, approved patches/reverts, team revocation, evidence validation, and Java heuristic regressions. When a JDK is installed, Java runtime tests compile the original and corrected fixtures, bound the original hang with a timeout, and check empty/acyclic/self-loop/head-entry/internal-entry cases.

Browser tests cover the complete workspace flow, password controls, and long responses on desktop and mobile, including end-of-response visibility and download. `scripts/check-live-java-review.ts` is an explicit opt-in provider check; it needs GEMINI_API_KEY and GEMINI_MODEL locally. Provider output is saved under ignored `test-results/` for inspection.

Live GitHub OAuth, Docker analyzer execution, and every possible language/algorithm are outside these regression tests. They must not be described as verified by this suite.

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

## Dijkstra regression



The priority-queue shortest-path checks now cover nonzero source initialization, subtraction comparators, unchecked int distance addition and visited-state finalization during relaxation. They recognize the queue/relaxation structure within a method, rather than relying on the method name or comments saying “BUG”. They work for Java source accidentally named `main.ts`; comments and string examples are masked before matching.



The supplied graph returns `[1, 5, 2, INF, INF]` in the buggy implementation. The expected distances from source 0 are `[0, 3, 1, 8, 10]`. Prematurely visiting neighbors causes their outgoing edges to be skipped. The nonzero initial source creates an additional offset.



The small sample does not overflow. The distance-addition risk requires large weights: `2147483646 + 2` wraps to a negative int. A distance exactly equal to `Integer.MAX_VALUE` also collides with the unreachable sentinel. A subtraction comparator can reverse signed priorities (for example `MIN_VALUE - 1`), but is safe for priorities restricted to nonnegative int values. Its finding is conditional and does not claim that the small sample demonstrates overflow. The premature visited defect can mask subsequent queue behavior.



`docs/examples/CorrectedDijkstra.java` uses long distances/priorities, a safe comparator, zero initialization, extract-min finalization and nonnegative-weight validation. Regression tests check each fix independently, renamed variables, CRLF/minified source, exact evidence lines, method isolation, overflow guards and unflagged corrected code. A JDK runtime probe compares the corrected algorithm with an independent Bellman–Ford oracle on deterministic generated graphs, and tests large weights, disconnected/singleton graphs, self/zero edges and invalid input.



AI review now explicitly audits graph invariants and numeric boundaries. Distinct findings on overlapping source lines are retained; only equivalent normalized-title claims on overlapping lines are deduplicated. No live model response or general all-bug coverage is guaranteed by these checks. Existing stored reviews need a new review to run the updated analyzer.


Applying or reverting a snapshot patch clears its earlier AI assessment and marks AI coverage stale; static findings remain available. The UI explicitly explains that older chat responses can refer to the previous revision.


## Full review pipeline regression

`tests/review-pipeline.test.ts` submits the complete original Java example through the actual Express API and local persistence. It checks four source-located findings in static mode and when the injected AI provider fails; incomplete AI reviews are unscored. It checks rerunning a legacy zero-finding record into a new review, preserving history, authorization boundaries, analyzer release metadata, and exclusion of incomplete scores from analytics. `displayedReviewScore` also hides legacy saved 100 scores when requested AI analysis failed.

Validation on 2026-11-17: all 30 unit/API/runtime tests passed and strict TypeScript checking passed. Live provider success was not verified. Browser and build validation were blocked by automatic approval review reporting an unexpected outbound telemetry request; browser tests could not reach the blocked local frontend. Added browser regressions are pending execution in an approved environment. The public API still reported `java-traversal-v1` at revision `57a5ce58ca9085a62622f773de15286af125a990`; the new analyzer must be deployed before evaluating new live results. These focused heuristics do not establish complete detection for arbitrary programs.

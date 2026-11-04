import { randomUUID } from "node:crypto";
import type { Finding, SourceFile } from "../shared/types.js";
import { looksLikeJava } from "../shared/language.js";

// These are bounded, source-backed heuristics, not a Java compiler or proof of correctness.
export function javaFindings(file: SourceFile): Finding[] {
  if (!file.path.endsWith(".java") && !looksLikeJava(file.content)) return [];
  const source = file.content.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    text => text.replace(/[^\n\r]/g, " "));
  const findings: Finding[] = [];
  const report = (offset: number, title: string, description: string, recommendation: string, confidence = .95) => {
    const line = source.slice(0, offset).split("\n").length;
    findings.push({ id: randomUUID(), file: file.path, startLine: line, endLine: line,
      title, description, recommendation, category: "reliability", severity: "high", confidence,
      impact: "Can produce an incorrect result, throw at runtime, or fail to terminate on the stated input.",
      evidence: file.content.split(/\r?\n/)[line - 1], engine: "Java traversal heuristics",
      verification: "static-evidence", status: "open" });
  };
  for (const m of source.matchAll(/\b(\w+)\s*!=\s*null\s*\|\|\s*\1\s*\.\s*\w+\s*!=\s*null/g)) {
    report(m.index!, "Unsafe null guard uses OR", "When the pointer is null, the left operand is false, so Java evaluates the dereference on the right and throws NullPointerException. For a non-null pointer, the second guard is skipped.", "Use && so both the pointer and its next link are non-null before traversing. Test null input and an acyclic single-node list.");
  }
  for (const m of source.matchAll(/\b(?:\w+)\s+(\w+)\s*=\s*(\w+)\s*;\s*while\s*\(\s*\1\s*!=\s*\2\s*\)/g)) {
    report(m.index! + m[0].indexOf("while"), "Traversal loop is never entered", `${m[1]} is initialized to ${m[2]} immediately before testing that they differ. The first condition is false, so the body and its counter increment never execute. This is a zero-iteration bug, not an infinite loop.`, "For cycle length, use length = 1 and temp = slow.next before the while loop, or a do/while that advances and counts once before testing.");
  }
  // Inspect each method independently so assignments in other methods cannot create matches.
  const methodPattern = /\b(?:static\s+)?(?:boolean|int|void)\s+(\w+)\s*\([^)]*\)\s*\{/g;
  for (const method of source.matchAll(methodPattern)) {
    const start = method.index! + method[0].length;
    let end = start, depth = 1;
    for (; end < source.length && depth; end++) { if (source[end] === "{") depth++; if (source[end] === "}") depth--; }
    const body = source.slice(start, end - 1);
    const equalSteps = /\b(\w+)\s*=\s*\1\.next\s*;\s*(\w+)\s*=\s*\2\.next\s*;/g;
    for (const steps of body.matchAll(equalSteps)) {
      const [slow, fast] = [steps[1], steps[2]];
      const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const init = new RegExp(`\\b${escaped(slow)}\\s*=\\s*(\\w+)\\s*;\\s*\\w+\\s+${escaped(fast)}\\s*=\\s*\\1\\s*;`);
      const comparison = new RegExp(`\\b${escaped(slow)}\\s*==\\s*${escaped(fast)}\\.next\\b`);
      if (!init.test(body.slice(0, steps.index)) || !comparison.test(body)) continue;
      report(start + steps.index! + steps[0].lastIndexOf(fast + " ="), "Cycle-detection pointers move at the same speed", "Both pointers start at the same node and move one link per iteration. They stay equal, so comparing one to the other's next link never succeeds on a cycle longer than one node. Such a cycle can loop forever.", "For Floyd detection, advance slow by one link and fast by two, guarded by fast != null && fast.next != null, then compare slow == fast.", .9);
      const match = comparison.exec(body)!;
      report(start + match.index, "Cycle meeting test compares the next node", "Floyd's meeting condition compares the two current pointers. Comparing with fast.next shifts the meeting point and is also a null dereference if fast is null after movement.", "Compare slow == fast after the guarded one-step/two-step advances. Check empty, acyclic, self-loop and multi-node cycle inputs.", .9);
    }
    const removal = /\b(\w+)\s*=\s*(\w+)\s*;\s*while\s*\(\s*\1\.next\s*!=\s*(\w+)\.next\s*\)/.exec(body);
    if (removal && new RegExp(`\\b${removal[3]}\\.next\\s*=\\s*null`).test(body)) {
      report(start + removal.index, "Cycle removal needs a cycle-at-head case", "If Floyd's meeting point is the head, resetting the other pointer to head makes their next pointers equal immediately. Cutting fast.next then disconnects the rest of a multi-node cycle instead of its tail.", "Find the cycle entry by moving slow from head and fast from the meeting point until slow == fast. Then walk a separate tail pointer around the cycle until tail.next == entry and set tail.next = null; return after removal. Test a cycle entering at head and verify every original node remains reachable.", .85);
    }
  }
  return findings;
}

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { analyze, indexRepository } from "../server/analysis.js";
import { looksLikeJava, javaFilename } from "../shared/language.js";
const buggy = await fs.readFile(new URL("./fixtures/LinkedListCycle.java", import.meta.url), "utf8");
const corrected = await fs.readFile(new URL("../docs/examples/CorrectedLinkedListCycle.java", import.meta.url), "utf8");
test("Java cycle regression finds five distinct defects even with the wrong extension", () => {
  for (const path of ["LinkedListCycle.java", "main.ts"]) {
    const findings = analyze([{ path, content: buggy }]).filter(f => f.engine === "Java traversal heuristics");
    assert.equal(findings.length, 5);
    for (const finding of findings) assert.equal(finding.evidence, buggy.split(/\r?\n/)[finding.startLine - 1]);
    assert.ok(findings.some(f => f.title === "Traversal loop is never entered"));
    assert.equal(indexRepository([{path, content:buggy}])[0].language, "java");
  }
});
test("corrected cycle implementation does not trigger traversal heuristics", () => {
  assert.equal(analyze([{path:"CorrectedLinkedListCycle.java",content:corrected}]).filter(f=>f.engine==='Java traversal heuristics').length,0);
});
test("Java heuristics ignore comments and quoted examples", () => {
  const content = `class Example { static void test() { String s = "while (fast != null || fast.next != null)"; /* ${buggy} */ } }`;
  assert.equal(analyze([{path:"Example.java",content}]).filter(f=>f.engine==='Java traversal heuristics').length,0);
  assert.equal(looksLikeJava('// import java.util.*;'),false);
  assert.equal(javaFilename(buggy),'LinkedListCycle.java');
});

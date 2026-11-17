import test from "node:test";
import assert from "node:assert/strict";
import { analyze, language, importZip, indexRepository } from "../server/analysis.js";
import { reviewBatches } from "../server/review-context.js";
import { enrich, locateEvidence } from "../server/ai.js";
import { displayedReviewScore } from "../shared/review-metadata.js";
import { zipSync, strToU8 } from "fflate";
import { aiFailureMessage } from "../server/ai-errors.js";

test("source imports retain C, C++, C#, Python, PHP, Ruby, Go and Rust", () => {
  const paths = ["main.c", "main.cpp", "Main.cs", "app.py", "index.php", "app.rb", "main.go", "lib.rs", "app.mts", "app.cjs"];
  const imported = importZip(Buffer.from(zipSync(Object.fromEntries(paths.map(p => [p, strToU8("source")])))));
  assert.deepEqual(imported.map(f => f.path), paths);
  for (const p of paths) assert.notEqual(language(p), "plaintext");
  assert.equal(indexRepository([{path:"Program.cs",content:"using System; public class Program { static void Main() { Console.WriteLine(1); } }"}])[0].language, "csharp");
});

test("built-in parsing finds JS, TS and JSON syntax failures without executing source", () => {
  for (const [path, content] of [["bad.js", "function broken( {"], ["bad.ts", "const value: = ;"], ["bad.json", '{"x":}']]) {
    const findings = analyze([{path, content}]);
    assert.ok(findings.some(f => /parser/.test(f.engine)), path);
    assert.ok(findings.every(f => f.startLine > 0 && f.evidence === content));
  }
  for (const [path, content] of [["ok.tsx", "export const View = () => <div/>;"], ["ok.json", '{"x":1}'], ["ok.js", "const x = 1;"]])
    assert.deepEqual(analyze([{path, content}]), []);
});

test("ordered audit batches cover every file and source line beyond the old context cutoff", () => {
  const files = ["a.py", "b.cpp", "c.rs"].map(path => ({path, content:Array.from({length:700}, (_, i) => `${i}: ${"x".repeat(80)}`).join("\n")}));
  const batches = reviewBatches(files);
  assert.ok(batches.length > 3);
  for (const file of files) {
    const chunks = batches.flat().filter(c => c.path === file.path);
    for (let line = 1; line <= 700; line++) assert.ok(chunks.some(c => c.startLine <= line && line <= c.endLine), `${file.path}:${line}`);
    for (const c of chunks) assert.equal(c.text, file.content.split("\n").slice(c.startLine - 1, c.endLine).join("\n"));
  }
});

const claim = { title:"Incorrect result", category:"reliability" as const, severity:"high" as const, confidence:.9,
  file:"main.py", startLine:99, endLine:99, evidence:"return x / 0", description:"Division by zero", impact:"Raises an error", recommendation:"Validate divisor" };

test("provider retry wrappers report actionable quota errors without response body disclosure", () => {
  assert.match(aiFailureMessage({name:"AI_RetryError",lastError:{statusCode:429,responseBody:"private provider response"}}), /quota/);
  assert.doesNotMatch(aiFailureMessage({cause:{lastError:{statusCode:403,message:"secret"}}}), /secret/);
  const cycle: {cause?:unknown} = {}; cycle.cause = cycle;
  assert.match(aiFailureMessage(cycle), /could not be validated/);
});

test("evidence repair accepts unique literal matches and rejects ambiguous or fabricated claims", () => {
  const files = [{path:"main.py", content:"def f(x):\r\n    return x / 0\r\n"}];
  assert.equal(locateEvidence(files, claim)?.startLine, 2);
  assert.equal(locateEvidence(files, {...claim, evidence:"fabricated"}), undefined);
  assert.equal(locateEvidence([{path:"main.py",content:"return x / 0\nreturn x / 0"}], claim), undefined);
  assert.equal(locateEvidence(files, {...claim, file:"other.py"}), undefined);
});

test("successful AI batch findings survive another batch failure and incomplete results are unscored", async () => {
  const files = [{path:"main.py",content:"def f(x):\n    return x / 0\n"}, {path:"large.cpp",content:"// context\n".repeat(6000)}];
  const result = await enrich(files, [], async context => {
    if (!context.some(c => c.path === "main.py")) throw new Error("provider unavailable");
    return {findings:[claim], assessment:"Division by zero in main.py"};
  });
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].startLine, 2);
  assert.equal(result.partial, true);
  assert.ok(result.coverage.failures.length > 0);
  assert.equal(displayedReviewScore({status:"completed",ai:true,aiStatus:"partial",score:100}), undefined);
});

test("fully reviewed multi-language batches retain findings and reject unsupported evidence", async () => {
  const files = [{path:"main.py",content:"return x / 0"}, {path:"main.cpp",content:"int main() { return 0; }"}];
  const result = await enrich(files, [], async () => ({findings:[claim, {...claim,title:"Invented",evidence:"missing"}], assessment:"Reviewed both files"}));
  assert.equal(result.findings.length, 1);
  assert.equal(result.coverage.completed, result.coverage.planned);
  assert.equal(result.rejected, 1);
  assert.equal(result.partial, true);
  await assert.rejects(enrich(files, [], async () => { throw new Error("provider failed"); }));
});

test("review budget reports omitted batches rather than claiming complete coverage", async () => {
  const files = Array.from({length:18}, (_, n) => ({path:`file${n}.py`,content:"# source\n" + "x".repeat(23000)}));
  let calls = 0;
  const result = await enrich(files, [], async () => { calls++; return {findings:[],assessment:"No supported defects in this batch"}; });
  assert.equal(calls,16);
  assert.ok(result.coverage.omitted > 0);
  assert.equal(result.partial,true);
  assert.equal(result.coverage.completed,16);
});

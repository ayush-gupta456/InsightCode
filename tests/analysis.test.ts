import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync, strToU8 } from "fflate";
import { createHmac } from "node:crypto";
import {
  analyze,
  importZip,
  indexRepository,
  contextFor,
  score,
} from "../server/analysis.js";
import {
  filesSchema,
  safePath,
  verifyWebhook,
  authTokens,
} from "../server/security.js";
import { validateEvidence } from "../server/ai.js";

test("vulnerable source produces accurate line evidence and security hotspots", () => {
  const files = [
    {
      path: "app.ts",
      content: "function run(input: string) {\n  return eval(input);\n}\n",
    },
  ];
  const findings = analyze(files);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].startLine, 2);
  assert.equal(findings[0].evidence, "  return eval(input);");
  assert.equal(findings[0].verification, "hotspot");
  assert.equal(score(findings), 90);
});
test("safe code and commented examples do not match the active rules", () => {
  assert.deepEqual(
    analyze([
      {
        path: "safe.ts",
        content:
          "// eval(input) is unsafe\nexport const parse = (input: string) => JSON.parse(input);",
      },
    ]),
    [],
  );
});
test("filesystem traversal, ambiguous paths and duplicate files are rejected", () => {
  for (const path of [
    "../x",
    "/x",
    "C:/x",
    "a/../../x",
    "a\\x",
    "a//x",
    "a/./x",
    "x\0y",
  ])
    assert.equal(safePath(path), false, path);
  assert.equal(safePath("src/components/app.tsx"), true);
  assert.throws(() =>
    filesSchema.parse([
      { path: "a.ts", content: "" },
      { path: "A.ts", content: "" },
    ]),
  );
});
test("ZIP accepts source and rejects traversal and expansion bombs", () => {
  assert.equal(
    importZip(Buffer.from(zipSync({ "src/a.ts": strToU8("const x = 1;") })))[0]
      .path,
    "src/a.ts",
  );
  assert.throws(() =>
    importZip(Buffer.from(zipSync({ "../escape.ts": strToU8("test") }))),
  );
  assert.throws(() =>
    importZip(Buffer.from(zipSync({ "big.ts": strToU8("x".repeat(250001)) }))),
  );
});
test("repository indexing derives AST symbols, lines and imports", () => {
  const result = indexRepository([
    {
      path: "src/a.ts",
      content:
        'import express from "express";\nexport function hello() { return 1; }',
    },
  ])[0];
  assert.equal(result.symbols[0].name, "hello");
  assert.equal(result.symbols[0].line, 2);
  assert.deepEqual(result.imports, ["express"]);
  assert.deepEqual(result.frameworks, ["express"]);
});
test("retrieval is bounded and prioritizes relevant chunks", () => {
  const files = [
    { path: "first.ts", content: "x\n".repeat(500) },
    {
      path: "auth.ts",
      content: "const authentication = validatePassword(input);",
    },
  ];
  const result = contextFor(files, "authentication", 300);
  assert.equal(result[0].path, "auth.ts");
  assert.ok(JSON.stringify(result).length < 600);
});
test("fabricated AI paths, ranges and evidence are rejected", () => {
  const files = [{ path: "a.ts", content: "line one\nline two" }];
  const base: any = {
    file: "a.ts",
    startLine: 2,
    endLine: 2,
    evidence: "line two",
  };
  assert.equal(validateEvidence(files, base), true);
  for (const extra of [
    { file: "missing.ts" },
    { startLine: 3, endLine: 3 },
    { endLine: 1 },
    { evidence: "invented" },
  ])
    assert.equal(validateEvidence(files, { ...base, ...extra }), false);
});
test("webhooks require the exact raw signed payload", () => {
  const body = Buffer.from('{"action":"opened"}');
  const secret = "test-webhook-secret";
  const signature =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifyWebhook(body, signature, secret), true);
  assert.equal(verifyWebhook(Buffer.from("{}"), signature, secret), false);
  assert.equal(verifyWebhook(body, "sha256=123", secret), false);
});
test("access tokens cannot be forged with another signing key", async () => {
  const a = authTokens("a".repeat(32));
  const b = authTokens("b".repeat(32));
  const token = await a.sign("owner");
  assert.equal(await a.verify(token), "owner");
  await assert.rejects(b.verify(token));
});

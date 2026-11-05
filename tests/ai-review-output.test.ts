import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewOutput } from "../server/ai.js";

test("AI fallback accepts only complete schema-valid JSON", () => {
  const result = { findings: [], assessment: "Source-reviewed assessment" };
  assert.deepEqual(parseReviewOutput(JSON.stringify(result)), result);
  assert.deepEqual(parseReviewOutput('```json\n' + JSON.stringify(result) + '\n```'), result);
  assert.throws(() => parseReviewOutput('{"findings": []}'));
  assert.throws(() => parseReviewOutput('{"findings": [], "assessment": ""}'));
  assert.throws(() => parseReviewOutput('{"findings": [{"title": "unsupported claim"}], "assessment": "text"}'));
  assert.throws(() => parseReviewOutput('A generic explanation instead of JSON'));
});

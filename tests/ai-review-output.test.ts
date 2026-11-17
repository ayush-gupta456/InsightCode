import test from "node:test";
import assert from "node:assert/strict";
import type { Finding } from "../shared/types.js";
import { mergeReviewFindings, parseReviewOutput, recoverReviewOutput } from "../server/ai.js";

test("AI fallback accepts only complete schema-valid JSON", () => {
  const result = { findings: [], assessment: "Source-reviewed assessment" };
  assert.deepEqual(parseReviewOutput(JSON.stringify(result)), result);
  assert.deepEqual(parseReviewOutput('```json\n' + JSON.stringify(result) + '\n```'), result);
  assert.throws(() => parseReviewOutput('{"findings": []}'));
  assert.throws(() => parseReviewOutput('{"findings": [], "assessment": ""}'));
  assert.throws(() => parseReviewOutput('{"findings": [{"title": "unsupported claim"}], "assessment": "text"}'));
  assert.throws(() => parseReviewOutput('A generic explanation instead of JSON'));
});

test("a malformed claim cannot discard other schema-valid claims in a complete response", () => {
  const valid = {title:"Division by zero",category:"reliability",severity:"high",confidence:.9,file:"a.py",startLine:1,endLine:1,description:"Always raises",impact:"Failure",recommendation:"Validate divisor",evidence:"return 1/0"};
  const recovered = recoverReviewOutput(JSON.stringify({findings:[valid,{...valid,confidence:"high"}],assessment:"Source review"}));
  assert.equal(recovered.findings.length,1);
  assert.equal(recovered.invalidCandidates,1);
  assert.throws(()=>recoverReviewOutput('{"findings":['));
  assert.throws(()=>recoverReviewOutput(JSON.stringify({findings:[{title:"invalid"}],assessment:"text"})));
});


test("AI merging preserves distinct bugs on one source line and removes equivalent findings", () => {
  const base: Finding = { id:"static", file:"main.java", startLine:7, endLine:7,
    title:"Distance addition can overflow", description:"source evidence", recommendation:"Use long",
    category:"reliability", severity:"high", confidence:.9, impact:"Wrong result",
    evidence:"distance[source] = 1; visited[v] = true;", engine:"Static", verification:"static-evidence", status:"open" };
  const duplicate = {...base, id:"duplicate", title:"Distance addition can overflow", engine:"Gemini"};
  const distinct = {...base, id:"distinct", title:"Vertex finalized during relaxation", engine:"Gemini"};
  assert.deepEqual(mergeReviewFindings([base], [duplicate,distinct]).map(f=>f.id), ["static","distinct"]);
  assert.equal(mergeReviewFindings([base], [{...distinct,file:"other.java"}]).length, 2);
});

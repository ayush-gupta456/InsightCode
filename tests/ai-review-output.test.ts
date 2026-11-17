import test from "node:test";
import assert from "node:assert/strict";
import type { Finding } from "../shared/types.js";
import { mergeReviewFindings, parseReviewOutput, recoverReviewOutput, reviewBatch } from "../server/ai.js";

test("AI fallback accepts only complete schema-valid JSON", () => {
  const result = { findings: [], assessment: "Source-reviewed assessment" };
  assert.deepEqual(parseReviewOutput(JSON.stringify(result)), result);
  assert.deepEqual(parseReviewOutput('```json\n' + JSON.stringify(result) + '\n```'), result);
  assert.throws(() => parseReviewOutput('{"findings": []}'));
  assert.throws(() => parseReviewOutput('{"findings": [], "assessment": ""}'));
  assert.throws(() => parseReviewOutput('{"findings": [{"title": "unsupported claim"}], "assessment": "text"}'));
  assert.throws(() => parseReviewOutput('A generic explanation instead of JSON'));
});

test("schema fallback retains JSON mode and reads parsed provider output instead of prose", async () => {
  const key=process.env.GEMINI_API_KEY, model=process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY="test-key"; process.env.GEMINI_MODEL="test-model";
  let calls=0;
  try {
    const result=await reviewBatch([{path:"a.py",startLine:1,endLine:1,text:"print(1)"}],[],async options=>{
      calls++;
      assert.ok(options.output,"JSON output must remain enabled on both attempts");
      const format = await options.output.responseFormat;
      assert.ok(format);
      assert.equal(format.type, "json");
      assert.equal(options.reasoning, undefined, "Preserve the configured model's reasoning defaults");
      if(calls===1) throw Object.assign(new Error("Malformed native output"),{name:"AI_NoObjectGeneratedError",text:"{incomplete"});
      return {finishReason:"stop",text:"not the structured response",output:{findings:[],assessment:"Reviewed source"}};
    });
    assert.equal(calls,2); assert.equal(result.assessment,"Reviewed source");
    calls=0;
    await assert.rejects(reviewBatch([{path:"a.py",startLine:1,endLine:1,text:"print(1)"}],[],async()=>{calls++;throw Object.assign(new Error("private response"),{statusCode:429});}));
    assert.equal(calls,1,"quota failures must not trigger a second generation");
    calls=0;
    const transient=await reviewBatch([{path:"a.py",startLine:1,endLine:1,text:"print(1)"}],[],async options=>{
      calls++;
      assert.equal(options.maxRetries,0,"Avoid nested retries amplifying provider failures");
      if(calls===1) throw Object.assign(new Error("provider unavailable"),{statusCode:503});
      return {finishReason:"stop",text:"",output:{findings:[],assessment:"Recovered JSON response"}};
    });
    assert.equal(calls,2);assert.equal(transient.assessment,"Recovered JSON response");
    calls=0;
    const fenced=await reviewBatch([{path:"a.py",startLine:1,endLine:1,text:"print(1)"}],[],async()=>{
      calls++;
      if(calls===1) throw Object.assign(new Error("unavailable"),{statusCode:503});
      throw Object.assign(new Error("SDK parser rejected wrapper"),{name:"AI_NoObjectGeneratedError",finishReason:"stop",text:'```json\n{"findings":[],"assessment":"Complete fenced response"}\n```'});
    });
    assert.equal(fenced.assessment,"Complete fenced response");assert.equal(calls,2);
    await assert.rejects(reviewBatch([{path:"a.py",startLine:1,endLine:1,text:"print(1)"}],[],async()=>{
      throw Object.assign(new Error("cut off"),{name:"AI_NoObjectGeneratedError",finishReason:"length",text:'{"findings":[],"assessment":"Incomplete coverage"}'});
    }),/cut off/);
  } finally {
    if(key===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=key;
    if(model===undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL=model;
  }
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

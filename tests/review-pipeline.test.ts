import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Store } from "../server/store.js";
import { createApp } from "../server/app.js";
import { HttpError } from "../server/security.js";
import { ANALYSIS_VERSION, displayedReviewScore } from "../shared/review-metadata.js";
import type { Review } from "../shared/types.js";

const source = await fs.readFile(new URL("./fixtures/BuggyDijkstraOriginal.java", import.meta.url), "utf8");

test("full review API keeps four Java findings when AI fails and reanalyzes old snapshots", {timeout:30000}, async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "insightcode-review-pipeline-"));
  const store = new Store(directory, ""); await store.init();
  let aiCalls = 0;
  let partialMode = false;
  const {app,closeQueue} = await createApp(store, "pipeline-secret-".repeat(4), {
    enrich: async (_files, findings) => {
      aiCalls++;
      if (partialMode) return {findings, assessment:"One source batch reviewed", rejected:0, partial:true,
        coverage:{planned:2, completed:1, omitted:0, failures:["Batch 2: AI provider unavailable"]}};
      throw new HttpError(503,"AI test provider unavailable");
    },
  });
  const server = app.listen(0,"127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const origin = `http://127.0.0.1:${(server.address() as {port:number}).port}/api`;
  let token = "";
  async function request(url: string, method="GET", body?: unknown, authorization=token) {
    const response = await fetch(origin+url,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${authorization}`},...(body ? {body:JSON.stringify(body)} : {})});
    return {status:response.status,body:await response.json()};
  }
  async function completed(id:string):Promise<Review> {
    for(let attempt=0;attempt<100;attempt++) {
      const response=await request(`/reviews/${id}`);
      assert.equal(response.status,200);
      if(response.body.status === "completed") return response.body;
      assert.notEqual(response.body.status,"failed",response.body.error);
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    throw new Error("Review completion timed out");
  }
  function checkFindings(review:Review) {
    assert.equal(review.findings.length,4);
    assert.equal(review.analysisVersion,ANALYSIS_VERSION);
    for(const finding of review.findings) {
      assert.equal(finding.file,"BuggyDijkstra.java");
      assert.equal(finding.evidence,source.split(/\r?\n/)[finding.startLine-1]);
    }
  }
  try {
    const health=await request("/health");assert.equal(health.body.analysisVersion,ANALYSIS_VERSION);
    const account=await request("/auth/register","POST",{name:"Review QA",email:"pipeline@example.test",password:"pipeline-password-123"});
    assert.equal(account.status,201);token=account.body.token;
    const staticSubmission=await request("/reviews","POST",{name:"Exact Dijkstra source",files:[{path:"BuggyDijkstra.java",content:source}],ai:false});
    assert.equal(staticSubmission.status,202);
    const staticReview=await completed(staticSubmission.body.id);checkFindings(staticReview);
    assert.equal(staticReview.score,66);assert.equal(aiCalls,0);
    const aiSubmission=await request("/reviews","POST",{name:"AI failure fallback",files:[{path:"BuggyDijkstra.java",content:source}],ai:true});
    const aiReview=await completed(aiSubmission.body.id);checkFindings(aiReview);
    assert.equal(aiCalls,1);assert.equal(aiReview.aiStatus,"failed");assert.equal(aiReview.score,undefined);
    assert.match(aiReview.logs.join("\n"),/Deterministic results retained/);
    const stored=await store.get("reviews",aiReview.id);assert.ok(stored);
    stored.findings=[];stored.analysisVersion="java-traversal-v1";stored.score=100;await store.put("reviews",stored);
    assert.equal(displayedReviewScore(stored),undefined,"legacy failed AI reviews must hide saved 100/100");
    const rerun=await request(`/reviews/${aiReview.id}/rerun`,"POST",{ai:false});
    assert.equal(rerun.status,202);assert.notEqual(rerun.body.id,aiReview.id);
    const refreshed=await completed(rerun.body.id);checkFindings(refreshed);assert.equal(refreshed.score,66);
    assert.equal((await request(`/reviews/${aiReview.id}`)).body.findings.length,0,"original history is retained");
    const analytics=await request("/analytics");assert.equal(analytics.body.score,66);assert.equal(analytics.body.excludedScores,1);
    assert.equal(analytics.body.trends.length,2);
    partialMode = true;
    const partialSubmission = await request("/reviews", "POST", {name:"Partial provider coverage",files:[{path:"BuggyDijkstra.java",content:source}],ai:true});
    const partialReview = await completed(partialSubmission.body.id);
    checkFindings(partialReview);
    assert.equal(partialReview.aiStatus, "partial");
    assert.equal(partialReview.score, undefined);
    assert.equal(partialReview.aiCoverage?.completed, 1);
    assert.equal((await request(`/reviews/${aiReview.id}/rerun`,"POST",{ai:false},"invalid")).status,401);
    const other=await request("/auth/register","POST",{name:"Other user",email:"other-pipeline@example.test",password:"pipeline-password-456"});
    assert.equal((await request(`/reviews/${aiReview.id}/rerun`,"POST",{},other.body.token)).status,404);
  } finally {
    await closeQueue(); await new Promise<void>(resolve=>server.close(()=>resolve()));
    await fs.rm(directory,{recursive:true,force:true});
  }
});

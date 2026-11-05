import test from "node:test";
import assert from "node:assert/strict";
import { aiFailureMessage } from "../server/ai-errors.js";

test("AI failures give actionable reasons without leaking provider details", () => {
  assert.match(aiFailureMessage({statusCode:429}), /quota/);
  assert.match(aiFailureMessage({cause:{statusCode:403}}), /credentials/);
  assert.match(aiFailureMessage({statusCode:404}), /model/);
  assert.match(aiFailureMessage({name:"TimeoutError"}), /timed out/);
  assert.match(aiFailureMessage({statusCode:503}), /temporarily/);
  assert.doesNotMatch(aiFailureMessage(new Error("secret-api-key")), /secret-api-key/);
});

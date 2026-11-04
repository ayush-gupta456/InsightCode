import "dotenv/config";
import fs from "node:fs/promises";
import { analyze } from "../server/analysis.js";
import { enrich } from "../server/ai.js";
// Explicitly opt-in: sends only the public regression fixture to the configured AI provider.
if (process.env.RUN_LIVE_AI !== "1") throw new Error("Set RUN_LIVE_AI=1 to run the live provider check.");
const files = [{path:"LinkedListCycle.java",content:await fs.readFile(new URL("../tests/fixtures/LinkedListCycle.java",import.meta.url),"utf8")}];
const result = await enrich(files,analyze(files));
await fs.mkdir("test-results",{recursive:true});
await fs.writeFile("test-results/java-ai-assessment.md",result.assessment);
console.log(JSON.stringify({findings:result.findings.map(f=>({title:f.title,line:f.startLine,engine:f.engine})),rejected:result.rejected,assessmentCharacters:result.assessment.length}));

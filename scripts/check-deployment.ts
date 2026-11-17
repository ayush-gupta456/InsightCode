import { ANALYSIS_VERSION } from "../shared/review-metadata.js";

const base = new URL(process.argv[2] || "https://insightcode.vercel.app");
if (base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
  throw new Error("Deployment checks require HTTPS outside localhost");
}
const healthUrl = new URL("/api/health", base);
try {
  const response = await fetch(healthUrl, {signal:AbortSignal.timeout(20_000), cache:"no-store"});
  if (!response.ok) throw new Error(`Health request failed (${response.status})`);
  const health = await response.json() as {analysisVersion?:string;revision?:string;aiConfigured?:boolean};
  const current = health.analysisVersion === ANALYSIS_VERSION;
  console.log(JSON.stringify({url:healthUrl.href,expectedAnalyzer:ANALYSIS_VERSION,
    deployedAnalyzer:health.analysisVersion ?? "unknown",revision:health.revision ?? "unknown",
    aiConfigured:health.aiConfigured === true,current},null,2));
  if (!current) { console.error("Backend analyzer is outdated. Deploy the latest main commit on the API host; redeploying the frontend alone does not update analysis."); process.exitCode=1; }
} catch(error) { console.error(error instanceof Error ? error.message : "Deployment verification failed");process.exitCode=1; }

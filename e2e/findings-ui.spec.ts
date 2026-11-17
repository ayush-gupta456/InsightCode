import {test,expect} from "@playwright/test";
import fs from "node:fs/promises";
import {analyze} from "../server/analysis";
import {ANALYSIS_VERSION} from "../shared/review-metadata";
const content=await fs.readFile(new URL("../tests/fixtures/BuggyDijkstraOriginal.java",import.meta.url),"utf8");

test("findings UI renders actual analyzer output and hides legacy perfect scores after AI failure",async({page})=>{
  const findings=analyze([{path:"BuggyDijkstra.java",content}]);
  expect(findings).toHaveLength(4);
  let oldBackend=false;
  let reruns=0;
  const review={id:"qa",ownerId:"qa",name:"Dijkstra review",files:[{path:"BuggyDijkstra.java",content}],source:"upload",revision:0,status:"completed",findings,score:100,ai:true,aiStatus:"failed",analysisVersion:ANALYSIS_VERSION,createdAt:new Date().toISOString(),logs:["AI unavailable; static findings retained"]};
  await page.route("**/*",async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==new URL(test.info().project.use.baseURL as string).origin) return route.abort();
    if(url.pathname.startsWith("/socket.io")) return route.abort();
    if(!url.pathname.startsWith("/api/")) return route.continue();
    if(url.pathname.endsWith("/rerun")){reruns++;return route.fulfill({status:202,json:{...review,id:"qa-rerun"}});}
    const data=url.pathname==="/api/auth/refresh"?{token:"qa",user:{id:"qa",name:"QA",email:"qa@example.test",role:"member"}}:
      url.pathname==="/api/health"?{status:"ok",analysisVersion:oldBackend?"java-traversal-v1":ANALYSIS_VERSION}:
      /\/api\/reviews\/qa(?:-rerun)?$/.test(url.pathname)?review:
      url.pathname.endsWith("/index")?[]:[];
    return route.fulfill({json:data});
  });
  await page.goto("/app/reviews/qa");
  await expect(page.locator('.finding-card')).toHaveCount(4);
  await expect(page.locator('.review-coverage')).toContainText("AI analysis failed");
  await expect(page.locator('.findings-summary')).toContainText("Unscored");
  await expect(page.locator('.findings-summary')).not.toContainText("100");
  await page.getByRole("heading",{name:"Shortest-path source distance must start at zero",exact:true}).click();
  await expect(page.locator('.finding-detail')).toContainText("single vertex");
  await page.getByLabel("Filter severity").selectOption("high");
  await expect(page.locator('.finding-card')).toHaveCount(3);
  await page.getByLabel("Filter severity").selectOption("all");
  await expect(page.locator('.finding-card')).toHaveCount(4);
  await page.getByRole("button",{name:"Run review again",exact:true}).click();
  await expect(page).toHaveURL(/qa-rerun/);expect(reruns).toBe(1);
  oldBackend=true;await page.reload();
  await expect(page.getByRole("alert")).toContainText("Deploy the updated API");
  await expect(page.getByRole("button",{name:"Run review again",exact:true})).toBeDisabled();
});

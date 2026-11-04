import { test, expect } from "@playwright/test";
test("long assistant responses remain readable with composer, expansion and download", async ({page}) => {
  const review={id:"qa",ownerId:"qa",name:"Java traversal review",source:"upload",files:[{path:"Cycle.java",content:"class Cycle { static void run() {} }"}],findings:[],status:"completed",logs:["Static analysis completed"],createdAt:new Date().toISOString(),ai:false,revision:0,score:100};
  const content=Array.from({length:30},(_,i)=>`## Finding ${i+1}\n\nA detailed explanation of traversal behavior and a correction.\n\n\`\`\`java\nwhile (fast != null && fast.next != null) { fast = fast.next.next; }\n\`\`\`\n`).join('\n')+'\n| Operation | Time | Space |\n|---|---|---|\n| Detection | O(n) | O(1) |\n\nEND OF COMPLETE RESPONSE';
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path==='/api/auth/refresh'?{token:'qa-token',user:{id:'qa',name:'Reader QA',email:'qa@example.test',role:'member'}}:
      path==='/api/reviews/qa'?review:path.endsWith('/messages')?[{id:'message',role:'assistant',content}]:path.endsWith('/index')?[]:[];
    await route.fulfill({json:data});
  });
  await page.route('**/socket.io/**',route=>route.abort());
  await page.goto('/app/reviews/qa',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Assistant',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Finding 1',exact:true})).toBeVisible();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    const metrics=await page.locator('.messages').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight}));
    expect(metrics.height).toBeGreaterThan(100);
    expect(metrics.scroll).toBeGreaterThan(metrics.height);
    await page.locator('.messages').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    await expect(page.getByText('END OF COMPLETE RESPONSE',{exact:true})).toBeVisible();
    const composer=await page.locator('.chat-input').boundingBox();
    const pane=await page.locator('.assistant-pane').boundingBox();
    expect(composer!.y+composer!.height).toBeLessThanOrEqual(pane!.y+pane!.height+2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.getByRole('button',{name:'Expand response'}).click();
  await expect(page.getByRole('button',{name:'Close expanded view'})).toBeVisible();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download full response'}).click();
  expect((await download).suggestedFilename()).toBe('insightcode-response.md');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Expand response'})).toBeVisible();
});

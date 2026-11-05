import {test, expect} from '@playwright/test';

test('review deletion requires confirmation and recovers from errors', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('theme','light'));
  let deleted=false, fail=true, attempts=0;
  const review={id:'delete-qa',ownerId:'qa',name:'Cycle.java',fileCount:1,source:'upload',status:'completed',findings:[],score:100,createdAt:new Date().toISOString(),ai:false,revision:0};
  await page.route('**/api/**', async route=>{
    const path=new URL(route.request().url()).pathname;
    if(route.request().method()==='DELETE') {
      attempts++;
      if(fail) return route.fulfill({status:409,json:{error:'Wait for the review to finish before deleting it'}});
      deleted=true; return route.fulfill({json:{deleted:true}});
    }
    return route.fulfill({json:path==='/api/auth/refresh'?{token:'qa',user:{id:'qa',name:'Reviewer',email:'qa@example.test',role:'member'}}:path==='/api/reviews'?(deleted?[]:[review]):path==='/api/analytics'?{reviews:1,findings:0,security:0,score:100,trends:[]}:[]});
  });
  await page.route('**/socket.io/**',route=>route.abort());
  await page.goto('/app',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('button',{name:'Delete Cycle.java'})).toBeVisible();
  await page.screenshot({path:'test-results/dashboard-light.png',fullPage:true});
  await page.getByRole('button',{name:'Delete Cycle.java'}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(attempts).toBe(0);
  await page.getByRole('button',{name:'Delete Cycle.java'}).click();
  await page.getByRole('button',{name:'Delete review',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Wait for the review');
  fail=false;
  await page.getByRole('button',{name:'Delete review',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Delete Cycle.java'})).toHaveCount(0);
  expect(attempts).toBe(2);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/history',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Review history'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

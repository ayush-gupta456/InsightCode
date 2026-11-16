import {test,expect} from '@playwright/test';
test('workspace and public pages fit phone tablet and desktop with accessible navigation',async({page})=>{
 await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;if(p==='/api/auth/refresh'&&!new URL(page.url()).pathname.startsWith('/app'))return route.fulfill({status:401,json:{error:'Sign in'}});return route.fulfill({json:p==='/api/auth/refresh'?{token:'qa',user:{id:'qa',name:'Responsive QA',email:'qa@example.test',role:'member'}}:p==='/api/auth/config'?{google:true,passwordReset:true}:p==='/api/capabilities'?{analyzers:[],persistence:'test',queue:'test'}:p==='/api/analytics'?{}:[]});});
 await page.route('**/socket.io/**',r=>r.abort());
 for(const width of [320,390,625,768,955,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  for(const url of ['/','/login','/register','/forgot-password','/app','/app/history','/app/projects','/app/new','/app/settings']){
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await expect(page.locator(url.startsWith('/app')?'.page':url==='/'?'.landing':'.auth-card')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${url} at ${width}`).toBe(true);
  }
  if(width<760){
   await page.getByRole('button',{name:'Toggle sidebar'}).click();
   const menu=page.getByRole('navigation',{name:'Workspace pages'});
   await expect(menu).toBeVisible();
   await menu.getByRole('link',{name:'Review history'}).click();
   await expect(page).toHaveURL(/history/);
   await expect(menu).not.toBeVisible();
   await page.screenshot({path:`test-results/responsive-${width}.png`,fullPage:true});
  }
 }
});



test('branded 404 offers recovery and session loading respects reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('**/api/auth/refresh',route=>route.fulfill({status:401,json:{error:'Sign in'}}));
 await page.goto('/a-page-that-does-not-exist');
 await expect(page.getByRole('heading',{name:'This path needs a new direction.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Back to home'})).toHaveAttribute('href','/');
 await expect(page.getByRole('button',{name:'Reload page'})).toHaveCount(0);
 await page.unroute('**/api/auth/refresh');
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/auth/refresh',async route=>{await gate;await route.fulfill({status:401,json:{error:'Sign in'}});});
 try {
  await page.goto('/app',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('status')).toContainText('Opening your workspace');
  await expect(page.locator('.status-orbit')).toHaveCSS('animation-name','none');
 } finally { release(); }
 await expect(page).toHaveURL(/login/);
});

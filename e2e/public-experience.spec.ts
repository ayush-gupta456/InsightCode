import {test,expect} from '@playwright/test';

test('public themes persist and recovery works on mobile with reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/api/**',route=>{const p=new URL(route.request().url()).pathname;return route.fulfill({status:p==='/api/auth/refresh'?401:200,json:p==='/api/auth/config'?{google:false,passwordReset:true}:p==='/api/auth/forgot-password'?{ok:true}:{error:'Sign in'}})});
  await page.goto('/',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Light theme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.getByRole('link',{name:'Sign in',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.getByRole('button',{name:/Continue with Google/})).toBeDisabled();
  await page.screenshot({path:'test-results/signin-light.png',fullPage:true});
  await page.getByRole('button',{name:'Dark theme',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.locator('.auth-card')).toHaveCSS('opacity','1');
  await page.screenshot({path:'test-results/signin-dark.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('link',{name:'Forgot password?'}).click();
  await page.getByLabel('Email address').fill('test@example.test');
  await page.getByRole('button',{name:'Send reset link'}).click();
  await expect(page.getByRole('status')).toContainText('If an account exists');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goto('/reset-password#token='+'a'.repeat(64),{waitUntil:'domcontentloaded'});
  await page.getByLabel('New password',{exact:true}).fill('new-password-123');
  await page.getByLabel('Confirm password',{exact:true}).fill('different-password-123');
  await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match');
  await page.getByLabel('Confirm password',{exact:true}).fill('new-password-123');
  await page.getByRole('button',{name:'Reset password',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('password has been updated');
});


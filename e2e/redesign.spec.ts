import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/refresh', route => route.fulfill({status:401,json:{error:'Sign in'}}));
});

test('example review supports keyboard navigation and mobile menu focus restoration', async ({page}) => {
  await page.goto('/');
  const source = page.getByRole('tab', {name:'Source', exact:true});
  await source.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', {name:'Finding',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel')).toContainText('Check the response');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', {name:'Proposed patch'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('tabpanel')).toContainText('response.ok');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Open navigation'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Open navigation'})).toBeFocused();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('link',{name:'Start your first review'}).focus();
  await expect(page.locator('.marketing-cta .icon-arrow svg')).toHaveCSS('transform','none');
});

test('landing fits both themes, narrow screens and wide monitors', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  for (const theme of ['Light','Dark']) {
    await page.getByRole('button',{name:`${theme} theme`,exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme',theme.toLowerCase());
    for (const width of [320,390,625,768,955,1440,1920]) {
      await page.setViewportSize({width,height:900});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme} theme at ${width}`).toBe(true);
      if([390,1440].includes(width)) await page.screenshot({path:`test-results/landing-${theme.toLowerCase()}-${width}.png`,fullPage:true});
    }
  }
});

// Intercept every request so the production-shaped build exercises only local fixtures.
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'https://getcyb.fit') return route.abort();
    if (url.pathname.startsWith('/api/')) {
      const published = {published:true, business:{slug:'demo'}, website:{brandName:'Demo',pages:[{slug:'',title:'Home',sections:[],seoTitle:'Merchant headline'}]}};
      const json = url.pathname.includes('/websites/public/') ? published : url.pathname.includes('products') ? [] : {};
      return route.fulfill({json});
    }
    const file = url.pathname.startsWith('/assets/') ? url.pathname : url.pathname === '/about' ? '/about/index.html' : '/app-shell.html';
    const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
    return route.fulfill({body:await readFile('dist'+file),contentType});
  });
  await page.goto('https://getcyb.fit/about?utm_source=test');
  await page.getByRole('heading',{level:1}).waitFor();
  assert.equal(await page.title(),'About CYB');
  await page.locator('nav').getByText('Contact').click();
  await page.waitForFunction(() => document.title === 'Contact CYB Support');
  await page.locator('nav').getByText('Log in').click();
  await page.waitForFunction(() => document.querySelector('meta[name=robots]').content.includes('noindex'));
  assert.equal(await page.locator('link[rel=canonical]').count(),0);
  await page.goto('https://getcyb.fit/store/demo');
  await page.waitForFunction(() => document.title === 'Merchant headline');
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'index, follow');
} finally {
  await browser.close();
}

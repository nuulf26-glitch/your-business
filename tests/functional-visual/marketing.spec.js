import { expect, test } from '@playwright/test';

const user = { id: 'marketing-preview-owner', email: 'owner@example.test', emailVerified: true, role: 'owner', paid: true };
const business = { id: 'marketing-preview-business', name: 'Atelier Preview', storeUrl: 'atelier-preview', slug: 'atelier-preview' };

async function mockMarketingApi(page) {
  const calls = [];
  let contacts = [];
  let campaigns = [];
  let settings = { unsubscribedRetentionDays: 365 };
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();
    const input = request.postDataJSON?.() || {};
    calls.push({ path, method, input, businessId: request.headers()['x-cyb-business-id'] || '' });
    let body = {};
    if (path === '/auth/me') body = user;
    else if (path === '/businesses/mine/stores') body = [business];
    else if (path === '/marketing/contacts' && method === 'GET') body = contacts;
    else if (path === '/marketing/contacts' && method === 'POST') {
      const data = input.data || {};
      const created = { id: `contact-${contacts.length + 1}`, name: data.name, email: data.email, consentStatus: 'subscribed', consentAt: new Date().toISOString(), consentSource: data.consentSource, businessSlug: 'atelier-preview', unsubscribeToken: 'synthetic-token' };
      contacts = [created, ...contacts]; body = created;
    }
    else if (path === '/marketing/campaigns' && method === 'GET') body = campaigns;
    else if (path === '/marketing/campaigns' && method === 'POST') {
      const data = input.data || {};
      const created = { id: `campaign-${campaigns.length + 1}`, ...data, status: 'draft' };
      campaigns = [created, ...campaigns]; body = created;
    }
    else if (path === '/marketing/settings' && method === 'GET') body = settings;
    else if (path === '/marketing/settings' && method === 'PATCH') { settings = input.data; body = settings; }
    else if (path === '/auth/logout') body = { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return calls;
}

test('marketing consent controls work and the workspace stays within responsive viewports', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cyb_active_business_id', 'marketing-preview-business'));
  const calls = await mockMarketingApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/marketing');
  await expect(page.getByRole('heading', { name: 'Marketing', level: 1 })).toBeVisible();

  const consent = page.getByLabel('This person explicitly agreed to receive marketing.');
  await expect(page.getByRole('button', { name: 'Save opted-in contact' })).toBeDisabled();
  await page.getByLabel('Email', { exact: true }).fill('ari@example.test');
  await page.getByLabel('Where was consent collected?').fill('Website newsletter form');
  await consent.check();
  await page.getByRole('button', { name: 'Save opted-in contact' }).click();
  await expect(page.getByText('Contact saved with recorded opt-in.')).toBeVisible();
  await expect(page.getByText('ari@example.test')).toBeVisible();
  expect(calls.some(call => call.path === '/marketing/contacts' && call.method === 'POST' && call.input.data.consented === true && call.businessId === business.id)).toBeTruthy();

  await page.getByRole('button', { name: 'Campaign drafts' }).click();
  await page.getByLabel('Campaign name').fill('Spring');
  await page.getByLabel('Subject').fill('A note');
  await page.getByLabel('Message').fill('Hello {{unsubscribe_url}}');
  await page.getByRole('button', { name: 'Save campaign draft' }).click();
  await expect(page.getByText('Campaign saved as a draft. No message has been sent.')).toBeVisible();

  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
    await expect(page.getByRole('heading', { name: 'Marketing', level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  }
});

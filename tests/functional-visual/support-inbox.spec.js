import { expect, test } from '@playwright/test';

const user = { id: 'visual-owner', email: 'owner@example.test', role: 'OWNER', paid: true, emailVerified: true };
const business = { id: 'visual-business', name: 'Atelier Preview', slug: 'atelier-preview', category: 'salon', published: true };
const initialTicket = {
  id: 'ticket-1', subject: 'Order question', customerName: 'Synthetic Customer', email: 'customer@example.test', status: 'open', channel: 'website',
  requiresHuman: true, assignedToUserId: null, createdAt: '2026-11-20T10:00:00.000Z', updatedAt: '2026-11-20T10:00:00.000Z', lastMessageAt: '2026-11-20T10:00:00.000Z',
  messages: [{ id: 'message-1', kind: 'customer_message', body: 'I need a person to help with my order.', at: '2026-11-20T10:00:00.000Z' }],
};

async function prepare(page) {
  const calls = [];
  let ticket = structuredClone(initialTicket);
  await page.addInitScript(({ value }) => sessionStorage.setItem('getcyb_session_user', JSON.stringify(value)), { value: user });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, '');
    const body = request.postDataJSON?.() || {};
    calls.push({ method: request.method(), pathname, body, businessId: request.headers()['x-cyb-business-id'] || '' });
    let result = {};
    if (pathname === '/auth/me') result = user;
    else if (pathname === '/auth/logout') result = { ok: true };
    else if (pathname === '/businesses/mine/stores') result = [business];
    else if (pathname === '/support/inbox' && request.method() === 'GET') result = [{ ...ticket, messages: undefined }];
    else if (pathname === '/support/inbox/ticket-1' && request.method() === 'GET') result = ticket;
    else if (pathname === '/support/inbox/ticket-1' && request.method() === 'PATCH') {
      ticket = { ...ticket, ...body.data, status: body.data.status || ticket.status, assignedToUserId: body.data.assignToMe ? user.id : (body.data.assignedToUserId ?? ticket.assignedToUserId), updatedAt: new Date().toISOString() };
      result = { id: ticket.id, status: ticket.status, requiresHuman: ticket.requiresHuman, assignedToUserId: ticket.assignedToUserId };
    } else if (pathname === '/support/inbox/ticket-1/notes' && request.method() === 'POST') {
      ticket = { ...ticket, messages: [...ticket.messages, { id: 'private-note', kind: 'internal_note', body: body.data.note, authorId: user.id, at: new Date().toISOString() }] };
      result = { id: ticket.id };
    } else if (pathname === '/public/support' && request.method() === 'POST') result = { id: 'ticket-2', duplicate: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  return calls;
}

test('owner can triage website requests, assign to self, save private notes, and view human handoff responsively', async ({ page }) => {
  const calls = await prepare(page);
  await page.goto('/support/inbox');
  await expect(page.getByRole('heading', { name: 'Support inbox' })).toBeVisible();
  await page.getByRole('button', { name: /Order question/ }).click();
  await expect(page.getByText('I need a person to help with my order.')).toBeVisible();
  await page.getByRole('button', { name: 'Assign to me' }).click();
  await expect(page.getByRole('button', { name: 'Unassign from me' })).toBeVisible();
  await page.getByLabel('Conversation status').selectOption('in_progress');
  await page.getByLabel('Private note').fill('Check the shipment history before replying.');
  await page.getByRole('button', { name: 'Add private note' }).click();
  await expect(page.getByText('Check the shipment history before replying.')).toBeVisible();
  expect(calls.some(call => call.pathname === '/support/inbox' && call.businessId === business.id)).toBeTruthy();
  expect(calls.some(call => call.pathname === '/support/inbox/ticket-1/notes' && call.method === 'POST')).toBeTruthy();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Support inbox overflow at ${viewport.width}px`).toBeTruthy();
  }
});

test('customer support intake stores a request through the published business route', async ({ page }) => {
  const calls = await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/support/atelier-preview');
  await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible();
  await page.getByLabel('Your name').fill('Synthetic Customer');
  await page.getByLabel('Email address').fill('customer@example.test');
  await page.getByLabel('Subject').fill('A website question');
  await page.getByLabel('Message').fill('Please have the support team review my question.');
  await page.getByLabel('Please have a person review this request').check();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('status')).toContainText('Your request was sent.');
  const submission = calls.find(call => call.pathname === '/public/support')?.body.data;
  expect(submission?.requestId).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  expect(submission).toMatchObject({ storeUrl: 'atelier-preview', email: 'customer@example.test', needsHuman: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
});

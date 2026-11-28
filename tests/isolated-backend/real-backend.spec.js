import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';

const artifactsDir = 'artifacts/isolated-backend/screenshots';
fs.mkdirSync(artifactsDir, { recursive: true });

async function requestFromPage(page, path, method = 'GET', data, businessId) {
  const result = await page.evaluate(async ({ path, method, data, businessId }) => {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(businessId ? { 'x-cyb-business-id': businessId } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, { path, method, data, businessId });
  expect(result.status, `${method} ${path} returned ${JSON.stringify(result.body)}`).toBeLessThan(400);
  return result.body;
}

async function requestStatusFromPage(page, path, businessId) {
  return page.evaluate(async ({ path, businessId }) => {
    const response = await fetch(`/api/v1${path}`, { credentials: 'include', headers: businessId ? { 'x-cyb-business-id': businessId } : {} });
    return response.status;
  }, { path, businessId });
}

async function checkNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content, `${label} horizontal overflow: ${JSON.stringify(dimensions)}`)
    .toBeLessThanOrEqual(dimensions.viewport + 2);
}

async function waitForSettledScreen(page, label) {
  await expect.poll(async () => {
    const text = (await page.locator('#root').innerText()).trim();
    return text.length > 20 && !text.includes('Loading CYB…') && !text.includes('Loading...');
  }, { timeout: 30_000, message: `${label} should finish rendering before screenshot capture` }).toBe(true);
}

test('real auth, editor persistence, catalog, COD checkout, and mobile views use isolated API', async ({ page, context }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const slug = process.env.E2E_STORE_SLUG;
  expect(email).toBeTruthy();
  expect(password).toBeTruthy();
  expect(slug).toBeTruthy();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/login');
  await page.locator('#loginEmail').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard(?:$|\?)/);
  await expect(page.locator('body')).not.toContainText('Page Not Found');
  await waitForSettledScreen(page, 'dashboard desktop');
  await checkNoHorizontalOverflow(page, 'dashboard desktop');
  await page.screenshot({ path: `${artifactsDir}/dashboard-1440x900.png`, fullPage: true });

  const auth = await requestFromPage(page, '/auth/me');
  expect(auth.email).toBe(email);
  const secondTab = await context.newPage();
  await secondTab.setViewportSize({ width: 390, height: 844 });
  await secondTab.goto('/dashboard');
  await expect(secondTab).toHaveURL(/\/dashboard(?:$|\?)/);
  await waitForSettledScreen(secondTab, 'dashboard second tab');
  const secondTabAuth = await requestFromPage(secondTab, '/auth/me');
  expect(secondTabAuth.id).toBe(auth.id);
  await checkNoHorizontalOverflow(secondTab, 'dashboard mobile');
  await secondTab.screenshot({ path: `${artifactsDir}/dashboard-390x844.png`, fullPage: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/dashboard');
  await waitForSettledScreen(page, 'dashboard tablet');
  await checkNoHorizontalOverflow(page, 'dashboard tablet');
  await page.screenshot({ path: `${artifactsDir}/dashboard-768x1024.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  await waitForSettledScreen(page, 'dashboard narrow mobile');
  await checkNoHorizontalOverflow(page, 'dashboard narrow mobile');
  await page.screenshot({ path: `${artifactsDir}/dashboard-375x812.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  const routes = [
    ['/editor', 'editor'],
    ['/products', 'products'],
    ['/orders', 'orders'],
    ['/customers', 'customers'],
    ['/settings', 'settings'],
  ];
  for (const [route, label] of routes) {
    await page.goto(route);
    await waitForSettledScreen(page, label);
    await expect(page.locator('body'), `${label} route should remain authenticated`).not.toContainText('Page Not Found');
    await checkNoHorizontalOverflow(page, `${label} desktop`);
    await page.screenshot({ path: `${artifactsDir}/${label}-1440x900.png`, fullPage: true });
  }

  const model = {
    editorVersion: 2,
    brandName: 'Synthetic E2E Store',
    primaryColor: '#111111',
    backgroundColor: '#ffffff',
    textColor: '#111111',
    bodyFont: 'Inter',
    headingFont: 'Inter',
    sections: [
      { id: 'e2e-hero', type: 'hero', label: 'Hero', title: 'Synthetic test storefront', body: 'Isolated end-to-end test content.', buttonText: 'Shop now' },
      { id: 'e2e-about', type: 'about', label: 'About', title: 'About this test', body: 'No customer data or live service is used.' },
      { id: 'e2e-collection', type: 'collection', label: 'Collection', title: 'Test products', body: 'Synthetic test catalog.' },
      { id: 'e2e-footer', type: 'footer', label: 'Footer', title: 'Synthetic test store' },
    ],
  };
  const saved = await requestFromPage(page, '/websites/draft', 'PUT', { model });
  expect(saved.draft).toMatchObject({ brandName: model.brandName });
  const publishResult = await requestFromPage(page, '/websites/publish', 'POST', { model });
  expect(publishResult.published).toBe(true);
  expect(publishResult.slug).toBe(slug);
  const publicWebsite = await requestFromPage(page, `/websites/public/${encodeURIComponent(slug)}`);
  expect(publicWebsite.published).toBe(true);
  await page.goto(`/store/${encodeURIComponent(slug)}`);
  await expect(page.getByRole('heading', { name: 'Synthetic test storefront' })).toBeVisible();
  const updatedModel = { ...model, sections: model.sections.map((section) => section.id === 'e2e-hero' ? { ...section, title: 'Updated synthetic storefront headline' } : section) };
  await requestFromPage(page, '/websites/draft', 'PUT', { model: updatedModel });
  await requestFromPage(page, '/websites/publish', 'POST', { model: updatedModel });
  const updatedPublicWebsite = await requestFromPage(page, `/websites/public/${encodeURIComponent(slug)}`);
  expect(updatedPublicWebsite.website.sections.find((section) => section.id === 'e2e-hero').title).toBe('Updated synthetic storefront headline');
  await page.goto(`/store/${encodeURIComponent(slug)}`);
  await expect(page.getByRole('heading', { name: 'Updated synthetic storefront headline' })).toBeVisible();

  // Exercise appointment discovery and its complete owner-side lifecycle with
  // business-local hours. This runs only against the disposable CI database.
  const businessHours = Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { open: '09:00', close: '17:00' }]));
  await requestFromPage(page, '/businesses/mine/catalog', 'PUT', { data: {
    businessCategory: 'services', timeZone: 'Asia/Dubai', hours: businessHours, closures: [],
    services: [{ id: 'e2e-consult', name: 'Synthetic consultation', duration: 30, price: 0, active: true }],
    staff: [{ id: 'e2e-staff', name: 'Synthetic team member', active: true, serviceIds: ['e2e-consult'] }],
  } });
  const bookingDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 14 * 86400000));
  const availableSlots = await requestFromPage(page, '/public/bookings/options', 'POST', { data: { storeUrl: slug, date: bookingDate, serviceId: 'e2e-consult', kind: 'appointment' } });
  expect(availableSlots.length).toBeGreaterThan(0);
  const firstSlot = availableSlots[0];
  expect(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', hour: '2-digit', hourCycle: 'h23' }).format(new Date(firstSlot.start))).toBe('09');
  const booking = await requestFromPage(page, '/public/bookings', 'POST', { data: { storeUrl: slug, name: 'Synthetic booking visitor', email: `booking-${process.env.GITHUB_RUN_ID || 'local'}@example.test`, start: firstSlot.start, serviceId: 'e2e-consult', kind: 'appointment' } });
  expect(booking).toMatchObject({ status: 'confirmed', timeZone: 'Asia/Dubai', start: firstSlot.start });
  const rescheduleSlot = availableSlots.find((slot) => Date.parse(slot.start) >= Date.parse(firstSlot.start) + 2 * 60 * 60 * 1000);
  expect(rescheduleSlot).toBeTruthy();
  await requestFromPage(page, `/businesses/mine/records/${encodeURIComponent(booking.id)}/reschedule`, 'PATCH', { data: { start: rescheduleSlot.start } });
  expect((await requestFromPage(page, '/businesses/mine/records?type=bookings')).find((row) => row.id === booking.id).start).toBe(rescheduleSlot.start);
  await requestFromPage(page, `/businesses/mine/records/${encodeURIComponent(booking.id)}?type=bookings`, 'PATCH', { status: 'cancelled' });
  expect((await requestFromPage(page, '/businesses/mine/records?type=bookings')).find((row) => row.id === booking.id).status).toBe('cancelled');

  // Create, edit, publish, and read a CMS entry through its public API.
  const collection = await requestFromPage(page, '/cms/collections', 'POST', { data: { name: 'Synthetic journal', slug: 'synthetic-journal', fields: [{ key: 'summary', label: 'Summary', type: 'longText', required: true }], categories: [] } });
  const cmsEntry = await requestFromPage(page, `/cms/collections/${encodeURIComponent(collection.id)}/entries`, 'POST', { data: { slug: 'synthetic-entry', title: 'Synthetic CMS entry', content: { summary: 'Initial synthetic summary.' } } });
  await requestFromPage(page, `/cms/entries/${encodeURIComponent(cmsEntry.id)}`, 'PATCH', { data: { content: { summary: 'Updated synthetic summary.' } } });
  await requestFromPage(page, `/cms/entries/${encodeURIComponent(cmsEntry.id)}/publish`, 'POST', {});
  const publicCms = await requestFromPage(page, `/public/cms/${encodeURIComponent(slug)}/${encodeURIComponent(collection.slug)}?entry=${encodeURIComponent(cmsEntry.slug)}`);
  expect(publicCms.entries).toHaveLength(1);
  expect(publicCms.entries[0]).toMatchObject({ title: 'Synthetic CMS entry', content: { summary: 'Updated synthetic summary.' } });
  await page.goto(`/store/${encodeURIComponent(slug)}/content/${encodeURIComponent(collection.slug)}`);
  await expect(page.getByRole('heading', { name: 'Synthetic journal' })).toBeVisible();
  await expect(page.getByText('Synthetic CMS entry', { exact: true })).toBeVisible();
  await expect(page.getByText('Updated synthetic summary.', { exact: true })).toBeVisible();

  const product = await requestFromPage(page, '/products', 'POST', {
    data: { name: 'Synthetic E2E Product', description: 'Isolated test item', sellingPrice: 18, status: 'active', stock: 4, variants: [{ id: 'synthetic-small', name: 'Small', sku: 'E2E-SMALL', price: 18, stock: 4 }] },
  });
  expect(product.name).toBe('Synthetic E2E Product');
  const products = await requestFromPage(page, '/products');
  expect(products.some((item) => item.id === product.id)).toBe(true);

  // Use a separate browser context for a second isolated merchant account and
  // verify direct API access is denied in both directions.
  const merchantBContext = await page.context().browser().newContext();
  const merchantBPage = await merchantBContext.newPage();
  await merchantBPage.goto('/login');
  await merchantBPage.locator('#loginEmail').fill(process.env.E2E_SECOND_TEST_EMAIL);
  await merchantBPage.locator('input[autocomplete="current-password"]').fill(process.env.E2E_SECOND_TEST_PASSWORD);
  await merchantBPage.getByRole('button', { name: 'Log in' }).click();
  await expect(merchantBPage).toHaveURL(/\/dashboard(?:$|\?)/);
  const merchantBBusiness = await requestFromPage(merchantBPage, '/businesses/mine');
  const merchantBProduct = await requestFromPage(merchantBPage, '/products', 'POST', { data: { name: 'Synthetic Merchant B Product', sellingPrice: 9, status: 'active', stock: 2 } });
  expect(await requestStatusFromPage(merchantBPage, `/products/${encodeURIComponent(product.id)}`, merchantBBusiness.id)).toBe(404);
  expect(await requestStatusFromPage(page, `/products/${encodeURIComponent(merchantBProduct.id)}`, merchantBBusiness.id)).toBe(404);
  await merchantBContext.close();

  const stores = await requestFromPage(page, "/businesses/mine/stores");
  expect(stores.some((store) => store.slug === slug)).toBe(true);
  const secondStore = await requestFromPage(page, "/businesses/mine/stores", "POST", { name: "Synthetic Secondary Store", slug: `${slug}-secondary`, category: "general", settings: { storeName: "Synthetic Secondary Store", storeUrl: `${slug}-secondary` } });
  expect(secondStore.id).toBeTruthy();
  expect(secondStore.slug).toBe(`${slug}-secondary`);
  const secondStoreProducts = await requestFromPage(page, "/products", "GET", undefined, secondStore.id);
  expect(secondStoreProducts).toEqual([]);
  const firstStoreProducts = await requestFromPage(page, "/products");
  expect(firstStoreProducts.some((item) => item.id === product.id)).toBe(true);

  const crmLead = await requestFromPage(page, '/crm/leads', 'POST', { data: { name: 'Synthetic CRM Lead', email: `crm-${process.env.GITHUB_RUN_ID || 'local'}@example.test`, source: 'e2e' } });
  const sameEmailLead = await requestFromPage(page, '/crm/leads', 'POST', { data: { name: 'Duplicate CRM Lead', email: crmLead.email } });
  const concurrentConversions = await Promise.all([crmLead, sameEmailLead].map((lead) => requestFromPage(page, `/crm/leads/${encodeURIComponent(lead.id)}/convert`, 'POST', { data: {} })));
  expect(concurrentConversions[0].customerId).toBe(concurrentConversions[1].customerId);
  expect(concurrentConversions.filter((item) => item.created)).toHaveLength(1);
  const converted = concurrentConversions[0];
  const convertedAgain = await requestFromPage(page, `/crm/leads/${encodeURIComponent(crmLead.id)}/convert`, 'POST', { data: {} });
  expect(convertedAgain).toMatchObject({ customerId: converted.customerId, created: false });
  await requestFromPage(page, '/customers', 'POST', { data: { name: 'Zed CRM Customer', email: `sort-${process.env.GITHUB_RUN_ID || 'local'}@example.test` } });
  const firstCustomerPage = await requestFromPage(page, '/crm/customers?search=example.test&sort=name&direction=asc&page=1&pageSize=1');
  const secondCustomerPage = await requestFromPage(page, '/crm/customers?search=example.test&sort=name&direction=asc&page=2&pageSize=1');
  expect(firstCustomerPage.total).toBeGreaterThanOrEqual(2);
  expect(firstCustomerPage.items[0].id).not.toBe(secondCustomerPage.items[0].id);
  expect(firstCustomerPage.items[0].name.localeCompare(secondCustomerPage.items[0].name)).toBeLessThan(0);
  await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`, 'POST', { data: { kind: 'note', summary: 'Synthetic CRM timeline note' } });
  await requestFromPage(page, `/crm/customers/${encodeURIComponent(converted.customerId)}/tags`, 'POST', { data: { tags: ['vip', 'e2e'] } });
  await requestFromPage(page, `/customers/${encodeURIComponent(converted.customerId)}/status`, 'PATCH', { status: 'VIP' });
  await requestFromPage(page, `/customers/${encodeURIComponent(converted.customerId)}/notes`, 'PATCH', { data: { note: 'Synthetic customer change note' } });
  const timeline = await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`);
  expect(timeline.some((event) => event.kind === 'lead_converted')).toBe(true);
  expect(timeline.some((event) => event.summary === 'Synthetic CRM timeline note')).toBe(true);
  expect(timeline.some((event) => event.kind === 'customer_tags_changed')).toBe(true);
  expect(timeline.some((event) => event.kind === 'customer_status_changed')).toBe(true);
  expect(timeline.some((event) => event.kind === 'customer_notes_updated')).toBe(true);
  const filteredCustomers = await requestFromPage(page, `/crm/customers?search=${encodeURIComponent(crmLead.email)}&tag=vip&page=1&pageSize=10`);
  expect(filteredCustomers.items.map((item) => item.id)).toContain(converted.customerId);
  const savedList = await requestFromPage(page, '/crm/segments', 'POST', { data: { name: 'Synthetic VIPs', filters: { search: crmLead.email, tag: 'vip', minSpent: 0 } } });
  const appliedList = await requestFromPage(page, `/crm/segments/${encodeURIComponent(savedList.id)}/apply`, 'POST', { data: {} });
  expect(appliedList.filters).toMatchObject({ search: crmLead.email, tag: 'vip', minSpent: 0 });
  await requestFromPage(page, `/crm/segments/${encodeURIComponent(savedList.id)}`, 'PATCH', { data: { name: 'Synthetic VIP list', filters: { search: crmLead.email, tag: 'vip', minSpent: 0 } } });
  await page.goto('/crm');
  const persistedLists = await requestFromPage(page, '/crm/segments');
  expect(persistedLists.some((item) => item.id === savedList.id && item.name === 'Synthetic VIP list')).toBe(true);
  const csv = await page.evaluate(async ({ id }) => { const response = await fetch(`/api/v1/crm/export/customers?segmentId=${encodeURIComponent(id)}`, { credentials: 'include' }); return { status: response.status, text: await response.text() }; }, { id: savedList.id });
  expect(csv.status).toBe(200);
  expect(csv.text).toContain(crmLead.email);
  expect(csv.text).toContain('vip');
  await requestFromPage(page, `/crm/segments/${encodeURIComponent(savedList.id)}`, 'DELETE');
  const foreignSegmentResponse = await page.evaluate(async ({ id, businessId }) => { const response = await fetch(`/api/v1/crm/segments/${encodeURIComponent(id)}/apply`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-cyb-business-id': businessId }, body: JSON.stringify({ data: {} }) }); return response.status; }, { id: savedList.id, businessId: secondStore.id });
  expect(foreignSegmentResponse).toBe(404);
  const crmDeal = await requestFromPage(page, '/crm/deals', 'POST', { data: { title: 'Synthetic CRM deal', amount: 125, stage: 'Qualification', customerId: converted.customerId } });
  await requestFromPage(page, `/crm/deals/${encodeURIComponent(crmDeal.id)}`, 'PATCH', { data: { stage: 'Proposal', amount: 175 } });
  const dealTimeline = await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`);
  expect(dealTimeline.some((event) => event.kind === 'deal_stage_changed')).toBe(true);
  const unsafeDelete = await page.evaluate(async () => { const response = await fetch('/api/v1/crm/pipeline/stages', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { stages: ['Qualification', 'Negotiation', 'Won'] } }) }); return response.status; });
  expect(unsafeDelete).toBe(400);
  await requestFromPage(page, `/crm/pipeline/stages`, 'PATCH', { data: { stages: ['Qualification', 'Review', 'Negotiation', 'Won'], renames: { Proposal: 'Review' } } });
  expect((await requestFromPage(page, '/crm/deals')).find((item) => item.id === crmDeal.id).stage).toBe('Review');
  const renamedDealTimeline = await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`);
  expect(renamedDealTimeline.some((event) => event.kind === 'deal_stage_changed' && event.summary === 'Deal moved to Review')).toBe(true);
  const unsafeCustomDelete = await page.evaluate(async () => { const response = await fetch('/api/v1/crm/pipeline/stages', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { stages: ['Qualification', 'Negotiation', 'Won'] } }) }); return response.status; });
  expect(unsafeCustomDelete).toBe(400);
  await requestFromPage(page, `/crm/deals/${encodeURIComponent(crmDeal.id)}`, 'PATCH', { data: { stage: 'Qualification' } });
  await requestFromPage(page, '/crm/pipeline/stages', 'PATCH', { data: { stages: ['Qualification', 'Negotiation', 'Won'] } });
  expect((await requestFromPage(page, '/crm/pipeline/stages')).includes('Review')).toBe(false);
  const crmTask = await requestFromPage(page, '/crm/tasks', 'POST', { data: { title: 'Synthetic due follow-up', customerId: converted.customerId, dueAt: '2026-01-01T00:00:00.000Z', reminderAt: '2026-01-01T00:00:00.000Z', priority: 'urgent' } });
  const reminders = await requestFromPage(page, '/crm/reminders');
  expect(reminders.filter((item) => item.taskId === crmTask.id)).toHaveLength(1);
  expect((await requestFromPage(page, '/crm/reminders')).filter((item) => item.taskId === crmTask.id)).toHaveLength(1);
  const reminderId = reminders.find((item) => item.taskId === crmTask.id).id;
  await requestFromPage(page, `/crm/reminders/${encodeURIComponent(reminderId)}`, 'PATCH', { data: { status: 'read' } });
  expect((await requestFromPage(page, '/crm/reminders')).find((item) => item.id === reminderId).status).toBe('read');
  await requestFromPage(page, `/crm/reminders/${encodeURIComponent(reminderId)}`, 'PATCH', { data: { status: 'unread' } });
  expect((await requestFromPage(page, '/crm/reminders')).find((item) => item.id === reminderId).status).toBe('unread');
  await requestFromPage(page, `/crm/reminders/${encodeURIComponent(reminderId)}`, 'PATCH', { data: { status: 'dismissed' } });
  expect((await requestFromPage(page, '/crm/reminders')).some((item) => item.id === reminderId)).toBe(false);
  await requestFromPage(page, `/crm/tasks/${encodeURIComponent(crmTask.id)}`, 'PATCH', { data: { status: 'completed' } });
  const completedTaskTimeline = await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`);
  expect(completedTaskTimeline.some((event) => event.kind === 'task_completed')).toBe(true);
  const foreignLeadResponse = await page.evaluate(async ({ id, businessId }) => { const response = await fetch(`/api/v1/crm/leads/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-cyb-business-id': businessId }, body: JSON.stringify({ data: { status: 'lost' } }) }); return response.status; }, { id: crmLead.id, businessId: secondStore.id });
  expect(foreignLeadResponse).toBe(404);

  await page.goto(`/store/${encodeURIComponent(slug)}`);
  await expect(page.getByText('Synthetic E2E Product', { exact: false }).first()).toBeVisible();
  await checkNoHorizontalOverflow(page, 'storefront desktop');
  await page.screenshot({ path: `${artifactsDir}/storefront-1440x900.png`, fullPage: true });

  await page.goto(`/product/${encodeURIComponent(product.id)}`);
  await expect(page.getByRole('heading', { name: 'Synthetic E2E Product' })).toBeVisible();
  await page.locator('.product-variant-select select').selectOption('synthetic-small');
  await expect(page.getByText('18.00', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  const selectedCart = await page.evaluate(() => JSON.parse(localStorage.getItem('businessCart') || '[]'));
  expect(selectedCart).toContainEqual(expect.objectContaining({ productId: product.id, variantId: 'synthetic-small', variantName: 'Small', price: 18 }));
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/store/${encodeURIComponent(slug)}`);
  await expect(page.getByText("Synthetic E2E Product", { exact: false }).first()).toBeVisible();
  await checkNoHorizontalOverflow(page, "storefront mobile");
  await page.screenshot({ path: `${artifactsDir}/storefront-390x844.png`, fullPage: true });
  await page.goto(`/product/${encodeURIComponent(product.id)}`);
  await checkNoHorizontalOverflow(page, "product mobile");
  await page.goto("/cart");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await expect(page.getByRole("heading", { name: "Delivery details" })).toBeVisible();
  await checkNoHorizontalOverflow(page, "checkout mobile");
  await page.screenshot({ path: `${artifactsDir}/checkout-390x844.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('input[name="fullName"]').fill('Synthetic Checkout Customer');
  await page.locator('input[name="email"]').fill(`checkout-${process.env.GITHUB_RUN_ID || 'local'}@example.test`);
  await page.locator('input[name="phone"]').fill('+971500000000');
  await page.locator('input[name="address"]').fill('Synthetic Test Address');
  await page.locator('input[name="city"]').fill('Al Ain');
  let checkoutPayload;
  let checkoutResponseDetails;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/v1/public/orders' && request.method() === 'POST') checkoutPayload = request.postDataJSON();
  });
  page.on('response', async response => {
    if (new URL(response.url()).pathname === '/api/v1/public/orders' && response.request().method() === 'POST') {
      checkoutResponseDetails = { status: response.status(), body: await response.text().catch(() => '') };
    }
  });
  await checkNoHorizontalOverflow(page, 'checkout desktop');
  await page.screenshot({ path: `${artifactsDir}/checkout-1440x900.png`, fullPage: true });
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(1000);
  if (page.url().includes('/checkout')) {
    console.log('Checkout diagnostics:', JSON.stringify({ checkoutResponseDetails, inlineError: await page.locator('.checkout-error').textContent().catch(() => null), checkoutPayload }));
  }
  await expect(page).toHaveURL(/\/payment(?:$|\?)/);
  await expect(page.getByRole('heading', { name: 'Complete your payment' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm cash on delivery' }).click();
  await expect(page).toHaveURL(/\/order-success(?:$|\?)/);
  await expect(page.getByText('Order confirmed')).toBeVisible();
  await page.screenshot({ path: `${artifactsDir}/order-confirmation-1440x900.png`, fullPage: true });

  const orders = await requestFromPage(page, '/orders');
  const checkoutOrder = orders.find((item) => item.data?.email?.startsWith('checkout-'));
  expect(checkoutOrder).toBeTruthy();
  expect(checkoutOrder.status).toBe('new');
  expect(checkoutOrder.data.paymentStatus).toBe('Cash on delivery');
  expect(checkoutPayload?.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  expect(checkoutPayload?.customerActionToken).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  const repeatedCheckout = await requestFromPage(page, '/public/orders', 'POST', checkoutPayload);
  expect(repeatedCheckout.id).toBe(checkoutOrder.id);
  expect((await requestFromPage(page, '/orders')).filter(item => item.id === checkoutOrder.id)).toHaveLength(1);
  const customers = await requestFromPage(page, '/customers');
  expect(customers.some((item) => item.email?.startsWith('checkout-'))).toBe(true);

  const completedOrder = await page.evaluate(() => JSON.parse(localStorage.getItem("completedOrder") || "null"));
  expect(completedOrder?.cashOnDeliveryToken).toBeTruthy();
  const customerOrderView = await requestFromPage(page, `/public/orders/${encodeURIComponent(checkoutOrder.id)}?token=${encodeURIComponent(completedOrder.cashOnDeliveryToken)}`);
  expect(customerOrderView.fulfillmentStatus).toBe("new");
  await expect(page.getByRole("heading", { name: "Order tracking" })).toBeVisible();

  const expectedTotal = Number(checkoutOrder.data.total);
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/payment`, "PATCH", { data: { status: "paid" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/payment`, "PATCH", { data: { status: "paid" } });
  const paidCustomer = await requestFromPage(page, "/customers");
  const checkoutCustomer = paidCustomer.find((item) => item.email?.startsWith("checkout-"));
  expect(checkoutCustomer).toMatchObject({ totalSpent: expectedTotal, paidOrders: 1 });
  const revenue = await requestFromPage(page, "/businesses/mine/commerce-analytics");
  expect(revenue.revenue).toBe(expectedTotal);
  const crmMoney = await requestFromPage(page, '/crm/analytics');
  expect(crmMoney.grossCollectedCents).toBeGreaterThanOrEqual(Math.round(expectedTotal * 100));
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "processing" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "packed" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "shipped", trackingNumber: "SYNTHETIC-TRACK-001", carrier: "Synthetic Carrier", trackingUrl: "https://carrier.example/track/SYNTHETIC-TRACK-001" } });
  const fulfilled = await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}`);
  expect(fulfilled).toMatchObject({ fulfillmentStatus: "shipped", paymentStatus: "Paid", trackingNumber: "SYNTHETIC-TRACK-001" });
  const customerTracking = await requestFromPage(page, `/public/orders/${encodeURIComponent(checkoutOrder.id)}?token=${encodeURIComponent(completedOrder.cashOnDeliveryToken)}`);
  expect(customerTracking).toMatchObject({ fulfillmentStatus: "shipped", trackingNumber: "SYNTHETIC-TRACK-001" });
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/payment`, "PATCH", { data: { status: "refunded" } });
  const refundedAnalytics = await requestFromPage(page, "/businesses/mine/commerce-analytics");
  expect(refundedAnalytics.revenue).toBe(0);
  expect(refundedAnalytics.refunds).toBe(expectedTotal);
  const crmRefunds = await requestFromPage(page, '/crm/analytics');
  expect(crmRefunds.refundsCents).toBeGreaterThanOrEqual(Math.round(expectedTotal * 100));
  expect(crmRefunds.netCustomerValueCents).toBeLessThanOrEqual(crmMoney.netCustomerValueCents);
  const storefrontTimeline = await requestFromPage(page, `/crm/activity/${encodeURIComponent(checkoutCustomer.id)}`);
  expect(storefrontTimeline.some((event) => event.kind === 'store_order' && event.orderId === checkoutOrder.id)).toBe(true);
  expect(storefrontTimeline.some((event) => event.kind === 'payment_collected' && event.orderId === checkoutOrder.id)).toBe(true);
  expect(storefrontTimeline.some((event) => event.kind === 'payment_refunded' && event.orderId === checkoutOrder.id)).toBe(true);

  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "returned" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "returned" } });
  const returned = await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}`);
  expect(returned).toMatchObject({ fulfillmentStatus: "returned", paymentStatus: "Refunded" });

  const cancelOrder = await requestFromPage(page, "/public/orders", "POST", { idempotencyKey: `cancel-${randomUUID().replaceAll('-', '')}`, customerActionToken: `action-${randomUUID().replaceAll('-', '')}`, data: { storeUrl: slug, customerName: "Synthetic Cancellation Customer", email: `cancel-${process.env.GITHUB_RUN_ID || "local"}@example.test`, items: [{ id: product.id, variantId: "synthetic-small", quantity: 1 }] } });
  await requestFromPage(page, `/public/orders/${encodeURIComponent(cancelOrder.id)}/cash-on-delivery`, "POST", { token: cancelOrder.cashOnDeliveryToken });
  await requestFromPage(page, `/orders/${encodeURIComponent(cancelOrder.id)}/fulfillment`, "PATCH", { data: { status: "cancelled" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(cancelOrder.id)}/fulfillment`, "PATCH", { data: { status: "cancelled" } });
  const storedProducts = await requestFromPage(page, "/products");
  expect(storedProducts.find((item) => item.id === product.id).data.variants[0].stock).toBe(4);

  // Manual collection methods use server-priced orders and remain unpaid until
  // the authenticated merchant confirms receipt. No external provider is called.
  const providerStateBefore = await requestFromPage(page, "/payments/providers");
  expect(providerStateBefore.providers.find((provider) => provider.id === "cash_on_delivery")).toMatchObject({ enabled: true, status: "available" });
  expect(providerStateBefore.providers.find((provider) => provider.id === "tap")).toMatchObject({ enabled: false, status: "approval_required", liveEnabled: false });
  expect(providerStateBefore.providers.find((provider) => provider.id === "stripe")).toMatchObject({ enabled: true, status: "not_connected", secretConfigured: false, connectionVerified: false, liveEnabled: false, methods: [] });
  for (const providerId of ["paypal", "tap", "paytabs", "amazon_payment_services", "payd"]) {
    expect(providerStateBefore.providers.find((provider) => provider.id === providerId)?.enabled).toBe(false);
  }
  const manualOptions = {
    bankTransfer: { enabled: true, bankName: "Synthetic Test Bank", accountName: "Synthetic Merchant", iban: "AE070331234567890123456", swift: "SYNTAEAD" },
    externalPaymentLink: { enabled: true, urlTemplate: "https://payments.example.org/checkout?amount={amount}&order={order}&currency={currency}" },
  };
  await requestFromPage(page, "/payments/providers/manual-options", "POST", manualOptions);
  const configuredProviders = await requestFromPage(page, "/payments/providers");
  expect(configuredProviders.providers.find((provider) => provider.id === "bank_transfer")).toMatchObject({ enabled: true, status: "connected" });
  expect(configuredProviders.providers.find((provider) => provider.id === "external_payment_link")).toMatchObject({ enabled: true, status: "connected" });
  const secondaryProviders = await requestFromPage(page, "/payments/providers", "GET", undefined, secondStore.id);
  expect(secondaryProviders.providers.find((provider) => provider.id === "bank_transfer")).toMatchObject({ enabled: false, status: "not_configured" });
  expect(secondaryProviders.providers.find((provider) => provider.id === "external_payment_link")).toMatchObject({ enabled: false, status: "not_configured" });

  const createManualOrder = async (label) => requestFromPage(page, "/public/orders", "POST", {
    idempotencyKey: `${label}-${randomUUID().replaceAll("-", "")}`,
    customerActionToken: `action-${randomUUID().replaceAll("-", "")}`,
    data: { storeUrl: slug, customerName: `Synthetic ${label} Customer`, email: `${label}-${process.env.GITHUB_RUN_ID || "local"}@example.test`, items: [{ id: product.id, variantId: "synthetic-small", quantity: 1 }] },
  });

  const bankOrder = await createManualOrder("bank-transfer");
  const bankMethods = await requestFromPage(page, `/public/orders/${encodeURIComponent(bankOrder.id)}/payment-methods?token=${encodeURIComponent(bankOrder.cashOnDeliveryToken)}`);
  expect(bankMethods.methods.map((method) => method.id)).toEqual(expect.arrayContaining(["cash_on_delivery", "bank_transfer", "external_payment_link"]));
  const bankOwnerOrder = (await requestFromPage(page, "/orders")).find((order) => order.id === bankOrder.id);
  expect(bankOwnerOrder).toBeTruthy();
  const bankExpectedAmount = Number(bankOwnerOrder.amountCents);
  const bankPayment = await requestFromPage(page, `/public/orders/${encodeURIComponent(bankOrder.id)}/payment/manual`, "POST", { token: bankOrder.cashOnDeliveryToken, method: "bank_transfer" });
  expect(bankPayment).toMatchObject({ provider: "bank_transfer", amountCents: bankExpectedAmount, currency: bankOwnerOrder.currency, status: "awaiting_confirmation", bankTransfer: { iban: manualOptions.bankTransfer.iban } });
  expect(await requestFromPage(page, `/public/orders/${encodeURIComponent(bankOrder.id)}/payment/manual`, "POST", { token: bankOrder.cashOnDeliveryToken, method: "bank_transfer" })).toEqual(bankPayment);
  const bankStoredOrder = await requestFromPage(page, `/orders/${encodeURIComponent(bankOrder.id)}`);
  expect(bankStoredOrder.paymentStatus).toBe("Awaiting manual confirmation");
  const crossMerchantOrderAccess = await page.evaluate(async ({ id, businessId }) => {
    const response = await fetch(`/api/v1/orders/${encodeURIComponent(id)}`, { credentials: "include", headers: { "x-cyb-business-id": businessId } });
    return response.status;
  }, { id: bankOrder.id, businessId: secondStore.id });
  expect(crossMerchantOrderAccess).toBe(404);
  await requestFromPage(page, `/orders/${encodeURIComponent(bankOrder.id)}/payment`, "PATCH", { data: { status: "paid" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(bankOrder.id)}/payment`, "PATCH", { data: { status: "paid" } });
  const bankPaidOrder = await requestFromPage(page, `/orders/${encodeURIComponent(bankOrder.id)}`);
  expect(bankPaidOrder.paymentStatus).toBe("Paid");
  const bankTransactions = await requestFromPage(page, "/payments/providers");
  expect(bankTransactions.transactions.filter((transaction) => transaction.orderId === bankOrder.id && transaction.provider === "bank_transfer")).toHaveLength(1);
  expect(bankTransactions.transactions.find((transaction) => transaction.orderId === bankOrder.id)).toMatchObject({ status: "confirmed", amountCents: bankExpectedAmount, currency: bankOwnerOrder.currency });

  const externalOrder = await createManualOrder("external-link");
  const externalOwnerOrder = (await requestFromPage(page, "/orders")).find((order) => order.id === externalOrder.id);
  expect(externalOwnerOrder).toBeTruthy();
  const externalExpectedAmount = Number(externalOwnerOrder.amountCents);
  const externalPayment = await requestFromPage(page, `/public/orders/${encodeURIComponent(externalOrder.id)}/payment/manual`, "POST", { token: externalOrder.cashOnDeliveryToken, method: "external_payment_link" });
  expect(externalPayment).toMatchObject({ provider: "external_payment_link", amountCents: externalExpectedAmount, currency: externalOwnerOrder.currency, status: "awaiting_confirmation" });
  const externalUrl = new URL(externalPayment.url);
  expect(externalUrl.searchParams.get("amount")).toBe((externalExpectedAmount / 100).toFixed(2));
  expect(externalUrl.searchParams.get("order")).toBe(`CYB-${externalOrder.id}`);
  expect(externalUrl.searchParams.get("currency")).toBe(externalOwnerOrder.currency);
  expect(externalPayment.url).not.toContain(bankOrder.id);
  expect((await requestFromPage(page, `/orders/${encodeURIComponent(externalOrder.id)}`)).paymentStatus).toBe("Awaiting manual confirmation");
  await requestFromPage(page, `/orders/${encodeURIComponent(externalOrder.id)}/payment`, "PATCH", { data: { status: "paid" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(externalOrder.id)}/payment`, "PATCH", { data: { status: "paid" } });
  const externalTransactions = await requestFromPage(page, "/payments/providers");
  expect(externalTransactions.transactions.filter((transaction) => transaction.orderId === externalOrder.id && transaction.provider === "external_payment_link")).toHaveLength(1);
  expect(externalTransactions.transactions.find((transaction) => transaction.orderId === externalOrder.id)).toMatchObject({ status: "confirmed", amountCents: externalExpectedAmount, currency: externalOwnerOrder.currency });

  const cancelledManualOrder = await createManualOrder("cancelled-external-link");
  await requestFromPage(page, `/public/orders/${encodeURIComponent(cancelledManualOrder.id)}/payment/manual`, "POST", { token: cancelledManualOrder.cashOnDeliveryToken, method: "external_payment_link" });
  await requestFromPage(page, `/orders/${encodeURIComponent(cancelledManualOrder.id)}/fulfillment`, "PATCH", { data: { status: "cancelled" } });
  const cancelledPaymentAttempt = await page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/orders/${encodeURIComponent(id)}/payment`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { status: "paid" } }) });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, cancelledManualOrder.id);
  expect(cancelledPaymentAttempt.status).toBe(409);
  const cancelledStoredOrder = await requestFromPage(page, `/orders/${encodeURIComponent(cancelledManualOrder.id)}`);
  expect(cancelledStoredOrder).toMatchObject({ status: "cancelled", fulfillmentStatus: "cancelled" });
  expect(cancelledStoredOrder.paymentStatus).toBe("Cancelled");
  const cancelledTransactions = await requestFromPage(page, "/payments/providers");
  expect(cancelledTransactions.transactions.find((transaction) => transaction.orderId === cancelledManualOrder.id && transaction.provider === "external_payment_link")).toMatchObject({ status: "cancelled" });

  await secondTab.close();
});

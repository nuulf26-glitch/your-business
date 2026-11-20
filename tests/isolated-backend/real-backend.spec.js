import { test, expect } from '@playwright/test';
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

  const product = await requestFromPage(page, '/products', 'POST', {
    data: { name: 'Synthetic E2E Product', description: 'Isolated test item', sellingPrice: 18, status: 'active', stock: 4, variants: [{ id: 'synthetic-small', name: 'Small', sku: 'E2E-SMALL', price: 18, stock: 4 }] },
  });
  expect(product.name).toBe('Synthetic E2E Product');
  const products = await requestFromPage(page, '/products');
  expect(products.some((item) => item.id === product.id)).toBe(true);

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
  await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`, 'POST', { data: { kind: 'note', summary: 'Synthetic CRM timeline note' } });
  const timeline = await requestFromPage(page, `/crm/activity/${encodeURIComponent(converted.customerId)}`);
  expect(timeline.some((event) => event.kind === 'lead_converted')).toBe(true);
  expect(timeline.some((event) => event.summary === 'Synthetic CRM timeline note')).toBe(true);
  await requestFromPage(page, `/crm/customers/${encodeURIComponent(converted.customerId)}/tags`, 'POST', { data: { tags: ['vip', 'e2e'] } });
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
  const pipelineBeforeDelete = await requestFromPage(page, '/crm/pipeline/stages');
  const unsafeDelete = await page.evaluate(async () => { const response = await fetch('/api/v1/crm/pipeline/stages', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { stages: ['Qualification', 'Negotiation', 'Won'] } }) }); return response.status; });
  expect(unsafeDelete).toBe(400);
  await requestFromPage(page, `/crm/pipeline/stages`, 'PATCH', { data: { stages: ['Qualification', 'Review', 'Negotiation', 'Won'], renames: { Proposal: 'Review' } } });
  expect((await requestFromPage(page, '/crm/deals')).find((item) => item.id === crmDeal.id).stage).toBe('Review');
  const unsafeCustomDelete = await page.evaluate(async () => { const response = await fetch('/api/v1/crm/pipeline/stages', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { stages: ['Qualification', 'Negotiation', 'Won'] } }) }); return response.status; });
  expect(unsafeCustomDelete).toBe(400);
  await requestFromPage(page, `/crm/deals/${encodeURIComponent(crmDeal.id)}`, 'PATCH', { data: { stage: 'Qualification' } });
  await requestFromPage(page, '/crm/pipeline/stages', 'PATCH', { data: { stages: ['Qualification', 'Negotiation', 'Won'] } });
  expect((await requestFromPage(page, '/crm/pipeline/stages')).includes('Review')).toBe(false);
  const crmTask = await requestFromPage(page, '/crm/tasks', 'POST', { data: { title: 'Synthetic due follow-up', customerId: converted.customerId, dueAt: '2026-01-01T00:00:00.000Z', reminderAt: '2026-01-01T00:00:00.000Z', priority: 'urgent' } });
  const reminders = await requestFromPage(page, '/crm/reminders');
  expect(reminders.filter((item) => item.taskId === crmTask.id)).toHaveLength(1);
  await requestFromPage(page, `/crm/reminders/${encodeURIComponent(reminders.find((item) => item.taskId === crmTask.id).id)}`, 'PATCH', { data: { status: 'read' } });
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
  await checkNoHorizontalOverflow(page, 'checkout desktop');
  await page.screenshot({ path: `${artifactsDir}/checkout-1440x900.png`, fullPage: true });
  await page.locator('form button[type="submit"]').click();
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

  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "returned" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}/fulfillment`, "PATCH", { data: { status: "returned" } });
  const returned = await requestFromPage(page, `/orders/${encodeURIComponent(checkoutOrder.id)}`);
  expect(returned).toMatchObject({ fulfillmentStatus: "returned", paymentStatus: "Refunded" });

  const cancelOrder = await requestFromPage(page, "/public/orders", "POST", { data: { storeUrl: slug, customerName: "Synthetic Cancellation Customer", email: `cancel-${process.env.GITHUB_RUN_ID || "local"}@example.test`, items: [{ id: product.id, variantId: "synthetic-small", quantity: 1 }] } });
  await requestFromPage(page, `/public/orders/${encodeURIComponent(cancelOrder.id)}/cash-on-delivery`, "POST", { token: cancelOrder.cashOnDeliveryToken });
  await requestFromPage(page, `/orders/${encodeURIComponent(cancelOrder.id)}/fulfillment`, "PATCH", { data: { status: "cancelled" } });
  await requestFromPage(page, `/orders/${encodeURIComponent(cancelOrder.id)}/fulfillment`, "PATCH", { data: { status: "cancelled" } });
  const storedProducts = await requestFromPage(page, "/products");
  expect(storedProducts.find((item) => item.id === product.id).data.variants[0].stock).toBe(4);

  await secondTab.close();
});

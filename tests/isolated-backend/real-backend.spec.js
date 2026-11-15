import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import process from 'node:process';

const artifactsDir = 'artifacts/isolated-backend/screenshots';
fs.mkdirSync(artifactsDir, { recursive: true });

async function requestFromPage(page, path, method = 'GET', data) {
  const result = await page.evaluate(async ({ path, method, data }) => {
    const response = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }, { path, method, data });
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
  await checkNoHorizontalOverflow(page, 'dashboard desktop');
  await page.screenshot({ path: `${artifactsDir}/dashboard-1440x900.png`, fullPage: true });

  const auth = await requestFromPage(page, '/auth/me');
  expect(auth.email).toBe(email);
  const secondTab = await context.newPage();
  await secondTab.setViewportSize({ width: 390, height: 844 });
  await secondTab.goto('/dashboard');
  await expect(secondTab).toHaveURL(/\/dashboard(?:$|\?)/);
  const secondTabAuth = await requestFromPage(secondTab, '/auth/me');
  expect(secondTabAuth.id).toBe(auth.id);
  await checkNoHorizontalOverflow(secondTab, 'dashboard mobile');
  await secondTab.screenshot({ path: `${artifactsDir}/dashboard-390x844.png`, fullPage: true });

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/dashboard');
  await checkNoHorizontalOverflow(page, 'dashboard tablet');
  await page.screenshot({ path: `${artifactsDir}/dashboard-768x1024.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
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
    data: { name: 'Synthetic E2E Product', description: 'Isolated test item', sellingPrice: 18, status: 'active', stock: 4 },
  });
  expect(product.name).toBe('Synthetic E2E Product');
  const products = await requestFromPage(page, '/products');
  expect(products.some((item) => item.id === product.id)).toBe(true);

  await page.goto(`/store/${encodeURIComponent(slug)}`);
  await expect(page.getByText('Synthetic E2E Product', { exact: false }).first()).toBeVisible();
  await checkNoHorizontalOverflow(page, 'storefront desktop');
  await page.screenshot({ path: `${artifactsDir}/storefront-1440x900.png`, fullPage: true });

  await page.goto(`/product/${encodeURIComponent(product.id)}`);
  await expect(page.getByRole('heading', { name: 'Synthetic E2E Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Delivery details' })).toBeVisible();
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
  expect(customers.some((item) => item.data?.email?.startsWith('checkout-'))).toBe(true);

  await secondTab.close();
});

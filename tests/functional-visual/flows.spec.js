import { expect, test } from "@playwright/test";

const user = {
  id: "synthetic-user", email: "visual-review@example.test", emailVerified: true,
  role: "owner", paid: true,
};
const business = {
  id: "synthetic-business", ownerId: user.id, name: "Atelier Preview", slug: "atelier-preview",
  category: "salon", settings: { businessName: "Atelier Preview", storeName: "Atelier Preview", storeUrl: "atelier-preview", currency: "USD", catalog: {} },
};
const website = {
  editorVersion: 2, brandName: "Atelier Preview", template: "minimal",
  sections: [{ id: "hero", type: "hero", title: "Synthetic preview", body: "Preview fixture content", buttonText: "Explore", href: "#collection", media: [{ id: 'synthetic-hero-image', type: 'image', url: 'https://images.example.test/synthetic.jpg', alt: 'Synthetic image', aspectRatio: '16 / 9', width: 100, unit: '%' }] }], pages: [],
};
const product = {
  id: "synthetic-product", data: { name: "Synthetic QA product", category: "Care", sellingPrice: 80, costPrice: 20, stock: 4, status: "active", description: "Test-only fixture" },
};
const order = {
  id: "synthetic-order", status: "new", createdAt: "2026-01-15T09:00:00.000Z",
  data: { id: "ORD-legacy-display", customerName: "Synthetic QA customer", email: "visual-review@example.test", productName: "Synthetic QA product", total: 80, fulfillmentStatus: "new", paymentStatus: "Cash on delivery", items: [{ name: "Synthetic QA product", quantity: 1, price: 80 }] },
};
const customer = {
  id: "synthetic-customer", data: { name: "Synthetic QA customer", email: "visual-review@example.test", phone: "+971500000000", orders: 1, totalSpent: 80, status: "New", createdAt: "2026-01-15T09:00:00.000Z" },
};

async function mockAppApi(page, { cookieAuth = false, orders: orderFixtures = [order] } = {}) {
  const calls = [];
  let authenticated = !cookieAuth;
  let products = [product];
  let currentOrders = structuredClone(orderFixtures);
  let stores = [{ id: business.id, name: business.name, slug: business.slug, category: business.category, published: true }];
  let draft = structuredClone(website);
  let crmSegments = [{ id: "segment-1", name: "VIPs", filters: { search: "vip" } }];
  let analyticsReports = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    calls.push({ method, pathname, searchParams: url.searchParams, body: request.postDataJSON?.(), businessId: request.headers()["x-cyb-business-id"] || "" });

    if (pathname === "/auth/login" && method === "POST") {
      authenticated = true;
      return route.fulfill({ status: 200, headers: { "Set-Cookie": "cyb-visual-session=synthetic; Path=/; HttpOnly; SameSite=Lax" }, contentType: "application/json", body: JSON.stringify(user) });
    }
    if (pathname === "/auth/me") {
      const hasCookie = (request.headers().cookie || "").includes("cyb-visual-session=synthetic");
      const allowed = cookieAuth ? hasCookie : authenticated;
      return route.fulfill({ status: allowed ? 200 : 401, contentType: "application/json", body: JSON.stringify(allowed ? user : { message: "No synthetic session" }) });
    }

    let status = 200;
    let body = {};
    if (pathname === "/auth/logout") body = { ok: true };
    else if (pathname === "/businesses/mine") body = business;
    else if (pathname === "/businesses/mine/stores" && method === "GET") body = stores;
    else if (pathname === "/businesses/mine/stores" && method === "POST") {
      const input = request.postDataJSON() || {};
      const created = { id: "synthetic-second-store", name: input.name, slug: input.slug, category: input.category, published: false };
      stores = [...stores, created];
      body = created;
    }
    else if (pathname === "/businesses/mine/catalog") body = {};
    else if (pathname.startsWith("/businesses/mine/records")) body = [];
    else if (pathname === "/businesses/mine/analytics") body = { days: [], pages: [], sources: [] };
    else if (pathname === "/businesses/mine/clients") body = [];
    else if (pathname === "/websites/draft" && method === "GET") body = { draft, published: null, updatedAt: "2026-01-15T09:00:00.000Z" };
    else if (pathname === "/websites/draft" && method === "PUT") { draft = request.postDataJSON()?.model || draft; body = { ok: true, draft }; }
    else if (pathname === "/websites/publication-diagnostic") body = { published: false, status: "draft" };
    else if (pathname === "/websites/versions") body = [];
    else if (pathname === "/websites/publish") body = { slug: "atelier-preview" };
    else if (pathname === "/products" && method === "GET") body = products;
    else if (pathname === "/products" && method === "POST") {
      const input = request.postDataJSON()?.data || {};
      const created = { id: "synthetic-created-product", data: input };
      products = [...products, created];
      body = created;
    } else if (pathname === "/orders" && method === "GET") body = currentOrders;
    else if (pathname === "/orders/synthetic-order/payment" && method === "PATCH") {
      const input = request.postDataJSON()?.data || {};
      body = { ...order, data: { ...order.data, paymentStatus: input.status === "paid" ? "Paid" : "Refunded" } };
    }
    else if (pathname.startsWith("/orders/") && method === "GET") {
      const record = currentOrders.find((candidate) => candidate.id === pathname.slice("/orders/".length));
      body = record ? { id: record.id, ...record.data, status: record.status, createdAt: record.createdAt } : {};
    }
    else if (pathname === "/crm/leads" && method === "GET") body = [{ id: "lead-1", name: "Lead One", email: "lead@example.test", status: "new" }];
    else if (pathname === "/crm/deals" && method === "GET") body = [{ id: "deal-1", title: "Deal One", amount: 25, currency: "AED", stage: "Qualification", status: "open" }];
    else if (pathname === "/crm/tasks" && method === "GET") body = [{ id: "task-1", title: "Follow up", dueAt: "2026-11-19T10:00:00.000Z", priority: "high", status: "open" }];
    else if (pathname === "/crm/reminders") body = [];
    else if (pathname.startsWith("/crm/activity/")) body = [{ id: "event-1", kind: "note", summary: "Synthetic timeline note", at: "2026-11-20T10:00:00.000Z" }];
    else if (pathname === "/crm/analytics") body = { customers: 1, leads: 1, conversionRate: 0, repeatCustomers: 0, netCustomerValueCents: 0 };
    else if (pathname === "/analytics/overview") body = { range: { from: "2026-11-01", to: "2026-11-21", previousFrom: "2026-10-11", previousTo: "2026-10-31", timeZone: "Asia/Dubai" }, current: { orders: 2, paidOrders: 1, unpaidOrders: 1, collectedRevenueCents: 12500, refundsCents: 2500, netRevenueCents: 10000, averageOrderValueCents: 12500, newCustomers: 1, newLeads: 2, leadConversionRate: 0.5, openPipelineValueCents: 5000, dealWinRate: 0.5, completedTasks: 1, tasks: 2 }, previous: { orders: 1, paidOrders: 1, unpaidOrders: 0, collectedRevenueCents: 10000, refundsCents: 0, netRevenueCents: 10000, averageOrderValueCents: 10000, newCustomers: 0, newLeads: 1, leadConversionRate: 0, openPipelineValueCents: 0, dealWinRate: 0, completedTasks: 0, tasks: 1 }, previousWebsite: { visitors: 5, sessions: 5, pageViews: 8, conversionEvents: 0 }, website: { visitors: 8, sessions: 8, pageViews: 15, conversionEvents: 1, conversionRate: 0.125, pages: [{ page: "/", views: 9 }], sources: [{ source: "direct", visits: 6 }], devices: [{ device: "mobile", visits: 5 }], browsers: [{ browser: "Safari", visits: 4 }] }, commerce: { repeatCustomers: 1, totalPayingCustomers: 3, repeatPurchaseRate: 0.33, topProducts: [{ productId: "synthetic-product", name: "Synthetic QA product", quantity: 2, revenueCents: 12500 }] }, trend: [{ date: "2026-11-20", pageViews: 8, uniqueVisitors: 5, revenue: 100 }, { date: "2026-11-21", pageViews: 7, uniqueVisitors: 4, revenue: 0 }] };
    else if (pathname === "/analytics/reports" && method === "GET") body = analyticsReports;
    else if (pathname === "/analytics/reports" && method === "POST") { const input = request.postDataJSON()?.data || {}; const report = { id: `report-${analyticsReports.length + 1}`, ...input }; analyticsReports = [...analyticsReports, report]; body = report; }
    else if (pathname.startsWith("/analytics/reports/") && method === "DELETE") { analyticsReports = analyticsReports.filter(item => item.id !== pathname.split("/").pop()); body = { deleted: true }; }
    else if (pathname === "/crm/customers") body = { items: [{ id: customer.id, ...customer.data, orders: 1, totalSpent: 80 }], page: 1, total: 1, totalPages: 1 };
    else if (pathname === "/crm/segments" && method === "GET") body = crmSegments;
    else if (pathname === "/crm/segments" && method === "POST") { const input = request.postDataJSON()?.data || {}; const created = { id: `segment-${crmSegments.length + 1}`, ...input }; crmSegments = [...crmSegments, created]; body = created; }
    else if (pathname.startsWith("/crm/segments/") && method === "PATCH") { const id = pathname.split("/").pop(); const patch = request.postDataJSON()?.data || {}; crmSegments = crmSegments.map(item => item.id === id ? { ...item, ...patch } : item); body = crmSegments.find(item => item.id === id) || {}; }
    else if (pathname.startsWith("/crm/segments/") && method === "DELETE") { const id = pathname.split("/").pop(); crmSegments = crmSegments.filter(item => item.id !== id); body = { deleted: true }; }
    else if (pathname.startsWith("/crm/segments/") && pathname.endsWith("/apply")) { const id = pathname.split("/").at(-2); body = crmSegments.find(item => item.id === id) || {}; }
    else if (pathname === "/crm/pipeline/stages") body = ["Qualification", "Proposal", "Negotiation", "Won"];
    else if (pathname === "/customers" && method === "GET") body = [{ id: customer.id, ...customer.data }];
    else if (pathname.startsWith("/customers/") && pathname.endsWith("/status")) body = { id: "synthetic-customer", data: { ...customer.data, status: request.postDataJSON()?.status || "Active" } };
    else if (pathname.startsWith("/orders/") && pathname.endsWith("/status") && method === "PATCH") {
      const id = pathname.split("/")[2];
      const nextStatus = String(request.postDataJSON()?.status || "").toLowerCase();
      currentOrders = currentOrders.map(row => row.id === id
        ? { ...row, status: nextStatus, data: { ...row.data, fulfillmentStatus: nextStatus } }
        : row);
      body = currentOrders.find(row => row.id === id) || {};
    }
    else if (pathname === "/public/products/item/synthetic-product") body = { ...product.data, id: product.id, storeUrl: "atelier-preview" };
    else if (pathname === "/public/orders" && method === "POST") body = { id: "synthetic-created-order", cashOnDeliveryToken: "synthetic-token" };
    else if (pathname === "/public/orders/synthetic-created-order/cash-on-delivery" && method === "POST") body = { ok: true };
    else if (pathname.startsWith("/public/") || pathname.startsWith("/websites/public/") || pathname.startsWith("/businesses/public/")) body = {};
    return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  return calls;
}

async function seedProtectedUser(page) {
  await page.addInitScript((value) => sessionStorage.setItem("getcyb_session_user", JSON.stringify(value)), user);
}

test("synthetic login keeps the cookie-backed session after reload and opens dashboard", async ({ page }) => {
  const calls = await mockAppApi(page, { cookieAuth: true });
  await page.goto("/login");
  await page.locator("#loginEmail").fill(user.email);
  await page.locator("#loginPassword").fill("synthetic-only-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Welcome back, Atelier Preview")).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".workspace-navigation")).toBeVisible({ timeout: 15000 });
  expect(calls.some((call) => call.pathname === "/auth/login" && call.method === "POST")).toBeTruthy();
  expect(calls.filter((call) => call.pathname === "/auth/me").length).toBeGreaterThan(1);
});

test("editor draft save and publish use the existing API contracts", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/editor");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect.poll(() => calls.some((call) => call.pathname === "/websites/draft" && call.method === "PUT")).toBeTruthy();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your website is live." })).toBeVisible({ timeout: 15000 });
  expect(calls.some((call) => call.pathname === "/websites/publish" && call.method === "POST")).toBeTruthy();
});

test("contact forms support saved conditional questions on mobile and desktop", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/editor");
  await page.getByRole("navigation", { name: "Editor navigation" }).getByRole("button", { name: "Add section" }).click();
  await page.getByRole("button", { name: /Contact form/ }).click();
  await page.getByRole("button", { name: /Add a question/ }).click();
  await page.getByLabel("Question 1 label").fill("What do you need?");
  await page.getByLabel("Question 1 type").selectOption("select");
  await page.getByLabel("Question 1 choices").fill("Consultation, Other");
  await page.getByRole("button", { name: /Add a question/ }).click();
  await page.getByLabel("Question 2 label").fill("Please describe");
  await page.getByLabel("Question 2 type").selectOption("textarea");
  await page.getByLabel("Question 2 visibility condition").selectOption({ label: "What do you need? = Other" });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/websites/draft" && call.method === "PUT" && call.body?.model?.pages?.some(item => item.sections.some(section => section.type === "contact" && section.formFields?.length === 2)))).toBeTruthy();

  const saved = [...calls].reverse().find(call => call.pathname === "/websites/draft" && call.method === "PUT");
  const formSection = saved.body.model.pages.flatMap(item => item.sections).find(section => section.type === "contact");
  expect(formSection.formFields[1].showWhen).toEqual({ fieldId: formSection.formFields[0].id, value: "Other" });
  await page.getByRole("button", { name: "Preview Website" }).click();
  const preview = page.locator(".full-preview");
  const choice = preview.getByRole("combobox", { name: "What do you need?" });
  await choice.selectOption("Consultation");
  await expect(preview.getByLabel("Please describe")).toBeHidden();
  await choice.selectOption("Other");
  await expect(preview.getByLabel("Please describe")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
});

test("image crop controls preview and save persistent crop metadata", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/editor");
  await page.getByLabel("Crop zoom 1").fill("1.8");
  await page.getByLabel("Aspect ratio").first().selectOption("4 / 3");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/websites/draft" && call.method === "PUT" && call.body?.model?.sections?.[0]?.media?.[0]?.cropScale === 1.8 && call.body?.model?.sections?.[0]?.media?.[0]?.aspectRatio === "4 / 3")).toBeTruthy();
});

test("editor page management, nested-safe actions, and responsive toolbar work with synthetic data", async ({ page }) => {
  test.setTimeout(90_000);
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/editor");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Current page" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `horizontal overflow at ${viewport.width}px`).toBeFalsy();
    if (viewport.width <= 900) {
      await page.getByRole("button", { name: "Add & pages" }).click();
      await expect(page.getByRole("navigation", { name: "Editor navigation" })).toBeVisible();
    }
    await page.getByRole("navigation", { name: "Editor navigation" }).getByRole("button", { name: /Pages/ }).click();
    await expect(page.getByText("Website pages")).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("navigation", { name: "Editor navigation" }).getByRole("button", { name: /Pages/ }).click();
  await page.getByLabel("New page name").fill("About");
  await page.getByRole("button", { name: "Add page" }).click();
  await expect(page.getByRole("combobox", { name: "Current page" })).toHaveValue(/page-/);
  await page.getByRole("navigation", { name: "Editor navigation" }).getByRole("button", { name: /Add section/ }).click();
  await page.getByRole("button", { name: /FAQ/ }).first().click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/websites/draft" && call.method === "PUT" && call.body?.model?.pages?.some(item => item.title === "About" && item.sections.some(section => section.type === "faq")))).toBeTruthy();
  await page.getByRole("navigation", { name: "Editor navigation" }).getByRole("button", { name: /Pages/ }).click();
  await page.getByRole("combobox", { name: "Current page" }).selectOption({ label: "About" });
  await page.locator(".page-actions").last().locator("summary").click();
  await page.getByRole("button", { name: "Set as homepage" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/websites/draft" && call.method === "PUT" && call.body?.model?.pages?.[0]?.title === "About")).toBeTruthy();
  await page.getByRole("navigation", { name: "Editor navigation" }).getByRole("button", { name: /Pages/ }).click();
  await page.getByLabel("External link label").fill("Instagram");
  await page.getByLabel("External URL").fill("https://instagram.com/atelier-preview");
  await page.getByRole("button", { name: "Add external link" }).click();
  await page.getByLabel("About label").fill("Our story");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect.poll(() => calls.some(call => {
    const model = call.pathname === "/websites/draft" && call.method === "PUT" ? call.body?.model : null;
    const aboutPageId = model?.pages?.find(item => item.title === "About")?.id;
    return !!aboutPageId && model.navigation?.some(item => item.label === "Our story" && item.pageId === aboutPageId) && model.navigation?.some(item => item.label === "Instagram" && item.href === "https://instagram.com/atelier-preview");
  })).toBeTruthy();
  await page.reload();
  const siteNavigation = page.getByRole("navigation", { name: "Website pages" });
  await expect(siteNavigation.getByRole("link", { name: "Our story" })).toBeVisible();
  await expect(siteNavigation.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/atelier-preview");
});

test("products, orders, and customers render fixture records and preserve update requests", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/products");
  await expect(page.getByText("Synthetic QA product").first()).toBeVisible();
  await page.locator("#name").fill("A synthetic new product");
  await page.locator("#sellingPrice").fill("25");
  await page.locator("#category").fill("Test");
  await page.locator("#stock").fill("3");
  await page.getByRole("button", { name: "Add variant" }).click();
  await page.getByLabel("Variant 1 name").fill("Small / Black");
  await page.getByLabel("Variant 1 SKU").fill("QA-SMALL-BLACK");
  await page.getByLabel("Variant 1 price").fill("20");
  await page.getByLabel("Variant 1 stock").fill("2");
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect.poll(() => calls.some((call) => call.pathname === "/products" && call.method === "POST")).toBeTruthy();
  const createdProductCall = calls.find((call) => call.pathname === "/products" && call.method === "POST");
  expect(createdProductCall.body.data.variants).toContainEqual(expect.objectContaining({ name: "Small / Black", sku: "QA-SMALL-BLACK", price: 20, stock: 2 }));

  await page.goto("/orders/synthetic-order");
  await page.locator("#status").selectOption("processing");
  await expect.poll(() => calls.some((call) => call.pathname === "/orders/synthetic-order/fulfillment" && call.method === "PATCH")).toBeTruthy();
  await page.locator("#shippingCompany").fill("Synthetic Carrier");
  await page.locator("#trackingNumber").fill("QA-TRACK-0001");
  await page.locator("#trackingUrl").fill("https://example.test/track/QA-TRACK-0001");
  await page.getByRole("button", { name: "Save Tracking Information" }).click();
  await expect(page.getByText("Company: Synthetic Carrier")).toBeVisible();
  await expect(page.getByText("Tracking Number: QA-TRACK-0001")).toBeVisible();

  await page.goto("/customers");
  await expect(page.getByText("Synthetic QA customer").first()).toBeVisible();
  await expect(page.locator(".customer-card").filter({ hasText: "Synthetic QA customer" })).toContainText("$80.00");
  await page.locator(".customer-status-select").selectOption("Active");
  await expect.poll(() => calls.some((call) => call.pathname === "/customers/synthetic-customer/status" && call.method === "PATCH")).toBeTruthy();
});

test("storefront product cart and cash-on-delivery checkout stay on synthetic routes", async ({ page }) => {
  const calls = await mockAppApi(page);
  await page.goto("/product/synthetic-product");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByText("Synthetic QA product").first()).toBeVisible();
  await page.goto("/checkout");
  await page.locator("#fullName").fill("Synthetic QA customer");
  await page.locator("#email").fill(user.email);
  await page.locator("#phone").fill("+971500000000");
  await page.locator("#address").fill("Synthetic test address");
  await page.locator("#city").fill("Test City");
  await page.getByRole("button", { name: /continue to payment/i }).click();
  await expect(page).toHaveURL(/\/payment$/);
  await page.getByRole("button", { name: "Confirm cash on delivery" }).click();
  await expect(page).toHaveURL(/\/order-success$/);
  expect(calls.some((call) => call.pathname === "/public/orders" && call.method === "POST")).toBeTruthy();
  const checkoutRequest = calls.find((call) => call.pathname === "/public/orders" && call.method === "POST");
  expect(checkoutRequest.body.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  expect(checkoutRequest.body.customerActionToken).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  expect(calls.some((call) => call.pathname === "/public/orders/synthetic-created-order/cash-on-delivery" && call.method === "POST")).toBeTruthy();
});


test("orders distinguish gross collections, refunds, and net revenue", async ({ page }) => {
  await seedProtectedUser(page);
  const paid = {
    id: "paid-order", status: "new", createdAt: "2026-11-19T10:00:00.000Z",
    data: { customerName: "Paid buyer", total: 37, paymentStatus: "Paid", collectedAmountCents: 3700, paymentHistory: [{ type: "collected", amountCents: 3700 }], items: [] },
  };
  const refunded = {
    id: "refunded-order", status: "new", createdAt: "2026-11-19T11:00:00.000Z",
    data: { customerName: "Refunded buyer", total: 32.5, paymentStatus: "Refunded", collectedAmountCents: 3250, paymentHistory: [{ type: "collected", amountCents: 3250 }, { type: "refund", amountCents: 3250 }], refundHistory: [{ amountCents: 3250, status: "recorded" }], items: [] },
  };
  await mockAppApi(page, { orders: [paid, refunded] });
  await page.goto("/orders");
  await expect(page.getByText("Net revenue", { exact: true })).toBeVisible();
  await expect(page.locator(".orders-summary-grid").getByText("$37.00", { exact: true })).toBeVisible();
  await expect(page.getByText(/Gross collected \$69.50 · refunds \$32.50/)).toBeVisible();
});

test("merchant payment actions use the database order ID and update from the saved response", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/orders");
  await expect(page.getByText("#ORD-legacy-display")).toBeVisible();
  await page.getByRole("button", { name: "Mark collected" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/orders/synthetic-order/payment" && call.method === "PATCH")).toBeTruthy();
  await expect(page.getByText("Payment: Paid")).toBeVisible();
  expect(calls.some(call => call.pathname === "/orders/ORD-legacy-display/payment")).toBe(false);
});

test("cancelled and returned orders cannot be marked collected in list or details", async ({ page }) => {
  await seedProtectedUser(page);
  const closedOrders = [
    { ...order, status: "cancelled", data: { ...order.data, fulfillmentStatus: "Cancelled", paymentStatus: "Cancelled" } },
    { ...order, id: "returned-order", status: "returned", data: { ...order.data, fulfillmentStatus: "Returned", paymentStatus: "unpaid" } },
  ];
  await mockAppApi(page, { orders: closedOrders });

  await page.goto("/orders");
  await expect(page.getByText("#ORD-legacy-display")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark collected" })).toHaveCount(0);

  await page.goto("/orders/synthetic-order");
  await expect(page.getByText("Order Status")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark collected" })).toHaveCount(0);
});

test("order fulfillment status reflects the saved cancellation response", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/orders");
  const status = page.locator(".order-status-select").first();
  await expect(status).toHaveValue("New");
  await status.selectOption("Cancelled");
  await expect.poll(() => calls.some(call => call.pathname === "/orders/synthetic-order/status" && call.method === "PATCH" && call.body?.status === "cancelled")).toBeTruthy();
  await expect(status).toHaveValue("Cancelled");
});

test("storefront treats the available quantity returned by the server consistently", async ({ page }) => {
  await mockAppApi(page);
  const model = { ...website, sections: [{ id: "inventory", type: "collection", title: "Inventory" }] };
  let availableStock = 0;
  let inventoryRequests = 0;
  await page.route("**/api/v1/websites/public/atelier-preview", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ published: true, website: model, business: { slug: "atelier-preview" } }),
  }));
  await page.route("**/api/v1/public/products/atelier-preview", route => {
    inventoryRequests += 1;
    return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{ ...product.data, id: product.id, storeUrl: "atelier-preview", stock: availableStock }]),
    });
  });

  await page.goto("/store/atelier-preview");
  await expect(page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  const previousInventoryRequests = inventoryRequests;
  availableStock = 1;
  await page.reload();
  await expect.poll(() => inventoryRequests).toBeGreaterThan(previousInventoryRequests);
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
});

test("storefront variant cards open option selection and persist the chosen variant in cart and COD order", async ({ page }) => {
  const calls = await mockAppApi(page);
  const variant = { id: "variant-small", name: "Small", sku: "QA-SMALL", price: 20, stock: 2 };
  const model = { ...website, brandName: "Atelier Preview", sections: [{ id: "collection", type: "collection", title: "Shop", limit: 4 }] };
  const variantRequests = [];
  await page.route("**/api/v1/websites/public/atelier-preview", async route => { variantRequests.push(new URL(route.request().url()).pathname); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ published: true, website: model, business: { slug: "atelier-preview" } }) }); });
  await page.route("**/api/v1/public/products/atelier-preview", async route => { variantRequests.push(new URL(route.request().url()).pathname); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...product.data, id: product.id, variants: [variant], storeUrl: "atelier-preview", stock: 0 }]) }); });
  await page.route("**/api/v1/public/products/item/synthetic-product", async route => { variantRequests.push(new URL(route.request().url()).pathname); await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...product.data, id: product.id, variants: [variant], storeUrl: "atelier-preview", stock: 0 }) }); });
  await page.goto("/store/atelier-preview");
  await page.getByRole("button", { name: "Choose options" }).click();
  await expect(page).toHaveURL(/\/product\/synthetic-product$/);
  await page.getByLabel("Options").selectOption("variant-small");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("businessCart") || "[]"))).toContainEqual(expect.objectContaining({ productId: "synthetic-product", variantId: "variant-small", variantName: "Small", sku: "QA-SMALL", price: 20 }));
  expect(variantRequests).toContain("/api/v1/public/products/atelier-preview");
  await page.goto("/cart");
  await page.getByRole("button", { name: "Continue to checkout" }).click();
  await page.locator("#fullName").fill("Synthetic variant buyer");
  await page.locator("#email").fill(user.email);
  await page.locator("#phone").fill("+971500000000");
  await page.locator("#address").fill("Synthetic test address");
  await page.locator("#city").fill("Test City");
  await page.getByRole("button", { name: /continue to payment/i }).click();
  await page.getByRole("button", { name: "Confirm cash on delivery" }).click();
  await expect(page).toHaveURL(/\/order-success$/);
  const orderRequest = calls.find(call => call.pathname === "/public/orders" && call.method === "POST");
  expect(orderRequest.body.data.items[0]).toMatchObject({ id: "synthetic-product", variantId: "variant-small", variantName: "Small", price: 20 });
});


test("store management creates and switches between owner stores", async ({ page }) => {
  const calls = await mockAppApi(page);
  await seedProtectedUser(page);
  await page.goto("/dashboard");
  await expect(page.getByLabel("Active store")).toHaveValue("synthetic-business");
  await page.getByRole("button", { name: "+ Add store" }).click();
  await page.getByLabel("Store name").fill("Second Store");
  await expect(page.getByLabel("Store URL")).toHaveValue("second-store");
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page.getByLabel("Active store")).toHaveValue("synthetic-second-store");
  await expect.poll(() => calls.some(call => call.pathname === "/businesses/mine/stores" && call.method === "POST" && call.body?.slug === "second-store")).toBeTruthy();
  expect(calls.some(call => call.pathname === "/businesses/mine" && call.businessId === "synthetic-second-store")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("cyb_active_business_id"))).toBe("synthetic-second-store");
});


test("CRM pipeline controls move deal stages and task completion persists", async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto("/crm");
  await page.getByRole("button", { name: "Pipeline" }).click();
  await expect(page.getByText("Deal One")).toBeVisible();
  await page.getByPlaceholder("New pipeline stage").fill("Review");
  await page.getByRole("button", { name: "Add stage" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/crm/pipeline/stages" && call.method === "PATCH" && call.body?.data?.stages?.includes("Review"))).toBeTruthy();
  await page.getByLabel("Deal stage Deal One").selectOption("Proposal");
  await expect.poll(() => calls.some(call => call.pathname === "/crm/deals/deal-1" && call.method === "PATCH" && call.body?.data?.stage === "Proposal")).toBeTruthy();
  await page.getByRole("button", { name: "Tasks" }).click();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect.poll(() => calls.some(call => call.pathname === "/crm/tasks/task-1" && call.method === "PATCH" && call.body?.data?.status === "completed")).toBeTruthy();
});


test('CRM filters, saved lists, activity timeline, and responsive customer views work', async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto('/crm');
  await page.getByRole('button', { name: 'Customers' }).click();
  await page.getByPlaceholder('Search name, email, phone').fill('Synthetic');
  await page.getByLabel('Minimum net spend').fill('25');
  await page.getByLabel('Customer tag filter').fill('vip');
  await page.getByLabel('Sort customers').selectOption('name');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByPlaceholder('Saved list name').fill('VIP filtered customers');
  await page.getByRole('button', { name: 'Save list' }).click();
  await expect(page.getByRole('button', { name: 'VIP filtered customers', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Update VIP filtered customers filters' }).click();
  await expect.poll(() => calls.some(call => call.pathname === '/crm/segments/segment-2' && call.method === 'PATCH' && call.body?.data?.filters?.tag === 'vip')).toBeTruthy();
  page.once('dialog', dialog => dialog.accept('VIP Refined'));
  await page.getByRole('button', { name: 'Rename VIP filtered customers' }).click();
  await expect.poll(() => calls.some(call => call.pathname === '/crm/segments/segment-2' && call.method === 'PATCH' && call.body?.data?.name === 'VIP Refined')).toBeTruthy();
  await page.getByRole('button', { name: 'Delete VIP Refined' }).click();
  await expect.poll(() => calls.some(call => call.pathname === '/crm/segments/segment-2' && call.method === 'DELETE')).toBeTruthy();
  await expect.poll(() => calls.some(call => call.pathname === '/crm/segments' && call.method === 'POST' && call.body?.data?.filters?.tag === 'vip' && call.body?.data?.filters?.minSpent === '25')).toBeTruthy();
  await page.getByRole('button', { name: 'Activity' }).click();
  await expect(page.getByText('Synthetic timeline note')).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `CRM overflow at ${viewport.width}px`).toBeTruthy();
  }
});

test('analytics dashboard shows real report fields, saves a range, and stays responsive', async ({ page }) => {
  await seedProtectedUser(page);
  const calls = await mockAppApi(page);
  await page.goto('/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics & reports' })).toBeVisible();
  const collectedRevenue = page.getByRole('article').filter({ hasText: 'Collected revenue' });
  await expect(collectedRevenue.getByRole('strong')).toHaveText('AED 125');
  await expect(page.getByText('No page view data for this period.')).toHaveCount(0);
  await expect.poll(() => calls.some(call => call.pathname === '/analytics/overview')).toBeTruthy();
  await page.getByRole('button', { name: '7 days' }).click();
  await expect.poll(() => calls.some(call => call.pathname === '/analytics/overview' && call.searchParams?.get('from'))).toBeTruthy();
  await page.getByLabel('Report name').fill('November overview');
  await page.getByRole('button', { name: 'Save report' }).click();
  await expect(page.getByRole('button', { name: 'November overview daily', exact: true })).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Analytics overflow at ${viewport.width}px`).toBeTruthy();
  }
});


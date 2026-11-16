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
  data: { customerName: "Synthetic QA customer", email: "visual-review@example.test", productName: "Synthetic QA product", total: 80, items: [{ name: "Synthetic QA product", quantity: 1, price: 80 }] },
};
const customer = {
  id: "synthetic-customer", data: { name: "Synthetic QA customer", email: "visual-review@example.test", phone: "+971500000000", orders: 1, totalSpent: 80, status: "New", createdAt: "2026-01-15T09:00:00.000Z" },
};

async function mockAppApi(page, { cookieAuth = false } = {}) {
  const calls = [];
  let authenticated = !cookieAuth;
  let products = [product];
  let draft = structuredClone(website);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    calls.push({ method, pathname, body: request.postDataJSON?.() });

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
    } else if (pathname === "/orders" && method === "GET") body = [order];
    else if (pathname === "/orders/synthetic-order") body = { id: order.id, ...order.data, status: order.status, createdAt: order.createdAt };
    else if (pathname === "/customers" && method === "GET") body = [customer];
    else if (pathname.startsWith("/customers/") && pathname.endsWith("/status")) body = { id: "synthetic-customer", data: { ...customer.data, status: request.postDataJSON()?.status || "Active" } };
    else if (pathname.startsWith("/orders/") && pathname.endsWith("/status")) body = { ok: true };
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
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await expect.poll(() => calls.some((call) => call.pathname === "/products" && call.method === "POST")).toBeTruthy();

  await page.goto("/orders/synthetic-order");
  await page.locator("#status").selectOption("processing");
  await expect.poll(() => calls.some((call) => call.pathname === "/orders/synthetic-order/fulfillment" && call.method === "PATCH")).toBeTruthy();

  await page.goto("/customers");
  await expect(page.getByText("Synthetic QA customer").first()).toBeVisible();
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
  expect(calls.some((call) => call.pathname === "/public/orders/synthetic-created-order/cash-on-delivery" && call.method === "POST")).toBeTruthy();
});


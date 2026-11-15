import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const outputRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../artifacts/functional-visual");
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "tablet-768x1024", width: 768, height: 1024 },
  { label: "mobile-390x844", width: 390, height: 844 },
  { label: "mobile-375x812", width: 375, height: 812 },
];

const routes = [
  ["homepage", "/"], ["login", "/login"], ["signup", "/signup"],
  ["forgot-password", "/forgot-password"], ["reset-password", "/reset-password?token=visual-test"],
  ["dashboard", "/dashboard"], ["editor", "/editor"], ["templates", "/templates"],
  ["create-website", "/create-website"], ["products", "/products"],
  ["orders", "/orders"], ["order-details", "/orders/fixture-order"],
  ["customers", "/customers"], ["business", "/business"],
  ["settings", "/settings"], ["store-setup", "/store-setup"],
  ["store-designer", "/store-designer"], ["shipping", "/shipping"],
  ["storefront", "/store/atelier-preview"], ["product-page", "/product/fixture-product"],
  ["cart", "/cart"], ["checkout", "/checkout"], ["order-confirmation", "/order-success"],
];

// These fixtures exist only in this Playwright process. Every /api/v1 request is
// intercepted before it can reach a real backend; production auth is untouched.
const fixtureUser = {
  id: "visual-fixture-user", email: "visual-review@example.test", emailVerified: true,
  role: "owner", paid: true,
};
const fixtureCatalog = {
  businessCategory: "salon", timeZone: "Asia/Dubai", services: [], staff: [],
  menu: [], tables: [], projects: [], closures: [], reservationDuration: 90,
  hours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, { open: "09:00", close: "18:00", closed: day === 0 }])),
};
const fixtureBusiness = {
  id: "visual-fixture-business", ownerId: fixtureUser.id, name: "Atelier Preview",
  slug: "atelier-preview", category: "salon",
  settings: {
    businessName: "Atelier Preview", storeName: "Atelier Preview", storeUrl: "atelier-preview",
    businessCategory: "salon", currency: "USD", catalog: fixtureCatalog,
    description: "Synthetic visual QA fixture", themeColor: "#171714",
  },
};
const fixtureProduct = {
  id: "fixture-product",
  data: { name: "Synthetic QA product", category: "Care", sellingPrice: 80, costPrice: 30, stock: 4, status: "active", description: "Playwright-only fixture", imageUrl: "" },
};
const fixturePublicProduct = { ...fixtureProduct.data, id: fixtureProduct.id, storeUrl: "atelier-preview" };
const fixtureOrder = {
  id: "fixture-order", status: "new", createdAt: "2026-01-15T09:00:00.000Z",
  data: { customerName: "Synthetic QA customer", email: "visual-review@example.test", productName: "Synthetic QA product", total: 80, items: [{ name: "Synthetic QA product", quantity: 1, price: 80 }] },
};
const fixtureCustomer = {
  id: "fixture-customer", data: { name: "Synthetic QA customer", email: "visual-review@example.test", phone: "", orders: 1, totalSpent: 80, status: "New", createdAt: "2026-01-15T09:00:00.000Z" },
};
const fixtureWebsite = {
  editorVersion: 2,
  brandName: "Atelier Preview", template: "minimal", sections: [
    { id: "fixture-hero", type: "hero", eyebrow: "PLAYWRIGHT FIXTURE", title: "A considered everyday ritual", body: "Synthetic website content used only to render the public storefront layout.", buttonText: "Explore the collection", href: "#collection" },
    { id: "fixture-collection", type: "collection", title: "The collection", body: "A preview of the product grid.", limit: 4 },
    { id: "fixture-footer", type: "footer", title: "Atelier Preview", body: "Synthetic visual review storefront." },
  ], pages: [],
};
const fixtureCart = [{ productId: "fixture-product", name: "Synthetic QA product", price: 80, quantity: 1, storeUrl: "atelier-preview", category: "Care", imageUrl: "" }];
const fixtureCompletedOrder = {
  id: "ORD-VISUAL-ONLY", customerName: "Synthetic QA customer", paymentStatus: "Pending",
  status: "new", total: 105, address: "Synthetic test address", city: "Test City",
  items: [{ productId: "fixture-product", name: "Synthetic QA product", price: 80, quantity: 1 }],
};

async function installSyntheticApi(page) {
  const intercepted = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/, "");
    intercepted.push(`${request.method()} ${pathname}`);

    let body = {};
    if (pathname === "/auth/me") body = fixtureUser;
    else if (pathname === "/businesses/mine") body = fixtureBusiness;
    else if (pathname === "/businesses/mine/catalog") body = fixtureCatalog;
    else if (pathname.startsWith("/businesses/mine/records")) body = [];
    else if (pathname === "/businesses/mine/analytics") body = { days: [], pages: [], sources: [] };
    else if (pathname === "/businesses/mine/clients") body = [];
    else if (pathname === "/websites/draft") body = { draft: fixtureWebsite, published: null, updatedAt: "2026-01-15T09:00:00.000Z" };
    else if (pathname === "/websites/versions") body = [];
    else if (pathname === "/websites/public/atelier-preview") body = { published: true, website: fixtureWebsite, business: fixtureBusiness };
    else if (pathname === "/websites/publication-diagnostic") body = { published: true, status: "published" };
    else if (pathname === "/products") body = [fixtureProduct];
    else if (pathname === "/orders") body = [fixtureOrder];
    else if (pathname === "/customers") body = [fixtureCustomer];
    else if (pathname === "/orders/fixture-order") body = { id: fixtureOrder.id, ...fixtureOrder.data, status: fixtureOrder.status, createdAt: fixtureOrder.createdAt };
    else if (pathname === "/public/products/atelier-preview") body = [fixturePublicProduct];
    else if (pathname === "/public/products/item/fixture-product") body = fixturePublicProduct;
    else if (pathname.startsWith("/businesses/public/")) body = fixtureBusiness;

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return intercepted;
}

async function inspectPage(page, viewportWidth) {
  return page.evaluate((width) => {
    const root = document.documentElement;
    const body = document.body;
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const headings = [...document.querySelectorAll("h1,h2,h3")].filter(visible).map((item) => item.textContent.trim()).filter(Boolean);
    const rootText = (document.querySelector("#root")?.innerText || "").trim();
    const offscreenControls = [...document.querySelectorAll("button,a,input,select,textarea")]
      .filter(visible)
      .filter((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.left >= -1 && rect.right <= width + 1) return false;
        for (let parent = item.parentElement; parent && parent !== body; parent = parent.parentElement) {
          const overflowX = getComputedStyle(parent).overflowX;
          if ((overflowX === "auto" || overflowX === "scroll") && parent.scrollWidth > parent.clientWidth + 1) return false;
        }
        return true;
      })
      .map((item) => (item.textContent || item.getAttribute("aria-label") || item.getAttribute("placeholder") || item.tagName).trim().slice(0, 60));
    const overflowNodes = [...document.querySelectorAll("body *")]
      .filter((item) => visible(item))
      .map((item) => ({ item, rect: item.getBoundingClientRect() }))
      .filter(({ item, rect }) => rect.right > width + 1 && getComputedStyle(item).overflowX !== "auto" && getComputedStyle(item).overflowX !== "scroll")
      .filter(({ item }) => ![...item.children].some((child) => child.scrollWidth > child.clientWidth + 1))
      .slice(0, 8)
      .map(({ item, rect }) => `${item.tagName.toLowerCase()}.${String(item.className?.baseVal || item.className || "").trim().replace(/\s+/g, ".")} ${Math.round(rect.width)}px@${Math.round(rect.left)}`);
    return {
      viewportWidth: width,
      documentWidth: Math.max(root.scrollWidth, body.scrollWidth),
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > width + 1,
      overflowNodes,
      headings,
      primaryContentVisible: rootText.length > 20 && !rootText.includes("Loading CYB…") && !rootText.includes("Loading..."),
      navigationVisible: visible(document.querySelector(".workspace-navigation, .landing-nav, .editor-toolbar, .auth-brand-panel")),
      offscreenControls,
      screenshotWidth: window.innerWidth,
      screenshotHeight: window.innerHeight,
    };
  }, viewportWidth);
}

for (const viewport of viewports) {
  test.describe(viewport.label, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const [name, route] of routes) {
      test(`${name} renders the real functional route at ${viewport.width}×${viewport.height}`, async ({ page }) => {
        fs.mkdirSync(path.join(outputRoot, viewport.label), { recursive: true });
        const intercepted = await installSyntheticApi(page);
        const protectedRoute = /^\/(dashboard|editor|create-website|products|orders|customers|business|settings|store-setup|store-designer|shipping)(\/|$)/.test(route);
        if (protectedRoute) {
          await page.addInitScript((user) => sessionStorage.setItem("getcyb_session_user", JSON.stringify(user)), fixtureUser);
        }
        if (route === "/cart" || route === "/checkout") {
          await page.addInitScript((cart) => localStorage.setItem("businessCart", JSON.stringify(cart)), fixtureCart);
        }
        if (route === "/order-success") {
          await page.addInitScript((order) => localStorage.setItem("completedOrder", JSON.stringify(order)), fixtureCompletedOrder);
        }
        await page.goto(route);
        await expect(page.locator("#root")).not.toBeEmpty();
        await expect(page.getByText("Loading CYB…")).toBeHidden({ timeout: 15_000 });
        await expect(page.getByText("Loading...", { exact: true })).toBeHidden({ timeout: 15_000 });
        await expect.poll(async () => (await page.locator("#root").innerText()).trim().length, { timeout: 15_000 }).toBeGreaterThan(20);
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

        const layout = await inspectPage(page, viewport.width);
        await page.screenshot({ path: path.join(outputRoot, viewport.label, `${name}.png`) });
        expect(layout.primaryContentVisible, `${name}: expected settled page content; headings: ${layout.headings.join(" | ")}`).toBeTruthy();
        expect(layout.horizontalOverflow, `${name}: horizontal overflow ${layout.documentWidth}/${viewport.width}; ${layout.overflowNodes.join("; ")}`).toBeFalsy();
        expect(layout.offscreenControls, `${name}: controls outside viewport`).toEqual([]);
        expect(intercepted.every((item) => !item.includes("https://")), `${name}: unexpected external API request`).toBeTruthy();
      });
    }
  });
}

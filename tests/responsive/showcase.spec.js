import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const outputRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../artifacts/responsive");
const viewports = [
  { label: "desktop-1440x900", width: 1440, height: 900 },
  { label: "tablet-768x1024", width: 768, height: 1024 },
  { label: "mobile-390x844", width: 390, height: 844 },
  { label: "mobile-375x812", width: 375, height: 812 },
];

const slug = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function inspectLayout(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const root = document.documentElement;
    const nav = document.querySelector(".showcase-screen-nav");
    const selected = nav?.querySelector('[aria-current="page"]');
    const navRect = nav?.getBoundingClientRect();
    const selectedRect = selected?.getBoundingClientRect();
    const overlapSelectors = [
      ".showcase-topbar", ".showcase-fixture-note", ".showcase-page-title",
      ".showcase-state-tabs", ".showcase-screen-stage", ".showcase-footer",
      ".showcase-card", ".showcase-kpi", ".proposal-hero", ".proposal-feature-grid article",
      ".public-feature-row article", ".public-about-values article", ".template-gallery-grid article",
      ".storefront-grid article", ".public-contact-form", ".checkout-preview > *",
      ".customer-product > *", ".customer-cart > *",
    ];
    const blocks = [...new Set(overlapSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]))]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
      });
    const overlaps = [];
    for (let i = 0; i < blocks.length; i += 1) {
      for (let j = i + 1; j < blocks.length; j += 1) {
        const a = blocks[i];
        const b = blocks[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const width = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const height = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (width > 2 && height > 2) overlaps.push(`${a.className || a.tagName} ↔ ${b.className || b.tagName}`);
      }
    }
    const clippedText = [...document.querySelectorAll(
      ".showcase-page-title h2, .showcase-page-title p, .showcase-screen-body h1, .showcase-screen-body h2, .showcase-screen-body h3, .showcase-screen-body p, .showcase-screen-body button, .showcase-screen-body label",
    )].filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (!r.width || !r.height || s.display === "none" || s.visibility === "hidden") return false;
      const clips = [s.overflowX, s.overflowY].some((value) => value === "hidden" || value === "clip") || s.textOverflow === "ellipsis";
      return clips && (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2);
    }).map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 80));
    const mainRect = document.querySelector(".showcase-main")?.getBoundingClientRect();
    const stageRect = document.querySelector(".showcase-screen-stage")?.getBoundingClientRect();
    const stageBodyRect = document.querySelector(".showcase-screen-body")?.getBoundingClientRect();
    const offscreenControls = [...document.querySelectorAll(".showcase-screen-body button, .showcase-screen-body input, .showcase-screen-body textarea, .showcase-screen-body select")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && (r.left < -1 || r.right > viewportWidth + 1);
      }).map((el) => (el.textContent || el.getAttribute("aria-label") || el.placeholder || el.tagName).trim().slice(0, 60));
    const selectedNavVisible = Boolean(selectedRect && navRect && selectedRect.left >= navRect.left - 1 && selectedRect.right <= navRect.right + 1 && selectedRect.top >= navRect.top - 1 && selectedRect.bottom <= navRect.bottom + 1);
    return {
      viewportWidth,
      viewportHeight: window.innerHeight,
      documentWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > viewportWidth + 1,
      selectedNavVisible,
      nav: navRect && { width: navRect.width, height: navRect.height, scrollWidth: nav.scrollWidth, scrollHeight: nav.scrollHeight },
      main: mainRect && { left: mainRect.left, right: mainRect.right },
      stage: stageRect && { left: stageRect.left, right: stageRect.right },
      stageBody: stageBodyRect && { left: stageBodyRect.left, right: stageBodyRect.right },
      clippedText,
      offscreenControls,
      overlaps,
      tableOverflow: [...document.querySelectorAll(".showcase-table-scroll")].map((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        contained: el.scrollWidth <= el.clientWidth || getComputedStyle(el).overflowX === "auto" || getComputedStyle(el).overflowX === "scroll",
      })),
    };
  });
}

for (const viewport of viewports) {
  test.describe(`${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test(`all 62 screens, states, and layouts at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      fs.mkdirSync(path.join(outputRoot, viewport.label), { recursive: true });
      await page.goto("/design-showcase");
      const navButtons = page.locator(".showcase-screen-nav button");
      await expect(navButtons).toHaveCount(62);
      await expect(page.getByText("Every example record, value and state here is synthetic", { exact: false })).toBeVisible();
      const screenNames = await navButtons.allTextContents();
      const failures = [];

      for (const screen of screenNames) {
        const navButton = page.locator(".showcase-screen-nav").getByRole("button", { name: screen, exact: true });
        await navButton.click();
        await expect(page.locator(".showcase-page-title h2")).toHaveText(screen);
        await expect(navButton).toHaveAttribute("aria-current", "page");
        await expect(page.locator(".showcase-screen-body")).toBeVisible();

        const initial = await inspectLayout(page);
        if (initial.horizontalOverflow) failures.push(`${screen}: document horizontal overflow ${initial.documentWidth}/${viewport.width}`);
        if (!initial.selectedNavVisible) failures.push(`${screen}: selected navigation item is clipped or not in view`);
        if (initial.clippedText.length) failures.push(`${screen}: clipped text ${initial.clippedText.join(" | ")}`);
        if (initial.offscreenControls.length) failures.push(`${screen}: controls outside viewport ${initial.offscreenControls.join(" | ")}`);
        if (initial.overlaps.length) failures.push(`${screen}: overlapping layout blocks ${initial.overlaps.slice(0, 3).join(" | ")}`);
        if (initial.tableOverflow.some((table) => !table.contained)) failures.push(`${screen}: table escapes its responsive scroll container`);

        const stageBefore = await page.locator(".showcase-screen-stage").boundingBox();
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const stageAfter = await page.locator(".showcase-screen-stage").boundingBox();
        if (stageBefore && stageAfter && (Math.abs(stageBefore.x - stageAfter.x) > 2 || Math.abs(stageBefore.y - stageAfter.y) > 2 || Math.abs(stageBefore.width - stageAfter.width) > 2)) {
          failures.push(`${screen}: layout shifted after render`);
        }

        await page.screenshot({ path: path.join(outputRoot, viewport.label, `${slug(screen)}.png`) });

        for (const [label, selector] of [["Empty state", ".showcase-empty"], ["Loading state", ".showcase-loading"], ["Error state", ".showcase-error"]]) {
          await page.getByRole("tab", { name: label, exact: true }).click();
          await expect(page.locator(selector)).toBeVisible();
          if (screen === "Dashboard overview") {
            await page.screenshot({ path: path.join(outputRoot, viewport.label, `dashboard-${slug(label)}.png`) });
          }
        }
        await page.getByRole("tab", { name: "Screen", exact: true }).click();
        await expect(page.locator(".showcase-page-title h2")).toHaveText(screen);
      }

      fs.writeFileSync(path.join(outputRoot, viewport.label, "layout-summary.json"), JSON.stringify({ viewport, screens: screenNames.length, failures }, null, 2));
      expect(failures, failures.slice(0, 40).join("\n")).toEqual([]);
    });
  });
}

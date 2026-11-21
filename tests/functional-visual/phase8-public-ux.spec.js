import { expect, test } from "@playwright/test";

test.describe("Phase 8 premium public experience", () => {
  test("home page explains CYB and exposes clear pricing and sample designs", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /build your website before you pay/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /everything your business needs/i })).toBeVisible();
    await expect(page.locator("#pricing")).toContainText("$246");
    await expect(page.getByText(/no monthly platform subscription/i)).toBeVisible();
    await expect(page.getByText(/these are sample brand concepts, not customer testimonials/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /sign up|create account|get started/i }).first()).toBeVisible();
  });

  test("FAQ controls expose expanded state and their answer regions", async ({ page }) => {
    await page.goto("/");
    const question = page.getByRole("button", { name: /do i need coding experience/i });
    await expect(question).toHaveAttribute("type", "button");
    await expect(question).toHaveAttribute("aria-expanded", "true");

    const answerId = await question.getAttribute("aria-controls");
    expect(answerId).toBeTruthy();
    await expect(page.locator(`#${answerId}`)).toBeVisible();

    const nextQuestion = page.getByRole("button", { name: /can i sell physical products/i });
    await nextQuestion.click();
    await expect(nextQuestion).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#${await nextQuestion.getAttribute("aria-controls")}`)).toBeVisible();
    await expect(question).toHaveAttribute("aria-expanded", "false");
  });

  test("terms state the current one-time price without describing a free trial", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByText(/CYB Lifetime Access costs \$246 USD as a one-time payment/i)).toBeVisible();
    await expect(page.getByText(/No free trial is included/i)).toBeVisible();
  });

  test("landing content stays within desktop, tablet, and mobile widths", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: /build your website before you pay/i })).toBeVisible();
      const widths = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
      expect(widths.content, `unexpected horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(widths.viewport + 1);
    }
  });
});

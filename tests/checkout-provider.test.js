import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("platform activation loads and offers Stripe only", async () => {
  const [main, paymentPage, appModule, routes] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/pages/PlatformPayment.jsx"),
    read("../backend/src/module.ts"),
    read("../backend/src/routes.ts"),
  ]);

  assert.doesNotMatch(main, /paypal/i);
  assert.doesNotMatch(paymentPage, /paypal/i);
  assert.match(paymentPage, /Pay securely with Stripe/);
  assert.match(appModule, /StripeController/);
  assert.doesNotMatch(appModule, /PayPalController/);
  assert.doesNotMatch(routes, /payments\/paypal/i);
});

test("store checkout presents cash on delivery without unavailable payment providers", async () => {
  const paymentPage = await read("../src/pages/Payment.jsx");
  assert.doesNotMatch(paymentPage, /paypal/i);
  assert.match(paymentPage, /Cash on delivery/);
});

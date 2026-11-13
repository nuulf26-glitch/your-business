import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { checkoutAttemptKey } from "../src/services/storefrontCheckout.js";

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
  assert.match(paymentPage, /cashOnDeliveryToken/);
  assert.match(paymentPage, /verified payment account connected/);
  assert.doesNotMatch(paymentPage, /Apple Pay|Google Pay|Visa|Mastercard/);
});

test("checkout reuses a strong request key only for identical order details", async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const form = { fullName: "A Customer", email: "a@example.com", phone: "+971500000000", address: "1 Main St", city: "Al Ain", notes: "" };
  const cart = [{ productId: "prod_1", quantity: 2 }];

  const first = await checkoutAttemptKey(form, cart, storage, webcrypto);
  const retry = await checkoutAttemptKey(form, cart, storage, webcrypto);
  const changed = await checkoutAttemptKey(form, [{ ...cart[0], quantity: 3 }], storage, webcrypto);

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(retry, first);
  assert.notEqual(changed, first);
  assert.doesNotMatch(values.get("storefrontCheckoutAttempt"), /a@example\.com/);
});

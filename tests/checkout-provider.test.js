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
  const [paymentPage, settingsPage, payments] = await Promise.all([
    read("../src/pages/Payment.jsx"),
    read("../src/pages/Settings.jsx"),
    read("../backend/src/merchant-payments.ts"),
  ]);
  assert.match(paymentPage, /Cash on delivery/);
  assert.match(paymentPage, /payment\/tap/);
  assert.match(settingsPage, /Payment providers/);
  assert.match(settingsPage, /0% commission/);
  assert.match(payments, /TAP_PLATFORM_TEST_APPROVED==='true'/);
  assert.match(payments, /sk_test_/);
  assert.match(payments, /encryptMerchantPaymentSecret/);
  assert.match(payments, /id:'paypal',name:'PayPal',enabled:false/);
  assert.match(payments, /id:'payd',name:'Payd',enabled:false/);
  assert.match(payments, /bank_transfer/);
  assert.match(payments, /external_payment_link/);
  assert.match(paymentPage, /payment\/manual/);
  assert.match(settingsPage, /manual-options/);
});

test("Stripe merchant checkout is test-only, direct-account, and mounts Stripe Payment Element", async () => {
  const [paymentPage, settingsPage, payments, routes] = await Promise.all([
    read("../src/pages/Payment.jsx"),
    read("../src/pages/Settings.jsx"),
    read("../backend/src/merchant-payments.ts"),
    read("../backend/src/routes.ts"),
  ]);
  assert.doesNotMatch(payments, /STRIPE_BYOG_TEST_APPROVED/);
  assert.match(payments, /Only UAE Stripe sandbox credentials are accepted/);
  assert.match(payments, /rk_test_/);
  assert.match(payments, /pk_test_/);
  assert.match(payments, /payment_method_types\[0\]/);
  assert.match(payments, /payment_intents/);
  assert.match(payments, /stripeByogWebhookValid/);
  assert.match(payments, /merchantPaymentLock/);
  assert.match(paymentPage, /https:\/\/js\.stripe\.com\/v3\//);
  assert.match(paymentPage, /paymentElement\.mount/);
  assert.match(paymentPage, /elements\.create\("expressCheckout"/);
  assert.match(paymentPage, /applePay: "auto", googlePay: "auto"/);
  assert.match(paymentPage, /confirmPayment\(/);
  assert.match(settingsPage, /Visa and Mastercard/);
  assert.match(settingsPage, /Apple Pay or Google Pay/);
  assert.match(settingsPage, /Connect restricted test account/);
  assert.match(routes, /cancelPayment\(secret/);
});

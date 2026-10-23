# Merchant payment architecture — decision pending

Research checked 24 October 2026 against provider documentation. No live payment integration has been activated, no existing subscription price changed, and no provider account opened.

## Existing implementation
`functions/index.js` implements PayPal sandbox payments for GETCYB platform access. This must remain separate from merchants accepting customer payments. `src/pages/Payment.jsx` reports customer PayPal as not connected; its existing cash-on-delivery writes and the legacy checkout still require a separate server-authoritative order/inventory release.

## Non-negotiable money flow
Customer → payment provider → the merchant's connected account and settlement bank account. GETCYB must not collect all merchant money into its own bank account. Provider balance routing, merchant-of-record status, platform fees and bank settlement must be understood independently.

## Provider findings
- Stripe direct charges place charges on the connected account: https://docs.stripe.com/connect/direct-charges . This is a candidate only where platform jurisdiction, account model and provider approval permit it.
- Stripe's UAE guidance restricts available connected-account/charge configurations. Do not assume a generic Standard/direct-charge tutorial applies to a UAE platform. Confirm the actual legal entity, supported merchant countries and approved configuration with Stripe: https://support.stripe.com/questions/connect-availability-in-the-uae . Destination charges and separate charges/transfers must not be silently substituted for the requested flow.
- PayPal multiparty payments support seller onboarding and marketplace operations: https://developer.paypal.com/platforms/overview . Live platform APIs require partner approval; sandbox testing can precede approval: https://developer.paypal.com/platforms/get-started . Eligibility for this exact UAE business and its merchant countries is not verified.
- PayPal's integration checklist covers onboarding readiness, sale/refund tests, partner attribution and scopes: https://developer.paypal.com/platforms/integration-checklist . Its published guide recommends onboarding merchants before payment.

## Required server design after provider selection
1. Owner-authenticated onboarding endpoint; provider-hosted identity/bank collection; persist merchant account IDs and readiness flags in private server-managed documents. Never accept a browser-provided destination account as authoritative.
2. Verify onboarding completion and payment/payout capabilities through provider API and signed webhooks. Do not enable checkout until required capabilities are active.
3. Server creates orders from merchant products/options, current prices, inventory, taxes and shipping configuration. Use integer minor units, a merchant-scoped idempotency key and atomic stock reservations with expiry.
4. Server creates provider checkout against the verified merchant account. Existing platform access payments and keys remain isolated.
5. Signed, replay-safe webhook verifies account, amount, currency, provider status and order identity; only then mark an order paid. Browser redirects never establish payment success.
6. Owner-authorized refunds, refund idempotency, stock return policy, dispute events, audit history and merchant notifications. Provider/dashboard responsibilities depend on the selected account configuration.
7. Record actual processing fees and refund/dispute costs for accounting; incomplete cost data must show profit as unavailable. Fees vary by country, payment method, account agreement and configuration; no fixed fee schedule has been assumed or added to GETCYB pricing.

## Release gates
Provider confirmation of eligible entity/account model/countries; approved onboarding; sandbox success/failure/duplicate webhook/refund/dispute tests; merchant isolation; regulatory and contractual review for the actual entity and settlement flow; production secrets configured separately; explicit user release approval. These items cannot be certified by a successful Vite build.

# Stripe Connect staging preparation — zero CYB commission

This change adds owner-scoped status verification and Stripe-hosted test onboarding for an existing, operator-provisioned merchant account. It does not create a connected account, payment, transfer, refund or application fee. Card and wallet checkout stays disabled, including after successful onboarding. No database migration is required.

CYB commission is **0% and zero fixed commission**. Merchant processing costs are separate from CYB commission. The status response records `platformCommission: {basisPoints: 0, fixedAmount: 0}` and `processingFeeBearer: 'unconfirmed'`. No processing markup, customer surcharge, VAT line or application fee is implemented. This policy field is preparation, not proof of end-to-end payment processing. The merchant-pays-processing requirement remains conditional on Stripe confirming a technically supported arrangement.

## UAE eligibility blocker

Stripe's UAE support article restricts UAE platforms to UAE Custom connected accounts and destination charges / separate charges and transfers. It does not support the proposed unrestricted direct-charge configuration for a UAE platform. The article also specifies loss-liability restrictions. Get account-specific written confirmation from Stripe before provisioning an account or switching a gate on. Do not guess a controller/loss-liability configuration from generic Connect pricing.

Official sources (checked 14 November 2026):
- https://support.stripe.com/questions/connect-availability-in-the-uae?locale=en-GB
- https://stripe.com/ae/connect/pricing
- https://stripe.com/ae/pricing
- https://docs.stripe.com/connect/destination-charges
- https://docs.stripe.com/connect/account-capabilities
- https://docs.stripe.com/connect/hosted-onboarding

### Capability rejection reported by the account owner

Stripe rejected a request for `transfers` without `card_payments` and required platform approval. This was reported during manual Dashboard setup; it has not been reproduced or cleared by CYB's application. A generic Sandbox flow or a dashboard checkbox is not approval for CYB's exact UAE configuration or for live payments.

Stripe also documents that sandboxes can permit capability-dependent actions before a capability becomes active. A successful sandbox transaction alone must therefore never be treated as proof of live capability eligibility.

The service reads the connected account's capability objects and their explicit `requested` fields. For transfers-only accounts it returns `connectionStatus: 'stripe_approval_required'` and refuses onboarding until operator configuration records Stripe approval for the pinned CYB platform. It never requests, removes or adds capabilities. Do **not** add `card_payments` just to bypass the error, switch charge types, change country, assume direct charges, or infer merchant-fee handling from a generic pricing page. If Stripe recommends requesting both capabilities, obtain confirmation that this is permitted and appropriate for the exact UAE account model before provisioning it.

Transfers-only destination recipients can have `charges_enabled=false`. Onboarding readiness therefore checks payouts, active transfers and missing requirements; it still never enables checkout. Capability evidence that is missing, duplicated or paginated is rejected.

Destination charges debit the platform balance for Stripe processing fees, refunds and chargebacks. Omitting an application fee gives CYB zero commission, but does not shift those costs to the merchant. Merchant fee recovery, if Stripe approves it, must be designed as cost recovery with merchant consent and reconciliation rather than relabelled as CYB commission or customer VAT. There is no approved cost-recovery implementation in this change.

Account-specific questions prepared for Stripe (not sent):

> CYB is a UAE platform that provides independent licensed merchants with their own storefronts. Our platform commission is 0%. Our account reports: “Your platform needs approval for accounts to have requested the transfers capability without the card_payments capability.” Please approve transfers-only accounts for this platform if supported, or confirm the exact supported UAE Custom account/controller and capability configuration, including whether both card_payments and transfers are permitted and required for our use case. Please confirm the permitted charge type, hosted onboarding, settlement merchant, Stripe/Connect/payout fee payer, any approved mechanism for merchants to bear their own processing costs, and responsibility for refunds, disputes and negative balances. Please resolve the Custom-account and loss-liability restrictions documented for UAE platforms and provide the applicable fees. We need sandbox confirmation first; this request is not authorization to activate live payments. CYB's separate $246 lifetime-access checkout must remain separate from merchant orders.

### Exact next step

The account owner sends the above question from the affected CYB Stripe account at https://support.stripe.com/contact. No support message has been sent by this change. Retain Stripe's platform-specific response and resolve the Dashboard's outstanding capability/verification task. Only then provision an authorized merchant test account with the confirmed configuration, enter the separate test credentials and operator mapping on staging, and exercise hosted onboarding against Stripe. The zero-commission requirement alone does not clear the capability rejection. No live accounts or live payments are authorized.

## Deployment gates (default closed)

Provision only an authorized merchant **test** connected account in the confirmed CYB test platform. Set its `metadata.cybBusinessId` to that merchant's server-side business ID. This requires explicit merchant authorization. No user-facing API can bind account IDs.

The following are staging-only operator configuration; none are added by this PR:

| Variable | Purpose |
| --- | --- |
| `STRIPE_CONNECT_TEST_ONBOARDING_ENABLED=true` | Explicitly enable test onboarding |
| `STRIPE_CONNECT_UAE_CONFIGURATION_CONFIRMED=true` | Set only after Stripe confirms the configuration for CYB |
| `STRIPE_CONNECT_TRANSFERS_ONLY_APPROVED=true` | Set only after Stripe approves transfers without card_payments for the pinned CYB platform; not a workaround or approval request |
| `STRIPE_CONNECT_TEST_SECRET_KEY` | Separate `sk_test_` credential; never falls back to lifetime checkout's key |
| `STRIPE_CONNECT_TEST_PLATFORM_ACCOUNT` | Expected CYB test platform account ID |
| `STRIPE_CONNECT_TEST_ACCOUNT_BINDINGS` | Operator-managed JSON map of business ID to connected test account ID; values must be unique |
| `PUBLIC_APP_URL` | Must exactly equal `https://getcyb-staging-web.onrender.com` |

All endpoints require the existing merchant session guard and global origin guard:
- `GET /api/v1/merchant-payments/stripe-connect/status`
- `POST /api/v1/merchant-payments/stripe-connect/onboarding-link`

Status and onboarding links are not cacheable. The service checks the provider's test balance, exact platform identity, account country/type and business ownership metadata. The hosted onboarding URL is returned only to the owner, must use `https://connect.stripe.com`, and must never be logged. Return/refresh URLs are fixed on staging. A return from Stripe is not evidence of verification; re-fetch status from Stripe. The settings UI and refresh-link regeneration UI are not part of this backend preparation PR.

## Payment integration still required

Before enabling checkout, implement a separately reviewed settlement model, merchant agreements, authoritative server totals, immutable order/account/platform/mode binding, idempotent payment creation, signed dedicated Connect events, amount/currency/account checks, unique provider event/payment records, reconciliation, payment failures/expiry, and refunds with correct transfer/application-fee reversals. Disputes and negative balances require an agreed responsible party and recovery policy. A ready onboarding status must never by itself enable card or wallet checkout.

The existing COD ledger and CYB's $246 lifetime checkout are unaffected. There is no reuse of the platform-access checkout, webhook or payment references.

## Payment methods and costs

Stripe lists Visa, Mastercard, Apple Pay and Google Pay as available in the UAE. Each merchant must still qualify for the approved model. Wallet display also depends on device/browser, wallet setup and the selected checkout integration. All card/wallet options remain disabled here; COD remains available. Source: https://support.stripe.com/questions/which-payments-methods-and-products-are-available-in-the-uae

UAE domestic card processing is advertised at 2.9% + AED 1 per successful payment; international cards and currency conversion each add 1% where applicable. The platform-controlled Connect pricing page advertises AED 7.50 per monthly active account and 0.25% + AED 5.50 per payout, and lists funds-routing/platform-management pricing separately. Confirm the applicable combination with Stripe rather than assuming fees stack or are waived. Applicable tax, refunds (original processing fees retained), disputes, FX and other optional products can add costs.

The earlier 3.9% + AED 1 merchant-markup proposal is superseded by **zero platform commission** and must not be implemented. Processing/Connect fees remain provider costs whose payer must be confirmed. Do not impose a card-specific customer surcharge or label processing fees as VAT. Allocation of processing costs, refunds, disputes and payout responsibilities require documented merchant agreement. Never route merchant money into CYB's platform account without the approved settlement arrangement.

## Validation boundary

Automated provider responses are mocked, including the approved transfers-only scenario. These tests establish code guards and zero-commission policy only; they do not prove Stripe has approved CYB, that a merchant is connected, or that a card/wallet payment settles. The current PR is a preparation draft, not a deployable end-to-end merchant payments release. No settings UI, customer card checkout, payment webhooks or refund processing are added.

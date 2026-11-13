# Stripe Connect staging onboarding

This change adds owner-scoped status verification and Stripe-hosted test onboarding for an existing, operator-provisioned merchant account. It does not create a connected account, payment, transfer, refund or application fee. Card and wallet checkout stays disabled, including after successful onboarding. No database migration is required.

## UAE eligibility blocker

Stripe's UAE support article restricts UAE platforms to UAE Custom connected accounts and destination charges / separate charges and transfers. It does not support the proposed unrestricted direct-charge configuration for a UAE platform. The article also specifies loss-liability restrictions. Get account-specific written confirmation from Stripe before provisioning an account or switching a gate on. Do not guess a controller/loss-liability configuration from generic Connect pricing.

Official sources (checked 13 November 2026):
- https://support.stripe.com/questions/connect-availability-in-the-uae?locale=en-GB
- https://stripe.com/ae/connect/pricing
- https://stripe.com/ae/pricing
- https://docs.stripe.com/connect/destination-charges

Account-specific questions prepared for Stripe (not sent):

> CYB is a UAE software platform for merchant storefronts. Please confirm the supported Connect configuration for our UAE platform and licensed UAE merchants, including account/controller parameters and eligible merchant business types/countries. We intend to allocate processing costs to merchants and may collect a disclosed merchant platform fee. Please confirm whether destination charges or another model is required, who is the settlement merchant, who pays processing/Connect/payout fees, and who is responsible for refunds, disputes and negative balances. Please reconcile the UAE support article's Custom-account requirement with its loss-liability restriction, and provide the exact account configuration enabled for us. Please confirm sandbox access and an itemized applicable fee schedule before we enable payments. We will not process merchant storefront orders through CYB's own lifetime-access checkout.

## Deployment gates (default closed)

Provision only an authorized merchant **test** connected account in the confirmed CYB test platform. Set its `metadata.cybBusinessId` to that merchant's server-side business ID. This requires explicit merchant authorization. No user-facing API can bind account IDs.

The following are staging-only operator configuration; none are added by this PR:

| Variable | Purpose |
| --- | --- |
| `STRIPE_CONNECT_TEST_ONBOARDING_ENABLED=true` | Explicitly enable test onboarding |
| `STRIPE_CONNECT_UAE_CONFIGURATION_CONFIRMED=true` | Set only after Stripe confirms the configuration for CYB |
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

## Costs and proposed pricing

UAE domestic card processing is advertised at 2.9% + AED 1 per successful payment; international cards and currency conversion each add 1% where applicable. The platform-controlled Connect pricing page advertises AED 7.50 per monthly active account and 0.25% + AED 5.50 per payout, and lists funds-routing/platform-management pricing separately. Confirm the applicable combination with Stripe rather than assuming fees stack or are waived. Applicable tax, refunds (original processing fees retained), disputes, FX and other optional products can add costs.

Charging merchants 3.9% + AED 1 was discussed as a proposal, not enabled here. Its 1 percentage-point spread is before Connect/tax/FX/refund/dispute costs, so it is not guaranteed profit. Do not impose a card-specific customer surcharge or label processing fees as VAT. Merchant fees, allocation of processing costs, refunds, disputes and payout responsibilities require documented merchant agreement. Never route merchant money into CYB's platform account without the approved settlement arrangement.

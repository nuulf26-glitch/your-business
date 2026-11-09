# Remaining staging QA — 2026-11-03

Baseline: staging branch `codex/cyb-media-task2-repair-20261029`, commit `03ff6ea` (PR #54). No production deployment or live Stripe configuration changes.

## Implemented and tested

- Stripe diagnostic now reads `/v1/balance`, whose response has `livemode`, instead of expecting that field on `/v1/account`. The diagnostic returns only booleans and configured price/currency, not balances or credentials.
- Staging confirmation rejects live keys and live/missing-mode Checkout sessions before activation. Session ID, owner, metadata intent, payment mode, paid status, amount and currency must match the saved payment reference.
- Signed webhook route: `POST /api/v1/payments/stripe/webhook`. Raw JSON bytes are captured before JSON parsing. HMAC-SHA256 signatures are checked with constant-time comparison and a 300-second timestamp window. Key rotation signatures are accepted. Event mode must match the API key; staging only accepts test mode.
- `checkout.session.completed` and `checkout.session.async_payment_succeeded` activate only a paid matching saved reference. Redelivery and concurrent browser confirmation use the same atomic PENDING-to-COMPLETED transition. A webhook arriving before the reference is saved returns a retryable error.
- New tests cover two-account HTTP password login with the actual SessionGuard (no guard override), private website/draft/product/settings reads, foreign product writes/deletes, foreign media completion, unpaid publishing, and foreign slug/settings overwrite rejection. These are isolated in-memory fixtures, **not** proof of two live staging accounts or PostgreSQL concurrency.
- Google tests cover invalid audience/issuer/subject/expiry/email, verified email requirement, Terms consent for new identities, prevention of silent email-based account linking, secure HttpOnly cookies and subsequent SessionGuard acceptance.

## Browser limitation

Playwright is installed. Chromium is absent. Official installation was attempted and blocked by the execution environment's network policy at `https://cdn.playwright.dev:443`. No alternate mirror or policy bypass was attempted. Exact 1440/1024/768/390/375 browser viewport tests and screenshots remain unverified. Editor canvas previews are not accepted as substitutes.

## Development dependency residual risk

`npm audit --json`: six moderate findings, all attributable to minimatch advisory GHSA-g3hv-75wg-m249 (globparts amplification denial of service), affected `<11.0.1`.

Chains: `eslint -> minimatch`; `eslint -> @eslint/config-array -> minimatch`. npm also propagates the finding to `@eslint-community/eslint-utils`, `@eslint/js`, and `eslint-plugin-react-refresh`, for six reported packages total.

Registry evaluation: latest ESLint 10.14.0 still declares minimatch `^10.2.6` and config-array `^0.23.5`. The fixed minimatch 11.0.1 is outside those declared supported ranges. No compatible fixed version was found. An unsupported major override or ESLint major downgrade was not applied merely to clear the audit.

Actual exposure: development/CI lint processing attacker-controlled glob patterns may exhaust resources. This is not a browser bundle/runtime dependency. Review lint configuration changes and do not execute untrusted PR tooling with secrets. The production API audit was not repeated.

## Live accounts and Google configuration

Existing media test script is obsolete: it expects bearer accessToken signup, omits Terms consent, and predates cookie sessions. It was inspected but not executed. No account, consent, or authentication was fabricated on staging.

One live browser account is available. A second distinct authorized staging account session is still required for live cross-account verification.

Google uses GIS ID tokens posted to `/api/v1/auth/google`, not an OAuth authorization-code redirect callback. Configure the same authorized web client ID as frontend build variable `VITE_GOOGLE_CLIENT_ID` and API runtime variable `GOOGLE_CLIENT_ID`. The authorized JavaScript origin is `https://getcyb-staging-web.onrender.com`. No client secret is required by this implementation. Live Google sign-in remains blocked on owner-authorized configuration; mock identity tests are not a provider login.

## Stripe owner configuration

Existing staging diagnostic reported testMode=false, verified=false, amountCents=24600, currency=usd. No checkout or real charge was attempted.

Required staging-only settings: a legitimate test `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` for the staging endpoint above. Subscribe that test endpoint to the two supported Checkout event types. Keep the existing $246 one-time price. Never place credential values in this report, repository, or chat.

Actual hosted test checkout cancellation/success, signed Stripe delivery, activation and publishing end-to-end remain blocked until those credentials are configured.

## PostgreSQL backup evidence and validation procedure

Render connector confirms existing PostgreSQL 16 database `getcyb-staging-db`, paid plan `0.1c-256mb`, 5 GB disk, available, no HA/read replica. Previous authenticated Recovery view showed three-day PITR, exports retained at least seven days, zero exports and disabled export action. This turn's dashboard access redirected to login; connector database metadata does not expose backup windows or archives. These observations do not prove backup integrity.

Non-destructive procedure once an authorized export is available:

1. Use PostgreSQL 16 or newer `pg_dump --format=custom` through an approved existing connection, without changing the external IP allow list or buying infrastructure. Keep credentials out of command text/logs; use the existing secure connection mechanism.
2. Save the archive privately and record its SHA-256 checksum and size.
3. Run `pg_restore --list archive.dump` to verify the archive directory.
4. Run `pg_restore --file=/dev/null archive.dump` **without `--dbname`** to decompress and parse the full archive without connecting to or modifying any database.
5. Verify expected schema/table entries and compare the stored checksum after transfer.

These checks detect unreadable/truncated archives but do not prove a successful database restore. Full restore validation requires a separately approved disposable target. No archive was available and PostgreSQL client binaries were absent, so this procedure is documented, not claimed as executed. No restore, resource purchase, database deletion, or customer-data export occurred.

## Evidence references

- https://github.com/advisories/GHSA-g3hv-75wg-m249
- https://github.com/stripe/stripe-php/blob/master/lib/Balance.php
- https://docs.stripe.com/events/manage-webhook-endpoints

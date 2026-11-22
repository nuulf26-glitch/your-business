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

## Follow-up verification — 2026-11-04

This continuation starts from merged PR #55 and live staging commit `f6bdcf37d034199c18215e892053a3be84527906`. Render confirms the staging API deployment is live at that commit. The production service and MUSE were not touched.

### Browser and customer journey

- The local Chromium download/font-extraction failure was avoided using the supported remote Chrome environment with its Playwright API; no alternate download mirror was used.
- The remote browser exposes a 1363×936 CSS viewport and no viewport-resize API. The public home, login, signup, and forgot-password routes loaded; at 1363px each checked route had no horizontal document overflow.
- The protected dashboard loaded in the existing authenticated staging session. The staging-only Stripe diagnostic is a real read-only request and returned: `Test mode: no · Verified: no · Amount: $246.00 USD`. No checkout or charge was created.
- Signup showed an unchecked Terms/Privacy checkbox and the Google message “Google sign-in is not configured on this environment.” No account was created and Terms were not accepted.
- The forgot-password form loaded, but no request was submitted: the previously used email was not associated with an account, and no known legitimate test-account email was available to target.
- Exact widths 1440, 1024, 768, 390, and 375px remain unverified because this Playwright surface cannot set or emulate a viewport. Do not mark responsive QA green based on this run.
- The existing PR #55 two-account HTTP tests remain the only account-isolation evidence. They passed against in-memory fixtures; live access using a second authorized account remains blocked. No other account identity was used and no customer records were changed.
- API health returned `{ status: "ok", database: "ok" }`.

### Backups

The Render resource view confirms the same available PostgreSQL 16 staging database, 5 GB disk, and existing paid plan. The Render connector does not expose backup retention windows or downloadable backup archives. Prior owner-authenticated Recovery view observations recorded three-day PITR, exports retained at least seven days, zero exports, and a disabled export action; those are not fresh integrity evidence. No archive could be parsed or checksummed, so backup integrity remains unverified. No database writes, restore, export, or extra-cost resource was used.

### Remaining owner actions

1. **Google Sign-In:** In Google Cloud Console, authorize the web origin `https://getcyb-staging-web.onrender.com` and provide the web OAuth client ID through Render’s staging frontend build variable `VITE_GOOGLE_CLIENT_ID` and staging API runtime variable `GOOGLE_CLIENT_ID`. Use the same client ID in both places; no client secret is used by this implementation. Redeploy the frontend and API, then a real Google sign-in can be checked.
2. **Stripe test mode:** Set a legitimate test-mode `STRIPE_SECRET_KEY` and the signing secret `STRIPE_WEBHOOK_SECRET` on the staging API through Render’s secret environment-variable UI. In Stripe’s test-mode workbench, register `https://getcyb-staging-api.onrender.com/api/v1/payments/stripe/webhook` and subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Then the hosted test checkout, signed delivery, activation, and publish journey can be verified. Keep all secret values out of chat and source control. Current diagnostic still reports test mode unavailable.
3. **Forgot Password:** Identify an email already registered to a staging test account controlled by the owner. Ensure the staging mail provider has valid SMTP host, port, user, sender, and non-empty password configuration. Then one reset request can be submitted to that registered test account and delivery checked. Do not create an account under another person’s identity.
4. **Live isolation:** Provide a second authorized staging test account controlled by the owner, with Terms and any email verification completed normally. Keep its account data isolated from customer records. The existing account session alone cannot prove cross-account denial.
5. **Backup integrity:** The owner must expose an existing retained backup through the authenticated Render Recovery/export flow or provide a safe private archive. It can then be checksummed and parsed using the procedure above without restoring over staging. The connector cannot currently establish exact retention from live metadata or access an archive.


# CYB V1 Final Launch Readiness

**Candidate:** `codex/cyb-v1-final-rc-20261128`  
**Source candidate:** Draft PR #111, commit `44dd846db5ca1a73cc5eecfaede433948a05238f`  
**Status:** Not launch-ready. Authenticated release checks and several provider/operations gates remain.

## Candidate contents

This branch is based on the integrated V1 candidate and includes the accepted V1 areas: authentication, AI website creation and editing, templates and publishing, uploads, e-commerce, CRM, essential analytics, dashboard, merchant isolation, CMS/blogs, and bookings. Marketing automation, advanced inbox, courses, advanced AI automation, advanced reporting, community, and memberships remain out of scope.

The latest code fixes booking validation and timezone handling, the PostgreSQL advisory-lock result that caused reschedule failures, CRM async form feedback, cancelled-order analytics, and AI-generated placeholder copy. It adds booking lifecycle and cross-feature/API-browser regression coverage, restores the complete API routes source, and masks randomly generated ephemeral test credentials in CI.

## Verification evidence

### Automated

- PR #111 backend CI: success; 248 passed, 1 suite and 1 test skipped; backend build passed.
- PR #111 isolated API E2E: success against disposable PostgreSQL; included booking create/reschedule/cancel, publishing and public rendering, public CMS, COD checkout/refund/cancel analytics, CRM, and bidirectional merchant access tests.
- PR #111 Chromium QA: success; 115/115 checks across four viewport sizes. Frontend build, lint, and website setup regressions passed.
- Local verification on this candidate: frontend build passed; ESLint passed with one non-blocking `useMemo` dependency warning in `src/pages/Checkout.jsx`; Prisma schema validation passed; backend build passed; 247 backend tests passed and 2 suites were skipped because no database test URL was configured. `git diff --check` passed.
- Full dependency audits reported zero vulnerabilities for both the frontend and backend dependency trees.
- Synthetic encrypted PostgreSQL backup/restore, integrity, tamper, and truncation tests passed in the inherited recovery workflow. These do not prove recoverability of existing customer data or provider-managed backups.

### Staging and production observations

- Render reports both staging services live at commit `44dd846db5ca1a73cc5eecfaede433948a05238f`.
- Staging API health returned `status: ok` and `database: ok`; the MinIO liveness endpoint returned HTTP 200.
- The staging homepage rendered. The current account's public access could not verify private merchant features, public store publishing, or CMS public rendering.
- The production homepage rendered, and the production API health endpoint returned `status: ok` and `database: ok`. No production settings, data, DNS, or deployment were changed.
- No staging or production migration was run. PR #111 adds no migration on top of its base, but this integrated branch contains seven Prisma migration files relative to `main` (media, terms consent, Google identity, trial previews, checkout key, and throttle storage, plus subscription-default changes). Compare their IDs against the target database's actual `_prisma_migrations` state; do not run them against an existing database without separate approval.
- The earlier staging report's reschedule failure was on the prior deployment. Although the fix is now deployed, authenticated browser verification of rescheduling has not been performed on this commit.

## V1 status

| Area | Status | Evidence and remaining gap |
|---|---|---|
| Authentication | PARTIAL | Earlier staging login and dashboard passed; current staging login/session, logout, reset delivery, expiration, and Safari/mobile session checks were not re-run in this session. |
| AI Website Builder and Editor | PARTIAL | Editor undo/redo, draft save/reload, and responsive preview passed previously; generated copy has regressions; no new paid live AI generation was run. |
| Templates, Drafts, and Publishing | PARTIAL | Draft persistence passed; automated publish/update/public-render tests passed; staging public publishing still requires authorized test-only activation. |
| Media Uploads | PARTIAL | Earlier staging image/video uploads persisted after reload; staging MinIO liveness returned HTTP 200; public published rendering and authenticated ownership checks remain outstanding. |
| E-commerce | PARTIAL | Automated synthetic COD, inventory, cancellation/refund, analytics, and idempotency coverage passed; authenticated store checkout and provider sandbox payment were not completed here. |
| CRM | PARTIAL | Earlier staging lead conversion/task creation passed; automated CRM and ownership tests passed; broader authenticated records, search, notes, and activity verification remains. |
| Essential Analytics | PARTIAL | Automated synthetic payment/refund/cancel accounting passed; live staging reconciliation against authenticated dashboard totals remains. |
| Dashboard | PARTIAL | Staging login/dashboard passed previously; complete current-candidate functional review remains. |
| Security and Merchant Isolation | PARTIAL | Automated bidirectional access tests passed; full direct API isolation across all listed resource types using two signed-in staging merchants remains a release gate. |
| CMS and Blogs | PARTIAL | Staging collection/article creation and persistence passed; automated public CMS tests passed; authenticated public rendering on deployed staging remains blocked by activation. |
| Bookings | PARTIAL | Automated availability/create/reschedule/cancel and timezone tests passed; staging create/cancel passed on the earlier deployment; current deployed reschedule, DST, mobile, and two-merchant checks remain. |

## Payment readiness

- Architecture remains BYOG: 0% CYB commission, merchant-owned processing accounts, and no CYB custody of merchant funds. COD remains available. The $246 lifetime access price is unchanged.
- Stripe is implemented as a UAE-only restricted test-key integration. Credentials are AES-256-GCM encrypted and never returned. PaymentIntents use server-calculated order amounts, signed webhooks, provider verification, idempotency, and test-mode guards. Live processing is disabled.
- Store checkout supports Stripe Payment Element for cards and Stripe Express Checkout for Apple Pay/Google Pay where Stripe, domain, currency, and device/browser eligibility permit. Wallet success has not been tested with a connected merchant test account.
- Google Pay production access requires a PSP, domain submission, integration screenshots/review, and production approval. Apple Pay web setup requires a merchant ID, certificates, and registration/verification of each domain/subdomain where the wallet is shown. Wallet availability varies by user country, device, browser, and supported card/currency; CYB must not promise universal availability.
- Real merchant eligibility, Apple developer setup/domain registration, Google Pay API production approval, and production payment processing remain unverified. Do not enable live processing until these gates and a separate production approval are complete.
- Research references: [Stripe availability in the UAE](https://stripe.com/ae/global), [Stripe supported currencies](https://docs.stripe.com/currencies), [Apple Pay web configuration](https://developer.apple.com/documentation/applepayontheweb/configuring-your-environment), [Google Pay API production access](https://support.google.com/console/answer/10914884?hl=en), and [Google Pay online countries](https://support.google.com/googlepay/answer/12429287?hl=en).

## Backup, infrastructure, and release gates

- Backup implementation uses encrypted PostgreSQL custom-format dumps, integrity checks, strict empty-target restore safeguards, version checks, and no automatic migrations. CI recovery evidence is synthetic only.
- Provider retention, point-in-time recovery, encryption-key custody and rotation, media backups, failure alerts, and a provider-level restore drill remain unverified. Any restore drill must use an empty disposable database and must never restore over staging or production.
- Staging and production API/database health checks returned OK at observation time. Production Render services still reference the older Render branch; production frontend behavior was only checked read-only. Environment variable values, retention settings, and full service-level monitoring were not inspected.
- Do not merge or deploy this candidate to production from this runbook. Preserve the staging/production migration guards and obtain explicit approval for merge, production deployment, live payment activation, configuration changes, and any provider-level recovery drill that requires existing service/data access.

## Actions required before a go decision

1. Approve the staging-only publishing entitlement for one disposable test account, with the short-lived email allowlist and expiry, then remove the temporary configuration after verification. The code only accepts it on `https://getcyb-staging-web.onrender.com` with the exact allowed email and a future expiry; production remains behind paid entitlement.
2. Provide a secure browser-auth route for the two authorized staging merchants (Merchant A and H), or make those accounts available in the authorized browser session. Never send passwords in chat.
3. Approve one paid AI generation if live AI output verification is still required; otherwise the automated mocked/response-normalization checks remain the available evidence.
4. Supply a merchant-owned restricted Stripe test key, publishable key, and webhook signing secret through the secure settings UI if provider sandbox checkout/webhook verification is required. Do not provide them in chat.
5. Complete merchant eligibility and provider setup for live Visa/Mastercard and wallet payments; verify each merchant storefront domain and applicable country/currency/device combinations. Do not enable production credentials without separate approval.
6. Confirm provider backup/retention and encryption-key custody, then schedule an empty disposable-target restore drill if the provider-level recovery gate is required.
7. After all release gates pass, explicitly approve PR merge order and production deployment. This branch/PR must remain unmerged until then.

## Proposed deployment and rollback sequence

1. Review PR ancestry and CI; keep PR #111 and its inherited backup/startup-safety changes in the approved merge order. Do not deploy an ancestor that omits the migrations-startup guard or recovery safeguards.
2. Before merge, take a provider-supported production backup and retain its integrity result; confirm a restorable point and the key custodian. Compare all seven migration IDs against production's actual `_prisma_migrations` state using a read-only check. If any are pending, stop and prepare a separately reviewed, approved migration plan; do not auto-run migrations during service startup.
3. Merge only after explicit approval. Deploy the compatible API first, verify `/api/v1/health` and database connectivity, then deploy the frontend. Keep live merchant processing disabled until separately approved.
4. Smoke-test signup/login/logout, dashboard, draft editing, public publishing with an entitled test owner, published navigation/mobile rendering, COD checkout/order management, CRM, CMS public rendering, bookings, analytics, and resource isolation.
5. Monitor health, error rates, payment/webhook reconciliation, booking failures, upload errors, and database connectivity. If a smoke test fails, stop rollout and redeploy the previous known-good frontend/API commits; do not reverse migrations or restore over the database without a separately approved recovery procedure.

**Decision:** NO-GO until authenticated staging release gates, public publishing/CMS rendering, current deployed booking verification, full merchant isolation, wallet/provider readiness, and operational recovery evidence are closed.

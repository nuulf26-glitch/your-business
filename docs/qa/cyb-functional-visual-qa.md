# CYB functional UI visual QA and interaction evidence

## Scope

This PR keeps CYB's real React routes and production business logic. The isolated PR #81 design showcase is used as a visual reference only; its synthetic records and proposal workflows are not copied into customer routes.

Playwright renders the real frontend route components while intercepting every `/api/v1/**` request inside the test process. No backend, staging or production account, customer record, payment service, or database is used.

## Responsive rendering evidence

GitHub Actions [run 43747045013](https://github.com/nuulf26-glitch/your-business/actions/runs/43747045013) passed build, ESLint, and **92/92 render checks** across 23 functional routes and all four requested viewports: 1440×900, 768×1024, 390×844, and 375×812.

The run produced 92 screenshots and `results.json` in artifact `cyb-functional-visual-qa-e333f310e1e113b5b6fc8ce58805bdeb7ff262af` (artifact ID `14174652269`; available for a limited retention period from the Actions run page).

Route coverage: homepage, login, signup, password recovery/reset, dashboard, editor, templates, website creation, products/inventory, orders/order details, customers, business workspace, settings, store setup/designer, shipping, storefront, product page, cart, checkout UI, and order confirmation.

## Visual fixes and comparison

- Side-by-side screenshot contact sheets compared all 23 route counterparts with PR #81 references at desktop 1440×900 and mobile 390×844. Automated rendering checks covered every route at all four viewports.
- The comparison found mobile Order Details retained a fixed minimum summary-column width, compressing the customer-information card. It now switches to a single column below 900px, with a full-width summary card. The fix was visually inspected at all four viewports in run 43747045013.
- The homepage hero was then changed to a centered editorial layout with serif display typography, warm ivory/beige colors, responsive form controls, and keyboard focus states. The existing prompt field, free-preview action, sample-design route, and $246 copy remain intact. Local build and lint pass after this change; **the new hero has not yet been rendered in a fresh browser screenshot**.
- Earlier refinements remain: responsive Dashboard metrics/help control, tablet workspace navigation, complete Store Designer styling, and semantic Shipping layout.
- Proposal-only content and synthetic records remain isolated. Any proposal that would change product workflows or use unrecovered product requirements remains subject to approval.

## Synthetic interaction test status

Commit `ad311d0e82127fc5d357b54612edfe500e195af3` adds synthetic Playwright flows for cookie-shaped login/session UI, editor draft save/publish requests, product/order/customer UI updates, and storefront/cart/COD checkout. They use in-process API fixtures only; they do not prove backend session security, API persistence, real payment processing, or refunds.

The local environment lacks the Playwright Chromium executable, so the local browser-flow command stopped before running. The Actions run predates these new tests; the available GitHub connector did not trigger a new run for the contents-API commit. **The flow tests are not yet verified.**

## Build and regression checks

- `npm run build` — passed locally after the homepage change.
- `npm run lint` — passed locally after the homepage change.
- 33 isolated Node tests — passed before the latest homepage-only styling change.
- `git diff --check` — passed.
- Responsive route screenshots — 92/92 passed on source commit `e333f310e1e113b5b6fc8ce58805bdeb7ff262af`. Current PR head `304821af612bd8bdbe0412b914347ffd45d8c969` includes the homepage styling and synthetic flow-test changes made after that run; those changes are not covered by the screenshots.

## Release gate and remaining blockers

**Do not deploy this PR to production yet.** No isolated backend/test-account environment is available, and preview-to-staging API access was rejected during the isolation review. Real login/session persistence, backend-backed editor save/publish, product/order/customer mutations, store checkout, refunds, and authenticated route compatibility remain unverified. Synthetic UI tests are not substitutes for those checks.

The required next step is an authorized isolated CYB test API/database with synthetic accounts and payment-provider test mode. Refund tests require a safe payment test environment; none was used. The PR remains Draft. No backend, database, authentication logic, Stripe, DNS, production deployment, or MUSE changes were made.
# CYB functional UI visual QA and interaction evidence

## Scope

This PR keeps CYB's real React routes and production business logic. The isolated PR #81 design showcase is used as a visual reference only; its synthetic records and proposal workflows are not copied into customer routes.

Playwright renders the real frontend route components while intercepting every `/api/v1/**` request inside the test process. No backend, staging or production account, customer record, payment service, or database is used.

## Responsive rendering

GitHub Actions [run 43747045013](https://github.com/nuulf26-glitch/your-business/actions/runs/43747045013) passed build, ESLint, and **92/92 render checks** across 23 functional routes and all four requested viewports: 1440×900, 768×1024, 390×844, and 375×812.

The run produced 92 screenshots and `results.json` in artifact `cyb-functional-visual-qa-e333f310e1e113b5b6fc8ce58805bdeb7ff262af` (artifact ID `14174652269`; available for a limited retention period from the Actions run page).

Route coverage: homepage, login, signup, password recovery/reset, dashboard, editor, templates, website creation, products/inventory, orders/order details, customers, business workspace, settings, store setup/designer, shipping, storefront, product page, cart, checkout UI, and order confirmation.

## Visual fixes and comparison

- Side-by-side screenshot contact sheets compared all 23 route counterparts with the PR #81 references at desktop 1440×900 and mobile 390×844. Automated rendering checks covered every route at all four viewports.
- The comparison found mobile order details retained a fixed minimum summary-column width, compressing the customer-information card. The page now switches to a single-column layout below 900px; the summary card becomes full-width.
- The new order-details layout was visually inspected at 1440×900, 768×1024, 390×844, and 375×812 in the run's screenshots.
- Existing previously confirmed refinements remain: responsive dashboard metrics/help control, tablet workspace navigation, complete Store Designer styling, and semantic Shipping layout.
- Some showcase pages are explicitly illustrative proposals. Functional pages retain their real forms, actions, and data structure; proposal-only content is not shown to customers. Exact one-to-one copy/layout changes that would alter homepage messaging or functional information hierarchy still need product/design approval.

## Additional isolated interaction tests

Commit `ad311d0e82127fc5d357b54612edfe500e195af3` adds synthetic Playwright flows for cookie-shaped login/session UI, editor draft save/publish API requests, product/order/customer UI updates, and product-to-cart plus cash-on-delivery checkout. These tests use only in-process API fixtures and do not prove backend session security, API persistence, payment processing, or refunds.

The local environment lacks the Playwright Chromium executable; the local flow-test command therefore stopped before executing browser tests. The GitHub Actions run above predates this test-only commit, and a new Actions run was not available for it. The flow specs are **not yet verified**.

## Build and regression checks

- `npm run build` — passed locally.
- `npm run lint` — passed locally.
- 33 isolated Node tests — passed.
- `git diff --check` — passed.
- Responsive Playwright rendering — 92/92 passed on source commit `e333f310e1e113b5b6fc8ce58805bdeb7ff262af`. Current PR head `ad311d0e82127fc5d357b54612edfe500e195af3` adds only the new flow-test file after that run.

## Release gate and remaining blockers

**Do not deploy this PR to production yet.** No isolated backend/test-account environment has been made available, and preview-to-staging API access was rejected during the isolation review. Consequently, real login/session persistence, backend-backed editor save/publish, product/order/customer mutations, store checkout, refunds, and authenticated route compatibility have not been verified. The synthetic flow tests do not substitute for those checks.

The required next step is an authorized isolated CYB test API/database with synthetic accounts and payment-provider test mode. Refund tests require a safe payment test environment; none was used. The PR remains Draft. No backend, database, authentication logic, Stripe, DNS, production deployment, or MUSE changes were made.
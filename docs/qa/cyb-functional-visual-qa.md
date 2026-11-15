# CYB functional frontend visual QA

## Scope and evidence

The Playwright run renders the actual React route components from the production-based PR branch. It runs Vite locally in GitHub Actions and intercepts `/api/v1/**` requests inside the test process with clearly synthetic fixtures. It does not connect to a CYB backend, log into a real account, or verify authenticated production behavior.

Screenshots and `results.json` are attached to [GitHub Actions run 43743043104](https://github.com/nuulf26-glitch/your-business/actions/runs/43743043104) as artifact `cyb-functional-visual-qa-007bccd417f5583007c7cbb28a52cb1513eb8b45` (92 route/viewport images). The run passed 92/92 layout cases. A subsequent run for the latest polish commit is recorded in PR checks.

Automated checks cover settled content, horizontal document overflow, visible navigation, controls outside the viewport, and accidental API requests escaping the local fixture. This is a responsive rendering check, not an assertion that the visual structure is identical to the showcase's synthetic proposal screens.

## Route and viewport matrix

Each row is captured and checked at desktop 1440×900, tablet 768×1024, mobile 390×844, and mobile 375×812.

| Functional screen | Route | Render check |
| --- | --- | --- |
| Homepage | `/` | Pass |
| Login | `/login` | Pass |
| Signup | `/signup` | Pass |
| Forgot password | `/forgot-password` | Pass |
| Reset password | `/reset-password?token=visual-test` | Pass |
| Dashboard | `/dashboard` | Pass |
| Website editor | `/editor` | Pass |
| Templates | `/templates` | Pass |
| Create website | `/create-website` | Pass |
| Products and inventory | `/products` | Pass |
| Orders | `/orders` | Pass |
| Order details | `/orders/fixture-order` | Pass |
| Customers | `/customers` | Pass |
| Business workspace | `/business` | Pass |
| Settings | `/settings` | Pass |
| Store setup | `/store-setup` | Pass |
| Store designer | `/store-designer` | Pass |
| Shipping | `/shipping` | Pass |
| Public storefront | `/store/atelier-preview` | Pass |
| Product page | `/product/fixture-product` | Pass |
| Cart | `/cart` | Pass |
| Checkout UI | `/checkout` | Pass |
| Order confirmation UI | `/order-success` | Pass |

## Visual review notes and changes

- Functional routes use the CYB styling and workspace treatments already present in the production-based branch. The showcase is an illustrative design reference; its synthetic examples are not copied into real customer routes.
- A mobile Dashboard screenshot exposed the direct “Net profit” label and “Not available” value sitting on the same line. The stat label/value now stack, with a readable value line height.
- On small screens, the floating help action covered too much underlying content. It now collapses to a compact, accessible icon button; its accessible name remains available to assistive technology.
- Shipping now uses a labeled section instead of nesting a second `<main>` inside the shared dashboard layout.
- A visually reviewed mobile Editor screenshot retained its charcoal workspace and controls without horizontal page overflow. The Shipping mobile screen stacks its summary cards and controls without horizontal page overflow.

## Checks and limits

- Latest CI run: see PR #82 checks for build, ESLint, and Playwright result on commit `7f748b0b254be5e6fbd1546f50924265987f68b0`.
- `npm run build` — passed locally after the final polish.
- `npm run lint` — passed locally after the final polish.
- Existing isolated Node tests — 27 passed (integration tests excluded because the integration runner does not exit cleanly in this environment).
- `git diff --check` — passed.
- Not verified: real login/session persistence, backend-backed Dashboard data, editor save/publish against a service, real product/order/customer mutations, checkout/payment/refund, and authenticated production routes. The available preview has no isolated backend/test-account session, so this change is not cleared for production deployment.
- Visual matching is not pixel-perfect: showcase proposal content and its synthetic layouts intentionally differ from working forms, records, and controls on functional routes. Further product/design review is needed for any requested one-to-one layout/content changes that could alter workflows.

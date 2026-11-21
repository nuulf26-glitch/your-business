# CYB Phase 5 — Analytics & Reporting Checklist

## Implementation

- [x] Add merchant-authenticated analytics overview and saved report APIs.
- [x] Aggregate website traffic, referrals, devices, browsers, page/landing/exit pages, and engagement events.
- [x] Require explicit anonymous analytics consent on published storefronts; retain only hashed random visitor/session identifiers, coarse source host, page path, device, and browser.
- [x] Aggregate order collections and refunds from payment ledger timestamps; exclude unpaid COD/pending orders from collected revenue and paid product rankings.
- [x] Add sales channel, product/variant, repeat purchase, customer value, lead, pipeline, and task metrics.
- [x] Support date ranges, previous-period comparisons, and daily/weekly/monthly/yearly summaries.
- [x] Add responsive dashboard, empty states, saved report configurations, CSV export, and print-to-PDF.
- [x] Use existing PostgreSQL business records; no Prisma schema or migration changes.
- [x] Keep scheduled delivery disabled; no external messaging or paid infrastructure added.

## Verification

- [x] Backend unit coverage for collected payments, refunds, unpaid orders, identity privacy, date zones, and merchant scoping.
- [x] Frontend interaction and responsive viewport flow added to Playwright visual QA.
- [x] Frontend production build.
- [x] Backend tests, Prisma validation, and backend build.
- [ ] GitHub Actions CI and isolated real-API E2E on PR #86.
- [ ] Playwright responsive screenshots from GitHub Actions (local browser download is blocked in this runtime).
- [ ] Live staging analytics checks with an authorized merchant session and opted-in storefront visitor.

## Deployment and launch blockers

- [ ] Deploy the Phase 5 commit to isolated staging after confirming the existing staging migration ledger is unchanged.
- [ ] Verify API health, authenticated analytics, report export, and zero cross-merchant access on staging.
- [ ] Keep Phase 4 authenticated live staging QA pending.
- [ ] Keep Phase 3 live cross-merchant isolation verification pending.
- [x] No production deployment, customer-data change, DNS change, Stripe change, or checkout change.

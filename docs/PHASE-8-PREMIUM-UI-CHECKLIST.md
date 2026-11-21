# CYB Phase 8 — Premium UI/UX Redesign

## Recovered scope

Source: `Pasted text(20261028-234445).txt`, Phase 8. The brief requires CYB's warm beige, white, black, and neutral identity; a clear product landing page; authentic product previews; AI/editor/template explanations; accurate pricing and trial information; FAQ and signup; and straightforward dashboard access to applicable website, store, analytics, settings, and help tasks. It prohibits fabricated testimonials and unverified ratings.

## Status at Phase 6 baseline

- **Implemented:** Premium neutral landing page, brand-consistent hero, working sample design links, template gallery, AI and editor explanations, one-time $246 pricing, free preview workflow, FAQ, and prominent signup entry points.
- **Implemented:** Dashboard actions for editing the website, opening its public store URL, and navigating to products, orders, customers, analytics, and settings. The store switcher exposes owned stores.
- **Partial:** Dashboard navigation labels its workspace entry “Overview” rather than “My websites” and has no direct help link. FAQ controls do not expose their disclosure state to assistive technology.
- **Not verified:** Live customer journeys and visual rendering in authenticated production/staging environments; this branch does not deploy.
- **No fabricated testimonials or ratings were found in the active landing page.** Sample designs and illustrative analytics are labeled as samples.

## Implemented on this branch

- Renamed the dashboard workspace navigation entry to “My websites.”
- Added a “Help & FAQ” link to the public FAQ section.
- Added accessible disclosure state, stable control/answer relationships, semantic answer regions, and keyboard focus styling to FAQ controls.
- Added focused Playwright checks for the landing page, pricing copy, sample-design disclosure, FAQ state, and legal no-free-trial wording.

## Deferred / unresolved

- The recovered Phase 8 brief asks for 14-day trial information, but current Terms state that no free trial is included. The latest project direction is to preserve the $246 lifetime checkout and not represent a trial duration. This branch preserves current legal/pricing language and does not alter checkout behavior pending a clear approved policy.
- No production/staging browser session was used; no deployment, DNS, Stripe, database, or infrastructure changes were made.

## Verification on this branch

- Frontend production build: **Passed**.
- ESLint: **Passed**, with one existing `Checkout.jsx` React hook dependency warning.
- Focused Playwright public UX suite: **Blocked**. Playwright's bundled Chromium is not installed, and system Chromium exits because this runtime denies its required local socket (`Operation not permitted`). The test suite is committed for GitHub Actions/browser-enabled execution; no visual pass is claimed here.

# CYB monochrome functional UI and responsive QA

## Scope

This PR keeps the real CYB React routes and their existing API contracts. The isolated PR #81 showcase and Playwright fixtures are used only for visual/test references; synthetic records are intercepted inside the test process and are not added to customer routes or production data.

The CYB platform UI uses black, white, and neutral gray. Editor chrome, shared status/empty/loading/error components, public homepage/auth, dashboard, business workspace, commerce screens, and navigation controls use grayscale styling. The editor canvas, public storefront, template previews, merchant-selected colors, uploaded images, and user customizations remain unchanged.

## Responsive screenshot evidence

GitHub Actions [run 43750709090](https://github.com/nuulf26-glitch/your-business/actions/runs/43750709090) tested commit `d983f759f466e1f3f0b303eb693a571cd483cc24`. It passed the frontend build, ESLint, and **96/96 Playwright cases** (92 route/viewports plus four synthetic interaction flows). There were no skipped, failed, or flaky tests.

The run captured **92 screenshots**: all 23 functional routes at 1440×900, 768×1024, 390×844, and 375×812. Artifact: `cyb-functional-visual-qa-d983f759f466e1f3f0b303eb693a571cd483cc24` (ID `14175792985`, available until 2026-11-18). Download from the Actions run page.

Routes: homepage, login, signup, forgot password, reset password, dashboard, editor, templates, create website, products, orders, order details, customers, business workspace, settings, store setup, store designer, shipping, storefront, product page, cart, checkout, and order confirmation.

All 92 screenshots were reviewed in viewport contact sheets. The update neutralizes the editor toolbar/device controls, library placeholders, shared badges and states, and the Dashboard active-account marker. The neutral focus rings apply to CYB controls. The user website canvas still shows its selected merchant theme, including its chosen colors, so the platform UI recoloring does not overwrite website customization. No new overflow or clipping defect was observed; automated checks also found zero horizontal overflow and zero controls outside the viewport.

## Accessibility checks

Keyboard focus indicators are now explicit for shared CYB components, navigation, forms, and editor controls, with white focus outlines on dark navigation and neutral focus outlines on the dark editor. Status remains conveyed with text (the account indicator is a plain check mark, not a colored emoji).

Sampled grayscale text/button contrast ratios meet WCAG AA for normal text: #171717 on #fefefe = 17.78:1; #767676 on #fefefe = 4.50:1; #555555 on #f0f0f0 = 6.54:1; #d6d6d6 on #141416 = 12.66:1; white on #171717 = 17.93:1. This is a targeted visual/token check, not a complete independent WCAG audit.

## Synthetic interaction test boundary

The four Playwright flows exercise cookie-shaped synthetic login/session UI, editor draft save/publish requests, product/order/customer UI updates, and storefront cart/COD request flow. The browser intercepts API requests in-process; these tests **do not** verify a real backend, database persistence, authentication security, real checkout/payment, or refund processing.

## Release status

**Not cleared for production deployment.** The required isolated authenticated backend/test account is unavailable. The prior preview-to-staging API connection was rejected during the isolation review, and production credentials/data/payment flows must not be used as a substitute. Real session persistence, editor persistence/publishing, product/order/customer mutations, and checkout/refund compatibility therefore remain unverified.

No production deployment, rollback change, backend/database/authentication change, Stripe/payment change, DNS change, or MUSE change was made. PR #82 remains Draft. A rollback point should be recorded only if deployment is later authorized after the isolated critical tests pass.

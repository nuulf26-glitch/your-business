# CYB Phase 9 — Customer Experience

Source: `Pasted text(20261028-234445).txt`, Phase 9. The current implementation sequence keeps the Phase 6 $246 lifetime checkout and does not restore the retired 14-day trial.

## Journey requirements

- [x] Explain CYB on the public landing page; the existing landing page remains in place.
- [x] Continue from account creation into the signed-in website setup flow.
- [ ] Start the trial. **Deferred due to the newer approved pricing decision:** the 14-day trial was removed; this branch does not change billing or the $246 lifetime checkout.
- [x] Offer a choice to start with an available template or AI.
- [x] Route the AI choice directly to the editor's AI draft flow.
- [x] Route template choices to the editor and apply the selected Modern or Luxury Dark starter palette on a new draft.
- [x] Preserve an existing draft when a user chooses a starter template; show a notice directing them to add a look without replacing saved work.
- [x] Keep text/image editing, draft saving, preview, publishing, and public URL paths in the existing editor and storefront flows.

## Experience and regression work

- [x] Add accessible radio choices, URL guidance and validation, saving state, and a clear error state to website setup.
- [x] Make the Luxury Dark preview route resolve to its existing template component.
- [x] Add Playwright coverage for AI/template onboarding routes and responsive overflow at 1440, 768, 390, and 375 px.
- [x] No backend API or database changes.
- [x] No production/staging deploy, DNS, payment, Stripe, or infrastructure changes.

## Verification

- Frontend build: passed.
- ESLint: passed with one existing Checkout hook warning.
- `git diff --check`: passed.
- Playwright test code added. Execution is **blocked** in this runtime: Playwright's bundled Chromium is absent, and system Chromium exits because `socket()` is denied (`Operation not permitted`).
- Staging journeys and real account behavior were not tested.

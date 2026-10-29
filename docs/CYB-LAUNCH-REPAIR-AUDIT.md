# CYB launch repair audit

Audit snapshot: 2026-10-29. This is a repository and public-site review, not a production penetration test. No production database writes, schema migrations, provider transactions, merges, or deployments were performed.

## Internal issue checklist

| Severity | Area / affected files | Finding | Disposition |
|---|---|---|---|
| Critical | `backend/src/routes.ts`, `src/components/AiDesigner.jsx`, `backend/src/ai-website.ts` | AI design endpoint handled initial creation but did not safely apply natural-language edits to a current editable website; failure diagnostics were too generic. | Implemented structured create/edit request handling, guarded operations, input validation, timeout and actionable service errors; local mock tests pass. Live provider call remains unverified without staging credentials and provider capacity. |
| High | `src/pages/Payment.jsx`, `backend/src/routes.ts`, `docs/PAYMENT-ARCHITECTURE.md` | Storefront PayPal is not configured as a merchant-directed provider flow. Exposing a selectable PayPal method would imply online payments work. | UI now clearly disables PayPal while retaining supported cash-on-delivery flow. Merchant-directed online payments and verified paid-order callbacks remain blocked pending provider/account model and onboarding approval. |
| High | `backend/README.md`, `docs/CUSTOM-BACKEND-MIGRATION.md`, `backend/src/firebase-bridge.ts`, `netlify.toml` | Repository documentation says the custom backend is not production-ready; custom-backend preview, migration/import, email, object storage, health check, backup restore, and cutover have not been demonstrated. Legacy Firebase bridge remains in the staged migration path. | No production migration or database mutation attempted. Existing docs remain the release gates. Confirm the authoritative data system and complete isolated staging migration/restore before cutover. |
| High | `src/pages/WebsiteEditor.jsx`, `src/editor/WebsiteRenderer.jsx`, `backend/src/routes.ts`, `backend/src/website-policy.ts` | Draft, publish, and public rendering span separate client/server paths; repository tests cover snapshots and policy, but no authenticated end-to-end editor-to-public comparison was possible. | Existing draft/publish policy tests pass. No live account or staging service was available to certify editor parity, save, refresh, public URL, or responsive behavior. |
| High | `backend/src/routes.ts`, `src/media/MediaFields.jsx`, `src/services/imageService.js` | Upload path depends on configured persistent storage and deployment secrets; public deployment persistence could not be verified. Frontend/backend 5 MiB limits and image MIME rules need to remain aligned. | Frontend upload validation aligned to JPEG/PNG/WEBP/GIF and 5 MiB. Storage persistence and public rendering still require staging upload/refresh/publish verification. |
| High | `functions/index.js`, `backend/src/routes.ts`, `src/pages/PlatformPayment.jsx`, `backend/.env.example` | CYB lifetime access payment and merchant storefront payments are separate payment systems. Live platform provider credentials/account mode and $246 capture/refund behavior were not verifiable from this checkout. | Customer-facing lifetime price set to $246 and obsolete client-side subscription route removed. No charge was made. Confirm provider live mode, server verification, activation, idempotency, and refunds in staging before production. |
| High | `backend/src/session.ts`, `backend/src/database.ts`, `backend/prisma/schema.prisma`, `backend/src/routes.ts` | Auth, tenant ownership, PostgreSQL schema, and custom backend routes exist, but signup/reset/email/data-isolation journeys and existing-account migration are not end-to-end verified. | Backend unit tests pass. No test accounts were created because no isolated staging environment or credentials were supplied. Never run migration/import against production as part of this branch. |
| Medium | `src/landing/Reviews.jsx`, `src/landing/Analytics.jsx`, `src/landing/LandingPage.jsx` | Production landing page currently uses “Your Business” identity and unsupported testimonials/ratings; analytics preview can look like real customer results. | Removed fabricated testimonials; analytics is labeled sample/illustrative; landing and primary nav use CYB branding and explain AI design. Public site observation was read-only. |
| Medium | `src/pages/Payment.jsx`, `src/pages/PlatformPayment.jsx`, `backend/.env.example` | Public pricing/payment labels need to agree with the one-time $246 lifetime offer and 14-day trial. | Updated platform pricing display/default to $246 and removed dead monthly AI plan settings/route. Live checkout and all external pricing surfaces still need confirmation. |
| Medium | `eslint.config.js`, repository-wide source | `npm run lint` reports 48 errors and 3 warnings across legacy CommonJS functions, React effect/purity rules, and existing frontend files. | Not fixed in this pass because errors span unrelated legacy areas and a broad auto-fix could change runtime behavior. Build and test suites pass; lint remains a quality gate. |
| Medium | `README.md`, `backend/README.md` | Root README is still the default Vite starter, and docs describe the staged backend rather than an already-cut-over production system. | Audit finding only; deployment status must be settled before changing instructions or removing the Firebase bridge. |

## Verification performed

- `npm run build` (frontend): passed.
- `npm --prefix backend run build`: passed.
- `npm --prefix backend test`: passed, 6 suites / 23 tests.
- `node --test tests/*.test.* test/*.mjs`: passed, 29 tests.
- `npm run lint`: failed, 48 errors / 3 warnings (see checklist).
- `git diff --check`: passed.
- Public `https://getcyb.fit/` inspected read-only. It loaded with legacy “Your Business” branding and unsupported testimonial/rating content at audit time. No user login or transaction was attempted.

## Not verified / release blockers

- OpenAI live request, provider limits/billing, model availability, and authenticated AI-save-publish journey.
- Production or staging backend health, SMTP, PostgreSQL persistence, existing-data import, backups, and restore drill.
- Real image upload persistence and published image URLs.
- Account registration/login/reset/logout and cross-user isolation in a deployed environment.
- Platform payment live-mode capture, duplicate callback behavior, and account activation.
- Merchant onboarding, seller-directed PayPal/card processing, refunds, and signed payment webhooks. Storefront checkout currently supports cash on delivery only.
- Desktop/tablet/mobile visual parity between editor, preview, and public page; load testing and 20 isolated test-account journeys.

**Readiness:** not ready to launch or cut over based on available evidence. The frontend and backend compile and local test suites pass, but several core journeys and every live provider integration still require isolated staging verification. No production deployment or merge was made.

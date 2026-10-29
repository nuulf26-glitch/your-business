# CYB launch repair audit

Audit snapshot: 2026-10-29, continued on PR #12. This is a repository review and limited browser verification, not a production penetration test. At the time of this initial audit, no production database writes, schema migrations, provider transactions, merges, or deployments had been performed.

## Internal issue checklist

| Severity | Area / affected files | Finding | Disposition |
|---|---|---|---|
| Critical | `backend/src/routes.ts`, `src/components/AiDesigner.jsx`, `backend/src/ai-website.ts`, `backend/test/ai-design.spec.ts` | AI design endpoint needed safe natural-language website edits. Product collection edits and device-specific responsive overrides were not accepted by the operation schema. | Implemented structured create/edit handling, validated collection limits and phone/tablet overrides, retained server-wide abuse protection, and tested prompt routing through mocked Responses API JSON. Live design generation remains unverified: the PR preview has no database connection and no staging OpenAI/database configuration was available. |
| High | `src/pages/Payment.jsx`, `backend/src/routes.ts`, `docs/PAYMENT-ARCHITECTURE.md` | Storefront PayPal is not configured as a merchant-directed provider flow. Exposing a selectable PayPal method would imply online payments work. | UI now clearly disables PayPal while retaining supported cash-on-delivery flow. Merchant-directed online payments and verified paid-order callbacks remain blocked pending provider/account model and onboarding approval. |
| High | `backend/README.md`, `docs/CUSTOM-BACKEND-MIGRATION.md`, `backend/src/firebase-bridge.ts`, `netlify.toml` | Repository documentation says the custom backend is not production-ready; custom-backend preview, migration/import, email, object storage, health check, backup restore, and cutover have not been demonstrated. Legacy Firebase bridge remains in the staged migration path. | No production migration or database mutation attempted. Existing docs remain the release gates. Confirm the authoritative data system and complete isolated staging migration/restore before cutover. |
| High | `src/pages/WebsiteEditor.jsx`, `src/editor/WebsiteRenderer.jsx`, `src/editor/editorState.js`, `src/editor/sectionStyle.js`, `backend/src/routes.ts`, `backend/src/website-policy.ts` | A failed products request could block the editor; retry was unavailable on the partial-load warning; invalid saved mode fallback was Advanced rather than Simple. Draft, publish, and public rendering remain separate client/server paths. | Integrated PR #11's `Promise.allSettled` fallback, partial-load warning and retry, and made Simple the invalid/unset default without changing shared website data. Unit/policy tests and builds pass. Authenticated save/refresh/preview/publish parity remains unverified because the PR preview has no database connection. |
| High | `backend/src/routes.ts`, `src/media/MediaFields.jsx`, `src/services/imageService.js` | Upload path depends on configured persistent storage and deployment secrets; public deployment persistence could not be verified. Frontend/backend 5 MiB limits and image MIME rules need to remain aligned. | Frontend upload validation aligned to JPEG/PNG/WEBP/GIF and 5 MiB. Storage persistence and public rendering still require staging upload/refresh/publish verification. |
| High | `functions/index.js`, `backend/src/routes.ts`, `src/pages/PlatformPayment.jsx`, `backend/.env.example` | CYB lifetime access payment and merchant storefront payments are separate payment systems. Live platform provider credentials/account mode and $246 capture/refund behavior were not verifiable from this checkout. | Customer-facing lifetime price set to $246 and obsolete client-side subscription route removed. No charge was made. Confirm provider live mode, server verification, activation, idempotency, and refunds in staging before production. |
| High | `backend/src/session.ts`, `backend/src/database.ts`, `backend/prisma/schema.prisma`, `backend/src/routes.ts` | Auth, tenant ownership, PostgreSQL schema, and custom backend routes exist, but signup/reset/email/data-isolation journeys and existing-account migration are not end-to-end verified. | Backend unit tests pass. No test accounts were created because no isolated staging environment or credentials were supplied. Never run migration/import against production as part of this branch. |
| Medium | `src/landing/Analytics.jsx`, `src/landing/LandingPage.jsx`, `src/landing/Navbar.jsx` | Landing copy and sample dashboard can be mistaken for live analytics if not clearly identified. | Current production and PR preview show CYB branding, label the figures “Illustrative data,” and explain that a user's dashboard uses their own records. Browser checks were read-only. |
| Medium | `src/pages/Payment.jsx`, `src/pages/PlatformPayment.jsx`, `backend/.env.example` | Public pricing/payment labels need to agree with the one-time $246 lifetime offer and 14-day trial. | Updated platform pricing display/default to $246 and removed dead monthly AI plan settings/route. Live checkout and all external pricing surfaces still need confirmation. |
| Medium | `eslint.config.js`, `backend/jest.config.js`, `functions/index.js`, `netlify/functions/api.js`, repository-wide React source | CommonJS runtime globals were not declared for backend/function files; React effect/purity findings and duplicate/unused code caused lint failures. | Fixed runtime-specific globals, state lifecycle/purity issues, unused/duplicate code, and effect dependencies without disabling lint rules. Current `npm run lint` passes. |
| Medium | `README.md`, `backend/README.md` | Root README is still the default Vite starter, and docs describe the staged backend rather than an already-cut-over production system. | Audit finding only; deployment status must be settled before changing instructions or removing the Firebase bridge. |

## Verification performed

- `npm run build` (frontend): passed.
- `npm --prefix backend run build`: passed.
- `npm --prefix backend test`: passed, 6 suites / 26 tests.
- `node --test tests/*.test.* test/*.mjs`: passed, 29 tests.
- `npm run lint`: passed.
- Frontend and backend builds: passed. Prisma schema validation passed with a local dummy connection string; no database connection or migration was performed.
- `git diff --check`: passed.
- Browser: PR preview landing page loaded. Its `/api/v1/health` endpoint crashed with `MissingDatabaseConnectionError`; public AI Help also returned an error. This is a staging configuration blocker, not a successful AI integration test.
- Browser, read-only production check: `https://getcyb.fit/api/v1/health` returned `{"status":"ok","database":"ok"}`. No user login or transaction was attempted.

## Not verified / release blockers

- OpenAI live website-design request, provider limits/billing, model availability, and authenticated AI-save-publish journey. AI edit tests mock provider JSON and do not prove the model generates the operations.
- Staging backend/database are not configured on the PR preview. Production health responds `ok`, but SMTP, PostgreSQL persistence journeys, existing-data import, backups, and restore drill remain unverified.
- Real image upload persistence and published image URLs.
- Account registration/login/reset/logout and cross-user isolation in a deployed environment.
- Platform payment live-mode capture, duplicate callback behavior, and account activation.
- Merchant onboarding, seller-directed PayPal/card processing, refunds, and signed payment webhooks. Storefront checkout currently supports cash on delivery only.
- Desktop/tablet/mobile visual parity between editor, preview, and public page; load testing and 20 isolated test-account journeys.

**Readiness at initial audit:** not ready to launch or cut over based on available evidence. The frontend and backend compile and local test suites pass, but several core journeys and every live provider integration still require isolated staging verification. No production deployment or merge had yet been made at that point.

## Post-audit update — 2026-10-29

- PR #12 was merged after explicit user approval. The user-provided Netlify Deploys screenshot shows `Production: main@7a1bc6b` as `Published`, with the commit title “Complete CYB AI and editor repairs” and a 44-second deploy. The production homepage and read-only `/api/v1/health` check were also observed; the API returned `status: ok` and `database: ok`.
- A follow-up branch applies two verified hosting safeguards: the AI design request now times out at 50 seconds (inside Netlify's 60-second synchronous function limit), and media uploads are capped at 4 MiB so Base64-encoded request bodies remain under Netlify's 6 MiB buffered limit. The browser UI, service validation, and backend validation use the same upload size.
- Follow-up local results: lint and frontend/backend builds pass; backend tests pass (27), and root tests pass (30). These results do not demonstrate live AI provider behavior, persistent media lifecycle, authenticated draft save/publish, or payment processing.
- This follow-up branch has not been merged or deployed. Live verification still needs an isolated staging database and media store, staging provider credentials, and browser access to the authenticated staging journey. No production write, customer charge, or real-account test was performed.

# CYB Phase 7 — Authentication and Database

Baseline: Phase 6 commit `038d81bb67a96eeb3964648a98446ef78e0b3949`.

This checklist tracks the recovered Phase 7 requirements against the existing implementation. It distinguishes source and automated-test coverage from staging and production evidence.

## Approved requirements and audit

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Registration, login, and logout | Implemented in code; automated coverage exists | `backend/src/routes.ts` (`AuthController`) and `backend/test/session.spec.ts`; test isolated end-to-end account journeys before release. |
| Email verification, if required | Partial / policy unresolved | Verification token, resend, and verify endpoints exist. Current signup marks the address verified and issues a session immediately; confirm whether verification is required before changing that behavior. Real email delivery remains a separate release check. |
| Forgot password and single-use reset | Implemented in code; automated coverage exists | Reset tokens are hashed, time-limited, consumed atomically, and all sessions are revoked; see `backend/test/session.spec.ts`. SMTP delivery has not been verified in this branch. |
| Session persistence and dashboard loading | Implemented in code; automated coverage exists | Opaque HttpOnly cookie, server-side session lookup, cross-tab refresh, and auth restoration are in `backend/src/session.ts` and `src/services/customBackendSession.js`; `backend/test/session.spec.ts` covers login, `/auth/me`, logout, and expiry. |
| User and merchant data isolation | Implemented in code; automated coverage exists | Session-protected controllers scope businesses by `ownerId` and records by `businessId`; source checks are in `backend/test/session.spec.ts`, commerce tests, CRM tests, and isolated API E2E. Live cross-merchant staging proof remains pending under the pre-launch QA hold. |
| Stores, products, orders, customers, drafts, and published sites persist | Implemented in schema and APIs; automated coverage exists | PostgreSQL/Prisma models are in `backend/prisma/schema.prisma`; persistence coverage includes `backend/test/website-persistence.spec.ts`, `backend/test/public-orders.spec.ts`, and the isolated API journey. No production data was read or changed. |
| Safe migrations | Partial | `backend/scripts/start-prod.cjs` checks migration status, refuses unexpected drift, uses the direct Neon migration URL, and retries advisory-lock conflicts. Production migration execution is not authorized or verified here. |
| Backup and tested rollback before any production schema change | Blocked / not verified | No disposable recovery drill or migration rollback procedure is evidenced in this branch. Do not run production schema changes until a backup and a tested recovery plan are recorded. |
| Remove obsolete Firebase only after data-dependency verification | Intentionally retained | Firebase Admin and bridge/import/export code remain for legacy-account and data migration compatibility. The encrypted export/import and production data-dependency verification are not complete, so removal is unsafe. |
| Existing accounts and records remain intact | Not verified in production | No production reads, writes, migration, or Firebase cutover were performed. This phase makes no production-data claim. |

## Verification plan

- Backend unit/integration suites: run `npm test` from `backend/`.
- Backend Prisma validation and build: run `npm run prisma:validate` and `npm run build` from `backend/`.
- Frontend build and lint: run `npm run build` and `npm run lint` from the repository root.
- Authenticated browser and persistence journeys: use isolated synthetic accounts and a separate test database. Do not seed production accounts.
- Live release checks: require an authorized staging account and verify registration/login/reset, cookie persistence after refresh and a new tab, database-backed store/product/order/customer/site records, and cross-account denial.

## Results on this branch

- Backend Jest: passed, 26 suites / 187 tests.
- Frontend production build: passed.
- Frontend ESLint: passed with 0 errors and 1 existing Checkout hook warning.
- Local responsive Playwright: blocked. Chromium starts and exits because this execution environment denies the required socket operation (`socket() failed: Operation not permitted`); the repository's normal Playwright browser executable is also absent.
- Prisma schema validation and backend build: running on a local dummy `DATABASE_URL`; no database connection or migration is performed.

The implementation already covers most Phase 7 application behavior. Remaining blockers are operational evidence and the unresolved email-verification policy; no speculative auth behavior or destructive Firebase removal is included.

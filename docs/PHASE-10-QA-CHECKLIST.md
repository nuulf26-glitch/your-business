# Phase 10 — Testing and Quality Assurance

Baseline: Phase 6 commit `038d81bb67a96eeb3964648a98446ef78e0b3949`.

## Coverage at this branch

| Requirement | Status | Evidence / next action |
|---|---|---|
| New registration, login, password recovery/reset, logout and session persistence | Partial | Playwright exercises synthetic registration, login, generic forgot-password response, password reset, and cookie-backed session across refresh. Email verification is not required by the current flow; logout and session expiry are not newly exercised here. |
| Blank, template-based and AI-generated website creation | Partial | AI generation preview, explicit replacement confirmation, apply-to-editor, and save-as-draft are covered. Blank/template setup is covered only by existing route/visual checks; creation journeys need stronger persistence assertions. |
| Editor edits, media upload, undo/redo, save and refresh | Partial | Existing tests cover page edits, crop settings, save, refresh, responsive toolbar and publishing. This branch adds undo/redo persistence-state checks. Successful binary upload and refresh restoration after an actual upload remain uncovered by this local mocked suite. |
| Publishing, public parity and mobile rendering | Partial | Existing visual suite checks routes at desktop/tablet/mobile widths, and editor tests exercise publish requests. It does not prove a live published snapshot exactly matches a saved editor version. |
| Product, order, supported COD checkout | Implemented in automated coverage | Existing mocked Playwright and isolated API tests exercise product/order flows and COD with separate idempotency/action tokens. |
| Invalid input, slow/failed API, expired session, duplicate/concurrent requests, database failures | Partial | Unit and isolated API suites include validation, retries, duplicate handling, concurrency, and persistence cases across relevant modules. A single end-to-end resilience matrix covering latency, expired sessions, and database failure responses is not present. |
| Twenty isolated test accounts and controlled staging load | Not run | No accounts were created. No staging load test was run. These require an approved, isolated staging environment and controlled traffic window. |

## Added in this phase branch

- Synthetic signup journey checks the submitted profile and accepted-terms value, then verifies the dashboard route loads.
- Generic password-recovery messaging and successful reset submission are checked using a synthetic reset token.
- AI-generated content remains a preview until explicit application; the applied result is saved as a draft and is not published by the test.
- Editor undo and redo restore the expected website name.

All newly added browser cases intercept the API and use `.example.test` identities. They do not connect to a live account or database.

## Local verification

- `node --check tests/functional-visual/flows.spec.js` — passed.
- `git diff --check` — passed.
- Root `npm ci --offline` — passed (180 packages installed from cache).
- Root `npm run build` — passed.
- Root `npm run lint` — passed with 0 errors and 1 existing Checkout hook dependency warning.
- Targeted Playwright run — 4 tests were selected, but all were blocked before test execution because the Playwright Chromium headless-shell binary is absent. `/usr/bin/chromium` is installed but cannot start in this runtime (`socket() failed: Operation not permitted`). No browser assertions ran.
- Backend `npm ci --offline` — passed (747 packages installed from cache).
- Backend Prisma validation — passed with a synthetic localhost `DATABASE_URL`.
- Backend build — passed with a synthetic localhost `DATABASE_URL`.
- Backend Jest — 26 suites / 187 tests passed with a synthetic localhost `DATABASE_URL`.
- Responsive screenshots — blocked by the browser startup restriction above; run through GitHub Actions after the branch is pushed.

## Remaining QA work

- Run the frontend visual suite at 1440×900, 768×1024, 390×844 and 375×812 in GitHub Actions and retain screenshot artifacts.
- Run backend CI, migration validation, isolated real-API E2E, and responsive visual QA on this commit.
- Add stronger creation-to-refresh checks for blank/template websites, successful media uploads, and published snapshot parity.
- Add end-to-end cases for expired sessions, slow/failed API responses and database failure handling without weakening existing assertions.
- Do not create fake accounts in production. Create the requested 20 test accounts only in an isolated development/staging environment when that environment is available; run load tests only against staging.

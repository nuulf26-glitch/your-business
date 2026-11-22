# CYB Deferred QA Register

This is the central list for release verification deliberately deferred while
approved build work continues. Close items with evidence in the owning phase PR.

| Area | Deferred verification | Owner / status |
| --- | --- | --- |
| Phase 3 | Isolated staging cross-merchant data isolation verification | Pending final QA |
| Phase 4 | Authenticated live staging verification | Pending final QA |
| Phase 5 | PR CI, isolated API E2E, responsive screenshots, and live staging analytics / export checks | Pending final QA; local Chromium runtime can block screenshots |
| Phase 6 | Staging checkout callback, retry, cancellation, and COD verification; production billing remains untouched | Pending final QA |
| Phase 11 | Isolated backup restore, staging / production security configuration review, external authorization checks, rollback evidence, and alerts | Pending final QA |
| Phase 12 | Final staging security regression | Pending final QA; isolated PostgreSQL migration and multi-instance rate-limit test passed in GitHub E2E run #220 |
| Browser QA | Local Chromium is unavailable; the responsive Playwright suite passed on GitHub's Chromium runner, including four viewport sizes (visual QA run #246) | Passed in CI |
| Planning | Recover approved Phase 14–16 names and scope; resolve the historical Phase 12 numbering conflict | Blocked on source records |
| Sequence | Phase 13 Forgot Password work must remain last per approved record | Deferred until Phases 14–16 complete |
| CMS baseline | Confirm published entries render in public CYB themes and verify collection/content isolation using two authenticated businesses | Pending centralized final QA |
| Marketing baseline | Verify consent capture, signed unsubscribe, suppression retention and cross-business isolation; email delivery intentionally remains disabled | Pending centralized final QA |
| Membership baseline | Verify tier grants, access-token expiry/revocation, protected-content visibility and cross-business isolation | Pending centralized final QA |
| Unified Inbox baseline | Submit public support requests, confirm merchant routing, private-note visibility, assignment/handoff and cross-business isolation | Pending centralized final QA |
| Courses baseline | Verify owner-scoped authoring, invitation access/revocation, learner progress and certificates using isolated test accounts | Pending centralized final QA |

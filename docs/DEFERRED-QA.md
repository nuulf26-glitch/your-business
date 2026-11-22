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
| Phase 12 | Real PostgreSQL multi-replica rate-limit behavior and final staging security regression | Pending final QA |
| Browser QA | Responsive Playwright execution on a supported Chromium runner; local attempt is blocked because Playwright Chromium is not installed in this runtime | Pending runner |
| Planning | Recover approved Phase 14–16 names and scope; resolve the historical Phase 12 numbering conflict | Blocked on source records |
| Sequence | Phase 13 Forgot Password work must remain last per approved record | Deferred until Phases 14–16 complete |

# Conditional Forms — recovered scope and implementation

## Approval evidence

The Library file `CYB-46-Stage-Requirements-and-Gap-Audit.md` records the
secondary approved product baseline recovered from the 14 November CYB brief.
Its “Commerce, CRM, analytics, booking, and forms” requirements call for basic
and conditional forms. It also explicitly says the original 46-stage
conversations for stages 1–44 were not accessible, so this feature is not
assigned an unsupported stage number or claimed as a transcript-level stage
approval.

## Repository audit

- `src/editor/WebsiteRenderer.jsx` previously rendered a fixed name, email, and
  message form only.
- The public API previously persisted those three values and the form ID, with
  no configurable question schema or conditional visibility.
- Existing inquiry storage and CRM record handling are preserved.

## Implemented

- Editors can add up to 12 custom short-answer, long-answer, select, and yes/no
  questions to a contact form.
- Editors can mark questions required and show a question only when an earlier
  select or yes/no answer matches.
- Visitors see the matching questions, and hidden answers are cleared from the
  form state when their condition becomes false.
- Published websites validate the custom schema before publish.
- Inquiry submissions are validated against the published form; unknown,
  hidden, invalid-choice, and oversized answers are rejected before persistence.
- Accepted answers are stored on the business-scoped inquiry record. The
  notification remains generic and does not copy custom answer content.
- Legacy contact forms with no custom questions preserve their existing
  payload and behavior.

## Verification and remaining work

- Backend unit and controller regressions cover schema/payload validation and
  published-only form lookup.
- Backend migration/isolated DB and concurrent multi-instance rate-limit tests
  passed in the ephemeral PostgreSQL CI workflow (run #220).
- Responsive Playwright coverage passed in the functional visual workflow at
  four viewport sizes, including this contact-form flow (run #246).
- Local Playwright remains unavailable because Chromium is absent in this
  runtime; the GitHub result is the browser verification evidence.
- Live staging inquiry delivery and CRM display remain final-QA work.

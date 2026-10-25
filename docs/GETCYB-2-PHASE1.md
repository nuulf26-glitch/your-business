# GETCYB 2.0 — Phase 1 checkpoint

Approved direction: lighter beige/white/black editor controls; preserve customer website composition and existing data. Development branch: codex/getcyb-2-approved-phase1. No production deployment or production data mutation performed.

## Implemented
- Three control modes share one website document; account-scoped mode preference. Existing features remain reachable under More tools. Content controls precede expandable design controls. Mobile tabs expose tools, canvas and properties.
- Upload progress, accepted-format/size validation, owner-scoped media paths, timeouts and useful failures. Upload completion merges into the latest document and original page; removed/locked sections are not resurrected.
- Transactional draft revisions reject stale tab/device writes. Local recovery cache remains available. Concurrent saves/publishes are serialized in the editor; new edits during a save remain dirty.
- Explicit publish review warns about missing links/photos. Draft/published isolation remains intact. Phone/iPad full preview uses the selected width; editor logo and business catalogue are included.
- Server trial policy anchored to Firebase Auth creation time. Private billing records cannot be controlled through client profile dates. Existing accounts before a configured rollout keep access. Expiry never removes data, saved drafts or existing published pages.
- Trial banner replaces the old inactive-account message. Server-owned paid entitlement is recorded atomically with the verified platform payment profile.
- Environment-overridable Firebase config, App Check initialization when configured, and demo-project local emulator connections by default in development.
- Password recovery uses neutral account-existence messaging. Profile writes merge instead of replacing existing fields.

## Verification
- 36 policy tests pass (26 existing + 10 new).
- Actual editor browser journey passes with injected local test services: mode preservation, autosave/reload, stale save rejection, asynchronous upload retaining newer text, explicit publish review, draft/full-preview content parity, and mobile access without document overflow at 1024/736/390/320px.
- Development-only `/__editor-test` exercises the real editor. Its simulated publishing and uploads do not contact Firebase; it is excluded from production routing.
- Production build and Functions entry load pass. Existing large bundle warning remains.
- Baseline repository lint remains 60 errors / 3 warnings; unrelated legacy files are not rewritten.

## Not certified / configuration required
- Live Firebase uploads, signup/reset delivery, callable transaction retries and cross-owner authorization have NOT been exercised against staging. A Java 21+ runtime is required for the current Firestore emulator; this environment has Java 17.
- Storage rules provided are a candidate for isolated testing. Production Firestore/Storage policies are not available for audit. Do not deploy them blindly over unknown production rules. Existing wildcard grants require a complete audit.
- Frontend and updated Functions must be staged together: revision-aware saves require `expectedRevision`; old editor clients must reload for the new contract.
- Copy `.env.staging.example` to `.env.staging.local` and configure a separate project plus App Check. Do not point local testing at production.
- Configure server `TRIAL_ROLLOUT_AT` to the actual release boundary. `TRIAL_ENFORCE_PUBLISH` defaults false until expiry policy and billing are ready. With no rollout configuration, previous access is preserved and no misleading countdown appears. Trial restrictions are not active on the live site.
- Trial AI allowances await Phase 3; no AI provider request is implemented here. Subscription pricing remains undecided; no automatic charge is introduced.
- Merchant settlement/Apple Pay, secure merchant checkout, fitness memberships, redesigned business dashboards, AI, domains and team permissions remain subsequent phases. Existing sandbox platform-access payment is separate from merchant payment acceptance.
- The changed getcyb.zip found in the workspace was not produced by this change and is excluded from this commit.

## Next stages
Phase 2: category dashboards and server-authoritative checkout, fitness and operational workflows. Phase 3: server-side editable AI proposals with cost limits and approve/undo. Phase 4: advanced customization, domains, SEO, analytics and team permissions. Provider configuration and staging journeys must pass before requesting separate production deployment approval.

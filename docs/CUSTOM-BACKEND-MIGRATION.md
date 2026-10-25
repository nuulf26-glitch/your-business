# Custom backend migration — staged release record

## Current phase: development foundation

The baseline repository is preserved on `backup/main-before-custom-backend-2026-10-25`. Work is isolated on `codex/custom-backend-migration`. No production service, Firebase project, database, storage bucket, DNS, or payment configuration has been changed.

### Existing integrations found

- Web client: React/Vite; Firebase Web SDK configured in `src/firebase.js`.
- Authentication: Firebase Auth in signup/login/reset, protected routes, and dashboard layout.
- Firestore: direct client reads/writes in stores, products, orders, customers, settings, shipping, dashboard, checkout and editor; callable Cloud Functions cover business catalogs, appointments, public products, publishing and analytics.
- Storage: Firebase Storage upload calls from `src/services/imageService.js` and `src/pages/WebsiteEditor.jsx`.
- Serverless: `functions/index.js` contains Firebase-token-verified PayPal create/capture endpoints; other modules implement website publishing, analytics, catalog/booking and product projections.
- Deployment: `firebase.json` configures Hosting/Functions; `public/_redirects` is also present. No API service or managed Postgres configuration exists.
- Payments: PayPal client SDK on web and server-side PayPal REST calls in Cloud Functions. Subscription/trial persistence was not established by the repository scan.

### Work added

- NestJS/TypeScript API and Prisma/PostgreSQL schema for users, sessions, email tokens, 14-day trials, businesses, websites/versions, products, customers, orders and payment references.
- Owner-scoped business/product/customer/order APIs, website draft/publish/public read, PayPal order/capture verification and S3-compatible upload signing.
- Email verification/reset endpoints plus Firebase Admin token exchange for staged migration. Frontend auth can optionally establish the custom cookie after Firebase login when `VITE_ENABLE_CUSTOM_API_SESSION=true`; direct Firestore workflows remain the system of record.
- Read-only encrypted Firebase export and staging-import scripts: Auth users, recursive Firestore documents, and Storage object backups; an AES-256-GCM verifier checks document counts and asset SHA-256 integrity. The import is idempotent, target-host guarded, retains every source document by path, and maps core account/store/site/product/customer/order/payment records. The export/import have not been run because Firebase Admin and staging DB credentials are unavailable; S3 asset copying and URL rewrite remain outstanding.

### Migration safety and prerequisites

Before data migration, use Firebase Admin credentials with Auth export, Firestore export, and Storage read permissions. Export into encrypted, access-controlled storage. Preserve source IDs in `legacyFirebaseId`; write deterministic mapping records for nested/private collections. Verify counts, references, object SHA-256 checksums, and representative published site renders before any read/write cutover. Firebase must remain intact and available through the rollback window.

Rollback: keep the prior Hosting release and Firebase services unchanged; switch the API feature flag/base URL back to Firebase only after bidirectional writes are disabled or reconciled. Do not delete Firebase resources as part of rollback. Capture a final Postgres snapshot before any cutover attempt.

### Still required before production

- Firebase-admin-backed read-only export and idempotent import scripts; a real backup cannot be produced from this environment because Firebase service-account/admin credentials are not available.
- Configure SMTP and test email link delivery and one-time expiration. Determine whether Firebase password hash export is enabled and supported for the project. Users without a compatible imported hash will need a verified password-reset flow; plaintext passwords cannot be recovered.
- Finish domain modules and parity mapping, especially server-authoritative cart checkout/order totals, bookings/industry workflows, subscriptions and PayPal webhook verification.
- Complete client migration domain-by-domain (avoid a partial auth cutover because current UI consumers depend on Firebase `auth.currentUser` and Firestore SDK).
- Add migration fixtures, tenant isolation/security tests, email/S3/PayPal sandbox journeys, backup restore test, and staged deployment/monitoring configuration.
- Configure staging and production managed PostgreSQL, S3-compatible storage, Redis if deployed rate-limit/session needs require it, secrets, TLS, CI/CD, logs/alerts and scheduled database backups.
- Run full authenticated journeys on staging and explicitly approve production migration. Production has not been touched.

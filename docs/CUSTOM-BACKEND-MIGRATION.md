# GETCYB custom backend migration

## Current state

Development is isolated on `codex/custom-backend-migration`. Production `getcyb.fit`, Firebase Hosting, Firebase Auth, Firestore, Storage, and Functions have not been changed. The staging API and frontend are on Render; the latest backend changes are still being deployed and must pass staging checks before any production switch.

### Repository integrations found

- React/Vite frontend with Firebase Auth, Firestore, Storage, and callable Functions.
- Firestore collections: `stores`, `products`, `orders`, `customers`, `users`, and private business collections for bookings, inquiries, notifications, pickup orders, websites, versions, and analytics.
- Cloud Functions for PayPal subscription create/capture, website publishing, business catalogs, bookings, pickup orders, inquiries, analytics, and public products.
- Firebase Storage uploads from the website editor and product workflow.

### Implemented in the custom backend

- NestJS/TypeScript modular API, PostgreSQL/Prisma models and migrations, hashed session tokens, Argon2id passwords, rate limiting, origin checks, validation, and tenant-scoped business/product/customer/order operations.
- Custom signup/login/logout, reset/verification endpoints, 14-day trials, and a verified Firebase-token bridge for existing Firebase accounts during migration.
- Website draft save, publish/unpublish, versions, public rendering, public products, and owner-scoped editor data.
- Public checkout writes orders and customers to PostgreSQL. The server recalculates item prices from stored products; the browser cannot set the amount. Owners can list and manage orders and tracking details.
- Business catalog, appointments/reservations with availability checks and transaction locks, inquiries, pickup orders, notifications, client notes, and visit analytics endpoints.
- PayPal REST order creation and capture verification for platform subscriptions. The shop checkout's PayPal payment flow is still not complete; it currently supports cash on delivery only.
- S3-compatible presigned image uploads. Staging object-storage credentials and CORS must be configured before upload tests can pass.
- Firebase export with AES-256-GCM encryption; archive verification with SHA-256 asset checks; guarded/idempotent staging import; Firebase Storage-to-S3 copy; and staging import count/path validation scripts. Import maps old IDs, business catalogs, account subscriptions, website versions, products, customers, orders, payment references, bookings, inquiries, notifications, pickup orders, and client notes. Storage URLs are rewritten from the S3 mapping.

### Validation run

- Frontend production build passes.
- Backend NestJS build passes.
- Backend automated tests: 16 passed across 3 suites.
- Prisma schema validates when `DATABASE_URL` is provided.
- Migration scripts pass Node syntax checks.
- Staging API health has returned `{"status":"ok","database":"ok"}`. The newest backend deploy has not yet completed, so its routes still need post-deploy verification.
- No Firebase backup/export or data import has run; no real email, object upload, PayPal payment, or full browser journey has been exercised.

## Required access and configuration

To run a real migration, provide Firebase Admin credentials with Auth user export, Firestore read, and Storage read permissions; the Firebase Storage bucket name; a private backup destination and a separately stored 32-byte backup-encryption key; and S3-compatible bucket credentials plus public HTTPS asset base URL. Staging SMTP credentials are needed to verify password-reset email delivery. Production needs its own managed PostgreSQL, object storage, email provider, secrets, monitoring, and backup plan.

The staging Render PostgreSQL instance is on a free plan with an expiry date. It is for testing only and must be replaced by a durable managed database before production use. Do not point staging or migration scripts at the live Firebase project for writes.

## Migration commands

1. Set Firebase Admin credentials, bucket name, `BACKUP_ENCRYPTION_KEY`, and a new empty private `EXPORT_DIR`; run `npm run backup:firebase`.
2. Run `npm run verify:firebase-backup -- /absolute/path/to/export`.
3. Set staging S3 credentials and `IMPORT_TARGET=staging`, `ALLOW_STAGING_IMPORT=YES`; run `npm run migrate:firebase-storage-staging -- /absolute/path/to/export --apply`.
4. Dry-run `npm run import:firebase-staging -- /absolute/path/to/export`; review all counts, then apply only with `--apply` and the exact verified staging database hostname in `IMPORT_STAGING_DB_HOST`.
5. Run `npm run verify:firebase-staging-import -- /absolute/path/to/export` and test representative accounts, stores, published sites, images, products, customers, orders, bookings, and payment records.

Firebase records are never deleted by these scripts. Firebase stays available through the rollback window. Rollback means routing the frontend back to Firebase and keeping the Postgres copy and source Firebase data intact; reconcile any test writes before trying another cutover.

## Still required before public launch

- Finish and verify every frontend Firebase call path; keep the legacy bridge until accounts have signed in or reset passwords on the custom backend.
- Receive the required Firebase and object-storage credentials, create and verify the encrypted archive, copy assets, import to staging, and validate relationships and public pages.
- Run browser journeys on staging for registration/login, dashboard, products, image upload, editor save/publish/render, orders, appointments, and subscription status. Complete a PayPal sandbox test; implement seller-directed shop payments if required.
- Configure durable production PostgreSQL, object storage, SMTP, backups/restore drill, logs/alerts, secrets, CI/CD, and a production domain/API origin.
- Review tenant isolation and payment/security behavior, then request final approval before any production cutover.

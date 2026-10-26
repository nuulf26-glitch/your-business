# GETCYB API foundation

NestJS modular-monolith foundation for a staged Firebase replacement. The legacy frontend and Firebase stay in service until each domain is migrated and verified. This API is not production-ready until the checklist in `../docs/CUSTOM-BACKEND-MIGRATION.md` is complete.

## Local development

1. Copy `.env.example` to `.env` and replace `SESSION_SECRET`.
2. Run `docker compose up -d postgres minio minio-setup redis` and wait for the MinIO setup container to finish.
3. Run `npm ci`, `npm run prisma:generate`, `npm run prisma:migrate`, `npm run start:dev`.
4. API listens on `http://localhost:3001/api/v1`.

Readiness is available at `GET /api/v1/health`; it returns `200` only when PostgreSQL answers. The production process fails at startup if database, HTTPS frontend origin, object-storage, or SMTP settings are missing. Behind a single trusted reverse proxy, secure cookies and client IP rate limits use the forwarded connection details.

## Encrypted Firebase export

The export is read-only. Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase Admin service-account file (or `FIREBASE_SERVICE_ACCOUNT_JSON` in a secure runtime), `FIREBASE_STORAGE_BUCKET`, `BACKUP_ENCRYPTION_KEY` (32 bytes, base64 or hex), and an empty private `EXPORT_DIR` outside this repository. Run `npm run backup:firebase`. It encrypts Firestore batches, Auth export pages, and Storage objects with AES-256-GCM; the summary contains counts only. Run `npm run verify:firebase-backup -- /absolute/path/to/export` with the same key to verify decryption tags, record counts and Storage SHA-256 hashes. Keep the key separate from the backup and never commit either.

For a dry-run import, use `npm run import:firebase-staging -- /absolute/path/to/export`. It preserves every Firestore document by source path in `LegacyDocument` and maps accounts, subscriptions, stores, catalogs, sites, versions, products, customers, orders, business records, and existing PayPal references into PostgreSQL. Apply is blocked unless `--apply`, `IMPORT_TARGET=staging`, `ALLOW_STAGING_IMPORT=YES`, and an exact `IMPORT_STAGING_DB_HOST` match are provided. The importer is idempotent; it does not delete Firebase records. Password hashes are not imported as Argon2 hashes; existing users continue through the Firebase session bridge until they set a custom-backend password. Copy Storage assets to S3 with `npm run migrate:firebase-storage-staging -- /absolute/path/to/export --apply`, then run `npm run verify:firebase-staging-import -- /absolute/path/to/export` to compare migrated counts and legacy ID/path mappings.

Implemented endpoints: signup, login, logout, reset/verification, a verified Firebase session bridge, owner-scoped business/product/customer/order operations, public price-checked checkout, website draft/publish/public read, business catalogs, bookings/reservations, inquiries, pickup orders, client notes, notifications, analytics, platform PayPal capture verification, and S3-compatible image upload signing. Passwords use Argon2id; sessions and one-time email tokens are random values stored as SHA-256 hashes. To try the staged API, set `VITE_ENABLE_CUSTOM_API_SESSION=true` and `VITE_CUSTOM_BACKEND_URL` on a non-production frontend. Uploaded product/site images are intended to be publicly readable from high-entropy object URLs; do not place private documents in this bucket.

SMTP, Firebase Admin credentials, PayPal sandbox credentials, and object-storage credentials are required for their respective integrations. The Firebase export/import has not run; real backups, image uploads, email delivery, PayPal payments, and full browser journeys remain unverified. Storefront checkout currently supports cash on delivery; seller-directed shop PayPal payments and webhook verification remain outstanding. Do not direct production traffic here yet.

## Staging deployment preparation

Build the API container from this directory. Set `NODE_ENV=production` for staging so secure cookies and production guards are exercised, and set `FRONTEND_ORIGIN` to the exact HTTPS staging frontend origin(s). Provide a managed PostgreSQL `DATABASE_URL`, an S3-compatible bucket and access keys, an HTTPS `S3_PUBLIC_BASE_URL`, and SMTP credentials through the host's secret manager. If the browser app and API use different sites, set `COOKIE_SAME_SITE=none` and use HTTPS on both. Use separate PayPal sandbox credentials and a separate staging bucket/database. Do not point staging at the live Firebase project for writes. Keep the service at one instance until rate limiting uses a shared Redis store; the current Nest throttler keeps counters in process memory.

The container runs `prisma migrate deploy` before starting the API. Before routing test traffic, verify `GET /api/v1/health`, signup/login/email, editor save/publish, image upload, and PayPal sandbox capture against staging, and take a database snapshot. Keep this branch separate from the production site. Enable scheduled database backups and retention in the provider console; perform and record a restore drill before any production cutover. No production service, DNS, or live deployment is part of staging setup.

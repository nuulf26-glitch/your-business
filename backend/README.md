# GETCYB API foundation

NestJS modular-monolith foundation for a staged Firebase replacement. The legacy frontend and Firebase stay in service until each domain is migrated and verified. This API is not production-ready until the checklist in `../docs/CUSTOM-BACKEND-MIGRATION.md` is complete.

## Local development

1. Copy `.env.example` to `.env` and replace `SESSION_SECRET`.
2. Run `docker compose up -d postgres minio minio-setup redis` and wait for the MinIO setup container to finish.
3. Run `npm ci`, `npm run prisma:generate`, `npm run prisma:migrate`, `npm run start:dev`.
4. API listens on `http://localhost:3001/api/v1`.

## Encrypted Firebase export

The export is read-only. Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase Admin service-account file (or `FIREBASE_SERVICE_ACCOUNT_JSON` in a secure runtime), `FIREBASE_STORAGE_BUCKET`, `BACKUP_ENCRYPTION_KEY` (32 bytes, base64 or hex), and an empty private `EXPORT_DIR` outside this repository. Run `npm run backup:firebase`. It encrypts Firestore batches, Auth export pages, and Storage objects with AES-256-GCM; the summary contains counts only. Run `npm run verify:firebase-backup -- /absolute/path/to/export` with the same key to verify decryption tags, record counts and Storage SHA-256 hashes. Keep the key separate from the backup and never commit either.

For a dry-run import, use `npm run import:firebase-staging -- /absolute/path/to/export`. It preserves every Firestore document by source path in `LegacyDocument` and maps accounts, stores, sites, products, customers, orders and existing PayPal references into their initial PostgreSQL models. Apply is blocked unless `--apply`, `IMPORT_TARGET=staging`, `ALLOW_STAGING_IMPORT=YES`, and an exact `IMPORT_STAGING_DB_HOST` match are provided. The importer is idempotent; it does not delete Firebase records. Password hashes are not used as Argon2 hashes; imported users continue through the Firebase session bridge until password resets are completed. Storage files stay in the encrypted archive and still need a separately verified S3 copy before final cutover.

Implemented endpoints: signup, login, logout, email verification and password reset; a feature-flagged verified-Firebase-token-to-API-session bridge; owner-scoped business, product, customer and order operations; website draft/publish/public-read; PayPal create/capture verification; and S3-compatible image upload presigning. Passwords use Argon2id; sessions and one-time email tokens are random values stored as SHA-256 hashes. Public auth and payment routes are rate limited. To try the staged auth bridge, set `VITE_ENABLE_CUSTOM_API_SESSION=true` and `VITE_CUSTOM_BACKEND_URL` on a non-production frontend. Uploaded product/site images are intentionally publicly readable by their high-entropy object URLs, consistent with published storefront use; do not place private documents in this bucket.

SMTP, Firebase Admin credentials, PayPal sandbox credentials and object-storage credentials are required for their respective integrations. Server-authoritative customer checkout, booking/industry workflows, broader roles, Firebase export/import, PayPal webhooks, security review and end-to-end coverage are still in progress. Do not direct production traffic here yet.

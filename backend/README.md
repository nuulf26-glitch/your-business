# GETCYB API foundation

NestJS modular-monolith foundation for a staged Firebase replacement. The legacy frontend and Firebase stay in service until each domain is migrated and verified. This API is not production-ready until the checklist in `../docs/CUSTOM-BACKEND-MIGRATION.md` is complete.

## Local development

1. Copy `.env.example` to `.env` and replace `SESSION_SECRET`.
2. Run `docker compose up -d postgres minio redis`.
3. Run `npm ci`, `npm run prisma:generate`, `npm run prisma:migrate`, `npm run start:dev`.
4. API listens on `http://localhost:3001/api/v1`.

Implemented initial endpoints: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`; owner-scoped business, product, website draft/publish, public website read, and S3-compatible image upload presigning. Passwords use Argon2id via `argon2`; sessions use random opaque tokens stored as SHA-256 hashes in PostgreSQL and HTTP-only cookies.

Email verification/reset, authorization roles beyond owner, full customer/order/booking/industry APIs, Firebase import, PayPal webhook flow, security review and end-to-end coverage are still in progress. Do not direct production traffic here yet.

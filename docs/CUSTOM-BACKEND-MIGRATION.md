# GETCYB custom backend

## Goal

GETCYB's API, account handling, tenant rules, database schema, and business workflows are project code owned by this repository. The public API is served by a Netlify Function. PostgreSQL is used as the database engine through the project's Netlify Database, and Netlify Blobs stores uploaded images. These are infrastructure services; they do not supply GETCYB's application logic or user model.

## Current implementation

- NestJS API with PostgreSQL/Prisma models for accounts, businesses, websites, products, customers, orders, bookings, inquiries, analytics, subscriptions, sessions, and payment references.
- Argon2id passwords, hashed session tokens, owner-scoped data access, request validation, origin checks, and rate limiting.
- Netlify Function adapter exposes the API under `/api/v1`; the frontend uses same-origin requests and HTTP-only session cookies.
- Netlify Database provides a separate production branch and isolated deploy-preview branches. Prisma migrations run during deploy.
- Netlify Blobs stores user-uploaded images with owner-specific, unguessable keys. Public sites only receive image URLs, not storage credentials.
- Production `getcyb.fit` and Firebase have not been switched over. The custom backend must be deployed to a preview and checked before any production cutover.

## Not ready for public launch yet

- The Netlify Function adapter and Netlify Database wiring still need a successful preview deployment and health check.
- Email delivery is not configured, so verification and password-reset messages need SMTP setup.
- Platform PayPal payment requires its own credentials and a sandbox capture check. Store-owner PayPal checkout is still separate work.
- A Firebase export/import is not required for an empty launch. If existing data is to be preserved, use the encrypted export/import workflow only after deciding which existing records are needed.
- Free hosting has usage caps; if a quota is reached, requests can pause until the quota resets. Monitor Netlify's credit usage before inviting real stores.

## Deploy

Netlify builds the frontend, backend, Prisma client, and applies migrations using the database URL for the current deploy context. The API health URL is `https://getcyb.fit/api/v1/health` after production deployment. A branch deploy should be used first and verified before merging any change into production.

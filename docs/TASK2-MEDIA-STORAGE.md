# Task 2 media storage and staging verification

Status: implementation under verification. Real staging storage uploads remain blocked until a dedicated bucket is configured. No production merge or deployment is authorized.

## Root cause confirmed
Render staging logs on 2026-10-29 show `MissingBlobsEnvironmentError` from `getStore`: the API depended on a Netlify runtime environment that does not exist on Render. Staging has neither Netlify Blobs configuration nor S3 credentials. The previous raw-body upload also imposed a 4 MiB limit for Netlify's buffered function path, making practical video uploads impossible.

## New architecture
Authenticated authorize → short-lived checksum/length/type-bound signed PUT → browser sends bytes directly to a PRIVATE object bucket → authenticated complete validates HEAD size/type/SHA256, magic bytes, dimensions and actual codecs using ffprobe → conditional copy to an immutable final key → metadata marked READY in PostgreSQL.

Stable `/api/v1/uploads/media/:uuid` references redirect to fresh expiring read URLs. S3 serves video byte ranges directly; files do not pass through a serverless response. Removing media from a design removes the reference, never the stored object. Published snapshots and versions therefore retain their files. There is no finalized-object garbage collector in this change.

Older small-upload clients use the same S3 validation pipeline through a 4 MiB compatibility endpoint. New clients upload directly. Raw staging uploads are not stored on Render's filesystem or in PostgreSQL. The new table stores metadata only. Asset IDs are random UUIDs. Account-specific reservations serialize the 2 GiB / 1,000 asset quota; pending reservations expire after 15 minutes. Finalization and attaching managed media to products or websites require ownership. Validated media is intentionally accessible to anyone with its unguessable stable URL; private confidential files are not a supported use for these website assets. There is no public asset-list API.

Existing Netlify/Firebase/external URLs are retained. Optional server-only `NETLIFY_BLOBS_SITE_ID` and `NETLIFY_BLOBS_TOKEN` allow legacy Netlify reads on Render. No existing asset is copied, deleted or rewritten automatically.

## Minimum configuration on getcyb-staging-api
Set these in the service Environment panel, without sharing values in chat:

- `S3_BUCKET`: a NEW staging-only private bucket
- `S3_REGION`: actual bucket region (for example the chosen AWS region)
- `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: server-only bucket-scoped credentials
- `S3_ENDPOINT`: only for a compatible provider; omit for AWS S3
- `S3_FORCE_PATH_STYLE`: `true` only if that provider requires it

Use AWS S3 or a compatible service supporting SHA256 checksums on signed PUT/HEAD and conditional CopyObject. Compatibility is not assumed for every provider. The API Docker image installs ffprobe. When using Netlify for the frontend, point `VITE_CUSTOM_BACKEND_URL` at this Render API; ffprobe is not supplied by the Netlify function runtime.

The service is Blueprint-managed; these credentials should remain server configuration. No secret values are committed. The existing unrelated service variables must remain unchanged.

Required bucket policy for this credential (restrict Resource to this staging bucket):

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `incoming/*`
- `s3:PutObject`, `s3:GetObject` on `media/*`
- `CopyObject` is authorized by GetObject on its source and PutObject on its destination
- No public bucket policy, ACL, bucket administration or production-bucket access

Use default SSE-S3 encryption unless KMS permissions are configured separately. Keep Block Public Access enabled. Add a lifecycle expiration rule for **incoming/** only after one day to remove abandoned or replayed temporary uploads. Do not expire `media/*`.

Bucket CORS (AWS JSON):

```json
[
  {
    "AllowedOrigins": ["https://getcyb-staging-web.onrender.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "x-amz-checksum-sha256", "range"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 300
  }
]
```

Add only specific other staging frontend origins if they are actually used. Do not use `*` for private staging upload origins. Save/redeploy the API after configuration and repeat real browser verification.

## Formats and limits
Images: JPEG, PNG, WebP, GIF ≤20 MiB and ≤40 million pixels. Videos: MP4 with H.264 video and AAC/MP3 audio; WebM with VP8/VP9 video and Opus/Vorbis audio, ≤250 MiB. MOV/QuickTime and HEVC are explicitly rejected with conversion guidance. No transcoding is claimed. Corrupt, mislabeled and unsupported files do not receive READY URLs.

## Verification types
Backend unit/HTTP regression tests use mocked DB/S3 dependencies where explicitly stated. The codec test invokes real FFmpeg and ffprobe on generated JPEG, PNG, WebP, H.264 MP4 and VP9 WebM files; it is not an object-storage test. `npm --prefix backend run test:media:staging` uses the deployed API and real configured storage, creates an isolated test account and products, and only accepts the known staging API hostname. It reports blocked with exit 2 if storage is not configured. It does not replace browser verification.

Browser checklist still required: JPEG/PNG/WebP uploads, multiple product images, primary image/reordering/replacement/removal, video upload/preview/size/replacement/removal, save/refresh/publish/public playback, mobile layout and unsupported/size-boundary validation. Do not mark this task complete until these pass with real persistent staging storage, including reads after a staging API redeploy.

## Actual staging delivery evidence — 29 October 2026

Dedicated branch: `codex/cyb-media-task2-repair-20261029`; draft PR #15, stacked on Task 1. Both PR #13 and PR #14 heads are ancestors of the remote Task 2 commit, so neither prior repair branch was overwritten.

Runtime commit initially verified: `d9a8fd8bcfce5441460d74bc31d7c4ad756b4ec1`.

- API deploy `dep-dbhehquc6qcc73f78b00`: live at 10:36 UAE time.
- Frontend deploy `dep-dbheilu1egvs73fc2q3g`: live at 10:36 UAE time.
- API logs confirm the additive `20261029110000_media_assets` migration succeeded.
- GitHub backend CI run 83 succeeded.
- Screenshot: `task2-evidence/staging-live.jpg`.

Real deployed API requests used generated staging-only test accounts. Secrets were held in memory and were not printed. The test did not change any existing account or any production record.

| Request | Actual response | Meaning |
| --- | --- | --- |
| POST /auth/signup | 201 | Isolated staging session created |
| GET /uploads/status | 200, configured:false | No persistent object-store configuration available |
| POST /uploads/authorize, valid PNG metadata | 503 | Explicit storage-configuration failure; no object was uploaded |
| POST /uploads/authorize, MP4 >250 MiB | 400 | Server size boundary enforced |
| POST /uploads/authorize, MOV | 400 | Unsupported container rejected |

The real staging storage script exited **2 / BLOCKED**, not success. No S3 PUT, object read, signed read, byte-range playback or post-redeploy persistence has succeeded in staging yet.

The actual staging browser reached its login form. Secure credential submission returned the visible error **“The email or password is incorrect.”** No authentication changes, password resets, production sign-ins or verification bypasses were attempted.

| Acceptance workflow | Current result |
| --- | --- |
| JPEG/PNG/WebP real storage upload | Blocked by bucket configuration and browser sign-in |
| Multiple product images / main image / reorder | Implemented; browser acceptance blocked |
| Image/video resize, fit, aspect ratio, focal point | Implemented; browser acceptance blocked |
| MP4/WebM upload, preview and playback | Real local codecs passed; real storage/browser playback blocked |
| Replacement/removal | Implemented; real storage/browser acceptance blocked |
| Save → refresh → publish → public media | Not verified with uploaded media |
| Desktop/tablet/mobile acceptance | Not verified in the authenticated editor or public uploaded-media site |
| Persistence after API redeploy | Not verified with real objects |

Local validation: frontend and backend builds, ESLint, 9 backend suites / 49 cases, 32 root regression cases, and diff whitespace checks passed. The original missing-configuration regression uses a real local HTTP server with a mocked DB and no configured object store. Owner checks use mocked DB responses. Signature generation uses the real AWS SDK with test-only dummy credentials but does not contact S3. Codec fixtures use real FFmpeg/ffprobe. Live staging API checks use real deployed code and PostgreSQL, but **zero real object storage successes are claimed**.

## Task 2 files changed

The Task 2 implementation modifies these files (inherited PR #13 files are separate history):

- `.github/workflows/backend-ci.yml`
- `backend/.env.example`
- `backend/Dockerfile`
- `backend/package.json`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261029110000_media_assets/migration.sql`
- `backend/scripts/test-media-storage-staging.mjs`
- `backend/src/media-storage.ts`
- `backend/src/module.ts`
- `backend/src/routes.ts`
- `backend/test/media-routing.spec.ts`
- `backend/test/media-storage.spec.ts`
- `src/editor/structure.js`
- `src/media/MediaFields.jsx`
- `src/media/MediaDisplay.jsx`
- `src/media/media.css`
- `src/media/media.js`
- `src/media/uploadPolicy.js`
- `src/pages/Products.jsx`
- `src/pages/WebsiteEditor.jsx`
- `src/services/imageService.js`
- `test/product-media.test.mjs`
- `test/upload-policy.test.mjs`
- `docs/TASK2-MEDIA-STORAGE.md`
- `docs/task2-evidence/staging-live.jpg`

No new Task 2 payment, pricing, AI generation or authentication-architecture changes were made. No PR merge or production deployment was performed.

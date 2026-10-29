# Task 2 media storage and staging verification

Status: implementation under verification. Real staging storage uploads remain blocked until a dedicated bucket is configured. No production merge or deployment is authorized.

## Root cause confirmed
Render staging logs on 2026-10-29 show `MissingBlobsEnvironmentError` from `getStore`: the API depended on a Netlify runtime environment that does not exist on Render. Staging has neither Netlify Blobs configuration nor S3 credentials. The previous raw-body upload also imposed a 4 MiB limit for Netlify's buffered function path, making practical video uploads impossible.

## New architecture
Authenticated authorize → short-lived checksum/length/type-bound signed PUT → browser sends bytes directly to a PRIVATE object bucket → authenticated complete validates HEAD size/type/SHA256, magic bytes, dimensions and actual codecs using ffprobe → conditional copy to an immutable final key → metadata marked READY in PostgreSQL.

Stable `/api/v1/uploads/media/:uuid` references redirect to fresh expiring read URLs. S3 serves video byte ranges directly; files do not pass through a serverless response. Removing media from a design removes the reference, never the stored object. Published snapshots and versions therefore retain their files. There is no finalized-object garbage collector in this change.

Raw staging uploads are not stored on Render's filesystem or in PostgreSQL. The new table stores metadata only. Asset IDs are random UUIDs. Account-specific reservations serialize the 2 GiB / 1,000 asset quota; pending reservations expire after 15 minutes. Finalization and attaching managed media to products or websites require ownership. Validated media is intentionally accessible to anyone with its unguessable stable URL; private confidential files are not a supported use for these website assets. There is no public asset-list API.

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

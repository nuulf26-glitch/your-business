CREATE TABLE "MediaAsset" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL, "checksum" TEXT NOT NULL, "objectKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "width" INTEGER, "height" INTEGER,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");
CREATE INDEX "MediaAsset_ownerId_status_expiresAt_idx" ON "MediaAsset"("ownerId", "status", "expiresAt");

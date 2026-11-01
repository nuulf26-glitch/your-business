CREATE TABLE "TrialPreview" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "prompt" TEXT,
  "draft" JSONB,
  "generatedAt" TIMESTAMP(3),
  "claimedUserId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrialPreview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrialPreview_tokenHash_key" ON "TrialPreview"("tokenHash");
CREATE UNIQUE INDEX "TrialPreview_claimedUserId_key" ON "TrialPreview"("claimedUserId");
CREATE INDEX "TrialPreview_expiresAt_idx" ON "TrialPreview"("expiresAt");

CREATE TABLE "ApiThrottleBucket" (
  "id" TEXT NOT NULL,
  "totalHits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiThrottleBucket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiThrottleBucket_expiresAt_idx" ON "ApiThrottleBucket"("expiresAt");
CREATE INDEX "ApiThrottleBucket_blockedUntil_idx" ON "ApiThrottleBucket"("blockedUntil");

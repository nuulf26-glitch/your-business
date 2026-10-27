CREATE TABLE "BusinessRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessRecord_businessId_type_createdAt_idx"
ON "BusinessRecord"("businessId", "type", "createdAt");

ALTER TABLE "BusinessRecord"
ADD CONSTRAINT "BusinessRecord_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

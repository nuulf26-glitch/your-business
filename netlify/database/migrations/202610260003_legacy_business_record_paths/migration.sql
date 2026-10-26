ALTER TABLE "BusinessRecord" ADD COLUMN "legacyFirebasePath" TEXT;
CREATE UNIQUE INDEX "BusinessRecord_legacyFirebasePath_key" ON "BusinessRecord"("legacyFirebasePath");

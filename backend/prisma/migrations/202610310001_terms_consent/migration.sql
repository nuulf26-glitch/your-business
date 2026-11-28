CREATE TABLE "TermsConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TermsConsent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TermsConsent_userId_acceptedAt_idx" ON "TermsConsent"("userId", "acceptedAt");

ALTER TABLE "TermsConsent" ADD CONSTRAINT "TermsConsent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

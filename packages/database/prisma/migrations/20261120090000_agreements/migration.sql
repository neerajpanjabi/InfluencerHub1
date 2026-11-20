-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AgreementParty" AS ENUM ('BUSINESS', 'INFLUENCER');

-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('TYPED', 'DRAWN');

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "businessId" UUID NOT NULL,
    "influencerId" UUID NOT NULL,
    "campaignId" UUID,
    "createdById" UUID NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionId" UUID,
    "executedAt" TIMESTAMPTZ(6),
    "declinedReason" TEXT,
    "closedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_versions" (
    "id" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "clauses" JSONB NOT NULL,
    "financialTerms" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "authorParty" "AgreementParty" NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_signatures" (
    "id" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "party" "AgreementParty" NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "method" "SignatureMethod" NOT NULL,
    "signatureImage" TEXT,
    "contentHash" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agreements_number_key" ON "agreements"("number");

-- CreateIndex
CREATE UNIQUE INDEX "agreements_currentVersionId_key" ON "agreements"("currentVersionId");

-- CreateIndex
CREATE INDEX "agreements_businessId_status_idx" ON "agreements"("businessId", "status");

-- CreateIndex
CREATE INDEX "agreements_influencerId_status_idx" ON "agreements"("influencerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_versions_agreementId_version_key" ON "agreement_versions"("agreementId", "version");

-- CreateIndex
CREATE INDEX "agreement_signatures_agreementId_idx" ON "agreement_signatures"("agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_signatures_versionId_party_key" ON "agreement_signatures"("versionId", "party");

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "influencer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "agreement_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_versions" ADD CONSTRAINT "agreement_versions_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_signatures" ADD CONSTRAINT "agreement_signatures_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "agreement_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Agreements: integrity rules ────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS agreement_number_seq START 1001;

-- Versions and signatures are evidence: never updated or deleted.
CREATE TRIGGER agreement_versions_immutable
  BEFORE UPDATE OR DELETE ON agreement_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
CREATE TRIGGER agreement_signatures_immutable
  BEFORE UPDATE OR DELETE ON agreement_signatures
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

-- A signature must be for the exact content of the version it references.
CREATE OR REPLACE FUNCTION check_signature_hash() RETURNS trigger AS $$
BEGIN
  IF NEW."contentHash" <> (SELECT "contentHash" FROM agreement_versions WHERE id = NEW."versionId") THEN
    RAISE EXCEPTION 'Signature content hash does not match agreement version';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER agreement_signatures_hash_check
  BEFORE INSERT ON agreement_signatures
  FOR EACH ROW EXECUTE FUNCTION check_signature_hash();

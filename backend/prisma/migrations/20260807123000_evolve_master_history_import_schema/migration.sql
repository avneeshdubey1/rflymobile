-- Reconcile the August compatibility schema before adding the canonical
-- master/history model. Historical migrations remain byte-for-byte immutable;
-- all repairs are forward-only in this transaction. PostgreSQL rolls the whole
-- migration back if any preflight, DDL, backfill, or constraint step fails.
BEGIN;

ALTER TABLE "Drone"
ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "tankCapacityLitres" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "batteryCapacityMah" INTEGER,
ADD COLUMN IF NOT EXISTS "enduranceMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Drone"
SET "category" = COALESCE("category", "type"),
    "tankCapacityLitres" = COALESCE("tankCapacityLitres", "tankCapacity"),
    "batteryCapacityMah" = COALESCE("batteryCapacityMah", "batteryCapacity"),
    "enduranceMinutes" = COALESCE("enduranceMinutes", "endurance");

ALTER TABLE "Drone"
ALTER COLUMN "uin" DROP NOT NULL;

DO $$
DECLARE
    certified_type TEXT;
    unsupported_certified_values BIGINT;
BEGIN
    SELECT data_type
    INTO certified_type
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Drone'
      AND column_name = 'certified';

    IF certified_type IN ('text', 'character varying') THEN
        SELECT COUNT(*)
        INTO unsupported_certified_values
        FROM "Drone"
        WHERE "certified" IS NOT NULL
          AND trim("certified") <> ''
          AND lower(trim("certified")) NOT IN (
            'true', 'yes', '1', 'certified', 'false', 'no', '0', 'not certified'
          );

        IF unsupported_certified_values > 0 THEN
            RAISE EXCEPTION
              'Drone.certified contains % unsupported legacy value(s); reconcile them before deploying',
              unsupported_certified_values;
        END IF;

        ALTER TABLE "Drone"
        ALTER COLUMN "certified" TYPE BOOLEAN
        USING CASE
            WHEN lower(trim(COALESCE("certified", ''))) IN ('true', 'yes', '1', 'certified') THEN true
            ELSE false
        END;
    END IF;
END $$;

UPDATE "Drone"
SET "certified" = false
WHERE "certified" IS NULL;

ALTER TABLE "Drone"
ALTER COLUMN "certified" SET DEFAULT false,
ALTER COLUMN "certified" SET NOT NULL;

DROP TYPE IF EXISTS "DroneCategory";

-- CreateEnum
CREATE TYPE "AssetOperationalState" AS ENUM ('IN_SERVICE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "AssetAvailabilityState" AS ENUM ('AVAILABLE', 'ASSIGNED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "CropSeason" AS ENUM ('KHARIF', 'RABI', 'SUMMER', 'OTHER');

-- CreateEnum
CREATE TYPE "LanguageProficiency" AS ENUM ('PRIMARY', 'STRONG', 'WORKING', 'BASIC');

-- CreateEnum
CREATE TYPE "FarmLocationSource" AS ENUM ('STAFF_CAPTURED', 'PUBLIC_WEBSITE', 'IMPORTED_ZOHO', 'IMPORTED_GOOGLE_FORMS');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('FARMER_WORKBOOK', 'ZOHO_CRM', 'GOOGLE_FORMS');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('STAGED', 'VALIDATED', 'REVIEW_REQUIRED', 'APPROVED', 'IMPORTING', 'COMPLETED', 'FAILED', 'ROLLED_BACK', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "SourceRecordStatus" AS ENUM ('PENDING', 'VALID', 'REJECTED', 'REVIEW_REQUIRED', 'IMPORTED', 'SKIPPED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "HistoricalServiceStatus" AS ENUM ('COMPLETED', 'UNKNOWN', 'CORRECTED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HistoryEventType" AS ENUM ('BASELINE', 'CREATED', 'UPDATED', 'STATUS_CHANGED', 'CORRECTED', 'ARCHIVED', 'IMPORTED');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "serviceWindowEnd" TIMESTAMP(3),
ADD COLUMN     "serviceWindowStart" TIMESTAMP(3),
ADD COLUMN     "legacyCrewIncomplete" BOOLEAN;

-- Preserve, identify, and quarantine incomplete assignments created by the
-- compatibility application. The runtime may close them safely, but every new
-- assignment must satisfy the complete operational-unit invariant.
UPDATE "Assignment"
SET "legacyCrewIncomplete" = ("copilotId" IS NULL OR "lmvId" IS NULL);

ALTER TABLE "Assignment"
ALTER COLUMN "legacyCrewIncomplete" SET DEFAULT false,
ALTER COLUMN "legacyCrewIncomplete" SET NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdByImportBatchId" TEXT;

-- AlterTable
ALTER TABLE "Drone" ADD COLUMN     "availabilityState" "AssetAvailabilityState" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "operationalState" "AssetOperationalState" NOT NULL DEFAULT 'IN_SERVICE';

-- AlterTable
ALTER TABLE "LMV" ADD COLUMN     "availabilityState" "AssetAvailabilityState" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "operationalState" "AssetOperationalState" NOT NULL DEFAULT 'IN_SERVICE';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "acreageDecimal" DECIMAL(12,2),
ADD COLUMN     "cropId" TEXT,
ADD COLUMN     "farmLocationId" TEXT;

-- AlterTable
ALTER TABLE "OperatingCenter" ADD COLUMN     "administrativeLocationId" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "plusCode" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

UPDATE "OperatingCenter"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "OperatingCenter"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeCode" TEXT;

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "nativeName" VARCHAR(80),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crop" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "normalizedName" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'IN',
    "state" VARCHAR(120),
    "district" VARCHAR(120),
    "mandal" VARCHAR(120),
    "village" VARCHAR(160),
    "postalCode" VARCHAR(20),
    "normalizedKey" VARCHAR(640) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmLocation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "administrativeLocationId" TEXT,
    "label" VARCHAR(120),
    "addressText" VARCHAR(500),
    "plusCode" VARCHAR(20),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(10,2),
    "source" "FarmLocationSource" NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLanguagePreference" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "proficiency" "LanguageProficiency" NOT NULL DEFAULT 'WORKING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLanguagePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSeasonalCrop" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cropId" TEXT NOT NULL,
    "season" "CropSeason" NOT NULL,
    "seasonYear" INTEGER,
    "acreage" DECIMAL(12,2),
    "tankQuantity" DECIMAL(12,2),
    "expectedSprayings" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSeasonalCrop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSubscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "cardNumber" VARCHAR(80),
    "schemeCode" VARCHAR(80),
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "validFrom" DATE,
    "validUntil" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSprayPurpose" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "purposeCode" VARCHAR(80) NOT NULL,
    "labelSnapshot" VARCHAR(160),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSprayPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "originalFileName" VARCHAR(255) NOT NULL,
    "fileSizeBytes" BIGINT NOT NULL,
    "workbookType" VARCHAR(20) NOT NULL DEFAULT 'XLSX',
    "fileChecksum" CHAR(64) NOT NULL,
    "mappingVersion" VARCHAR(80) NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "supersedesBatchId" TEXT,
    "dryRunPlanHash" CHAR(64),
    "referenceDataFingerprint" CHAR(64),
    "approvalReference" VARCHAR(160),
    "backupEvidenceReference" VARCHAR(160),
    "expectedDeploymentName" VARCHAR(120),
    "reconciliationChecksum" CHAR(64),
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'STAGED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "reviewRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "safeReport" JSONB,
    "rawRetentionUntil" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "importStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceSystem" "ImportSourceType" NOT NULL,
    "sheetName" VARCHAR(120) NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "externalRecordId" VARCHAR(160),
    "rowFingerprint" CHAR(64) NOT NULL,
    "phoneFingerprint" CHAR(64),
    "recipientLast4" VARCHAR(4),
    "status" "SourceRecordStatus" NOT NULL DEFAULT 'PENDING',
    "reasonCode" VARCHAR(80),
    "safeDetails" JSONB,
    "proposedOutcome" VARCHAR(80),
    "finalOutcome" VARCHAR(80),
    "encryptedPayload" BYTEA NOT NULL,
    "payloadIv" BYTEA NOT NULL,
    "payloadAuthTag" BYTEA NOT NULL,
    "encryptionKeyVersion" VARCHAR(40) NOT NULL,
    "payloadExpiresAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,
    "resultEntityType" VARCHAR(80),
    "resultEntityId" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricalServiceRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "farmLocationId" TEXT,
    "cropId" TEXT,
    "operatingCenterId" TEXT,
    "serviceDate" DATE,
    "rawCropName" VARCHAR(160),
    "servicedAcres" DECIMAL(12,2),
    "legacyZone" VARCHAR(160),
    "status" "HistoricalServiceStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoricalServiceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VillageVisit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "collectorUserId" TEXT,
    "collectorNameRaw" VARCHAR(160),
    "employeeCodeRaw" VARCHAR(80),
    "administrativeLocationId" TEXT,
    "cropId" TEXT,
    "visitedAt" TIMESTAMP(3),
    "rawCropName" VARCHAR(160),
    "observedAcres" DECIMAL(12,2),
    "fertilizerShop" VARCHAR(240),
    "expectedSpraying" VARCHAR(240),
    "farmerType" VARCHAR(80),
    "notes" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerHistory" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" "HistoryEventType" NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "reason" VARCHAR(500),
    "effectiveAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" "HistoryEventType" NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "reason" VARCHAR(500),
    "effectiveAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroneHistory" (
    "id" TEXT NOT NULL,
    "droneId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" "HistoryEventType" NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "reason" VARCHAR(500),
    "effectiveAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DroneHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LMVHistory" (
    "id" TEXT NOT NULL,
    "lmvId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "eventType" "HistoryEventType" NOT NULL,
    "changedFields" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "reason" VARCHAR(500),
    "effectiveAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LMVHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");

-- CreateIndex
CREATE INDEX "Language_active_displayName_idx" ON "Language"("active", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_code_key" ON "Crop"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Crop_normalizedName_key" ON "Crop"("normalizedName");

-- CreateIndex
CREATE INDEX "Crop_active_displayName_idx" ON "Crop"("active", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Location_normalizedKey_key" ON "Location"("normalizedKey");

-- CreateIndex
CREATE INDEX "Location_countryCode_state_district_mandal_village_idx" ON "Location"("countryCode", "state", "district", "mandal", "village");

-- CreateIndex
CREATE INDEX "Location_active_idx" ON "Location"("active");

-- CreateIndex
CREATE INDEX "FarmLocation_customerId_active_idx" ON "FarmLocation"("customerId", "active");

-- CreateIndex
CREATE INDEX "FarmLocation_administrativeLocationId_idx" ON "FarmLocation"("administrativeLocationId");

-- CreateIndex
CREATE INDEX "FarmLocation_verifiedByUserId_idx" ON "FarmLocation"("verifiedByUserId");

-- CreateIndex
CREATE INDEX "FarmLocation_plusCode_idx" ON "FarmLocation"("plusCode");

-- CreateIndex
CREATE INDEX "CustomerLanguagePreference_languageId_idx" ON "CustomerLanguagePreference"("languageId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLanguagePreference_customerId_languageId_key" ON "CustomerLanguagePreference"("customerId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLanguagePreference_customerId_rank_key" ON "CustomerLanguagePreference"("customerId", "rank");

-- CreateIndex
CREATE INDEX "CustomerSeasonalCrop_customerId_season_seasonYear_idx" ON "CustomerSeasonalCrop"("customerId", "season", "seasonYear");

-- CreateIndex
CREATE INDEX "CustomerSeasonalCrop_cropId_idx" ON "CustomerSeasonalCrop"("cropId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSubscription_cardNumber_key" ON "CustomerSubscription"("cardNumber");

-- CreateIndex
CREATE INDEX "CustomerSubscription_customerId_status_idx" ON "CustomerSubscription"("customerId", "status");

-- CreateIndex
CREATE INDEX "LeadSprayPurpose_purposeCode_idx" ON "LeadSprayPurpose"("purposeCode");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSprayPurpose_leadId_purposeCode_key" ON "LeadSprayPurpose"("leadId", "purposeCode");

-- CreateIndex
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_rawRetentionUntil_idx" ON "ImportBatch"("rawRetentionUntil");

-- CreateIndex
CREATE INDEX "ImportBatch_createdByUserId_idx" ON "ImportBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "ImportBatch_approvedByUserId_idx" ON "ImportBatch"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_fileChecksum_mappingVersion_attemptNumber_key" ON "ImportBatch"("fileChecksum", "mappingVersion", "attemptNumber");

-- CreateIndex
CREATE INDEX "ImportBatch_supersedesBatchId_idx" ON "ImportBatch"("supersedesBatchId");

-- CreateIndex
CREATE INDEX "SourceRecord_batchId_status_idx" ON "SourceRecord"("batchId", "status");

-- CreateIndex
CREATE INDEX "SourceRecord_rowFingerprint_idx" ON "SourceRecord"("rowFingerprint");

-- CreateIndex
CREATE INDEX "SourceRecord_phoneFingerprint_idx" ON "SourceRecord"("phoneFingerprint");

-- CreateIndex
CREATE INDEX "SourceRecord_payloadExpiresAt_idx" ON "SourceRecord"("payloadExpiresAt");

-- CreateIndex
CREATE INDEX "SourceRecord_customerId_idx" ON "SourceRecord"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRecord_batchId_sheetName_sourceRowNumber_key" ON "SourceRecord"("batchId", "sheetName", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "SourceRecord_sourceSystem_externalRecordId_idx" ON "SourceRecord"("sourceSystem", "externalRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricalServiceRecord_sourceRecordId_key" ON "HistoricalServiceRecord"("sourceRecordId");

-- CreateIndex
CREATE INDEX "HistoricalServiceRecord_customerId_serviceDate_idx" ON "HistoricalServiceRecord"("customerId", "serviceDate");

-- CreateIndex
CREATE INDEX "HistoricalServiceRecord_farmLocationId_idx" ON "HistoricalServiceRecord"("farmLocationId");

-- CreateIndex
CREATE INDEX "HistoricalServiceRecord_cropId_idx" ON "HistoricalServiceRecord"("cropId");

-- CreateIndex
CREATE INDEX "HistoricalServiceRecord_operatingCenterId_idx" ON "HistoricalServiceRecord"("operatingCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "VillageVisit_sourceRecordId_key" ON "VillageVisit"("sourceRecordId");

-- CreateIndex
CREATE INDEX "VillageVisit_customerId_visitedAt_idx" ON "VillageVisit"("customerId", "visitedAt");

-- CreateIndex
CREATE INDEX "VillageVisit_collectorUserId_visitedAt_idx" ON "VillageVisit"("collectorUserId", "visitedAt");

-- CreateIndex
CREATE INDEX "VillageVisit_administrativeLocationId_idx" ON "VillageVisit"("administrativeLocationId");

-- CreateIndex
CREATE INDEX "VillageVisit_cropId_idx" ON "VillageVisit"("cropId");

-- CreateIndex
CREATE INDEX "CustomerHistory_customerId_recordedAt_idx" ON "CustomerHistory"("customerId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerHistory_customerId_version_key" ON "CustomerHistory"("customerId", "version");

-- CreateIndex
CREATE INDEX "CustomerHistory_actorUserId_idx" ON "CustomerHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "LeadHistory_leadId_recordedAt_idx" ON "LeadHistory"("leadId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeadHistory_leadId_version_key" ON "LeadHistory"("leadId", "version");

-- CreateIndex
CREATE INDEX "LeadHistory_actorUserId_idx" ON "LeadHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "DroneHistory_droneId_recordedAt_idx" ON "DroneHistory"("droneId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DroneHistory_droneId_version_key" ON "DroneHistory"("droneId", "version");

-- CreateIndex
CREATE INDEX "DroneHistory_actorUserId_idx" ON "DroneHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "LMVHistory_lmvId_recordedAt_idx" ON "LMVHistory"("lmvId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LMVHistory_lmvId_version_key" ON "LMVHistory"("lmvId", "version");

-- CreateIndex
CREATE INDEX "LMVHistory_actorUserId_idx" ON "LMVHistory"("actorUserId");

-- CreateIndex
CREATE INDEX "Assignment_pilotId_scheduledDate_idx" ON "Assignment"("pilotId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Assignment_droneId_scheduledDate_idx" ON "Assignment"("droneId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Assignment_lmvId_scheduledDate_idx" ON "Assignment"("lmvId", "scheduledDate");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_active_updatedAt_idx" ON "Customer"("active", "updatedAt");

-- CreateIndex
CREATE INDEX "Customer_createdByImportBatchId_idx" ON "Customer"("createdByImportBatchId");

-- CreateIndex
CREATE INDEX "Drone_homeCenterId_archivedAt_operationalState_availability_idx" ON "Drone"("homeCenterId", "archivedAt", "operationalState", "availabilityState");

-- CreateIndex
CREATE INDEX "LMV_homeCenterId_operationalState_availabilityState_idx" ON "LMV"("homeCenterId", "operationalState", "availabilityState");

-- CreateIndex
CREATE INDEX "Lead_farmLocationId_createdAt_idx" ON "Lead"("farmLocationId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_cropId_createdAt_idx" ON "Lead"("cropId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingCenter_code_key" ON "OperatingCenter"("code");

-- CreateIndex
CREATE INDEX "OperatingCenter_administrativeLocationId_idx" ON "OperatingCenter"("administrativeLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");

-- AddForeignKey
ALTER TABLE "OperatingCenter" ADD CONSTRAINT "OperatingCenter_administrativeLocationId_fkey" FOREIGN KEY ("administrativeLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdByImportBatchId_fkey" FOREIGN KEY ("createdByImportBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_farmLocationId_fkey" FOREIGN KEY ("farmLocationId") REFERENCES "FarmLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmLocation" ADD CONSTRAINT "FarmLocation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmLocation" ADD CONSTRAINT "FarmLocation_administrativeLocationId_fkey" FOREIGN KEY ("administrativeLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmLocation" ADD CONSTRAINT "FarmLocation_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLanguagePreference" ADD CONSTRAINT "CustomerLanguagePreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLanguagePreference" ADD CONSTRAINT "CustomerLanguagePreference_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSeasonalCrop" ADD CONSTRAINT "CustomerSeasonalCrop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSeasonalCrop" ADD CONSTRAINT "CustomerSeasonalCrop_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSprayPurpose" ADD CONSTRAINT "LeadSprayPurpose_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_supersedesBatchId_fkey" FOREIGN KEY ("supersedesBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalServiceRecord" ADD CONSTRAINT "HistoricalServiceRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalServiceRecord" ADD CONSTRAINT "HistoricalServiceRecord_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "SourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalServiceRecord" ADD CONSTRAINT "HistoricalServiceRecord_farmLocationId_fkey" FOREIGN KEY ("farmLocationId") REFERENCES "FarmLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalServiceRecord" ADD CONSTRAINT "HistoricalServiceRecord_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricalServiceRecord" ADD CONSTRAINT "HistoricalServiceRecord_operatingCenterId_fkey" FOREIGN KEY ("operatingCenterId") REFERENCES "OperatingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageVisit" ADD CONSTRAINT "VillageVisit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageVisit" ADD CONSTRAINT "VillageVisit_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "SourceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageVisit" ADD CONSTRAINT "VillageVisit_collectorUserId_fkey" FOREIGN KEY ("collectorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageVisit" ADD CONSTRAINT "VillageVisit_administrativeLocationId_fkey" FOREIGN KEY ("administrativeLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillageVisit" ADD CONSTRAINT "VillageVisit_cropId_fkey" FOREIGN KEY ("cropId") REFERENCES "Crop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerHistory" ADD CONSTRAINT "CustomerHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerHistory" ADD CONSTRAINT "CustomerHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadHistory" ADD CONSTRAINT "LeadHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadHistory" ADD CONSTRAINT "LeadHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroneHistory" ADD CONSTRAINT "DroneHistory_droneId_fkey" FOREIGN KEY ("droneId") REFERENCES "Drone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroneHistory" ADD CONSTRAINT "DroneHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMVHistory" ADD CONSTRAINT "LMVHistory_lmvId_fkey" FOREIGN KEY ("lmvId") REFERENCES "LMV"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LMVHistory" ADD CONSTRAINT "LMVHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Compatibility backfills. No legacy column is removed or rewritten.
UPDATE "Lead"
SET "acreageDecimal" = ROUND(("acreage"::numeric), 2)
WHERE "acreageDecimal" IS NULL
  AND "acreage"::text NOT IN ('NaN', 'Infinity', '-Infinity')
  AND "acreage" >= 0;

UPDATE "Drone"
SET
  "operationalState" = CASE
    WHEN "status" = 'MAINTENANCE' THEN 'MAINTENANCE'::"AssetOperationalState"
    WHEN "status" = 'OUT_OF_SERVICE' THEN 'OUT_OF_SERVICE'::"AssetOperationalState"
    ELSE 'IN_SERVICE'::"AssetOperationalState"
  END,
  "availabilityState" = CASE
    WHEN "status" = 'AVAILABLE' THEN 'AVAILABLE'::"AssetAvailabilityState"
    WHEN "status" = 'ASSIGNED' THEN 'ASSIGNED'::"AssetAvailabilityState"
    ELSE 'UNAVAILABLE'::"AssetAvailabilityState"
  END;

UPDATE "LMV"
SET
  "operationalState" = CASE
    WHEN "status" = 'MAINTENANCE' THEN 'MAINTENANCE'::"AssetOperationalState"
    WHEN "status" = 'OUT_OF_SERVICE' THEN 'OUT_OF_SERVICE'::"AssetOperationalState"
    ELSE 'IN_SERVICE'::"AssetOperationalState"
  END,
  "availabilityState" = CASE
    WHEN "status" = 'AVAILABLE' THEN 'AVAILABLE'::"AssetAvailabilityState"
    WHEN "status" = 'ASSIGNED' THEN 'ASSIGNED'::"AssetAvailabilityState"
    ELSE 'UNAVAILABLE'::"AssetAvailabilityState"
  END;

-- Seed the controlled values already exposed by the compatibility UI. These
-- are operational reference data, not demo/customer records. "Others" remains
-- a UI sentinel and is intentionally not a crop master value.
INSERT INTO "Crop" ("id", "code", "displayName", "normalizedName", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'paddy', 'Paddy', 'paddy', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'black-gram', 'Black gram', 'blackgram', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'maize', 'Maize', 'maize', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'green-gram', 'Green gram', 'greengram', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'red-gram', 'Red gram', 'redgram', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'cotton', 'Cotton', 'cotton', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'chilly', 'Chilly', 'chilly', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'sugar-cane', 'Sugar cane', 'sugarcane', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'jowar', 'Jowar', 'jowar', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'bengal-gram', 'Bengal gram', 'bengalgram', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'groundnut', 'Ground nut', 'groundnut', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'tobacco', 'Tobacco', 'tobacco', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "normalizedName" = EXCLUDED."normalizedName",
    "active" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

-- Evolve populated legacy records into the normalized master layer without
-- deleting or rewriting their compatibility fields. Deterministic codes make
-- this backfill auditable while keeping unapproved future import values in the
-- importer's review queue.
INSERT INTO "Language" ("id", "code", "displayName", "nativeName", "active", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'en', 'English', 'English', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ta', 'Tamil', 'தமிழ்', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'kn', 'Kannada', 'ಕನ್ನಡ', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'te', 'Telugu', 'తెలుగు', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'hi', 'Hindi', 'हिन्दी', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ml', 'Malayalam', 'മലയാളം', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'und', 'Not recorded', NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "displayName" = EXCLUDED."displayName",
    "nativeName" = EXCLUDED."nativeName",
    "active" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

WITH legacy_languages(raw_value) AS (
  SELECT trim("preferredLanguage") FROM "Customer" WHERE trim(COALESCE("preferredLanguage", '')) <> ''
  UNION
  SELECT trim("preferredLanguage") FROM "User" WHERE trim(COALESCE("preferredLanguage", '')) <> ''
  UNION
  SELECT trim("preferredLanguage") FROM "Lead" WHERE trim(COALESCE("preferredLanguage", '')) <> ''
), normalized AS (
  SELECT
    raw_value,
    CASE
      WHEN lower(raw_value) ~ '^[a-z]{2,8}([_-][a-z0-9]{2,8})?$' AND length(raw_value) <= 12
        THEN replace(lower(raw_value), '_', '-')
      ELSE 'l_' || substr(md5(lower(raw_value)), 1, 10)
    END AS language_code
  FROM legacy_languages
)
INSERT INTO "Language" ("id", "code", "displayName", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, language_code, left(raw_value, 80), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM normalized
ON CONFLICT ("code") DO NOTHING;

WITH customer_languages AS (
  SELECT
    c."id" AS customer_id,
    CASE
      WHEN lower(trim(c."preferredLanguage")) ~ '^[a-z]{2,8}([_-][a-z0-9]{2,8})?$'
           AND length(trim(c."preferredLanguage")) <= 12
        THEN replace(lower(trim(c."preferredLanguage")), '_', '-')
      ELSE 'l_' || substr(md5(lower(trim(c."preferredLanguage"))), 1, 10)
    END AS language_code
  FROM "Customer" c
  WHERE trim(COALESCE(c."preferredLanguage", '')) <> ''
)
INSERT INTO "CustomerLanguagePreference" (
  "id", "customerId", "languageId", "rank", "proficiency", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, cl.customer_id, l."id", 1, 'PRIMARY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customer_languages cl
JOIN "Language" l ON l."code" = cl.language_code
ON CONFLICT ("customerId", "languageId") DO NOTHING;

WITH legacy_crops(raw_value) AS (
  SELECT trim("cropType") FROM "Lead" WHERE trim(COALESCE("cropType", '')) <> ''
  UNION SELECT trim(CASE WHEN lower(trim(COALESCE("kharifCrop", ''))) = 'other' THEN "kharifOtherCrop" ELSE "kharifCrop" END) FROM "Customer"
  UNION SELECT trim(CASE WHEN lower(trim(COALESCE("rabiCrop", ''))) = 'other' THEN "rabiOtherCrop" ELSE "rabiCrop" END) FROM "Customer"
  UNION SELECT trim(CASE WHEN lower(trim(COALESCE("summerCrop", ''))) = 'other' THEN "summerOtherCrop" ELSE "summerCrop" END) FROM "Customer"
), normalized AS (
  SELECT DISTINCT
    left(regexp_replace(lower(raw_value), '[^[:alnum:]]+', '', 'g'), 120) AS normalized_name,
    left(raw_value, 120) AS display_name
  FROM legacy_crops
  WHERE trim(COALESCE(raw_value, '')) <> ''
)
INSERT INTO "Crop" ("id", "code", "displayName", "normalizedName", "active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'legacy_' || substr(md5(normalized_name), 1, 32),
  min(display_name),
  normalized_name,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM normalized
GROUP BY normalized_name
ON CONFLICT ("normalizedName") DO NOTHING;

WITH seasonal_values AS (
  SELECT "id" AS customer_id, 'KHARIF'::"CropSeason" AS season,
    trim(CASE WHEN lower(trim(COALESCE("kharifCrop", ''))) = 'other' THEN "kharifOtherCrop" ELSE "kharifCrop" END) AS crop_name,
    "kharifAcres" AS acreage, "kharifTanks" AS tanks, "kharifSprayings" AS sprayings
  FROM "Customer"
  UNION ALL
  SELECT "id", 'RABI'::"CropSeason",
    trim(CASE WHEN lower(trim(COALESCE("rabiCrop", ''))) = 'other' THEN "rabiOtherCrop" ELSE "rabiCrop" END),
    "rabiAcres", "rabiTanks", "rabiSprayings"
  FROM "Customer"
  UNION ALL
  SELECT "id", 'SUMMER'::"CropSeason",
    trim(CASE WHEN lower(trim(COALESCE("summerCrop", ''))) = 'other' THEN "summerOtherCrop" ELSE "summerCrop" END),
    "summerAcres", "summerTanks", "summerSprayings"
  FROM "Customer"
)
INSERT INTO "CustomerSeasonalCrop" (
  "id", "customerId", "cropId", "season", "seasonYear", "acreage", "tankQuantity", "expectedSprayings", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  sv.customer_id,
  crop."id",
  sv.season,
  NULL,
  CASE WHEN sv.acreage IS NULL OR sv.acreage::text IN ('NaN', 'Infinity', '-Infinity') THEN NULL ELSE round(sv.acreage::numeric, 2) END,
  CASE WHEN sv.tanks IS NULL OR sv.tanks::text IN ('NaN', 'Infinity', '-Infinity') THEN NULL ELSE round(sv.tanks::numeric, 2) END,
  sv.sprayings,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM seasonal_values sv
JOIN "Crop" crop
  ON crop."normalizedName" = left(regexp_replace(lower(sv.crop_name), '[^[:alnum:]]+', '', 'g'), 120)
WHERE trim(COALESCE(sv.crop_name, '')) <> '';

WITH subscription_values AS (
  SELECT
    "id" AS customer_id,
    NULLIF(trim("subscriptionCardNumber"), '') AS card_number,
    NULLIF(trim("subscriptionYear"), '') AS scheme_code,
    COUNT(*) OVER (PARTITION BY NULLIF(trim("subscriptionCardNumber"), '')) AS card_count
  FROM "Customer"
  WHERE trim(COALESCE("subscriptionCardNumber", '')) <> ''
     OR trim(COALESCE("subscriptionYear", '')) <> ''
)
INSERT INTO "CustomerSubscription" (
  "id", "customerId", "cardNumber", "schemeCode", "status", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  customer_id,
  CASE WHEN card_number IS NOT NULL AND card_count = 1 THEN left(card_number, 80) ELSE NULL END,
  left(scheme_code, 80),
  'UNKNOWN',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM subscription_values;

WITH customer_locations AS (
  SELECT
    c."id" AS customer_id,
    NULLIF(trim(c."state"), '') AS state_name,
    NULLIF(trim(c."district"), '') AS district_name,
    NULLIF(trim(c."mandal"), '') AS mandal_name,
    NULLIF(trim(c."village"), '') AS village_name,
    lower(concat(
      'in|', regexp_replace(trim(COALESCE(c."state", '')), '[[:space:]]+', ' ', 'g'),
      '|', regexp_replace(trim(COALESCE(c."district", '')), '[[:space:]]+', ' ', 'g'),
      '|', regexp_replace(trim(COALESCE(c."mandal", '')), '[[:space:]]+', ' ', 'g'),
      '|', regexp_replace(trim(COALESCE(c."village", '')), '[[:space:]]+', ' ', 'g')
    )) AS normalized_key
  FROM "Customer" c
  WHERE trim(COALESCE(c."state", '')) <> ''
     OR trim(COALESCE(c."district", '')) <> ''
     OR trim(COALESCE(c."mandal", '')) <> ''
     OR trim(COALESCE(c."village", '')) <> ''
)
INSERT INTO "Location" (
  "id", "countryCode", "state", "district", "mandal", "village", "normalizedKey", "active", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, 'IN', min(state_name), min(district_name), min(mandal_name), min(village_name), normalized_key, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customer_locations
GROUP BY normalized_key
ON CONFLICT ("normalizedKey") DO NOTHING;

WITH customer_locations AS (
  SELECT
    c."id" AS customer_id,
    lower(concat(
      'in|', regexp_replace(trim(COALESCE(c."state", '')), '[[:space:]]+', ' ', 'g'),
      '|', regexp_replace(trim(COALESCE(c."district", '')), '[[:space:]]+', ' ', 'g'),
      '|', regexp_replace(trim(COALESCE(c."mandal", '')), '[[:space:]]+', ' ', 'g'),
      '|', regexp_replace(trim(COALESCE(c."village", '')), '[[:space:]]+', ' ', 'g')
    )) AS normalized_key,
    concat_ws(', ', NULLIF(trim(c."village"), ''), NULLIF(trim(c."mandal"), ''), NULLIF(trim(c."district"), ''), NULLIF(trim(c."state"), '')) AS address_text
  FROM "Customer" c
  WHERE trim(COALESCE(c."state", '')) <> ''
     OR trim(COALESCE(c."district", '')) <> ''
     OR trim(COALESCE(c."mandal", '')) <> ''
     OR trim(COALESCE(c."village", '')) <> ''
)
INSERT INTO "FarmLocation" (
  "id", "customerId", "administrativeLocationId", "label", "addressText", "source", "active", "createdAt", "updatedAt"
)
SELECT gen_random_uuid()::text, cl.customer_id, l."id", 'Primary farm', left(cl.address_text, 500), 'STAFF_CAPTURED', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM customer_locations cl
JOIN "Location" l ON l."normalizedKey" = cl.normalized_key;

UPDATE "Lead" lead
SET "cropId" = crop."id"
FROM "Crop" crop
WHERE lead."cropId" IS NULL
  AND trim(COALESCE(lead."cropType", '')) <> ''
  AND crop."normalizedName" = left(regexp_replace(lower(trim(lead."cropType")), '[^[:alnum:]]+', '', 'g'), 120);

INSERT INTO "FarmLocation" (
  "id", "customerId", "administrativeLocationId", "label", "addressText", "latitude", "longitude", "source", "active", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  lead."customerId",
  customer_farm."administrativeLocationId",
  left('Legacy Lead ' || lead."id", 120),
  left(lead."farmerAddress", 500),
  CASE
    WHEN lead."latitude" IS NULL OR lead."longitude" IS NULL
      OR lead."latitude"::text IN ('NaN', 'Infinity', '-Infinity')
      OR lead."longitude"::text IN ('NaN', 'Infinity', '-Infinity')
      OR lead."latitude" NOT BETWEEN -90 AND 90
      OR lead."longitude" NOT BETWEEN -180 AND 180
    THEN NULL ELSE round(lead."latitude"::numeric, 7)
  END,
  CASE
    WHEN lead."latitude" IS NULL OR lead."longitude" IS NULL
      OR lead."latitude"::text IN ('NaN', 'Infinity', '-Infinity')
      OR lead."longitude"::text IN ('NaN', 'Infinity', '-Infinity')
      OR lead."latitude" NOT BETWEEN -90 AND 90
      OR lead."longitude" NOT BETWEEN -180 AND 180
    THEN NULL ELSE round(lead."longitude"::numeric, 7)
  END,
  CASE WHEN lead."intakeChannel" = 'WEBSITE' THEN 'PUBLIC_WEBSITE'::"FarmLocationSource" ELSE 'STAFF_CAPTURED'::"FarmLocationSource" END,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Lead" lead
LEFT JOIN LATERAL (
  SELECT farm."administrativeLocationId"
  FROM "FarmLocation" farm
  WHERE farm."customerId" = lead."customerId"
  ORDER BY farm."createdAt", farm."id"
  LIMIT 1
) customer_farm ON true
WHERE lead."customerId" IS NOT NULL
  AND lead."farmLocationId" IS NULL
  AND (lead."farmerAddress" IS NOT NULL OR (lead."latitude" IS NOT NULL AND lead."longitude" IS NOT NULL));

UPDATE "Lead" lead
SET "farmLocationId" = farm."id"
FROM "FarmLocation" farm
WHERE lead."customerId" IS NOT NULL
  AND lead."farmLocationId" IS NULL
  AND farm."customerId" = lead."customerId"
  AND farm."label" = left('Legacy Lead ' || lead."id", 120);

INSERT INTO "LeadSprayPurpose" ("id", "leadId", "purposeCode", "labelSnapshot", "createdAt")
SELECT
  gen_random_uuid()::text,
  lead."id",
  'legacy_' || substr(md5(lower(trim(lead."sprayPurpose"))), 1, 32),
  left(trim(lead."sprayPurpose"), 160),
  CURRENT_TIMESTAMP
FROM "Lead" lead
WHERE trim(COALESCE(lead."sprayPurpose", '')) <> ''
ON CONFLICT ("leadId", "purposeCode") DO NOTHING;

-- Canonicalize every safely recognizable legacy customer phone before adding
-- the constraint. Ambiguous values or canonical collisions stop the migration
-- with count-only evidence; they are never guessed or silently discarded.
DO $$
DECLARE
  invalid_phone_count BIGINT;
  canonical_collision_count BIGINT;
BEGIN
  WITH candidates AS (
    SELECT
      "id",
      CASE
        WHEN trim("phone") ~ '^[+][0-9]{8,15}$' THEN trim("phone")
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
          THEN '+91' || regexp_replace("phone", '[^0-9]', '', 'g')
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
          THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$'
          THEN '+91' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 2)
        ELSE NULL
      END AS canonical_phone
    FROM "Customer"
  )
  SELECT COUNT(*) INTO invalid_phone_count
  FROM candidates
  WHERE canonical_phone IS NULL;

  WITH candidates AS (
    SELECT
      CASE
        WHEN trim("phone") ~ '^[+][0-9]{8,15}$' THEN trim("phone")
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
          THEN '+91' || regexp_replace("phone", '[^0-9]', '', 'g')
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
          THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
        WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$'
          THEN '+91' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 2)
        ELSE NULL
      END AS canonical_phone
    FROM "Customer"
  )
  SELECT COUNT(*) INTO canonical_collision_count
  FROM (
    SELECT canonical_phone
    FROM candidates
    WHERE canonical_phone IS NOT NULL
    GROUP BY canonical_phone
    HAVING COUNT(*) > 1
  ) collisions;

  IF invalid_phone_count > 0 OR canonical_collision_count > 0 THEN
    RAISE EXCEPTION
      'Customer phone preflight failed: % unrecognized value(s), % canonical collision group(s)',
      invalid_phone_count,
      canonical_collision_count;
  END IF;
END $$;

WITH candidates AS (
  SELECT
    "id",
    CASE
      WHEN trim("phone") ~ '^[+][0-9]{8,15}$' THEN trim("phone")
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$'
        THEN '+91' || regexp_replace("phone", '[^0-9]', '', 'g')
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$'
        THEN '+' || regexp_replace("phone", '[^0-9]', '', 'g')
      WHEN regexp_replace("phone", '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$'
        THEN '+91' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 2)
    END AS canonical_phone
  FROM "Customer"
)
UPDATE "Customer" customer
SET "phone" = candidates.canonical_phone
FROM candidates
WHERE customer."id" = candidates."id"
  AND customer."phone" IS DISTINCT FROM candidates.canonical_phone;

DO $$
DECLARE
  invalid_lead_acreage_count BIGINT;
  invalid_assignment_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO invalid_lead_acreage_count
  FROM "Lead"
  WHERE "acreageDecimal" IS NOT NULL AND "acreageDecimal" < 0;

  SELECT COUNT(*) INTO invalid_assignment_count
  FROM "Assignment"
  WHERE ("copilotId" IS NOT NULL AND "pilotId" = "copilotId")
     OR ("copilotDroneId" IS NOT NULL AND "copilotDroneId" <> "droneId")
     OR "dailySequence" <= 0
     OR ("serviceWindowStart" IS NOT NULL AND "serviceWindowEnd" IS NOT NULL
         AND "serviceWindowEnd" <= "serviceWindowStart");

  IF invalid_lead_acreage_count > 0 OR invalid_assignment_count > 0 THEN
    RAISE EXCEPTION
      'Operational compatibility preflight failed: % invalid Lead acreage row(s), % invalid Assignment row(s)',
      invalid_lead_acreage_count,
      invalid_assignment_count;
  END IF;
END $$;

-- Constraints are added and explicitly validated in this migration. The
-- temporary NOT VALID form permits the data preflight/backfill ordering only;
-- the migration cannot commit with an unvalidated compatibility row.
ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_phone_canonical_check"
CHECK ("phone" ~ '^[+][0-9]{8,15}$') NOT VALID;

ALTER TABLE "FarmLocation"
ADD CONSTRAINT "FarmLocation_coordinate_pair_check"
CHECK (("latitude" IS NULL) = ("longitude" IS NULL)) NOT VALID,
ADD CONSTRAINT "FarmLocation_latitude_range_check"
CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)) NOT VALID,
ADD CONSTRAINT "FarmLocation_longitude_range_check"
CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180)) NOT VALID,
ADD CONSTRAINT "FarmLocation_accuracy_nonnegative_check"
CHECK ("accuracyMeters" IS NULL OR "accuracyMeters" >= 0) NOT VALID;

ALTER TABLE "CustomerLanguagePreference"
ADD CONSTRAINT "CustomerLanguagePreference_rank_positive_check"
CHECK ("rank" > 0) NOT VALID;

ALTER TABLE "CustomerSeasonalCrop"
ADD CONSTRAINT "CustomerSeasonalCrop_acreage_nonnegative_check"
CHECK ("acreage" IS NULL OR "acreage" >= 0) NOT VALID,
ADD CONSTRAINT "CustomerSeasonalCrop_tanks_nonnegative_check"
CHECK ("tankQuantity" IS NULL OR "tankQuantity" >= 0) NOT VALID,
ADD CONSTRAINT "CustomerSeasonalCrop_sprayings_nonnegative_check"
CHECK ("expectedSprayings" IS NULL OR "expectedSprayings" >= 0) NOT VALID;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_acreage_decimal_nonnegative_check"
CHECK ("acreageDecimal" IS NULL OR "acreageDecimal" >= 0) NOT VALID;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_distinct_crew_check"
CHECK ("copilotId" IS NULL OR "pilotId" <> "copilotId") NOT VALID,
ADD CONSTRAINT "Assignment_complete_crew_check"
CHECK ("legacyCrewIncomplete" OR ("copilotId" IS NOT NULL AND "lmvId" IS NOT NULL)) NOT VALID,
ADD CONSTRAINT "Assignment_single_drone_check"
CHECK ("copilotDroneId" IS NULL OR "copilotDroneId" = "droneId") NOT VALID,
ADD CONSTRAINT "Assignment_daily_sequence_positive_check"
CHECK ("dailySequence" > 0) NOT VALID,
ADD CONSTRAINT "Assignment_service_window_order_check"
CHECK ("serviceWindowStart" IS NULL OR "serviceWindowEnd" IS NULL OR "serviceWindowEnd" > "serviceWindowStart") NOT VALID;

DO $$
DECLARE duplicate_sequences BIGINT;
BEGIN
  SELECT COUNT(*) INTO duplicate_sequences
  FROM (
    SELECT 1
    FROM "Assignment"
    WHERE "copilotId" IS NOT NULL AND "lmvId" IS NOT NULL
    GROUP BY
      least("pilotId", "copilotId"),
      greatest("pilotId", "copilotId"),
      "droneId",
      "lmvId",
      "scheduledDate"::date,
      "dailySequence"
    HAVING COUNT(*) > 1
  ) duplicate_groups;

  IF duplicate_sequences > 0 THEN
    RAISE EXCEPTION
      'Assignment contains % duplicate crew/day sequence group(s); reconcile ordering before deploying',
      duplicate_sequences;
  END IF;
END $$;

CREATE UNIQUE INDEX "Assignment_crew_day_sequence_key"
ON "Assignment" (
  least("pilotId", "copilotId"),
  greatest("pilotId", "copilotId"),
  "droneId",
  "lmvId",
  ("scheduledDate"::date),
  "dailySequence"
)
WHERE "copilotId" IS NOT NULL AND "lmvId" IS NOT NULL;

ALTER TABLE "CustomerSubscription"
ADD CONSTRAINT "CustomerSubscription_date_order_check"
CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" >= "validFrom") NOT VALID;

CREATE UNIQUE INDEX "CustomerSeasonalCrop_current_key"
ON "CustomerSeasonalCrop" ("customerId", "season")
WHERE "seasonYear" IS NULL;

CREATE UNIQUE INDEX "CustomerSubscription_current_key"
ON "CustomerSubscription" ("customerId")
WHERE "status" IN ('ACTIVE', 'UNKNOWN');

ALTER TABLE "Language"
ADD CONSTRAINT "Language_code_trimmed_check"
CHECK (length(trim("code")) > 0 AND "code" = lower(trim("code"))) NOT VALID;

ALTER TABLE "Crop"
ADD CONSTRAINT "Crop_code_trimmed_check"
CHECK (length(trim("code")) > 0 AND "code" = lower(trim("code"))) NOT VALID,
ADD CONSTRAINT "Crop_normalized_name_check"
CHECK (
  length(trim("normalizedName")) > 0
  AND "normalizedName" = lower(trim("normalizedName"))
  AND "normalizedName" !~ '[[:space:]]'
) NOT VALID;

ALTER TABLE "Location"
ADD CONSTRAINT "Location_normalized_key_check"
CHECK (length(trim("normalizedKey")) > 0 AND "normalizedKey" = lower(trim("normalizedKey"))) NOT VALID;

ALTER TABLE "ImportBatch"
ADD CONSTRAINT "ImportBatch_counts_nonnegative_check"
CHECK (
  "totalRows" >= 0 AND "validRows" >= 0 AND "rejectedRows" >= 0
  AND "reviewRows" >= 0 AND "importedRows" >= 0 AND "skippedRows" >= 0
) NOT VALID,
ADD CONSTRAINT "ImportBatch_counts_reconcile_check"
CHECK (
  "totalRows" = "validRows" + "rejectedRows" + "reviewRows" + "skippedRows"
  AND "importedRows" <= "validRows"
) NOT VALID,
ADD CONSTRAINT "ImportBatch_file_size_positive_check"
CHECK ("fileSizeBytes" > 0) NOT VALID,
ADD CONSTRAINT "ImportBatch_attempt_positive_check"
CHECK ("attemptNumber" > 0) NOT VALID,
ADD CONSTRAINT "ImportBatch_retention_after_creation_check"
CHECK ("rawRetentionUntil" > "createdAt") NOT VALID,
ADD CONSTRAINT "ImportBatch_approval_evidence_check"
CHECK (
  "status" NOT IN ('APPROVED', 'IMPORTING', 'COMPLETED')
  OR (
    "approvedByUserId" IS NOT NULL
    AND "approvedAt" IS NOT NULL
    AND "approvalReference" IS NOT NULL
    AND "backupEvidenceReference" IS NOT NULL
    AND "expectedDeploymentName" IS NOT NULL
    AND "dryRunPlanHash" IS NOT NULL
    AND "referenceDataFingerprint" IS NOT NULL
  )
) NOT VALID,
ADD CONSTRAINT "ImportBatch_completion_evidence_check"
CHECK (
  "status" <> 'COMPLETED'
  OR (
    "completedAt" IS NOT NULL
    AND "reconciledAt" IS NOT NULL
    AND "reconciliationChecksum" IS NOT NULL
    AND "failureCode" IS NULL
  )
) NOT VALID;

ALTER TABLE "SourceRecord"
ADD CONSTRAINT "SourceRecord_row_number_positive_check"
CHECK ("sourceRowNumber" > 1) NOT VALID,
ADD CONSTRAINT "SourceRecord_external_id_nonblank_check"
CHECK ("externalRecordId" IS NULL OR length(trim("externalRecordId")) > 0) NOT VALID,
ADD CONSTRAINT "SourceRecord_fingerprint_format_check"
CHECK (
  "rowFingerprint" ~ '^[0-9a-f]{64}$'
  AND ("phoneFingerprint" IS NULL OR "phoneFingerprint" ~ '^[0-9a-f]{64}$')
) NOT VALID,
ADD CONSTRAINT "SourceRecord_encryption_shape_check"
CHECK (
  (
    octet_length("encryptedPayload") > 0
    AND octet_length("payloadIv") = 12
    AND octet_length("payloadAuthTag") = 16
  )
  OR (
    octet_length("encryptedPayload") = 0
    AND octet_length("payloadIv") = 0
    AND octet_length("payloadAuthTag") = 0
  )
) NOT VALID;

ALTER TABLE "HistoricalServiceRecord"
ADD CONSTRAINT "HistoricalServiceRecord_acres_nonnegative_check"
CHECK ("servicedAcres" IS NULL OR "servicedAcres" >= 0) NOT VALID;

ALTER TABLE "VillageVisit"
ADD CONSTRAINT "VillageVisit_acres_nonnegative_check"
CHECK ("observedAcres" IS NULL OR "observedAcres" >= 0) NOT VALID;

ALTER TABLE "Drone"
ADD CONSTRAINT "Drone_asset_state_consistency_check"
CHECK (
  ("operationalState" = 'IN_SERVICE' AND "availabilityState" IN ('AVAILABLE', 'ASSIGNED'))
  OR ("operationalState" IN ('MAINTENANCE', 'OUT_OF_SERVICE') AND "availabilityState" = 'UNAVAILABLE')
) NOT VALID;

ALTER TABLE "Drone"
ADD CONSTRAINT "Drone_capacity_nonnegative_check"
CHECK (
  ("tankCapacity" IS NULL OR "tankCapacity" >= 0)
  AND ("tankCapacityLitres" IS NULL OR "tankCapacityLitres" >= 0)
  AND ("batteryCapacity" IS NULL OR "batteryCapacity" >= 0)
  AND ("batteryCapacityMah" IS NULL OR "batteryCapacityMah" >= 0)
  AND ("endurance" IS NULL OR "endurance" >= 0)
  AND ("enduranceMinutes" IS NULL OR "enduranceMinutes" >= 0)
) NOT VALID;

ALTER TABLE "Drone"
ADD CONSTRAINT "Drone_archived_state_check"
CHECK (
  "archivedAt" IS NULL
  OR (
    "status" = 'OUT_OF_SERVICE'
    AND "operationalState" = 'OUT_OF_SERVICE'
    AND "availabilityState" = 'UNAVAILABLE'
  )
) NOT VALID;

ALTER TABLE "LMV"
ADD CONSTRAINT "LMV_asset_state_consistency_check"
CHECK (
  ("operationalState" = 'IN_SERVICE' AND "availabilityState" IN ('AVAILABLE', 'ASSIGNED'))
  OR ("operationalState" IN ('MAINTENANCE', 'OUT_OF_SERVICE') AND "availabilityState" = 'UNAVAILABLE')
) NOT VALID;

ALTER TABLE "LMV"
ADD CONSTRAINT "LMV_capacity_positive_check"
CHECK ("capacity" > 0) NOT VALID;

DO $$
DECLARE
  centre_code_collisions BIGINT;
  employee_code_collisions BIGINT;
BEGIN
  SELECT COUNT(*) INTO centre_code_collisions
  FROM (
    SELECT lower(trim("code"))
    FROM "OperatingCenter"
    WHERE NULLIF(trim("code"), '') IS NOT NULL
    GROUP BY lower(trim("code"))
    HAVING COUNT(*) > 1
  ) duplicates;

  SELECT COUNT(*) INTO employee_code_collisions
  FROM (
    SELECT lower(trim("employeeCode"))
    FROM "User"
    WHERE NULLIF(trim("employeeCode"), '') IS NOT NULL
    GROUP BY lower(trim("employeeCode"))
    HAVING COUNT(*) > 1
  ) duplicates;

  IF centre_code_collisions > 0 OR employee_code_collisions > 0 THEN
    RAISE EXCEPTION
      'Case-insensitive master-code preflight failed: % OperatingCenter collision group(s), % employee-code collision group(s)',
      centre_code_collisions,
      employee_code_collisions;
  END IF;
END $$;

CREATE UNIQUE INDEX "OperatingCenter_code_ci_key"
ON "OperatingCenter" (lower(trim("code")))
WHERE NULLIF(trim("code"), '') IS NOT NULL;

CREATE UNIQUE INDEX "User_employeeCode_ci_key"
ON "User" (lower(trim("employeeCode")))
WHERE NULLIF(trim("employeeCode"), '') IS NOT NULL;

-- Every temporary NOT VALID constraint above is validated before this
-- migration can commit. No legacy row is left in an uneditable limbo.
ALTER TABLE "Customer" VALIDATE CONSTRAINT "Customer_phone_canonical_check";
ALTER TABLE "FarmLocation" VALIDATE CONSTRAINT "FarmLocation_coordinate_pair_check";
ALTER TABLE "FarmLocation" VALIDATE CONSTRAINT "FarmLocation_latitude_range_check";
ALTER TABLE "FarmLocation" VALIDATE CONSTRAINT "FarmLocation_longitude_range_check";
ALTER TABLE "FarmLocation" VALIDATE CONSTRAINT "FarmLocation_accuracy_nonnegative_check";
ALTER TABLE "CustomerLanguagePreference" VALIDATE CONSTRAINT "CustomerLanguagePreference_rank_positive_check";
ALTER TABLE "CustomerSeasonalCrop" VALIDATE CONSTRAINT "CustomerSeasonalCrop_acreage_nonnegative_check";
ALTER TABLE "CustomerSeasonalCrop" VALIDATE CONSTRAINT "CustomerSeasonalCrop_tanks_nonnegative_check";
ALTER TABLE "CustomerSeasonalCrop" VALIDATE CONSTRAINT "CustomerSeasonalCrop_sprayings_nonnegative_check";
ALTER TABLE "Lead" VALIDATE CONSTRAINT "Lead_acreage_decimal_nonnegative_check";
ALTER TABLE "Assignment" VALIDATE CONSTRAINT "Assignment_distinct_crew_check";
ALTER TABLE "Assignment" VALIDATE CONSTRAINT "Assignment_complete_crew_check";
ALTER TABLE "Assignment" VALIDATE CONSTRAINT "Assignment_single_drone_check";
ALTER TABLE "Assignment" VALIDATE CONSTRAINT "Assignment_daily_sequence_positive_check";
ALTER TABLE "Assignment" VALIDATE CONSTRAINT "Assignment_service_window_order_check";
ALTER TABLE "CustomerSubscription" VALIDATE CONSTRAINT "CustomerSubscription_date_order_check";
ALTER TABLE "Language" VALIDATE CONSTRAINT "Language_code_trimmed_check";
ALTER TABLE "Crop" VALIDATE CONSTRAINT "Crop_code_trimmed_check";
ALTER TABLE "Crop" VALIDATE CONSTRAINT "Crop_normalized_name_check";
ALTER TABLE "Location" VALIDATE CONSTRAINT "Location_normalized_key_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_counts_nonnegative_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_counts_reconcile_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_file_size_positive_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_attempt_positive_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_retention_after_creation_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_approval_evidence_check";
ALTER TABLE "ImportBatch" VALIDATE CONSTRAINT "ImportBatch_completion_evidence_check";
ALTER TABLE "SourceRecord" VALIDATE CONSTRAINT "SourceRecord_row_number_positive_check";
ALTER TABLE "SourceRecord" VALIDATE CONSTRAINT "SourceRecord_external_id_nonblank_check";
ALTER TABLE "SourceRecord" VALIDATE CONSTRAINT "SourceRecord_fingerprint_format_check";
ALTER TABLE "SourceRecord" VALIDATE CONSTRAINT "SourceRecord_encryption_shape_check";
ALTER TABLE "HistoricalServiceRecord" VALIDATE CONSTRAINT "HistoricalServiceRecord_acres_nonnegative_check";
ALTER TABLE "VillageVisit" VALIDATE CONSTRAINT "VillageVisit_acres_nonnegative_check";
ALTER TABLE "Drone" VALIDATE CONSTRAINT "Drone_asset_state_consistency_check";
ALTER TABLE "Drone" VALIDATE CONSTRAINT "Drone_archived_state_check";
ALTER TABLE "Drone" VALIDATE CONSTRAINT "Drone_capacity_nonnegative_check";
ALTER TABLE "LMV" VALIDATE CONSTRAINT "LMV_asset_state_consistency_check";
ALTER TABLE "LMV" VALIDATE CONSTRAINT "LMV_capacity_positive_check";

-- Keep the legacy combined status and the normalized state pair synchronized
-- throughout the compatibility release.
CREATE OR REPLACE FUNCTION rfly_sync_asset_state()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- On INSERT, a non-default legacy status remains authoritative for old
  -- clients. Otherwise an explicitly non-default normalized pair wins. On
  -- UPDATE, whichever representation changed is mirrored to the other.
  IF TG_OP = 'INSERT'
     AND NEW."status"::text = 'AVAILABLE'
     AND (
       NEW."operationalState" <> 'IN_SERVICE'::"AssetOperationalState"
       OR NEW."availabilityState" <> 'AVAILABLE'::"AssetAvailabilityState"
     ) THEN
    IF NEW."operationalState" = 'MAINTENANCE' THEN
      NEW."status" := 'MAINTENANCE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."operationalState" = 'OUT_OF_SERVICE' THEN
      NEW."status" := 'OUT_OF_SERVICE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."availabilityState" = 'ASSIGNED' THEN
      NEW."status" := 'ASSIGNED';
    ELSE
      NEW."status" := 'AVAILABLE';
      NEW."availabilityState" := 'AVAILABLE';
    END IF;
  ELSIF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    CASE NEW."status"::text
      WHEN 'AVAILABLE' THEN
        NEW."operationalState" := 'IN_SERVICE';
        NEW."availabilityState" := 'AVAILABLE';
      WHEN 'ASSIGNED' THEN
        NEW."operationalState" := 'IN_SERVICE';
        NEW."availabilityState" := 'ASSIGNED';
      WHEN 'MAINTENANCE' THEN
        NEW."operationalState" := 'MAINTENANCE';
        NEW."availabilityState" := 'UNAVAILABLE';
      WHEN 'OUT_OF_SERVICE' THEN
        NEW."operationalState" := 'OUT_OF_SERVICE';
        NEW."availabilityState" := 'UNAVAILABLE';
    END CASE;
  ELSIF NEW."operationalState" IS DISTINCT FROM OLD."operationalState"
     OR NEW."availabilityState" IS DISTINCT FROM OLD."availabilityState" THEN
    IF NEW."operationalState" = 'MAINTENANCE' THEN
      NEW."status" := 'MAINTENANCE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."operationalState" = 'OUT_OF_SERVICE' THEN
      NEW."status" := 'OUT_OF_SERVICE';
      NEW."availabilityState" := 'UNAVAILABLE';
    ELSIF NEW."availabilityState" = 'ASSIGNED' THEN
      NEW."status" := 'ASSIGNED';
    ELSIF NEW."availabilityState" = 'AVAILABLE' THEN
      NEW."status" := 'AVAILABLE';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Drone_sync_asset_state"
BEFORE INSERT OR UPDATE OF "status", "operationalState", "availabilityState" ON "Drone"
FOR EACH ROW EXECUTE FUNCTION rfly_sync_asset_state();

CREATE TRIGGER "LMV_sync_asset_state"
BEFORE INSERT OR UPDATE OF "status", "operationalState", "availabilityState" ON "LMV"
FOR EACH ROW EXECUTE FUNCTION rfly_sync_asset_state();

-- The operational unit is exactly two distinct pilots, one drone, and one
-- LMV. Multiple jobs may be ordered on the same day, but a resource cannot be
-- active in two jobs at once. Advisory locks serialize cross-column Pilot /
-- Copilot checks that ordinary unique indexes cannot express.
CREATE OR REPLACE FUNCTION rfly_guard_assignment_unit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resource_key TEXT;
  conflict_id TEXT;
  drone_is_archived BOOLEAN;
  drone_operational "AssetOperationalState";
  drone_availability "AssetAvailabilityState";
  lmv_operational "AssetOperationalState";
  lmv_availability "AssetAvailabilityState";
BEGIN
  IF NEW."copilotId" IS NULL OR NEW."lmvId" IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD."legacyCrewIncomplete"
         AND NEW."legacyCrewIncomplete"
         AND NEW."pilotId" IS NOT DISTINCT FROM OLD."pilotId"
         AND NEW."copilotId" IS NOT DISTINCT FROM OLD."copilotId"
         AND NEW."droneId" IS NOT DISTINCT FROM OLD."droneId"
         AND NEW."copilotDroneId" IS NOT DISTINCT FROM OLD."copilotDroneId"
         AND NEW."lmvId" IS NOT DISTINCT FROM OLD."lmvId"
         AND (
           (
             NEW."startedAt" IS NOT DISTINCT FROM OLD."startedAt"
             AND NEW."completedAt" IS NOT DISTINCT FROM OLD."completedAt"
           )
           OR (
             OLD."startedAt" IS NOT NULL
             AND OLD."completedAt" IS NULL
             AND NEW."completedAt" IS NOT NULL
           )
         ) THEN
        -- A quarantined legacy row may be closed or receive non-crew metadata,
        -- but it cannot start, change resources, or be created anew incomplete.
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'A complete two-pilot, one-drone, one-LMV crew is required';
  END IF;
  NEW."legacyCrewIncomplete" := false;
  IF NEW."pilotId" = NEW."copilotId" THEN
    RAISE EXCEPTION 'Pilot and Copilot must be different users';
  END IF;
  IF NEW."copilotDroneId" IS NOT NULL AND NEW."copilotDroneId" <> NEW."droneId" THEN
    RAISE EXCEPTION 'A crew assignment can use only one drone';
  END IF;

  FOR resource_key IN
    SELECT value
    FROM unnest(ARRAY['drone:' || NEW."droneId", 'lmv:' || NEW."lmvId"]) value
    ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('AssignmentResource:' || resource_key));
  END LOOP;

  SELECT "archivedAt" IS NOT NULL, "operationalState", "availabilityState"
  INTO drone_is_archived, drone_operational, drone_availability
  FROM "Drone"
  WHERE "id" = NEW."droneId";
  IF NOT FOUND OR drone_is_archived OR drone_operational <> 'IN_SERVICE'::"AssetOperationalState"
     OR drone_availability = 'UNAVAILABLE'::"AssetAvailabilityState" THEN
    RAISE EXCEPTION 'The assigned drone must be an active in-service asset';
  END IF;

  SELECT "operationalState", "availabilityState"
  INTO lmv_operational, lmv_availability
  FROM "LMV"
  WHERE "id" = NEW."lmvId";
  IF NOT FOUND OR lmv_operational <> 'IN_SERVICE'::"AssetOperationalState"
     OR lmv_availability = 'UNAVAILABLE'::"AssetAvailabilityState" THEN
    RAISE EXCEPTION 'The assigned LMV must be an active in-service asset';
  END IF;

  IF NEW."startedAt" IS NOT NULL AND NEW."completedAt" IS NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD."startedAt" IS NULL
       OR OLD."completedAt" IS NOT NULL
       OR NEW."pilotId" IS DISTINCT FROM OLD."pilotId"
       OR NEW."copilotId" IS DISTINCT FROM OLD."copilotId"
       OR NEW."droneId" IS DISTINCT FROM OLD."droneId"
       OR NEW."lmvId" IS DISTINCT FROM OLD."lmvId"
     ) THEN
    FOR resource_key IN
      SELECT value
      FROM unnest(ARRAY[
        'user:' || NEW."pilotId",
        'user:' || NEW."copilotId",
        'drone:' || NEW."droneId",
        'lmv:' || NEW."lmvId"
      ]) value
      ORDER BY value
    LOOP
      PERFORM pg_advisory_xact_lock(hashtext('AssignmentResource:' || resource_key));
    END LOOP;

    SELECT assignment."id"
    INTO conflict_id
    FROM "Assignment" assignment
    WHERE assignment."id" <> NEW."id"
      AND assignment."startedAt" IS NOT NULL
      AND assignment."completedAt" IS NULL
      AND (
        assignment."pilotId" IN (NEW."pilotId", NEW."copilotId")
        OR assignment."copilotId" IN (NEW."pilotId", NEW."copilotId")
        OR assignment."droneId" = NEW."droneId"
        OR assignment."lmvId" = NEW."lmvId"
      )
    LIMIT 1;

    IF conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Another active assignment already uses this crew, drone, or LMV';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "Assignment_guard_operational_unit"
BEFORE INSERT OR UPDATE OF "pilotId", "copilotId", "droneId", "copilotDroneId", "lmvId", "startedAt", "completedAt", "legacyCrewIncomplete"
ON "Assignment"
FOR EACH ROW EXECUTE FUNCTION rfly_guard_assignment_unit();

-- A staged source row has exactly one source-appropriate canonical outcome.
-- This closes the cross-table hole that two independent UNIQUE constraints
-- cannot express on their own.
CREATE OR REPLACE FUNCTION rfly_guard_import_outcome()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  source_system "ImportSourceType";
BEGIN
  SELECT "sourceSystem" INTO source_system
  FROM "SourceRecord"
  WHERE "id" = NEW."sourceRecordId";

  IF source_system IS NULL THEN
    RAISE EXCEPTION 'The import outcome requires an existing SourceRecord';
  END IF;

  IF TG_TABLE_NAME = 'HistoricalServiceRecord' THEN
    IF source_system <> 'ZOHO_CRM'::"ImportSourceType" THEN
      RAISE EXCEPTION 'HistoricalServiceRecord requires a ZOHO_CRM source row';
    END IF;
    IF EXISTS (SELECT 1 FROM "VillageVisit" WHERE "sourceRecordId" = NEW."sourceRecordId") THEN
      RAISE EXCEPTION 'The SourceRecord already has a VillageVisit outcome';
    END IF;
  ELSIF TG_TABLE_NAME = 'VillageVisit' THEN
    IF source_system <> 'GOOGLE_FORMS'::"ImportSourceType" THEN
      RAISE EXCEPTION 'VillageVisit requires a GOOGLE_FORMS source row';
    END IF;
    IF EXISTS (SELECT 1 FROM "HistoricalServiceRecord" WHERE "sourceRecordId" = NEW."sourceRecordId") THEN
      RAISE EXCEPTION 'The SourceRecord already has a HistoricalServiceRecord outcome';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "HistoricalServiceRecord_guard_source_outcome"
BEFORE INSERT OR UPDATE OF "sourceRecordId" ON "HistoricalServiceRecord"
FOR EACH ROW EXECUTE FUNCTION rfly_guard_import_outcome();

CREATE TRIGGER "VillageVisit_guard_source_outcome"
BEFORE INSERT OR UPDATE OF "sourceRecordId" ON "VillageVisit"
FOR EACH ROW EXECUTE FUNCTION rfly_guard_import_outcome();

CREATE OR REPLACE FUNCTION rfly_guard_source_record_terminal_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_database() ~ '_test$'
     AND current_setting('rfly.allow_history_mutation', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('IMPORTED', 'SKIPPED') THEN
      RAISE EXCEPTION 'Terminal SourceRecord evidence cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" IN ('IMPORTED', 'SKIPPED')
     AND ROW(
       NEW."sourceSystem", NEW."sheetName", NEW."sourceRowNumber", NEW."externalRecordId",
       NEW."rowFingerprint", NEW."status", NEW."customerId", NEW."resultEntityType",
       NEW."resultEntityId", NEW."committedAt"
     ) IS DISTINCT FROM ROW(
       OLD."sourceSystem", OLD."sheetName", OLD."sourceRowNumber", OLD."externalRecordId",
       OLD."rowFingerprint", OLD."status", OLD."customerId", OLD."resultEntityType",
       OLD."resultEntityId", OLD."committedAt"
     ) THEN
    RAISE EXCEPTION 'Terminal SourceRecord identity and outcome evidence are immutable';
  END IF;

  IF NEW."status" = 'IMPORTED' THEN
    IF NEW."customerId" IS NULL OR NEW."resultEntityType" IS NULL
       OR NEW."resultEntityId" IS NULL OR NEW."committedAt" IS NULL THEN
      RAISE EXCEPTION 'An imported SourceRecord requires complete reconciliation evidence';
    END IF;
    IF NEW."sourceSystem" = 'ZOHO_CRM'::"ImportSourceType" THEN
      IF NEW."resultEntityType" <> 'HistoricalServiceRecord'
         OR NOT EXISTS (
           SELECT 1 FROM "HistoricalServiceRecord"
           WHERE "id" = NEW."resultEntityId" AND "sourceRecordId" = NEW."id"
         ) THEN
        RAISE EXCEPTION 'ZOHO_CRM SourceRecord outcome evidence is inconsistent';
      END IF;
    ELSIF NEW."sourceSystem" = 'GOOGLE_FORMS'::"ImportSourceType" THEN
      IF NEW."resultEntityType" <> 'VillageVisit'
         OR NOT EXISTS (
           SELECT 1 FROM "VillageVisit"
           WHERE "id" = NEW."resultEntityId" AND "sourceRecordId" = NEW."id"
         ) THEN
        RAISE EXCEPTION 'GOOGLE_FORMS SourceRecord outcome evidence is inconsistent';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "SourceRecord_terminal_evidence"
BEFORE UPDATE OR DELETE ON "SourceRecord"
FOR EACH ROW EXECUTE FUNCTION rfly_guard_source_record_terminal_evidence();

-- Dedicated histories capture safe business state without copying customer
-- phones, exact coordinates, addresses, chat content, or raw import payloads.
CREATE OR REPLACE FUNCTION rfly_capture_customer_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
  changed_names jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('CustomerHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "CustomerHistory" WHERE "customerId" = NEW."id";

  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN
    actor_id := NULL;
  END IF;

  after_snapshot := jsonb_build_object(
    'active', NEW."active",
    'preferredLanguage', NEW."preferredLanguage",
    'ownership', NEW."ownership",
    'totalAcres', NEW."totalAcres",
    'seasonalProfile', jsonb_build_object(
      'kharifCrop', NEW."kharifCrop", 'kharifAcres', NEW."kharifAcres", 'kharifTanks', NEW."kharifTanks", 'kharifSprayings', NEW."kharifSprayings",
      'rabiCrop', NEW."rabiCrop", 'rabiAcres', NEW."rabiAcres", 'rabiTanks', NEW."rabiTanks", 'rabiSprayings', NEW."rabiSprayings",
      'summerCrop', NEW."summerCrop", 'summerAcres', NEW."summerAcres", 'summerTanks', NEW."summerTanks", 'summerSprayings', NEW."summerSprayings"
    ),
    'hasSubscription', NEW."subscriptionCardNumber" IS NOT NULL OR NEW."subscriptionYear" IS NOT NULL,
    'hasFarmerPortalUser', NEW."farmerUserId" IS NOT NULL,
    'staffConfirmedAt', NEW."staffConfirmedAt"
  );

  IF TG_OP = 'INSERT' THEN
    before_snapshot := NULL;
    changed_names := to_jsonb(ARRAY[
      'displayName', 'phone', 'preferredLanguage', 'ownership', 'totalAcres',
      'location', 'seasonalProfile', 'subscription', 'remarks', 'active',
      'farmerUserId', 'staffConfirmedAt'
    ]::text[]);
  ELSE
    before_snapshot := jsonb_build_object(
      'active', OLD."active",
      'preferredLanguage', OLD."preferredLanguage",
      'ownership', OLD."ownership",
      'totalAcres', OLD."totalAcres",
      'seasonalProfile', jsonb_build_object(
        'kharifCrop', OLD."kharifCrop", 'kharifAcres', OLD."kharifAcres", 'kharifTanks', OLD."kharifTanks", 'kharifSprayings', OLD."kharifSprayings",
        'rabiCrop', OLD."rabiCrop", 'rabiAcres', OLD."rabiAcres", 'rabiTanks', OLD."rabiTanks", 'rabiSprayings', OLD."rabiSprayings",
        'summerCrop', OLD."summerCrop", 'summerAcres', OLD."summerAcres", 'summerTanks', OLD."summerTanks", 'summerSprayings', OLD."summerSprayings"
      ),
      'hasSubscription', OLD."subscriptionCardNumber" IS NOT NULL OR OLD."subscriptionYear" IS NOT NULL,
      'hasFarmerPortalUser', OLD."farmerUserId" IS NOT NULL,
      'staffConfirmedAt', OLD."staffConfirmedAt"
    );
    changed_names := to_jsonb(array_remove(ARRAY[
      CASE WHEN NEW."displayName" IS DISTINCT FROM OLD."displayName" THEN 'displayName' END,
      CASE WHEN NEW."phone" IS DISTINCT FROM OLD."phone" THEN 'phone' END,
      CASE WHEN NEW."preferredLanguage" IS DISTINCT FROM OLD."preferredLanguage" THEN 'preferredLanguage' END,
      CASE WHEN NEW."ownership" IS DISTINCT FROM OLD."ownership" THEN 'ownership' END,
      CASE WHEN NEW."totalAcres" IS DISTINCT FROM OLD."totalAcres" THEN 'totalAcres' END,
      CASE WHEN ROW(NEW."village", NEW."mandal", NEW."district", NEW."state") IS DISTINCT FROM ROW(OLD."village", OLD."mandal", OLD."district", OLD."state") THEN 'location' END,
      CASE WHEN ROW(NEW."kharifCrop", NEW."kharifOtherCrop", NEW."kharifAcres", NEW."kharifTanks", NEW."kharifSprayings", NEW."rabiCrop", NEW."rabiOtherCrop", NEW."rabiAcres", NEW."rabiTanks", NEW."rabiSprayings", NEW."summerCrop", NEW."summerOtherCrop", NEW."summerAcres", NEW."summerTanks", NEW."summerSprayings") IS DISTINCT FROM ROW(OLD."kharifCrop", OLD."kharifOtherCrop", OLD."kharifAcres", OLD."kharifTanks", OLD."kharifSprayings", OLD."rabiCrop", OLD."rabiOtherCrop", OLD."rabiAcres", OLD."rabiTanks", OLD."rabiSprayings", OLD."summerCrop", OLD."summerOtherCrop", OLD."summerAcres", OLD."summerTanks", OLD."summerSprayings") THEN 'seasonalProfile' END,
      CASE WHEN ROW(NEW."subscriptionCardNumber", NEW."subscriptionYear") IS DISTINCT FROM ROW(OLD."subscriptionCardNumber", OLD."subscriptionYear") THEN 'subscription' END,
      CASE WHEN NEW."remarks" IS DISTINCT FROM OLD."remarks" THEN 'remarks' END,
      CASE WHEN NEW."active" IS DISTINCT FROM OLD."active" THEN 'active' END,
      CASE WHEN NEW."farmerUserId" IS DISTINCT FROM OLD."farmerUserId" THEN 'farmerUserId' END,
      CASE WHEN NEW."staffConfirmedAt" IS DISTINCT FROM OLD."staffConfirmedAt" THEN 'staffConfirmedAt' END
    ]::text[], NULL));
  END IF;

  IF TG_OP = 'UPDATE' AND jsonb_array_length(changed_names) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO "CustomerHistory" ("id", "customerId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."active" IS DISTINCT FROM OLD."active" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('fields', changed_names, 'before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rfly_capture_lead_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
  changed_names jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('LeadHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "LeadHistory" WHERE "leadId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;

  after_snapshot := jsonb_build_object(
    'status', NEW."status", 'intakeChannel', NEW."intakeChannel",
    'acreage', COALESCE(NEW."acreageDecimal", round(NEW."acreage"::numeric, 2)),
    'cropId', NEW."cropId", 'cropType', NEW."cropType",
    'matchedCenterId', NEW."matchedCenterId", 'farmLocationId', NEW."farmLocationId",
    'soilType', NEW."soilType", 'cropAgeWeeks', NEW."cropAgeWeeks",
    'sprayPurpose', NEW."sprayPurpose", 'hasChemical', NEW."hasChemical",
    'expectedDate', NEW."expectedDate", 'expectedTime', NEW."expectedTime",
    'waterBodyNearby', NEW."waterBodyNearby", 'terrainType', NEW."terrainType",
    'processedAt', NEW."processedAt"
  );
  IF TG_OP = 'INSERT' THEN
    before_snapshot := NULL;
    changed_names := to_jsonb(ARRAY['status', 'intakeChannel', 'acreage', 'crop', 'farmLocation', 'serviceProfile']::text[]);
  ELSE
    before_snapshot := jsonb_build_object(
      'status', OLD."status", 'intakeChannel', OLD."intakeChannel",
      'acreage', COALESCE(OLD."acreageDecimal", round(OLD."acreage"::numeric, 2)),
      'cropId', OLD."cropId", 'cropType', OLD."cropType",
      'matchedCenterId', OLD."matchedCenterId", 'farmLocationId', OLD."farmLocationId",
      'soilType', OLD."soilType", 'cropAgeWeeks', OLD."cropAgeWeeks",
      'sprayPurpose', OLD."sprayPurpose", 'hasChemical', OLD."hasChemical",
      'expectedDate', OLD."expectedDate", 'expectedTime', OLD."expectedTime",
      'waterBodyNearby', OLD."waterBodyNearby", 'terrainType', OLD."terrainType",
      'processedAt', OLD."processedAt"
    );
    changed_names := to_jsonb(array_remove(ARRAY[
      CASE WHEN NEW."status" IS DISTINCT FROM OLD."status" THEN 'status' END,
      CASE WHEN NEW."intakeChannel" IS DISTINCT FROM OLD."intakeChannel" THEN 'intakeChannel' END,
      CASE WHEN NEW."acreage" IS DISTINCT FROM OLD."acreage" OR NEW."acreageDecimal" IS DISTINCT FROM OLD."acreageDecimal" THEN 'acreage' END,
      CASE WHEN NEW."cropType" IS DISTINCT FROM OLD."cropType" OR NEW."cropId" IS DISTINCT FROM OLD."cropId" THEN 'crop' END,
      CASE WHEN NEW."matchedCenterId" IS DISTINCT FROM OLD."matchedCenterId" THEN 'matchedCenterId' END,
      CASE WHEN NEW."farmLocationId" IS DISTINCT FROM OLD."farmLocationId" OR ROW(NEW."latitude", NEW."longitude", NEW."farmerAddress") IS DISTINCT FROM ROW(OLD."latitude", OLD."longitude", OLD."farmerAddress") THEN 'farmLocation' END,
      CASE WHEN ROW(NEW."soilType", NEW."cropAgeWeeks", NEW."chemicalBrand", NEW."sprayPurpose", NEW."hasChemical", NEW."chemicalProofUrl", NEW."expectedDate", NEW."expectedTime", NEW."waterBodyNearby", NEW."terrainType") IS DISTINCT FROM ROW(OLD."soilType", OLD."cropAgeWeeks", OLD."chemicalBrand", OLD."sprayPurpose", OLD."hasChemical", OLD."chemicalProofUrl", OLD."expectedDate", OLD."expectedTime", OLD."waterBodyNearby", OLD."terrainType") THEN 'serviceProfile' END,
      CASE WHEN NEW."notes" IS DISTINCT FROM OLD."notes" THEN 'notes' END,
      CASE WHEN NEW."farmerName" IS DISTINCT FROM OLD."farmerName" THEN 'farmerName' END,
      CASE WHEN NEW."farmerPhone" IS DISTINCT FROM OLD."farmerPhone" THEN 'farmerPhone' END,
      CASE WHEN NEW."processedAt" IS DISTINCT FROM OLD."processedAt" THEN 'processedAt' END
    ]::text[], NULL));
  END IF;

  IF TG_OP = 'UPDATE' AND jsonb_array_length(changed_names) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO "LeadHistory" ("id", "leadId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."status" IS DISTINCT FROM OLD."status" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('fields', changed_names, 'before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rfly_capture_drone_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('DroneHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "DroneHistory" WHERE "droneId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;
  after_snapshot := jsonb_build_object(
    'name', NEW."name", 'model', NEW."model", 'manufacturer', NEW."manufacturer",
    'serialNumber', NEW."serialNumber", 'uin', NEW."uin", 'type', NEW."type", 'category', NEW."category",
    'tankCapacity', NEW."tankCapacity", 'batteryCapacity', NEW."batteryCapacity", 'endurance', NEW."endurance",
    'tankCapacityLitres', NEW."tankCapacityLitres", 'batteryCapacityMah', NEW."batteryCapacityMah", 'enduranceMinutes', NEW."enduranceMinutes",
    'certified', NEW."certified", 'serviceType', NEW."serviceType", 'status', NEW."status",
    'operationalState', NEW."operationalState", 'availabilityState', NEW."availabilityState",
    'homeCenterId', NEW."homeCenterId", 'airworthinessExpiry', NEW."airworthinessExpiry", 'lastMaintained', NEW."lastMaintained",
    'archivedAt', NEW."archivedAt"
  );
  before_snapshot := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
    'name', OLD."name", 'model', OLD."model", 'manufacturer', OLD."manufacturer",
    'serialNumber', OLD."serialNumber", 'uin', OLD."uin", 'type', OLD."type", 'category', OLD."category",
    'tankCapacity', OLD."tankCapacity", 'batteryCapacity', OLD."batteryCapacity", 'endurance', OLD."endurance",
    'tankCapacityLitres', OLD."tankCapacityLitres", 'batteryCapacityMah', OLD."batteryCapacityMah", 'enduranceMinutes', OLD."enduranceMinutes",
    'certified', OLD."certified", 'serviceType', OLD."serviceType", 'status', OLD."status",
    'operationalState', OLD."operationalState", 'availabilityState', OLD."availabilityState",
    'homeCenterId', OLD."homeCenterId", 'airworthinessExpiry', OLD."airworthinessExpiry", 'lastMaintained', OLD."lastMaintained",
    'archivedAt', OLD."archivedAt"
  ) END;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      NEW."name", NEW."model", NEW."manufacturer", NEW."serialNumber", NEW."uin", NEW."type", NEW."category",
      NEW."tankCapacity", NEW."tankCapacityLitres", NEW."batteryCapacity", NEW."batteryCapacityMah",
      NEW."endurance", NEW."enduranceMinutes", NEW."certified", NEW."serviceType", NEW."status",
      NEW."operationalState", NEW."availabilityState", NEW."homeCenterId", NEW."airworthinessExpiry",
      NEW."lastMaintained", NEW."archivedAt"
    ) IS NOT DISTINCT FROM ROW(
      OLD."name", OLD."model", OLD."manufacturer", OLD."serialNumber", OLD."uin", OLD."type", OLD."category",
      OLD."tankCapacity", OLD."tankCapacityLitres", OLD."batteryCapacity", OLD."batteryCapacityMah",
      OLD."endurance", OLD."enduranceMinutes", OLD."certified", OLD."serviceType", OLD."status",
      OLD."operationalState", OLD."availabilityState", OLD."homeCenterId", OLD."airworthinessExpiry",
      OLD."lastMaintained", OLD."archivedAt"
    ) THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO "DroneHistory" ("id", "droneId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."archivedAt" IS NOT NULL AND OLD."archivedAt" IS NULL THEN 'ARCHIVED'::"HistoryEventType"
      WHEN NEW."status" IS DISTINCT FROM OLD."status"
        OR NEW."operationalState" IS DISTINCT FROM OLD."operationalState"
        OR NEW."availabilityState" IS DISTINCT FROM OLD."availabilityState" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rfly_capture_lmv_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_version integer;
  actor_id text;
  before_snapshot jsonb;
  after_snapshot jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('LMVHistory:' || NEW."id"));
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version
  FROM "LMVHistory" WHERE "lmvId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;
  after_snapshot := jsonb_build_object(
    'registrationNo', NEW."registrationNo", 'label', NEW."label", 'status', NEW."status",
    'operationalState', NEW."operationalState", 'availabilityState', NEW."availabilityState",
    'homeCenterId', NEW."homeCenterId", 'capacity', NEW."capacity", 'notes', NEW."notes"
  );
  before_snapshot := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
    'registrationNo', OLD."registrationNo", 'label', OLD."label", 'status', OLD."status",
    'operationalState', OLD."operationalState", 'availabilityState', OLD."availabilityState",
    'homeCenterId', OLD."homeCenterId", 'capacity', OLD."capacity", 'notes', OLD."notes"
  ) END;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(
      NEW."registrationNo", NEW."label", NEW."status", NEW."operationalState",
      NEW."availabilityState", NEW."homeCenterId", NEW."capacity", NEW."notes"
    ) IS NOT DISTINCT FROM ROW(
      OLD."registrationNo", OLD."label", OLD."status", OLD."operationalState",
      OLD."availabilityState", OLD."homeCenterId", OLD."capacity", OLD."notes"
    ) THEN
      RETURN NEW;
    END IF;
  END IF;
  INSERT INTO "LMVHistory" ("id", "lmvId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
  VALUES (
    gen_random_uuid()::text,
    NEW."id",
    next_version,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATED'::"HistoryEventType"
      WHEN NEW."status" IS DISTINCT FROM OLD."status"
        OR NEW."operationalState" IS DISTINCT FROM OLD."operationalState"
        OR NEW."availabilityState" IS DISTINCT FROM OLD."availabilityState" THEN 'STATUS_CHANGED'::"HistoryEventType"
      ELSE 'UPDATED'::"HistoryEventType"
    END,
    jsonb_build_object('before', before_snapshot, 'after', after_snapshot),
    actor_id,
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Customer_capture_history"
AFTER INSERT OR UPDATE ON "Customer"
FOR EACH ROW EXECUTE FUNCTION rfly_capture_customer_history();

CREATE TRIGGER "Lead_capture_history"
AFTER INSERT OR UPDATE ON "Lead"
FOR EACH ROW EXECUTE FUNCTION rfly_capture_lead_history();

CREATE TRIGGER "Drone_capture_history"
AFTER INSERT OR UPDATE ON "Drone"
FOR EACH ROW EXECUTE FUNCTION rfly_capture_drone_history();

CREATE TRIGGER "LMV_capture_history"
AFTER INSERT OR UPDATE ON "LMV"
FOR EACH ROW EXECUTE FUNCTION rfly_capture_lmv_history();

CREATE OR REPLACE FUNCTION rfly_prevent_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_database() ~ '_test$'
     AND current_setting('rfly.allow_history_mutation', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  RAISE EXCEPTION '% is append-only; history rows cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER "CustomerHistory_append_only"
BEFORE UPDATE OR DELETE ON "CustomerHistory"
FOR EACH ROW EXECUTE FUNCTION rfly_prevent_history_mutation();

CREATE TRIGGER "LeadHistory_append_only"
BEFORE UPDATE OR DELETE ON "LeadHistory"
FOR EACH ROW EXECUTE FUNCTION rfly_prevent_history_mutation();

CREATE TRIGGER "DroneHistory_append_only"
BEFORE UPDATE OR DELETE ON "DroneHistory"
FOR EACH ROW EXECUTE FUNCTION rfly_prevent_history_mutation();

CREATE TRIGGER "LMVHistory_append_only"
BEFORE UPDATE OR DELETE ON "LMVHistory"
FOR EACH ROW EXECUTE FUNCTION rfly_prevent_history_mutation();

-- Disposable automated-test databases explicitly opt in to cleanup through a
-- database-level setting. Production leaves the setting absent, so restrictive
-- history FKs require masters to be archived instead of erased.
CREATE OR REPLACE FUNCTION rfly_cleanup_history_for_test()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_database() !~ '_test$'
     OR current_setting('rfly.allow_history_mutation', true) <> 'on' THEN
    RETURN OLD;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'Customer' THEN DELETE FROM "CustomerHistory" WHERE "customerId" = OLD."id";
    WHEN 'Lead' THEN DELETE FROM "LeadHistory" WHERE "leadId" = OLD."id";
    WHEN 'Drone' THEN DELETE FROM "DroneHistory" WHERE "droneId" = OLD."id";
    WHEN 'LMV' THEN DELETE FROM "LMVHistory" WHERE "lmvId" = OLD."id";
  END CASE;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "Customer_test_history_cleanup"
BEFORE DELETE ON "Customer"
FOR EACH ROW EXECUTE FUNCTION rfly_cleanup_history_for_test();

CREATE TRIGGER "Lead_test_history_cleanup"
BEFORE DELETE ON "Lead"
FOR EACH ROW EXECUTE FUNCTION rfly_cleanup_history_for_test();

CREATE TRIGGER "Drone_test_history_cleanup"
BEFORE DELETE ON "Drone"
FOR EACH ROW EXECUTE FUNCTION rfly_cleanup_history_for_test();

CREATE TRIGGER "LMV_test_history_cleanup"
BEFORE DELETE ON "LMV"
FOR EACH ROW EXECUTE FUNCTION rfly_cleanup_history_for_test();

-- Existing records receive a single factual baseline event. No historical
-- activity is invented from the current snapshot.
INSERT INTO "CustomerHistory" ("id", "customerId", "version", "eventType", "changedFields", "recordedAt")
SELECT gen_random_uuid()::text, "id", 1, 'BASELINE', jsonb_build_object(
  'before', NULL,
  'after', jsonb_build_object(
    'active', "active", 'preferredLanguage', "preferredLanguage", 'ownership', "ownership", 'totalAcres', "totalAcres",
    'hasSubscription', "subscriptionCardNumber" IS NOT NULL OR "subscriptionYear" IS NOT NULL,
    'hasFarmerPortalUser', "farmerUserId" IS NOT NULL, 'staffConfirmedAt', "staffConfirmedAt"
  )
), CURRENT_TIMESTAMP
FROM "Customer";

INSERT INTO "LeadHistory" ("id", "leadId", "version", "eventType", "changedFields", "recordedAt")
SELECT gen_random_uuid()::text, "id", 1, 'BASELINE', jsonb_build_object(
  'before', NULL,
  'after', jsonb_build_object(
    'status', "status", 'intakeChannel', "intakeChannel", 'acreage', COALESCE("acreageDecimal", round("acreage"::numeric, 2)),
    'cropId', "cropId", 'cropType', "cropType", 'matchedCenterId', "matchedCenterId", 'farmLocationId', "farmLocationId",
    'expectedDate', "expectedDate", 'expectedTime', "expectedTime"
  )
), CURRENT_TIMESTAMP
FROM "Lead";

INSERT INTO "DroneHistory" ("id", "droneId", "version", "eventType", "changedFields", "recordedAt")
SELECT gen_random_uuid()::text, "id", 1, 'BASELINE', jsonb_build_object('before', NULL, 'after', jsonb_build_object(
  'name', "name", 'model', "model", 'manufacturer', "manufacturer", 'serialNumber', "serialNumber", 'uin', "uin",
  'type', "type", 'category', "category", 'tankCapacity', "tankCapacity", 'batteryCapacity', "batteryCapacity",
  'endurance', "endurance", 'certified', "certified", 'serviceType', "serviceType", 'status', "status",
  'operationalState', "operationalState", 'availabilityState', "availabilityState", 'homeCenterId', "homeCenterId",
  'airworthinessExpiry', "airworthinessExpiry", 'lastMaintained', "lastMaintained", 'archivedAt', "archivedAt"
)), CURRENT_TIMESTAMP
FROM "Drone";

INSERT INTO "LMVHistory" ("id", "lmvId", "version", "eventType", "changedFields", "recordedAt")
SELECT gen_random_uuid()::text, "id", 1, 'BASELINE', jsonb_build_object('before', NULL, 'after', jsonb_build_object(
  'registrationNo', "registrationNo", 'label', "label", 'status', "status", 'operationalState', "operationalState",
  'availabilityState', "availabilityState", 'homeCenterId', "homeCenterId", 'capacity', "capacity"
)), CURRENT_TIMESTAMP
FROM "LMV";

COMMIT;

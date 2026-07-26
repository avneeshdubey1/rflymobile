-- Phase 1: strict intake and legacy-path retirement.
--
-- This migration is intentionally fail-closed for an existing populated
-- deployment. It never silently deletes historical appeals, Google Form
-- identifiers, or Bhumeet records. Take an approved backup, rehearse its
-- restore, and use a separately approved archival procedure before applying
-- this migration to a non-fresh legacy database.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "OutOfRangeAppeal")
    OR EXISTS (SELECT 1 FROM "Lead" WHERE "status" IN ('OUT_OF_RANGE', 'APPEAL_PENDING'))
    OR EXISTS (SELECT 1 FROM "Lead" WHERE "intakeChannel" = 'GOOGLE_FORM' OR "formResponseId" IS NOT NULL OR "surveyorName" IS NOT NULL)
    OR EXISTS (SELECT 1 FROM "PricingConfig" WHERE "key" = 'OUT_OF_RANGE_RATE_PER_KM')
    OR EXISTS (SELECT 1 FROM "BhumeetFlight")
    OR EXISTS (SELECT 1 FROM "Notification" WHERE "type" = 'OUT_OF_RANGE_APPEAL')
  THEN
    RAISE EXCEPTION 'Phase 1 strict-intake migration requires an approved backup and archival plan for legacy appeal, Google Form, transport-fee, Bhumeet, or related notification data.';
  END IF;
END $$;

ALTER TABLE "Lead" DROP COLUMN "formResponseId", DROP COLUMN "surveyorName";
DROP TABLE "OutOfRangeAppeal";
DROP TABLE "BhumeetFlight";

CREATE TYPE "LeadStatus_new" AS ENUM ('NEW', 'PROCESSED', 'NEEDS_MANUAL_SCHEDULING', 'MANUAL_CALL_REQUIRED', 'SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'FLAGGED', 'CANCELLED', 'REJECTED');
ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead" ALTER COLUMN "status" TYPE "LeadStatus_new" USING ("status"::text::"LeadStatus_new");
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'NEW';
DROP TYPE "LeadStatus";
ALTER TYPE "LeadStatus_new" RENAME TO "LeadStatus";

CREATE TYPE "IntakeChannel_new" AS ENUM ('WEBSITE', 'MANUAL_SALES');
ALTER TABLE "Lead" ALTER COLUMN "intakeChannel" TYPE "IntakeChannel_new" USING ("intakeChannel"::text::"IntakeChannel_new");
DROP TYPE "IntakeChannel";
ALTER TYPE "IntakeChannel_new" RENAME TO "IntakeChannel";

CREATE TABLE "DeclinedEnquiry" (
  "id" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "sourceChannel" "IntakeChannel" NOT NULL,
  "reason" TEXT NOT NULL DEFAULT 'OUTSIDE_SERVICE_AREA',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeclinedEnquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeclinedEnquiry_expiresAt_idx" ON "DeclinedEnquiry"("expiresAt");
CREATE INDEX "DeclinedEnquiry_contactPhone_createdAt_idx" ON "DeclinedEnquiry"("contactPhone", "createdAt");

CREATE TYPE "NotificationType_new" AS ENUM ('PILOT_ASSIGNMENT', 'PILOT_SMS', 'DISPATCH_CALL_TASK', 'RESCHEDULE', 'DRONE_DECOMMISSIONED', 'MISSION_FLAGGED', 'MISSION_COMPLETED', 'LEAD_PROCESSED', 'NEEDS_MANUAL_SCHEDULING', 'WEATHER_RISK', 'PAYMENT_PENDING');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";

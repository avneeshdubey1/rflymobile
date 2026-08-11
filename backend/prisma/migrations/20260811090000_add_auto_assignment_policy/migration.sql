-- Add a typed, singleton company policy without deleting or rewriting any
-- customer, import, lead, assignment, fleet, or user record.
BEGIN;

CREATE TYPE "WeatherUnavailableAction" AS ENUM (
  'SCHEDULE_WITH_WARNING',
  'MANUAL_REVIEW'
);

CREATE TABLE "AutoAssignmentPolicy" (
  "id" TEXT NOT NULL,
  "singletonKey" TEXT NOT NULL DEFAULT 'COMPANY',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "searchHorizonDays" INTEGER NOT NULL DEFAULT 5,
  "workingDayStartMinutes" INTEGER NOT NULL DEFAULT 540,
  "workingDayEndMinutes" INTEGER NOT NULL DEFAULT 1080,
  "defaultJobDurationMinutes" INTEGER NOT NULL DEFAULT 120,
  "turnaroundMinutes" INTEGER NOT NULL DEFAULT 30,
  "maxJobsPerUnitPerDay" INTEGER,
  "maxAcreagePerUnitPerDay" DECIMAL(12,2),
  "weatherUnavailableAction" "WeatherUnavailableAction" NOT NULL DEFAULT 'SCHEDULE_WITH_WARNING',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AutoAssignmentPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AutoAssignmentPolicy_singleton_key_check" CHECK ("singletonKey" = 'COMPANY'),
  CONSTRAINT "AutoAssignmentPolicy_search_horizon_check" CHECK ("searchHorizonDays" BETWEEN 1 AND 14),
  CONSTRAINT "AutoAssignmentPolicy_working_start_check" CHECK ("workingDayStartMinutes" BETWEEN 0 AND 1439),
  CONSTRAINT "AutoAssignmentPolicy_working_end_check" CHECK ("workingDayEndMinutes" BETWEEN 1 AND 1440),
  CONSTRAINT "AutoAssignmentPolicy_working_range_check" CHECK ("workingDayEndMinutes" > "workingDayStartMinutes"),
  CONSTRAINT "AutoAssignmentPolicy_duration_check" CHECK ("defaultJobDurationMinutes" BETWEEN 15 AND 720),
  CONSTRAINT "AutoAssignmentPolicy_turnaround_check" CHECK ("turnaroundMinutes" BETWEEN 0 AND 240),
  CONSTRAINT "AutoAssignmentPolicy_jobs_cap_check" CHECK ("maxJobsPerUnitPerDay" IS NULL OR "maxJobsPerUnitPerDay" BETWEEN 1 AND 20),
  CONSTRAINT "AutoAssignmentPolicy_acreage_cap_check" CHECK ("maxAcreagePerUnitPerDay" IS NULL OR "maxAcreagePerUnitPerDay" > 0),
  CONSTRAINT "AutoAssignmentPolicy_revision_check" CHECK ("revision" > 0)
);

CREATE UNIQUE INDEX "AutoAssignmentPolicy_singletonKey_key"
ON "AutoAssignmentPolicy"("singletonKey");

CREATE INDEX "AutoAssignmentPolicy_updatedByUserId_idx"
ON "AutoAssignmentPolicy"("updatedByUserId");

ALTER TABLE "AutoAssignmentPolicy"
ADD CONSTRAINT "AutoAssignmentPolicy_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AutoAssignmentPolicy" (
  "id", "singletonKey", "enabled", "searchHorizonDays",
  "workingDayStartMinutes", "workingDayEndMinutes",
  "defaultJobDurationMinutes", "turnaroundMinutes",
  "weatherUnavailableAction", "revision"
) VALUES (
  gen_random_uuid()::text, 'COMPANY', true, 5,
  540, 1080, 120, 30, 'SCHEDULE_WITH_WARNING', 1
);

-- Existing calendar rows receive factual compatibility windows. The columns
-- remain nullable during this package so the previous application image can
-- still be used for an application-only rollback after the additive migration.
UPDATE "Assignment"
SET "serviceWindowStart" = COALESCE("serviceWindowStart", "scheduledDate"),
    "serviceWindowEnd" = COALESCE(
      "serviceWindowEnd",
      COALESCE("serviceWindowStart", "scheduledDate") + INTERVAL '120 minutes'
    )
WHERE "serviceWindowStart" IS NULL OR "serviceWindowEnd" IS NULL;

CREATE INDEX "Assignment_pilotId_serviceWindowStart_idx"
ON "Assignment"("pilotId", "serviceWindowStart");

CREATE INDEX "Assignment_copilotId_serviceWindowStart_idx"
ON "Assignment"("copilotId", "serviceWindowStart");

CREATE INDEX "Assignment_droneId_serviceWindowStart_idx"
ON "Assignment"("droneId", "serviceWindowStart");

CREATE INDEX "Assignment_lmvId_serviceWindowStart_idx"
ON "Assignment"("lmvId", "serviceWindowStart");

COMMIT;

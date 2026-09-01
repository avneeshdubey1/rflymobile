ALTER TYPE "MissionIssueCategory" ADD VALUE IF NOT EXISTS 'LMV_MALFUNCTION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MAINTENANCE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MAINTENANCE_REQUEST_UPDATED';

CREATE TYPE "AssetType" AS ENUM ('DRONE', 'LMV');
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'RESOLVED');
CREATE TYPE "MaintenanceReasonCode" AS ENUM (
  'BATTERY_NOT_CHARGED',
  'PROPELLER_DAMAGED',
  'VEHICLE_BREAKDOWN',
  'TYRE_ISSUE',
  'ENGINE_ISSUE',
  'ELECTRICAL_ISSUE',
  'OTHER'
);

ALTER TABLE "LMV" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "AssetMaintenanceRequest" (
  "id" TEXT NOT NULL,
  "assetType" "AssetType" NOT NULL,
  "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reasonCode" "MaintenanceReasonCode" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "assignmentId" TEXT,
  "droneId" TEXT,
  "lmvId" TEXT,
  "requestedById" TEXT NOT NULL,
  "processedById" TEXT,
  "processedAt" TIMESTAMP(3),
  "processingNote" VARCHAR(500),
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetMaintenanceRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssetMaintenanceRequest_exactly_one_asset_check" CHECK (
    ("assetType" = 'DRONE' AND "droneId" IS NOT NULL AND "lmvId" IS NULL)
    OR ("assetType" = 'LMV' AND "lmvId" IS NOT NULL AND "droneId" IS NULL)
  ),
  CONSTRAINT "AssetMaintenanceRequest_reason_trimmed_check" CHECK (nullif(btrim("reason"), '') IS NOT NULL)
);

ALTER TABLE "AssetMaintenanceRequest" ADD CONSTRAINT "AssetMaintenanceRequest_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRequest" ADD CONSTRAINT "AssetMaintenanceRequest_droneId_fkey"
  FOREIGN KEY ("droneId") REFERENCES "Drone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRequest" ADD CONSTRAINT "AssetMaintenanceRequest_lmvId_fkey"
  FOREIGN KEY ("lmvId") REFERENCES "LMV"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRequest" ADD CONSTRAINT "AssetMaintenanceRequest_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRequest" ADD CONSTRAINT "AssetMaintenanceRequest_processedById_fkey"
  FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenanceRequest" ADD CONSTRAINT "AssetMaintenanceRequest_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AssetMaintenanceRequest_status_createdAt_idx" ON "AssetMaintenanceRequest"("status", "createdAt");
CREATE INDEX "AssetMaintenanceRequest_droneId_status_idx" ON "AssetMaintenanceRequest"("droneId", "status");
CREATE INDEX "AssetMaintenanceRequest_lmvId_status_idx" ON "AssetMaintenanceRequest"("lmvId", "status");
CREATE INDEX "AssetMaintenanceRequest_assignmentId_idx" ON "AssetMaintenanceRequest"("assignmentId");
CREATE INDEX "AssetMaintenanceRequest_requestedById_createdAt_idx" ON "AssetMaintenanceRequest"("requestedById", "createdAt");
CREATE UNIQUE INDEX "AssetMaintenanceRequest_open_drone_key" ON "AssetMaintenanceRequest"("droneId")
  WHERE "droneId" IS NOT NULL AND "status" IN ('PENDING', 'ACCEPTED');
CREATE UNIQUE INDEX "AssetMaintenanceRequest_open_lmv_key" ON "AssetMaintenanceRequest"("lmvId")
  WHERE "lmvId" IS NOT NULL AND "status" IN ('PENDING', 'ACCEPTED');

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
  SELECT COALESCE(MAX("version"), 0) + 1 INTO next_version FROM "LMVHistory" WHERE "lmvId" = NEW."id";
  actor_id := NULLIF(current_setting('rfly.actor_user_id', true), '');
  IF actor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = actor_id) THEN actor_id := NULL; END IF;
  after_snapshot := jsonb_build_object(
    'registrationNo', NEW."registrationNo", 'label', NEW."label", 'status', NEW."status",
    'operationalState', NEW."operationalState", 'availabilityState', NEW."availabilityState",
    'homeCenterId', NEW."homeCenterId", 'capacity', NEW."capacity", 'notes', NEW."notes",
    'archivedAt', NEW."archivedAt"
  );
  before_snapshot := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object(
    'registrationNo', OLD."registrationNo", 'label', OLD."label", 'status', OLD."status",
    'operationalState', OLD."operationalState", 'availabilityState', OLD."availabilityState",
    'homeCenterId', OLD."homeCenterId", 'capacity', OLD."capacity", 'notes', OLD."notes",
    'archivedAt', OLD."archivedAt"
  ) END;
  IF TG_OP = 'UPDATE' AND after_snapshot IS NOT DISTINCT FROM before_snapshot THEN RETURN NEW; END IF;
  INSERT INTO "LMVHistory" ("id", "lmvId", "version", "eventType", "changedFields", "actorUserId", "recordedAt")
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

CREATE TYPE "PilotAvailabilityState" AS ENUM ('AVAILABLE', 'OFFLINE');

ALTER TABLE "User"
ADD COLUMN "pilotAvailabilityState" "PilotAvailabilityState" NOT NULL DEFAULT 'AVAILABLE';

CREATE INDEX "User_role_pilotAvailabilityState_homeCenterId_active_archivedAt_idx"
ON "User"("role", "pilotAvailabilityState", "homeCenterId", "active", "archivedAt");

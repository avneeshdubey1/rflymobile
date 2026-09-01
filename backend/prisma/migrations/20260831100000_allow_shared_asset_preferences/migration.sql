-- Pilot asset fields are preferences, not exclusive reservations. Multiple
-- Pilots at the same operating centre may prefer the same Drone or LMV while
-- Assignment remains the authoritative, conflict-checked reservation.
DROP INDEX IF EXISTS "User_assignedDroneId_key";
DROP INDEX IF EXISTS "User_assignedLmvId_key";

CREATE INDEX IF NOT EXISTS "User_assignedDroneId_idx" ON "User"("assignedDroneId");
CREATE INDEX IF NOT EXISTS "User_assignedLmvId_idx" ON "User"("assignedLmvId");

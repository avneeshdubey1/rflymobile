-- Crew formation is separate from the Lead mission lifecycle. Existing valid
-- two-person assignments remain ready; quarantined legacy rows remain visibly
-- incomplete and cannot become templates for new work.
CREATE TYPE "CrewFormationState" AS ENUM (
  'PENDING_COPILOT_SELECTION',
  'READY',
  'LEGACY_INCOMPLETE'
);

ALTER TABLE "Assignment"
  ADD COLUMN "crewFormationState" "CrewFormationState" NOT NULL DEFAULT 'READY',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "copilotSelectedAt" TIMESTAMP(3),
  ADD COLUMN "crewFormationUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Assignment"
SET
  "crewFormationState" = CASE
    WHEN "legacyCrewIncomplete" OR "copilotId" IS NULL OR "lmvId" IS NULL
      THEN 'LEGACY_INCOMPLETE'::"CrewFormationState"
    ELSE 'READY'::"CrewFormationState"
  END,
  "copilotSelectedAt" = CASE
    WHEN NOT "legacyCrewIncomplete" AND "copilotId" IS NOT NULL AND "lmvId" IS NOT NULL
      THEN "createdAt"
    ELSE NULL
  END;

-- Superseded by the state-aware constraint below. The previous constraint
-- allowed only complete crews or quarantined legacy rows and therefore could
-- not represent a deliberate non-executable provisional reservation.
ALTER TABLE "Assignment"
  DROP CONSTRAINT IF EXISTS "Assignment_complete_crew_check";

ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_revision_check" CHECK ("revision" > 0),
  ADD CONSTRAINT "Assignment_crew_formation_check" CHECK (
    (
      "crewFormationState" = 'READY'::"CrewFormationState"
      AND "copilotId" IS NOT NULL
      AND "lmvId" IS NOT NULL
      AND NOT "legacyCrewIncomplete"
    )
    OR
    (
      "crewFormationState" = 'PENDING_COPILOT_SELECTION'::"CrewFormationState"
      AND "copilotId" IS NULL
      AND "lmvId" IS NOT NULL
      AND NOT "legacyCrewIncomplete"
      AND "acceptedAt" IS NULL
      AND "startedAt" IS NULL
      AND "completedAt" IS NULL
    )
    OR
    (
      "crewFormationState" = 'LEGACY_INCOMPLETE'::"CrewFormationState"
      AND "legacyCrewIncomplete"
    )
  );

CREATE INDEX "Assignment_crewFormationState_scheduledDate_idx"
ON "Assignment"("crewFormationState", "scheduledDate");

-- Replace the existing operational-unit guard so a deliberate provisional
-- assignment may reserve Primary Pilot + Drone + LMV while still preventing it
-- from becoming executable before Copilot selection.
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
  IF NEW."crewFormationState" = 'PENDING_COPILOT_SELECTION'::"CrewFormationState" THEN
    IF NEW."copilotId" IS NOT NULL OR NEW."lmvId" IS NULL OR NEW."legacyCrewIncomplete"
       OR NEW."acceptedAt" IS NOT NULL OR NEW."startedAt" IS NOT NULL
       OR NEW."completedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'A pending Copilot assignment must be a non-executable Primary Pilot, drone, and LMV reservation';
    END IF;
  ELSIF NEW."crewFormationState" = 'LEGACY_INCOMPLETE'::"CrewFormationState" THEN
    IF NOT NEW."legacyCrewIncomplete" THEN
      RAISE EXCEPTION 'Only quarantined legacy assignments may use LEGACY_INCOMPLETE crew state';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD."legacyCrewIncomplete"
         AND NEW."legacyCrewIncomplete"
         AND NEW."pilotId" IS NOT DISTINCT FROM OLD."pilotId"
         AND NEW."copilotId" IS NOT DISTINCT FROM OLD."copilotId"
         AND NEW."droneId" IS NOT DISTINCT FROM OLD."droneId"
         AND NEW."copilotDroneId" IS NOT DISTINCT FROM OLD."copilotDroneId"
         AND NEW."lmvId" IS NOT DISTINCT FROM OLD."lmvId"
         AND (
           (NEW."startedAt" IS NOT DISTINCT FROM OLD."startedAt" AND NEW."completedAt" IS NOT DISTINCT FROM OLD."completedAt")
           OR (OLD."startedAt" IS NOT NULL AND OLD."completedAt" IS NULL AND NEW."completedAt" IS NOT NULL)
         ) THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'A quarantined legacy assignment cannot start or change resources';
  ELSE
    IF NEW."copilotId" IS NULL OR NEW."lmvId" IS NULL OR NEW."legacyCrewIncomplete" THEN
      RAISE EXCEPTION 'A ready assignment requires a complete two-pilot, one-drone, one-LMV crew';
    END IF;
    IF NEW."pilotId" = NEW."copilotId" THEN
      RAISE EXCEPTION 'Pilot and Copilot must be different users';
    END IF;
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

DROP TRIGGER IF EXISTS "Assignment_guard_operational_unit" ON "Assignment";
CREATE TRIGGER "Assignment_guard_operational_unit"
BEFORE INSERT OR UPDATE OF "pilotId", "copilotId", "droneId", "copilotDroneId", "lmvId", "startedAt", "completedAt", "legacyCrewIncomplete", "crewFormationState"
ON "Assignment"
FOR EACH ROW EXECUTE FUNCTION rfly_guard_assignment_unit();

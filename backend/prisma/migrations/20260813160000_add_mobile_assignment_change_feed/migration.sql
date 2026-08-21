CREATE TYPE "MobileAssignmentChangeKind" AS ENUM ('CHANGED', 'REMOVED');

CREATE TABLE "MobileAssignmentChange" (
  "id" BIGSERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "kind" "MobileAssignmentChangeKind" NOT NULL,
  "revision" INTEGER,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileAssignmentChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileAssignmentChange_revision_check" CHECK ("revision" IS NULL OR "revision" > 0)
);

CREATE INDEX "MobileAssignmentChange_userId_id_idx"
ON "MobileAssignmentChange"("userId", "id");
CREATE INDEX "MobileAssignmentChange_changedAt_idx"
ON "MobileAssignmentChange"("changedAt");

CREATE OR REPLACE FUNCTION rfly_record_assignment_mobile_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_kind "MobileAssignmentChangeKind";
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision")
    SELECT participant, OLD."id", 'REMOVED', OLD."revision"
    FROM unnest(ARRAY[OLD."pilotId", OLD."copilotId"]) AS participant
    WHERE participant IS NOT NULL;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision")
    SELECT participant, OLD."id", 'REMOVED', OLD."revision"
    FROM unnest(ARRAY[OLD."pilotId", OLD."copilotId"]) AS participant
    WHERE participant IS NOT NULL
      AND NOT (participant = ANY(array_remove(ARRAY[NEW."pilotId", NEW."copilotId"]::text[], NULL)));
  END IF;

  SELECT CASE WHEN l."status"::text IN ('CANCELLED', 'REJECTED')
    THEN 'REMOVED'::"MobileAssignmentChangeKind"
    ELSE 'CHANGED'::"MobileAssignmentChangeKind"
  END INTO current_kind
  FROM "Lead" l WHERE l."id" = NEW."leadId";

  INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision", "changedAt")
  SELECT participant, NEW."id", current_kind, NEW."revision", NEW."updatedAt"
  FROM unnest(ARRAY[NEW."pilotId", NEW."copilotId"]) AS participant
  WHERE participant IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Assignment_mobile_change_feed"
AFTER INSERT OR UPDATE OR DELETE ON "Assignment"
FOR EACH ROW EXECUTE FUNCTION rfly_record_assignment_mobile_change();

CREATE OR REPLACE FUNCTION rfly_record_lead_mobile_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_row "Assignment"%ROWTYPE;
  change_kind "MobileAssignmentChangeKind";
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN RETURN NEW; END IF;
  SELECT * INTO assignment_row FROM "Assignment" WHERE "leadId" = NEW."id";
  IF NOT FOUND THEN RETURN NEW; END IF;
  change_kind := CASE WHEN NEW."status"::text IN ('CANCELLED', 'REJECTED')
    THEN 'REMOVED'::"MobileAssignmentChangeKind"
    ELSE 'CHANGED'::"MobileAssignmentChangeKind" END;
  INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision")
  SELECT participant, assignment_row."id", change_kind, assignment_row."revision"
  FROM unnest(ARRAY[assignment_row."pilotId", assignment_row."copilotId"]) AS participant
  WHERE participant IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Lead_mobile_assignment_change_feed"
AFTER UPDATE OF "status" ON "Lead"
FOR EACH ROW EXECUTE FUNCTION rfly_record_lead_mobile_change();

INSERT INTO "MobileAssignmentChange" ("userId", "assignmentId", "kind", "revision", "changedAt")
SELECT participant, a."id",
  CASE WHEN l."status"::text IN ('CANCELLED', 'REJECTED')
    THEN 'REMOVED'::"MobileAssignmentChangeKind"
    ELSE 'CHANGED'::"MobileAssignmentChangeKind" END,
  a."revision", a."updatedAt"
FROM "Assignment" a
JOIN "Lead" l ON l."id" = a."leadId"
CROSS JOIN LATERAL unnest(ARRAY[a."pilotId", a."copilotId"]) AS participant
WHERE participant IS NOT NULL;

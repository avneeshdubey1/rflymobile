-- Repair deployments where a development reset removed the required company
-- scheduling policy after its original migration had already been recorded.
-- Existing policy values and every operational/customer row remain untouched.
BEGIN;

INSERT INTO "AutoAssignmentPolicy" (
  "id", "singletonKey", "enabled", "searchHorizonDays",
  "workingDayStartMinutes", "workingDayEndMinutes",
  "defaultJobDurationMinutes", "turnaroundMinutes",
  "weatherUnavailableAction", "revision", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::text, 'COMPANY', true, 5,
  540, 1080, 120, 30,
  'SCHEDULE_WITH_WARNING', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("singletonKey") DO NOTHING;

COMMIT;

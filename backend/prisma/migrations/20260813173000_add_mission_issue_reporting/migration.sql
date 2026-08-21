CREATE TYPE "MissionIssueCategory" AS ENUM (
  'DRONE_MALFUNCTION',
  'SAFETY_HAZARD',
  'WEATHER_BLOCKER',
  'CUSTOMER_BLOCKER',
  'OTHER'
);

ALTER TABLE "Assignment"
ADD COLUMN "issueCategory" "MissionIssueCategory",
ADD COLUMN "issueNote" TEXT,
ADD COLUMN "issueReportedAt" TIMESTAMP(3),
ADD CONSTRAINT "Assignment_issue_consistency_check" CHECK (
  ("issueCategory" IS NULL AND "issueNote" IS NULL AND "issueReportedAt" IS NULL)
  OR
  ("issueCategory" IS NOT NULL AND nullif(btrim("issueNote"), '') IS NOT NULL AND "issueReportedAt" IS NOT NULL)
),
ADD CONSTRAINT "Assignment_issue_note_length_check" CHECK (
  "issueNote" IS NULL OR char_length("issueNote") BETWEEN 1 AND 500
);

CREATE INDEX "Assignment_issueCategory_issueReportedAt_idx"
ON "Assignment"("issueCategory", "issueReportedAt");

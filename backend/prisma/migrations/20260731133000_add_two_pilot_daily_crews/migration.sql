-- Existing assignments remain readable with a null Copilot.
-- Every new assignment is required by the service layer to select a Copilot.
ALTER TABLE "Assignment"
ADD COLUMN "copilotId" TEXT,
ADD COLUMN "dailySequence" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Assignment"
ADD CONSTRAINT "Assignment_copilotId_fkey"
FOREIGN KEY ("copilotId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Assignment_scheduledDate_dailySequence_idx"
ON "Assignment"("scheduledDate", "dailySequence");

CREATE INDEX "Assignment_copilotId_scheduledDate_idx"
ON "Assignment"("copilotId", "scheduledDate");

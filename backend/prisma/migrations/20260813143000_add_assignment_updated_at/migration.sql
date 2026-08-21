ALTER TABLE "Assignment"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Assignment_updatedAt_idx" ON "Assignment"("updatedAt");

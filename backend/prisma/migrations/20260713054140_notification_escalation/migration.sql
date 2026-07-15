-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PILOT_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE 'PILOT_SMS';
ALTER TYPE "NotificationType" ADD VALUE 'DISPATCH_CALL_TASK';

-- CreateTable
CREATE TABLE "NotificationEscalation" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'PUSH_SENT',
    "nextActionAt" TIMESTAMP(3) NOT NULL,
    "reassignCount" INTEGER NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEscalation_assignmentId_key" ON "NotificationEscalation"("assignmentId");

-- CreateIndex
CREATE INDEX "NotificationEscalation_nextActionAt_idx" ON "NotificationEscalation"("nextActionAt");

-- AddForeignKey
ALTER TABLE "NotificationEscalation" ADD CONSTRAINT "NotificationEscalation_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

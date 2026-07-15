-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'Representative';

-- AlterTable
ALTER TABLE "BBRepresentativeApproval" ADD COLUMN     "representativeUserId" UUID,
ALTER COLUMN "isApproved" SET DEFAULT false;

-- AlterTable
ALTER TABLE "PilotAssignment" ADD COLUMN     "representativeId" UUID;

-- AddForeignKey
ALTER TABLE "PilotAssignment" ADD CONSTRAINT "PilotAssignment_representativeId_fkey" FOREIGN KEY ("representativeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BBRepresentativeApproval" ADD CONSTRAINT "BBRepresentativeApproval_representativeUserId_fkey" FOREIGN KEY ("representativeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

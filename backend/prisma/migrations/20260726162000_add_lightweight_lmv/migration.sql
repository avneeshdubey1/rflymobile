CREATE TYPE "LMVStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'OUT_OF_SERVICE');

CREATE TABLE "LMV" (
    "id" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "label" TEXT,
    "status" "LMVStatus" NOT NULL DEFAULT 'AVAILABLE',
    "homeCenterId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LMV_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LMV_registrationNo_key" ON "LMV"("registrationNo");
CREATE INDEX "LMV_homeCenterId_status_idx" ON "LMV"("homeCenterId", "status");

ALTER TABLE "LMV" ADD CONSTRAINT "LMV_homeCenterId_fkey" FOREIGN KEY ("homeCenterId") REFERENCES "OperatingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assignment" ADD COLUMN "lmvId" TEXT;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lmvId_fkey" FOREIGN KEY ("lmvId") REFERENCES "LMV"("id") ON DELETE SET NULL ON UPDATE CASCADE;

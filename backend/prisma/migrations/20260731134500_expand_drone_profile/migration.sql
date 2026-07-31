-- Additive operational details selected from the Triveni prototype.
ALTER TABLE "Drone"
ADD COLUMN "name" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "manufacturer" TEXT,
ADD COLUMN "tankCapacityLitres" DOUBLE PRECISION,
ADD COLUMN "batteryCapacityMah" INTEGER,
ADD COLUMN "enduranceMinutes" INTEGER,
ADD COLUMN "certified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "serviceType" TEXT;

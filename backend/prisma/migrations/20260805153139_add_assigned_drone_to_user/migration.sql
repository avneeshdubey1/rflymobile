/*
  Warnings:

  - You are about to drop the column `batteryCapacityMah` on the `Drone` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Drone` table. All the data in the column will be lost.
  - You are about to drop the column `enduranceMinutes` on the `Drone` table. All the data in the column will be lost.
  - You are about to drop the column `serialNumber` on the `Drone` table. All the data in the column will be lost.
  - You are about to drop the column `tankCapacityLitres` on the `Drone` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[uin]` on the table `Drone` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[assignedDroneId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `uin` to the `Drone` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DroneCategory" AS ENUM ('EVTOL', 'HEXACOPTER', 'QUADCOPTER');

-- DropIndex
DROP INDEX "Drone_serialNumber_key";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "copilotDroneId" TEXT;

-- AlterTable
ALTER TABLE "Drone" DROP COLUMN "batteryCapacityMah",
DROP COLUMN "category",
DROP COLUMN "enduranceMinutes",
DROP COLUMN "serialNumber",
DROP COLUMN "tankCapacityLitres",
ADD COLUMN     "batteryCapacity" INTEGER,
ADD COLUMN     "endurance" INTEGER,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "tankCapacity" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "uin" TEXT NOT NULL,
ALTER COLUMN "certified" DROP NOT NULL,
ALTER COLUMN "certified" DROP DEFAULT,
ALTER COLUMN "certified" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "assignedDroneId" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "idProof" TEXT,
ADD COLUMN     "licenseId" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Drone_uin_key" ON "Drone"("uin");

-- CreateIndex
CREATE UNIQUE INDEX "User_assignedDroneId_key" ON "User"("assignedDroneId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedDroneId_fkey" FOREIGN KEY ("assignedDroneId") REFERENCES "Drone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_copilotDroneId_fkey" FOREIGN KEY ("copilotDroneId") REFERENCES "Drone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

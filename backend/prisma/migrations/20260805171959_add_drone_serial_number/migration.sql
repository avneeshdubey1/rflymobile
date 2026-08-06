/*
  Warnings:

  - A unique constraint covering the columns `[serialNumber]` on the table `Drone` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serialNumber` to the `Drone` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Drone" ADD COLUMN     "serialNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Drone_serialNumber_key" ON "Drone"("serialNumber");

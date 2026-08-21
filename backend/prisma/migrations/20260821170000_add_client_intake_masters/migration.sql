CREATE TYPE "ClusterType" AS ENUM ('HUB', 'SPOKE', 'MINIHUB');
CREATE TYPE "RequestType" AS ENUM ('B2B', 'B2C');
CREATE TYPE "MasterDataCategory" AS ENUM ('SPRAY_PURPOSE', 'B2B_SUBCATEGORY', 'LEAD_SOURCE', 'REPORTING_ADMIN');

CREATE TABLE "Cluster" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "displayName" VARCHAR(120) NOT NULL,
  "type" "ClusterType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cluster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MasterDataValue" (
  "id" TEXT NOT NULL,
  "category" "MasterDataCategory" NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MasterDataValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PilotAssignmentRejection" (
  "id" TEXT NOT NULL,
  "formerAssignmentId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "rejectedByPilotId" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PilotAssignmentRejection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "assignedLmvId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "clusterId" TEXT;
ALTER TABLE "Lead"
  ADD COLUMN "requestType" "RequestType",
  ADD COLUMN "b2bSubcategoryCode" TEXT,
  ADD COLUMN "clusterId" TEXT,
  ADD COLUMN "reportingAdminCode" TEXT,
  ADD COLUMN "leadSourceCode" TEXT;

CREATE UNIQUE INDEX "Cluster_code_key" ON "Cluster"("code");
CREATE INDEX "Cluster_active_sortOrder_displayName_idx" ON "Cluster"("active", "sortOrder", "displayName");
CREATE UNIQUE INDEX "MasterDataValue_category_code_key" ON "MasterDataValue"("category", "code");
CREATE INDEX "MasterDataValue_category_active_sortOrder_displayName_idx" ON "MasterDataValue"("category", "active", "sortOrder", "displayName");
CREATE UNIQUE INDEX "User_assignedLmvId_key" ON "User"("assignedLmvId");
CREATE INDEX "Customer_clusterId_active_idx" ON "Customer"("clusterId", "active");
CREATE INDEX "Lead_clusterId_createdAt_idx" ON "Lead"("clusterId", "createdAt");
CREATE INDEX "Lead_reportingAdminCode_createdAt_idx" ON "Lead"("reportingAdminCode", "createdAt");
CREATE INDEX "PilotAssignmentRejection_leadId_createdAt_idx" ON "PilotAssignmentRejection"("leadId", "createdAt");
CREATE INDEX "PilotAssignmentRejection_rejectedByPilotId_createdAt_idx" ON "PilotAssignmentRejection"("rejectedByPilotId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_assignedLmvId_fkey" FOREIGN KEY ("assignedLmvId") REFERENCES "LMV"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "Cluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotAssignmentRejection" ADD CONSTRAINT "PilotAssignmentRejection_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotAssignmentRejection" ADD CONSTRAINT "PilotAssignmentRejection_rejectedByPilotId_fkey" FOREIGN KEY ("rejectedByPilotId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_request_type_category_check" CHECK (
  "requestType" IS NULL
  OR ("requestType" = 'B2B' AND "b2bSubcategoryCode" IS NOT NULL)
  OR ("requestType" = 'B2C' AND "b2bSubcategoryCode" IS NULL)
);

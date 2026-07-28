CREATE TABLE "BusinessOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gstNo" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessOrganization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lead" ADD COLUMN "businessOrganizationId" TEXT;

CREATE INDEX "BusinessOrganization_name_idx" ON "BusinessOrganization"("name");
CREATE INDEX "BusinessOrganization_active_idx" ON "BusinessOrganization"("active");
CREATE UNIQUE INDEX "BusinessMembership_organizationId_userId_key" ON "BusinessMembership"("organizationId", "userId");
CREATE INDEX "BusinessMembership_userId_active_idx" ON "BusinessMembership"("userId", "active");
CREATE INDEX "BusinessMembership_organizationId_active_idx" ON "BusinessMembership"("organizationId", "active");
CREATE INDEX "Lead_businessOrganizationId_createdAt_idx" ON "Lead"("businessOrganizationId", "createdAt");

ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "BusinessOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessOrganizationId_fkey" FOREIGN KEY ("businessOrganizationId") REFERENCES "BusinessOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

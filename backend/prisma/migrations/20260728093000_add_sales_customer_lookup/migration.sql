CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'ta',
    "village" TEXT,
    "district" TEXT,
    "farmerUserId" TEXT,
    "createdByUserId" TEXT,
    "staffConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Lead" ADD COLUMN "customerId" TEXT;

CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE UNIQUE INDEX "Customer_farmerUserId_key" ON "Customer"("farmerUserId");
CREATE INDEX "Customer_displayName_idx" ON "Customer"("displayName");
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");
CREATE INDEX "Lead_customerId_createdAt_idx" ON "Lead"("customerId", "createdAt");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "CashCollectionReviewStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'VOIDED');

CREATE TABLE "B2cCashCollection" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "clientActionId" UUID NOT NULL,
    "reviewStatus" "CashCollectionReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2cCashCollection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "B2cCashCollection_amount_positive_check" CHECK ("amountMinor" > 0),
    CONSTRAINT "B2cCashCollection_currency_code_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX "B2cCashCollection_assignmentId_key" ON "B2cCashCollection"("assignmentId");
CREATE UNIQUE INDEX "B2cCashCollection_clientActionId_key" ON "B2cCashCollection"("clientActionId");
CREATE INDEX "B2cCashCollection_reviewStatus_createdAt_idx" ON "B2cCashCollection"("reviewStatus", "createdAt");
CREATE INDEX "B2cCashCollection_recordedById_createdAt_idx" ON "B2cCashCollection"("recordedById", "createdAt");

ALTER TABLE "B2cCashCollection"
  ADD CONSTRAINT "B2cCashCollection_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "B2cCashCollection"
  ADD CONSTRAINT "B2cCashCollection_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

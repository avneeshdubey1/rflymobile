CREATE TYPE "MobileApp" AS ENUM ('PILOT_FIELD', 'OPERATIONS');
CREATE TYPE "MobileMutationOutcome" AS ENUM (
  'APPLIED',
  'ALREADY_APPLIED',
  'CONFLICT',
  'REJECTED',
  'RETRY_LATER'
);

CREATE TABLE "MobileInstallation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "app" "MobileApp" NOT NULL,
  "installationKeyHash" VARCHAR(128) NOT NULL,
  "label" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" VARCHAR(200),
  CONSTRAINT "MobileInstallation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileInstallation_key_hash_check" CHECK (length("installationKeyHash") BETWEEN 32 AND 128),
  CONSTRAINT "MobileInstallation_revoke_reason_check" CHECK ("revokedAt" IS NULL OR nullif(btrim("revokeReason"), '') IS NOT NULL)
);

CREATE TABLE "MobileSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "authVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idleExpiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" VARCHAR(200),
  CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileSession_token_hash_check" CHECK (length("tokenHash") BETWEEN 32 AND 128),
  CONSTRAINT "MobileSession_expiry_check" CHECK (
    "idleExpiresAt" > "createdAt" AND "absoluteExpiresAt" > "createdAt"
  ),
  CONSTRAINT "MobileSession_revoke_reason_check" CHECK ("revokedAt" IS NULL OR nullif(btrim("revokeReason"), '') IS NOT NULL)
);

CREATE TABLE "MobileMutationReceipt" (
  "id" TEXT NOT NULL,
  "installationId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "actionId" VARCHAR(128) NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "requestHash" VARCHAR(128) NOT NULL,
  "outcome" "MobileMutationOutcome" NOT NULL,
  "safeResult" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MobileMutationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MobileMutationReceipt_action_check" CHECK (nullif(btrim("actionId"), '') IS NOT NULL),
  CONSTRAINT "MobileMutationReceipt_operation_check" CHECK (nullif(btrim("operation"), '') IS NOT NULL),
  CONSTRAINT "MobileMutationReceipt_request_hash_check" CHECK (length("requestHash") BETWEEN 32 AND 128)
);

CREATE UNIQUE INDEX "MobileInstallation_installationKeyHash_key"
ON "MobileInstallation"("installationKeyHash");
CREATE INDEX "MobileInstallation_userId_app_revokedAt_idx"
ON "MobileInstallation"("userId", "app", "revokedAt");

CREATE UNIQUE INDEX "MobileSession_tokenHash_key" ON "MobileSession"("tokenHash");
CREATE INDEX "MobileSession_userId_revokedAt_idx" ON "MobileSession"("userId", "revokedAt");
CREATE INDEX "MobileSession_installationId_revokedAt_idx" ON "MobileSession"("installationId", "revokedAt");
CREATE INDEX "MobileSession_idleExpiresAt_idx" ON "MobileSession"("idleExpiresAt");

CREATE UNIQUE INDEX "MobileMutationReceipt_installationId_actionId_key"
ON "MobileMutationReceipt"("installationId", "actionId");
CREATE INDEX "MobileMutationReceipt_assignmentId_createdAt_idx"
ON "MobileMutationReceipt"("assignmentId", "createdAt");
CREATE INDEX "MobileMutationReceipt_createdAt_idx" ON "MobileMutationReceipt"("createdAt");

ALTER TABLE "MobileInstallation"
ADD CONSTRAINT "MobileInstallation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileSession"
ADD CONSTRAINT "MobileSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileSession"
ADD CONSTRAINT "MobileSession_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "MobileInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileMutationReceipt"
ADD CONSTRAINT "MobileMutationReceipt_installationId_fkey"
FOREIGN KEY ("installationId") REFERENCES "MobileInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileMutationReceipt"
ADD CONSTRAINT "MobileMutationReceipt_assignmentId_fkey"
FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

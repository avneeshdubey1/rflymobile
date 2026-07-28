-- CreateEnum
CREATE TYPE "PhoneVerificationPurpose" AS ENUM ('FARMER_PORTAL_AUTH', 'FARMER_PHONE_LINK', 'BUSINESS_RECOVERY');

-- CreateEnum
CREATE TYPE "OtpDeliveryChannel" AS ENUM ('DISABLED', 'TEST', 'CLI', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "OtpDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'MOCKED', 'FAILED', 'DEAD_LETTER', 'DISABLED');

-- CreateTable
CREATE TABLE "PhoneVerificationChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "phoneHash" TEXT NOT NULL,
    "recipientLast4" TEXT,
    "purpose" "PhoneVerificationPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneVerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "channel" "OtpDeliveryChannel" NOT NULL,
    "status" "OtpDeliveryStatus" NOT NULL,
    "providerReference" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpDeliveryOutbox" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "channel" "OtpDeliveryChannel" NOT NULL,
    "status" "OtpDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpDeliveryOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneVerificationChallenge_phoneHash_purpose_createdAt_idx" ON "PhoneVerificationChallenge"("phoneHash", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationChallenge_userId_purpose_revokedAt_idx" ON "PhoneVerificationChallenge"("userId", "purpose", "revokedAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationChallenge_expiresAt_idx" ON "PhoneVerificationChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "VerificationDeliveryAttempt_challengeId_createdAt_idx" ON "VerificationDeliveryAttempt"("challengeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OtpDeliveryOutbox_idempotencyKey_key" ON "OtpDeliveryOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OtpDeliveryOutbox_status_nextAttemptAt_idx" ON "OtpDeliveryOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OtpDeliveryOutbox_challengeId_idx" ON "OtpDeliveryOutbox"("challengeId");

-- AddForeignKey
ALTER TABLE "PhoneVerificationChallenge" ADD CONSTRAINT "PhoneVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneVerificationChallenge" ADD CONSTRAINT "PhoneVerificationChallenge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDeliveryAttempt" ADD CONSTRAINT "VerificationDeliveryAttempt_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "PhoneVerificationChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpDeliveryOutbox" ADD CONSTRAINT "OtpDeliveryOutbox_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "PhoneVerificationChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

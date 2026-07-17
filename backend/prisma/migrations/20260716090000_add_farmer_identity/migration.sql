-- Add the Farmer identity introduced by the phone-OTP onboarding flow.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FARMER';

ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "village" TEXT,
ADD COLUMN IF NOT EXISTS "district" TEXT;


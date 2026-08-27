-- Add the separate Operations mobile Farmer OTP purpose. Existing portal,
-- phone-link, and recovery challenges retain their current values.
ALTER TYPE "PhoneVerificationPurpose" ADD VALUE IF NOT EXISTS 'FARMER_MOBILE_AUTH';

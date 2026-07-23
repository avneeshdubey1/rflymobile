-- Reconcile databases created only from migration history with the current
-- Prisma schema. Every addition is guarded because some development databases
-- already received these changes through `prisma db push`.
BEGIN;

-- Identity and workflow enum values.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FARMER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUSINESS';

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'MANUAL_CALL_REQUIRED';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PILOT_ASSIGNMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PILOT_SMS';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPATCH_CALL_TASK';

-- User identity, profile, and preference fields.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "preferences" JSONB,
ADD COLUMN IF NOT EXISTS "active" BOOLEAN,
ADD COLUMN IF NOT EXISTS "authVersion" INTEGER,
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "village" TEXT,
ADD COLUMN IF NOT EXISTS "district" TEXT,
ADD COLUMN IF NOT EXISTS "businessName" TEXT,
ADD COLUMN IF NOT EXISTS "gstNo" TEXT,
ADD COLUMN IF NOT EXISTS "contactPerson" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT;

UPDATE "User" SET "preferences" = '{}'::jsonb WHERE "preferences" IS NULL;
UPDATE "User" SET "active" = true WHERE "active" IS NULL;
UPDATE "User" SET "authVersion" = 1 WHERE "authVersion" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "preferences" SET DEFAULT '{}'::jsonb,
ALTER COLUMN "preferences" SET NOT NULL,
ALTER COLUMN "active" SET DEFAULT true,
ALTER COLUMN "active" SET NOT NULL,
ALTER COLUMN "authVersion" SET DEFAULT 1,
ALTER COLUMN "authVersion" SET NOT NULL;

-- Comprehensive lead-intake fields.
ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "soilType" TEXT,
ADD COLUMN IF NOT EXISTS "cropAgeWeeks" INTEGER,
ADD COLUMN IF NOT EXISTS "chemicalBrand" TEXT,
ADD COLUMN IF NOT EXISTS "sprayPurpose" TEXT,
ADD COLUMN IF NOT EXISTS "hasChemical" BOOLEAN,
ADD COLUMN IF NOT EXISTS "chemicalProofUrl" TEXT,
ADD COLUMN IF NOT EXISTS "expectedDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "expectedTime" TEXT,
ADD COLUMN IF NOT EXISTS "waterBodyNearby" BOOLEAN,
ADD COLUMN IF NOT EXISTS "terrainType" TEXT;

UPDATE "Lead" SET "hasChemical" = true WHERE "hasChemical" IS NULL;
UPDATE "Lead" SET "waterBodyNearby" = false WHERE "waterBodyNearby" IS NULL;

ALTER TABLE "Lead"
ALTER COLUMN "hasChemical" SET DEFAULT true,
ALTER COLUMN "hasChemical" SET NOT NULL,
ALTER COLUMN "waterBodyNearby" SET DEFAULT false,
ALTER COLUMN "waterBodyNearby" SET NOT NULL;

-- Build the current chat shape before removing the legacy admin/pilot fields.
ALTER TABLE "ChatSession"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "leadId" TEXT;

CREATE TABLE IF NOT EXISTS "_ChatParticipants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "_ChatParticipants_AB_unique"
ON "_ChatParticipants"("A", "B");

CREATE INDEX IF NOT EXISTS "_ChatParticipants_B_index"
ON "_ChatParticipants"("B");

-- Preserve both participants from every legacy chat before dropping its old
-- foreign-key columns. Dynamic SQL keeps this block safe on already-reconciled
-- databases where those columns no longer exist.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ChatSession'
          AND column_name = 'adminId'
    ) THEN
        EXECUTE 'INSERT INTO "_ChatParticipants" ("A", "B")
                 SELECT "id", "adminId" FROM "ChatSession"
                 WHERE "adminId" IS NOT NULL
                 ON CONFLICT ("A", "B") DO NOTHING';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ChatSession'
          AND column_name = 'pilotId'
    ) THEN
        EXECUTE 'INSERT INTO "_ChatParticipants" ("A", "B")
                 SELECT "id", "pilotId" FROM "ChatSession"
                 WHERE "pilotId" IS NOT NULL
                 ON CONFLICT ("A", "B") DO NOTHING';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ChatSession_leadId_fkey'
          AND conrelid = to_regclass('"ChatSession"')
    ) THEN
        ALTER TABLE "ChatSession"
        ADD CONSTRAINT "ChatSession_leadId_fkey"
        FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = '_ChatParticipants_A_fkey'
          AND conrelid = to_regclass('"_ChatParticipants"')
    ) THEN
        ALTER TABLE "_ChatParticipants"
        ADD CONSTRAINT "_ChatParticipants_A_fkey"
        FOREIGN KEY ("A") REFERENCES "ChatSession"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = '_ChatParticipants_B_fkey'
          AND conrelid = to_regclass('"_ChatParticipants"')
    ) THEN
        ALTER TABLE "_ChatParticipants"
        ADD CONSTRAINT "_ChatParticipants_B_fkey"
        FOREIGN KEY ("B") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "ChatSession"
DROP CONSTRAINT IF EXISTS "ChatSession_adminId_fkey",
DROP CONSTRAINT IF EXISTS "ChatSession_pilotId_fkey";

ALTER TABLE "ChatSession"
DROP COLUMN IF EXISTS "adminId",
DROP COLUMN IF EXISTS "pilotId";

COMMIT;

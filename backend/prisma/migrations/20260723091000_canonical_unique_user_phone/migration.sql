-- Phone authentication must resolve to exactly one account. Canonicalize all
-- stored values using the same India-default rule as identityService, then
-- enforce canonical shape and uniqueness at the database boundary.
--
-- Fail closed when legacy data is invalid or two rows collapse to the same
-- canonical identity. An operator must resolve those identities explicitly;
-- the migration must never choose an account on their behalf.
DO $$
BEGIN
  IF EXISTS (
    WITH normalized AS (
      SELECT
        "id",
        CASE
          WHEN length(digits) = 10 THEN '91' || digits
          ELSE digits
        END AS canonical_digits
      FROM (
        SELECT "id", regexp_replace("phone", '[^0-9]', '', 'g') AS digits
        FROM "User"
        WHERE "phone" IS NOT NULL
      ) cleaned
    )
    SELECT 1
    FROM normalized
    WHERE length(canonical_digits) < 8 OR length(canonical_digits) > 15
  ) THEN
    RAISE EXCEPTION 'Cannot canonicalize User.phone: resolve invalid legacy phone values before migrating';
  END IF;

  IF EXISTS (
    WITH normalized AS (
      SELECT
        CASE
          WHEN length(digits) = 10 THEN '91' || digits
          ELSE digits
        END AS canonical_digits
      FROM (
        SELECT regexp_replace("phone", '[^0-9]', '', 'g') AS digits
        FROM "User"
        WHERE "phone" IS NOT NULL
      ) cleaned
    )
    SELECT 1
    FROM normalized
    GROUP BY canonical_digits
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot make User.phone unique: resolve duplicate legacy phone identities before migrating';
  END IF;
END
$$;

WITH normalized AS (
  SELECT
    "id",
    CASE
      WHEN length(digits) = 10 THEN '+91' || digits
      ELSE '+' || digits
    END AS canonical_phone
  FROM (
    SELECT "id", regexp_replace("phone", '[^0-9]', '', 'g') AS digits
    FROM "User"
    WHERE "phone" IS NOT NULL
  ) cleaned
)
UPDATE "User" AS users
SET "phone" = normalized.canonical_phone
FROM normalized
WHERE users."id" = normalized."id"
  AND users."phone" IS DISTINCT FROM normalized.canonical_phone;

CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'User_phone_canonical_check'
      AND conrelid = '"User"'::regclass
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_phone_canonical_check"
    CHECK ("phone" IS NULL OR "phone" ~ '^[+][0-9]{8,15}$');
  END IF;
END
$$;

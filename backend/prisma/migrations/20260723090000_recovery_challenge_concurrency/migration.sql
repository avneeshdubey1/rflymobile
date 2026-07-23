-- Bind newly issued challenges to the account security state that was current
-- at issuance. Existing open challenges predate this invariant and are
-- invalidated instead of being silently grandfathered.
ALTER TABLE "PasswordRecoveryChallenge"
ADD COLUMN "expectedAuthVersion" INTEGER,
ADD COLUMN "externalProofHash" TEXT;

CREATE UNIQUE INDEX "PasswordRecoveryChallenge_externalProofHash_key"
ON "PasswordRecoveryChallenge"("externalProofHash");

UPDATE "PasswordRecoveryChallenge"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "userId" IS NOT NULL
  AND "usedAt" IS NULL
  AND "revokedAt" IS NULL;

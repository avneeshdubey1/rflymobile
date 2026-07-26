# Migration and rollback runbook

> **Operational record:** this is not the current product specification. Refer to [docs/plan/AGENTS.md](../plan/AGENTS.md) for release requirements.

## Rules

- Treat every schema migration as a reviewed production change.
- Take a verified, encrypted backup immediately before migration.
- Never run `prisma migrate dev`, `prisma migrate reset`, or development seed commands against production.
- Never edit an already-applied migration.
- PostgreSQL schema and application images are one release unit.
- Prisma migrations are forward migrations; there is no automatically safe “down” migration.

## Pre-migration gate

1. Confirm the company/deployment identifier and database volume.
2. Confirm the approved source revision and immutable image digests.
3. Review the generated SQL for locks, destructive changes, table rewrites, and expected duration.
4. Confirm backup success and the latest independent restore-test evidence.
5. Confirm maintenance window, operator, approver, rollback decision owner, and communication channel.
6. Stop new writes if the migration is not proven online-compatible.

### Phase 1 strict-intake legacy-data guard

`20260726110000_strict_intake_and_retire_legacy_paths` is intentionally fail-closed. A fresh handover database may apply it normally. It stops if it finds any legacy appeal, Google Form identifier/channel, transport-fee configuration, Bhumeet record, or related notification. Do not bypass this guard by deleting data through a seed, bootstrap, or ad hoc SQL command.

For a non-fresh legacy database, obtain explicit approval for the exact archival/deletion plan, take the backup, rehearse its restore, record preflight counts without customer payloads, and preserve the migration output. Only then may an approved operator apply the migration. The historical migration files remain part of the chain and must not be edited.

```sh
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml stop frontend backend
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml up --abort-on-container-exit --exit-code-from migrate migrate
```

If migration succeeds, start the approved application images and perform health plus workflow smoke tests. Preserve migration logs without request/customer payloads.

## Application rollback

An application-only rollback is allowed only when the previous image is explicitly compatible with the migrated schema.

1. Stop frontend/backend.
2. Set the deployment environment back to the prior immutable image tag/digests.
3. Render and review `docker compose config`.
4. Start backend/frontend without running an incompatible older migration image.
5. Run health, login, role, and Socket.IO smoke tests.

## Database rollback

If the schema or data must be reverted, restore the pre-migration backup. Do not invent reverse SQL during an incident.

1. Keep writers stopped.
2. Preserve the failed database/volume as incident evidence where storage policy permits.
3. Provision a clean replacement database volume or separately named recovery stack.
4. Restore according to [backup and restore](backup-restore.md).
5. deploy the matching previous schema/application release.
6. Verify data integrity using counts/status aggregates—never by copying PII into tickets or logs.
7. Reopen traffic only after the rollback owner approves.

Record the failure, customer impact window, migration/restore durations, data-loss window, image digests, backup identifier, and corrective action.

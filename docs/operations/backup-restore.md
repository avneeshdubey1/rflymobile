# Backup and restore runbook

> **Operational record:** this is not the current product specification. Refer to [docs/plan/AGENTS.md](../plan/AGENTS.md) for release requirements.

## Unresolved production inputs

The company still needs to approve RPO, RTO, backup frequency, retention, region, encryption/key owner, immutable/offline-copy policy, and restore-test frequency. Until those are approved, this document is a procedure template—not proof that backups exist.

Database dumps contain farmer contact data, operational history, payments, chat metadata/content, and potentially current GPS data. Handle every dump as highly sensitive. Never leave an unencrypted dump in the repository, a shared desktop folder, CI artifacts, or support tickets.

## Create a logical backup

Set a restrictive umask and write into an approved encrypted staging filesystem:

```sh
umask 077
backup_id="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="/approved/encrypted/staging/${DEPLOYMENT_NAME}-${backup_id}.dump"

docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml exec -T db \
  sh -c 'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$backup_file"

test -s "$backup_file"
sha256sum "$backup_file" > "${backup_file}.sha256"
```

Immediately encrypt/transfer the dump with the company-approved backup system and remove the plaintext staging copy according to that system's verified procedure. Do not print the dump, password, database URL, or encryption key. Record only backup ID, UTC time, source deployment, PostgreSQL/application version, size, checksum, encrypted destination reference, and operator.

A successful `pg_dump` is not a verified backup until restoration has passed in a separate environment.

## Restore rehearsal in an isolated environment

1. Create a new Compose project identifier, secret directory, database volume, and private test domain. Never point a restore rehearsal at the live volume.
2. Restrict access to the named restore-test team. Do not enable external providers or farmer notifications.
3. Retrieve and decrypt the chosen backup through the approved key system into protected temporary storage.
4. Start only the new database service.

```sh
docker compose --env-file "$RESTORE_DEPLOY_ENV" -f compose.production.yml up --detach db
docker compose --env-file "$RESTORE_DEPLOY_ENV" -f compose.production.yml exec -T db \
  sh -c 'exec pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error' \
  < "$RESTORE_BACKUP_FILE"
```

5. Run the release's migration container to bring an older backup forward when that is part of the approved rehearsal.
6. Start backend/frontend only on the isolated test network.
7. Verify schema/migration status, aggregate record counts, role authentication, representative workflows, audit ordering, and health. Do not paste real records into evidence.
8. Measure recovery duration and compare the backup timestamp to the approved RPO/RTO.
9. Securely remove the decrypted temporary file and destroy the restore stack/volume after evidence is approved.

## Emergency restore

During an incident, follow the same isolation and verification steps, with two-person approval for the destructive cutover. Preserve the old volume, stop writers, restore into a clean volume, verify, then switch traffic. Record any data-loss interval. Never use `docker compose down --volumes` as a shortcut.

## Restore evidence template

- Source deployment and backup ID:
- Backup UTC timestamp and checksum verification:
- Encrypted storage/key owner confirmation:
- Restore environment/project identifier:
- Operator and independent reviewer:
- PostgreSQL, migration, and application release:
- Restore start/end and measured RTO:
- Measured data-loss window/RPO:
- Integrity and workflow checks:
- Provider egress confirmed disabled:
- Temporary plaintext/restore environment disposal confirmed:
- Result and follow-up defects:

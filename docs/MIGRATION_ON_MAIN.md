# Production Farmer Data Migration (`main`)

**Status:** operator runbook
**Last verified in staging:** August 10, 2026
**Target:** current office production stack `rfly-onprem-demo`

This is the only approved command sequence for promoting the verified farmer
workbook import to the current production stack. It is additive and does not
seed, wipe, replace, or copy the production database. Stop on any unexpected
output. Never substitute a raw SQL/Node script for a failed gate.

## Proven source expectations

The currently approved workbook produced this staging evidence:

| Check | Expected |
|---|---:|
| CRM download rows | 745 |
| Google Forms rows | 1,219 |
| Total rows | 1,964 |
| Valid/importable rows | 1,924 |
| Safe skips | 40 |
| Rejected/review rows | 0 / 0 |
| Historical service outcomes | 743 |
| Village visit outcomes | 1,181 |
| Live Leads created | 0 |

Production may create fewer than 1,611 new customers because existing customers
must be matched by canonical phone. That is expected. Existing nonblank profile
values must not be overwritten. Any other difference requires review before
approval.

## 1. Release and host gates

Confirm the reviewed staging revision has reached `main`, main CI is green, and
the production deployment completed successfully. On the server:

```bash
set -euo pipefail

repo=/home/rflyrunner/actions-runner/_work/RFLY/RFLY
sudo -u rflyrunner git -C "$repo" rev-parse HEAD
sudo -u rflyrunner git -C "$repo" status --short

curl -fsS http://127.0.0.1:8088/healthz
echo
curl -fsS http://127.0.0.1:8088/api/health
echo
```

The worktree must be clean and both health checks must succeed. Record the SHA
in the private change ticket; do not add customer data to the ticket.

## 2. Create private production import paths

Run as root. These paths are outside Git and visible to snap Docker:

```bash
set -euo pipefail

repo=/home/rflyrunner/actions-runner/_work/RFLY/RFLY
secret_dir=/home/rflyrunner/actions-runner/_work/RFLY/_rfly-deploy-secrets/rfly-onprem-demo
input_dir=/home/rflyrunner/actions-runner/_work/RFLY/_rfly-import-input/rfly-onprem-demo
source_secret_dir=/opt/client-demo-app/secrets

install -d -m 0700 -o rflyrunner -g rflyrunner "$secret_dir"
install -d -m 0750 -o rflyrunner -g rflyrunner "$input_dir"
install -d -m 0700 -o rflyrunner -g rflyrunner "$source_secret_dir"
```

Securely copy the approved workbook to a temporary server path with SFTP/SCP.
For example, from the maintainer laptop (replace the placeholders):

```powershell
scp "D:\path\to\Farmers data.xlsx" <server-user>@<server-address>:/tmp/rfly-farmers.xlsx
```

Then move it into the private input directory on the server. Do not copy it into
the repository or GitHub:

```bash
install -m 0400 -o rflyrunner -g rflyrunner \
  /tmp/rfly-farmers.xlsx "$input_dir/farmers.xlsx"
rm -f /tmp/rfly-farmers.xlsx
```

## 3. Create/stage the importer key

The key file must contain exactly 32 bytes encoded as 64 hexadecimal characters
(a trailing newline is allowed). Never print the key.

```bash
set -euo pipefail

key_source=/opt/client-demo-app/secrets/import_staging_key
key_staged=/home/rflyrunner/actions-runner/_work/RFLY/_rfly-deploy-secrets/rfly-onprem-demo/import_staging_key

if ! test -e "$key_source"; then
  umask 077
  openssl rand -hex 32 > "$key_source"
fi

test "$(tr -d '\r\n' < "$key_source" | wc -c)" -eq 64 || {
  echo 'ERROR: Import key is not 64 hexadecimal characters' >&2
  exit 1
}
tr -d '\r\n' < "$key_source" | grep -Eq '^[0-9a-fA-F]{64}$' || {
  echo 'ERROR: Import key is not hexadecimal' >&2
  exit 1
}

install -m 0400 -o rflyrunner -g rflyrunner "$key_source" "$key_staged"
```

Do not regenerate this key after `prepare`; the encrypted staged payload would
become unreadable.

## 4. Build the production import environment

Run from the current Actions checkout. This runtime file is private and
temporary:

```bash
set -euo pipefail
cd /home/rflyrunner/actions-runner/_work/RFLY/RFLY

secret_dir=/home/rflyrunner/actions-runner/_work/RFLY/_rfly-deploy-secrets/rfly-onprem-demo
input_dir=/home/rflyrunner/actions-runner/_work/RFLY/_rfly-import-input/rfly-onprem-demo

cp /opt/client-demo-app/deployment.env .import-production.env
chmod 0600 .import-production.env

sed -i \
  -e "s|^DB_PASSWORD_FILE=.*|DB_PASSWORD_FILE=$secret_dir/db_password|" \
  -e "s|^RECOVERY_HASH_SECRET_FILE=.*|RECOVERY_HASH_SECRET_FILE=$secret_dir/recovery_hash_secret|" \
  -e "s|^OTP_HASH_SECRET_FILE=.*|OTP_HASH_SECRET_FILE=$secret_dir/otp_hash_secret|" \
  -e "s|^IMPORT_STAGING_KEY_FILE=.*|IMPORT_STAGING_KEY_FILE=$secret_dir/import_staging_key|" \
  -e "s|^IMPORT_WORKBOOK_DIRECTORY=.*|IMPORT_WORKBOOK_DIRECTORY=$input_dir|" \
  .import-production.env

grep -q '^DEPLOYMENT_NAME=rfly-onprem-demo$' .import-production.env || {
  echo 'ERROR: Refusing a non-production deployment name' >&2
  exit 1
}

compose=(
  docker compose
  --env-file .import-production.env
  -f compose.production.yml
  -f compose.onprem-demo.yml
  -f compose.import.yml
  -f compose.snap-import.yml
)

"${compose[@]}" config --quiet
"${compose[@]}" build importer importer-preflight
```

If the shell session closes, rerun this section to recreate the `compose` array.

## 5. Offline preflight

```bash
farmer_file=/imports/input/farmers.xlsx

"${compose[@]}" run --rm --no-deps \
  importer-preflight \
  preflight \
  --file "$farmer_file"
```

Stop unless the command reports `accepted: true`, 745 CRM rows, 1,219 Google
Forms rows, and 1,964 total rows.

## 6. Resolve the single production Admin

Do not hardcode a user ID from staging or chat history:

```bash
db_container=$("${compose[@]}" ps -q db)
test -n "$db_container" || { echo 'ERROR: Production DB container not found' >&2; exit 1; }

admin_rows=$(docker exec -i "$db_container" \
  psql -U rfly_demo -d rfly_demo -At \
  -c 'SELECT id FROM "User" WHERE role = '\''ADMIN'\'' AND active = true ORDER BY "createdAt";')

admin_count=$(printf '%s\n' "$admin_rows" | sed '/^$/d' | wc -l)
test "$admin_count" -eq 1 || {
  echo "ERROR: Expected exactly one active production Admin; found $admin_count" >&2
  exit 1
}
admin_id=$(printf '%s\n' "$admin_rows" | sed '/^$/d')
unset admin_rows
```

## 7. Prepare and review—no production records are written yet

```bash
"${compose[@]}" run --rm --no-deps \
  importer \
  prepare \
  --file "$farmer_file" \
  --actor "$admin_id" \
  --retention-days 7
```

Copy the returned batch UUID into this shell only:

```bash
batch_id='PASTE-THE-NEW-PRODUCTION-BATCH-UUID'
```

Then obtain the safe report:

```bash
"${compose[@]}" run --rm --no-deps importer report --batch "$batch_id"
```

Stop unless totals match the proven source expectations, rejected/review rows
are both zero, the target outcomes are historical records/village visits, and
the customer matching result is reasonable for the existing production data.

## 8. Record counts and create a verified production backup

```bash
docker exec -i "$db_container" psql -U rfly_demo -d rfly_demo -c '
  SELECT '\''Customers before import'\'' AS item, COUNT(*) FROM "Customer"
  UNION ALL SELECT '\''Leads before import'\'', COUNT(*) FROM "Lead"
  UNION ALL SELECT '\''Historical services before import'\'', COUNT(*) FROM "HistoricalServiceRecord"
  UNION ALL SELECT '\''Village visits before import'\'', COUNT(*) FROM "VillageVisit";
'

backup_dir=/opt/client-demo-app/backups/manual-farmer-import
install -d -m 0700 "$backup_dir"
backup_stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$backup_dir/rfly-production-before-farmer-import-${backup_stamp}.dump"

"${compose[@]}" exec -T db pg_dump \
  -U rfly_demo -d rfly_demo \
  --format=custom --no-owner --no-privileges > "$backup_file"

test -s "$backup_file" || { echo 'ERROR: Backup is empty' >&2; exit 1; }
"${compose[@]}" exec -T db pg_restore --list < "$backup_file" >/dev/null
chmod 0600 "$backup_file"
backup_sha=$(sha256sum "$backup_file" | awk '{print $1}')
backup_ref="backup-${backup_stamp}-${backup_sha:0:32}"
printf 'Verified backup: %s\nSHA-256: %s\n' "$backup_file" "$backup_sha"
```

Copy the backup to the approved encrypted off-host location before approval.
The short `backup_ref` is evidence metadata; it is not the backup itself.

## 9. Approve, commit, and verify

Approval is not a write of customer outcomes. Commit is the guarded atomic
write. Run them separately and inspect each result:

```bash
"${compose[@]}" run --rm --no-deps importer approve \
  --batch "$batch_id" \
  --admin "$admin_id" \
  --approval-ref "PRODUCTION-FARMER-IMPORT-${batch_id:0:8}" \
  --backup-ref "$backup_ref" \
  --deployment rfly-onprem-demo

"${compose[@]}" run --rm --no-deps importer commit \
  --batch "$batch_id" \
  --confirm "COMMIT_IMPORT_${batch_id}" \
  --deployment rfly-onprem-demo

"${compose[@]}" run --rm --no-deps importer verify --batch "$batch_id"
```

Completion is acceptable only when verification reports `ok: true`,
`consistent: true`, 1,924 imported rows, 40 skipped rows, zero incomplete or
unexpected outcomes, and a matching reconciliation checksum.

## 10. Post-import application checks

```bash
curl -fsS http://127.0.0.1:8088/healthz
echo
curl -fsS http://127.0.0.1:8088/api/health
echo

docker exec -i "$db_container" psql -U rfly_demo -d rfly_demo -c '
  SELECT '\''Customers'\'' AS item, COUNT(*) FROM "Customer"
  UNION ALL SELECT '\''Leads'\'', COUNT(*) FROM "Lead"
  UNION ALL SELECT '\''Historical services'\'', COUNT(*) FROM "HistoricalServiceRecord"
  UNION ALL SELECT '\''Village visits'\'', COUNT(*) FROM "VillageVisit";
'
```

In the UI, search three approved sample phone numbers from different source
sections and confirm customer auto-fill works. Confirm the import did not create
live Leads and existing customer records remain intact. Record only counts and
pass/fail evidence—never phone numbers or farmer details.

## 11. Closeout

```bash
rm -f .import-production.env
unset admin_id batch_id backup_sha backup_ref
```

Keep the verified backup under the retention policy. Remove the server-side
workbook only after acceptance and approved secure archival. After the batch's
`rawRetentionUntil` time, purge encrypted staged payloads with the exact guarded
phrase:

```bash
"${compose[@]}" run --rm --no-deps importer purge \
  --batch "$batch_id" \
  --actor "$admin_id" \
  --confirm "PURGE_IMPORT_${batch_id}"
```

Recreate the `compose` array and set `batch_id`/`admin_id` again if purging in a
later session. Purge will not erase committed customers or historical outcomes.

## Prohibited shortcuts

- Do not run `prisma db push`, `prisma migrate reset`, seed/demo scripts, or the
  initial-Admin bootstrap.
- Do not restore staging into production.
- Do not use raw `INSERT`, `UPDATE`, `DELETE`, ad-hoc `.js`, or `node -e` data
  mutations.
- Do not approve a batch without a readable backup and off-host copy.
- Do not reuse staging Admin IDs, batch IDs, approval references, or encryption
  keys.
- Do not combine the drone import with this farmer migration.

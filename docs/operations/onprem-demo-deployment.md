# On-premises demo deployment runbook

> Operational record: this adapts the current containerized application to the shared office server described in [SERVER_HANDOFF_FOR_CODEX.md](../SERVER_HANDOFF_FOR_CODEX.md). It is not production approval and does not replace the canonical plan in [docs/plan/AGENTS.md](../plan/AGENTS.md).

## Safety boundary

The office server is not empty. Do not reinstall Ubuntu, rename the host, change the `akdev` account, restart Docker, stop the `srs` container, reconfigure Jitsi/Nginx, alter existing databases, flush firewall rules, or run global Docker cleanup.

The first demo path deliberately avoids existing Nginx/Jitsi and binds only the new Compose frontend to host port `8088`.

```text
Browser
  -> http://172.20.96.10:8088 or http://PUBLIC_IP:8088
  -> Docker published port 8088
  -> frontend container
  -> backend container
  -> isolated PostgreSQL container/volume
```

Use this direct HTTP path only for a controlled demo. Real production still requires the HTTPS/proxy production runbook.

## Required local inputs

- Current repository source at the commit being demonstrated.
- SSH access as `waseem`, then `sudo -i`.
- Confirmation that TCP port `8088` is still free.
- Router port-forwarding only if public internet access is required.
- Secret files generated on the server, never pasted into chat or committed.

## Prepare the server

Log in from the office LAN:

```sh
ssh waseem@172.20.96.10
sudo -i
```

Confirm state without changing services:

```sh
date
hostnamectl
df -h
free -h
docker info
docker ps
ss -lntup | grep ':8088 ' || echo "Port 8088 is free"
systemctl is-active nginx prosody jicofo jitsi-videobridge2 mssql-server || true
```

If `8088` is occupied, stop and choose another verified-free port. Do not stop the occupying process without approval.

## Place the release

Use `/opt/client-demo-app`; do not use `/root` as the long-term project location.

```sh
mkdir -p /opt/client-demo-app/app /opt/client-demo-app/secrets /opt/client-demo-app/deployment-notes
chown -R waseem:waseem /opt/client-demo-app
chmod 0700 /opt/client-demo-app/secrets
```

Copy or clone the repository into:

```text
/opt/client-demo-app/app
```

Generate secret files on the server:

```sh
umask 077
openssl rand -base64 36 > /opt/client-demo-app/secrets/db_password
openssl rand -base64 48 > /opt/client-demo-app/secrets/recovery_hash_secret
openssl rand -base64 48 > /opt/client-demo-app/secrets/otp_hash_secret
chmod 0400 /opt/client-demo-app/secrets/*
```

Copy [deploy/onprem-demo.env.example](../../deploy/onprem-demo.env.example) to:

```text
/opt/client-demo-app/deployment.env
```

Review it locally on the server. Add `http://PUBLIC_IP:8088` to `CORS_ALLOWED_ORIGINS` only after the current public IP is verified and public access is required. Do not add `*`.

## Build and start

From the repository directory:

```sh
cd /opt/client-demo-app/app
docker compose --env-file /opt/client-demo-app/deployment.env \
  -f compose.production.yml -f compose.onprem-demo.yml config --quiet

docker compose --env-file /opt/client-demo-app/deployment.env \
  -f compose.production.yml -f compose.onprem-demo.yml up --detach --build --wait --wait-timeout 240
```

The stack uses an isolated PostgreSQL container and volume scoped by `DEPLOYMENT_NAME`. It must not connect to the server's existing PostgreSQL, MariaDB, Microsoft SQL Server, MongoDB, or Redis services.

## Verify

Local and LAN checks:

```sh
curl -fsS http://127.0.0.1:8088/healthz
curl -fsS http://127.0.0.1:8088/api/health
curl -fsS http://172.20.96.10:8088/healthz

docker compose --env-file /opt/client-demo-app/deployment.env \
  -f compose.production.yml -f compose.onprem-demo.yml ps

docker ps --filter name=rfly-onprem-demo
docker ps --filter name=srs
```

The `srs` container must still be up. Existing Jitsi services must remain in their prior state.

If public access is required, verify the current public IP from the server:

```sh
curl -4 https://api.ipify.org
echo
```

Then test from mobile data:

```text
http://PUBLIC_IP:8088
```

If LAN works but mobile/public access fails, the usual missing piece is router forwarding:

```text
TCP external 8088 -> 172.20.96.10:8088
```

Do not claim public deployment success until the mobile-data test passes.

## Demo account bootstrap

Do not run development seed data for handover-style demos. Use the guarded initial-Admin procedure only after confirming the demo database is the isolated Compose database:

```sh
docker compose --env-file /opt/client-demo-app/deployment.env \
  -f compose.production.yml -f compose.onprem-demo.yml run --rm \
  -e CONFIRM_DATABASE_WIPE=RESET_TO_INITIAL_ADMIN \
  -e INITIAL_ADMIN_NAME="Approved Admin Name" \
  -e INITIAL_ADMIN_EMAIL="approved-admin@example.invalid" \
  -e INITIAL_ADMIN_PASSWORD \
  backend node scripts/bootstrapInitialAdmin.js
```

Supply `INITIAL_ADMIN_PASSWORD` from the shell environment or a protected operator prompt. Never write it into Git, docs, or chat. Replace placeholder identity values locally.

## Rollback only this app

```sh
cd /opt/client-demo-app/app
docker compose --env-file /opt/client-demo-app/deployment.env \
  -f compose.production.yml -f compose.onprem-demo.yml down
```

This stops only the new demo stack. Do not use `docker system prune`, do not remove unrelated images, and do not stop `srs`.

If a firewall or router rule was added for the demo, remove only that specific rule after preserving evidence.

## Change record

Append every demo deployment attempt to:

```text
/opt/client-demo-app/deployment-notes/CHANGELOG.md
```

Record:

- date/time and operator;
- repository commit hash;
- Compose files used;
- host port and container port;
- image names/tags/digests where available;
- non-secret environment variable names;
- firewall/router changes requested or made;
- local, LAN, and public test results;
- rollback command used or planned;
- unresolved blockers.

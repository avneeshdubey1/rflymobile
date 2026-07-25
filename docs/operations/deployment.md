# Isolated deployment runbook

> **Operational record:** this runbook describes the current Compose baseline. The current product and release contract is in [docs/plan/AGENTS.md](../plan/AGENTS.md). Do not treat legacy application behaviour as production approval.

## Scope and safety boundary

This foundation packages the current application, migration tooling, reverse proxy, and PostgreSQL into separate containers. It does not by itself approve provider integrations, privacy wording, business configuration, alert ownership, or production launch.

The selected customer-isolation model is **one complete application stack and database per company**. A future exported/customized installation gets its own deployment; it does not share tables with another customer.

```text
Approved HTTPS edge / load balancer
                 |
         loopback/private port
                 |
        frontend Nginx container
          |                   |
       /api                /socket.io
          +-------- backend container -------- provider egress
                         |
                  private data network
                         |
                  PostgreSQL container

One-shot migration container also joins only the private data network.
```

Only the Nginx frontend publishes a host port. PostgreSQL, the backend, and the migration service have no published ports. The PostgreSQL network is marked internal. The backend and Nginx run as unprivileged users with read-only root filesystems, dropped Linux capabilities, bounded temporary storage, resource defaults, and rotated container logs.

## Inputs required before a real deployment

- A unique, customer-neutral deployment identifier.
- Approved HTTPS domain and TLS termination point.
- Exact number of trusted proxy hops from Nginx to the public TLS edge. The provided topology defaults to two: Nginx plus one TLS proxy.
- An absolute host directory for secret files, outside the source checkout.
- Immutable backend, migration, frontend, and PostgreSQL image references approved by the deployment owner. Pin registry images by digest after vulnerability scanning; `postgres:16-alpine` in the example is a local starting point, not an immutable release pin.
- Hosting region, backup destination, monitoring service, alert recipients, RPO/RTO, and maintenance owner.
- An approved guarded initial-Admin provisioning procedure. Do **not** run the development seed against production. The current bootstrap must be executed only through an approved deployment procedure; containerized production bootstrap work remains a launch gate until verified.

## Prepare one company installation

Run these commands on the Linux deployment host as its deployment administrator. Replace the example path and identifier locally.

```sh
sudo install -d -m 0700 /etc/field-operations/company-installation/secrets
sudo sh -c 'umask 077; openssl rand -base64 36 > /etc/field-operations/company-installation/secrets/db_password'
sudo sh -c 'umask 077; openssl rand -base64 48 > /etc/field-operations/company-installation/secrets/recovery_hash_secret'
sudo chmod 0400 /etc/field-operations/company-installation/secrets/*
```

Copy `deploy/example.env` to an access-controlled path outside the checkout, such as `/etc/field-operations/company-installation/deployment.env`. Set:

- a unique `DEPLOYMENT_NAME`;
- an immutable `IMAGE_TAG` or digest-based image references;
- the approved HTTPS `CORS_ALLOWED_ORIGINS`;
- only approved HTTPS `MAP_FRAME_ORIGINS` (OpenStreetMap is the current map-frame provider);
- absolute `DB_PASSWORD_FILE` and `RECOVERY_HASH_SECRET_FILE` paths;
- non-secret database identifiers;
- measured resource limits.

Do not place secret values in the environment file. Do not email, paste, commit, or log the secret files.

## Validate before changing runtime state

From the repository release directory:

```sh
export DEPLOY_ENV=/etc/field-operations/company-installation/deployment.env
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml config --quiet
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml build --pull
```

For registry releases, pull images by immutable tag/digest instead of building on the host. Preserve the image digests in the release record.

Before upgrading an existing installation, take and verify a backup according to [backup and restore](backup-restore.md).

## Controlled migration and start

The migration image contains the Prisma CLI; the long-running backend image does not contain development dependencies. The migration container reads the same database password file and exits after `prisma migrate deploy`.

```sh
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml up --no-deps db
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml up --abort-on-container-exit --exit-code-from migrate migrate
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml up --detach backend frontend
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml ps
```

The normal `docker compose up --detach` path also gates backend startup on a successful migration. Running the migration explicitly makes the approval boundary and output visible.

## TLS and proxy requirements

The default host binding is `127.0.0.1:8080`; it is intentionally not a public plaintext endpoint. Terminate TLS at an approved edge and proxy to that private/loopback listener while preserving:

- `Host`;
- `X-Forwarded-For`;
- `X-Forwarded-Proto: https`;
- WebSocket upgrade headers.

Restrict the host firewall so only the TLS edge can reach the frontend listener. Never change `APP_BIND_ADDRESS` to a public interface unless TLS is enforced before any request reaches it. Configure `TRUST_PROXY_HOPS` to the exact topology; too many trusted hops let client-supplied forwarding headers influence security and rate limiting, while too few cause legitimate HTTPS requests to be rejected.

## Verification after start

Use the external HTTPS URL for acceptance:

```sh
curl --fail --silent --show-error https://approved-domain.example/healthz
curl --fail --silent --show-error https://approved-domain.example/api/health
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml ps
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml port db 5432
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml port backend 5000
```

The final two commands must return no published port. Confirm that:

- Nginx and backend health checks are healthy;
- the public production health response contains only overall status;
- an unapproved browser origin is denied;
- an HTTP request is redirected/rejected at the TLS edge and never reaches the application as trusted HTTPS;
- login and one workflow per active role pass using approved non-production/staging accounts;
- Socket.IO chat/location reconnect through the proxy;
- the map disclosure loads only the configured frame provider;
- logs contain request IDs but no passwords, tokens, farmer contact data, chat bodies, payment links, or coordinates.

## Provider secrets

The entrypoint supports `*_FILE` variables for Google Form, UPI webhook, WhatsApp, weather, and UPI gateway credentials. Do not mount any provider secret until its adapter, sandbox verification, rotation owner, failure queue, and launch approval are complete. Missing Google/UPI webhook secrets keep those production endpoints closed.

Add provider secrets through a deployment-specific Compose override stored with deployment configuration, not by editing or committing `compose.production.yml`.

## Routine operations

```sh
# Status and health
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml ps

# Request-ID-oriented logs; never enable request-body logging
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml logs --since 30m frontend backend

# Graceful restart after an approved maintenance notice
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml restart backend frontend

# Stop application traffic while retaining the database
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml stop frontend backend
```

Do not use `docker compose down --volumes` on a real installation. That command deletes the database volume and is reserved for disposable CI/test stacks.

## Evidence to retain per release

- Approved change/release ticket and operator.
- Source revision and immutable image digests.
- Rendered Compose configuration with secret values absent.
- Backup identifier, checksum, encryption/storage confirmation, and restore-test reference.
- Migration output and duration.
- Health, role-workflow, Socket.IO, and browser/device results.
- Monitoring/alert check and rollback decision window.

The portable CI workflow validates source gates and starts a disposable isolated stack. It does not replace production-like staging, physical Android/browser acceptance, provider sandboxes, image scanning, backup restoration, or penetration testing.

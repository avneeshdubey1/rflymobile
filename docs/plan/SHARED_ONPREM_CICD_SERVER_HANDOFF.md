# Shared On-Premises CI/CD Server Handoff

**Status:** reusable implementation handoff
**Last verified against RFLY:** August 12, 2026
**Purpose:** give a future coding/operations agent enough verified context and
guardrails to add CI/CD for another application on the same physical office
server without interfering with RFLY or other workloads.

This is an implementation guide, not authorization to mutate the server. A
future agent must first inventory the live host and the target repository,
replace every placeholder, show the proposed isolation boundaries, and obtain
the maintainer's approval before installing a runner, opening a port, creating
secrets, or deploying an application.

## 1. Non-secret server context

The following was observed during the RFLY deployment. Recheck it because
server state can change.

| Item | Verified value / constraint |
|---|---|
| Public SSH endpoint | `103.238.230.152` (administrative access is separately controlled) |
| Hostname | `meet.broskieshub.com` / machine name `meet` |
| Office LAN address | `172.20.96.10` |
| Operating system | Ubuntu Core 24, Linux x86_64 |
| Capacity observed | 8 CPUs, about 31 GiB RAM, about 90 GiB free disk at the time of inspection |
| Container engine | Snap-packaged Docker; Docker Engine 29.6.1 and Compose 5.3.1 were observed |
| Existing RFLY runner | user `rflyrunner`, runner `meet-rfly-onprem`, label `rfly-onprem` |
| Existing runner service | `actions.runner.Waz00-m-RFLY.meet-rfly-onprem.service` |
| Existing RFLY production | Compose project `rfly-onprem-demo`, host port `8088` |
| Existing RFLY staging | Compose project `rfly-onprem-staging`, LAN host port `8089` |
| Existing RFLY paths | `/opt/client-demo-app` and `/opt/client-staging-app` |
| Existing VPN | OpenVPN is separately managed; do not change its PKI, profiles, routes, or firewall rules as part of application CI/CD |

Never copy credentials, runner registration tokens, `.env` contents, database
dumps, VPN profiles, private keys, or customer data into Git, documentation,
CI logs, issue trackers, or AI chat.

## 2. Architecture decision for another project

Use the same physical server but create a completely separate deployment
boundary:

```text
GitHub-hosted runner
  -> source tests, lint, build, dependency/secret/container scans
  -> successful CI event for staging or main

Dedicated self-hosted CD runner on meet
  -> checkout the exact CI-passed commit
  -> validate environment and port ownership
  -> build/pull immutable images
  -> start only that project's isolated Compose stack
  -> verified database backup (when a database exists)
  -> controlled migration
  -> health checks
  -> non-secret deployment evidence
```

Do not run untrusted pull-request code on the on-premises runner. Source CI
belongs on GitHub-hosted runners. The self-hosted runner is for protected
deployment workflows only.

The existing RFLY runner is repository-scoped and must remain dedicated to
RFLY. For another repository, register a separate repository runner (or a
carefully restricted organization runner) with its own:

- Unix service account;
- runner installation directory;
- systemd service;
- runner label;
- GitHub environment protections;
- deployment paths, secrets, ports, Compose names, volumes and networks.

Docker access is effectively privileged host access. Only trusted deployment
workflows and trusted maintainers may control a self-hosted runner.

## 3. Values that must be decided before implementation

A future agent must obtain or safely propose these values. Never silently copy
RFLY values.

```text
GITHUB_OWNER=<owner-or-organization>
GITHUB_REPOSITORY=<new-private-repository>
APP_SLUG=<lowercase-unique-name>
RUNNER_USER=<dedicated-linux-user>
RUNNER_NAME=<unique-runner-name>
RUNNER_LABEL=<unique-project-deploy-label>
PRODUCTION_COMPOSE_PROJECT=<unique-name>
STAGING_COMPOSE_PROJECT=<unique-name>
PRODUCTION_ROOT=/opt/<app-slug>-production
STAGING_ROOT=/opt/<app-slug>-staging
PRODUCTION_PORT=<unused-approved-port>
STAGING_PORT=<unused-approved-port>
PRODUCTION_BIND_ADDRESS=<approved-address>
STAGING_BIND_ADDRESS=172.20.96.10
PRODUCTION_DOMAIN=<domain-or-explicit-temporary-IP-decision>
DATABASE_NAME=<unique-production-database-name>
DATABASE_USER=<unique-production-database-user>
BACKUP_OWNER=<named-person-or-role>
ALERT_OWNER=<named-person-or-role>
```

Recommended branch flow:

```text
dev -> pull request -> staging -> maintainer promotion -> main
```

- CI runs on `dev`, `staging`, `main`, and pull requests.
- `staging` auto-deploys only after its exact commit passes CI.
- `main` auto-deploys only after its exact commit passes CI.
- Protect `staging` and `main`; require CI, prevent force pushes and require
  maintainer review.
- Use GitHub Environments named for this project, such as
  `<app>-staging` and `<app>-production`. Production may require approval.

## 4. Mandatory initial discovery

Run read-only checks before choosing paths or ports:

```bash
hostnamectl
docker version
docker compose version
docker info
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker network ls
docker volume ls
systemctl list-unit-files --type=service | grep -i 'actions.runner' || true
systemctl list-units --all --type=service | grep -i 'actions.runner' || true
ss -lntup
ip -brief -4 address
df -h
free -h
```

For each proposed port, verify both Docker and non-Docker listeners:

```bash
candidate_port='<PORT>'
docker ps --filter "publish=${candidate_port}"
ss -lntup | grep ":${candidate_port} " || echo "Port appears free"
```

Stop if the proposed path, Compose project name, volume, network, database
name, runner directory, service name or port overlaps an existing workload.
Never stop or remove an unrelated container to make room.

## 5. Repository preparation contract

The other application is currently monolithic. CI can be added now, but CD
must not be enabled until the application has a reviewed container contract.

Minimum repository components:

```text
.github/workflows/ci.yml
.github/workflows/onprem-staging-deploy.yml
.github/workflows/onprem-production-deploy.yml
compose.production.yml
compose.onprem-staging.yml
compose.onprem-production.yml
deploy/onprem-selfhosted-deploy.sh
deploy/staging.env.example
deploy/production.env.example
Dockerfile(s)
.dockerignore
```

Container requirements:

- immutable application image per source commit;
- non-root runtime user;
- read-only filesystem where practical;
- capabilities dropped;
- explicit health checks;
- bounded CPU/memory and rotated logs;
- no source bind mounts in staging or production;
- database and internal API ports not published to the host;
- only the approved web/reverse-proxy port published;
- named volumes unique to the Compose project;
- separate staging and production databases/volumes;
- secrets supplied through root-owned external files or an approved secret
  manager, never embedded in images or Compose source;
- migrations implemented as an idempotent one-shot container;
- no seed, demo-account, database-wipe, `db push`, or destructive bootstrap in
  a normal deployment.

The Snap Docker engine on this host rejected process launch when
`no-new-privileges:true` was set. Keep that protection in the portable base
Compose file, then use a host-specific overlay to reset only this unsupported
option:

```yaml
services:
  migrate:
    security_opt: !reset []
  backend:
    security_opt: !reset []
  frontend:
    security_opt: !reset []
```

Do not broadly remove non-root users, `cap_drop`, read-only filesystems,
network isolation or resource limits. Retest this workaround after any Docker
installation change.

## 6. CI workflow requirements

The CI workflow should use GitHub-hosted Ubuntu runners and include checks
appropriate to the stack. At minimum:

1. deterministic dependency installation from lockfiles;
2. formatting/linting and static analysis;
3. unit and integration tests;
4. production frontend/backend build;
5. database schema validation and a disposable migration replay, if relevant;
6. dependency audit and secret scanning;
7. container build and health test;
8. proof that database/internal services do not publish host ports;
9. cleanup of all disposable containers and volumes; and
10. branch protection requiring the CI result.

For container release evidence, build each runtime target, block fixable
`HIGH`/`CRITICAL` findings, publish immutable images by commit SHA, generate an
SBOM and retain image digest evidence. Do not disable a failing scan merely to
deploy.

## 7. CD workflow safety pattern

Staging and production deployment workflows should be triggered by
`workflow_run` only after the named CI workflow succeeds on the corresponding
branch. They must:

1. run only on the dedicated project runner label;
2. use a per-project/per-environment concurrency group;
3. check out `github.event.workflow_run.head_sha`;
4. fetch the current protected branch and refuse deployment if the successful
   CI SHA is no longer its tip;
5. run the committed deployment script rather than inline improvisation;
6. use different external environment/secret paths for staging and production;
7. record the source SHA and non-secret verification evidence; and
8. never seed or import customer data automatically.

Persistent self-hosted workspaces can retain a stale Git `.lock` file after an
interrupted job. Before `actions/checkout`, this host uses a narrowly scoped
recovery step:

```yaml
- name: Recover stale checkout locks
  shell: bash
  run: |
    set -euo pipefail
    git_directory="${GITHUB_WORKSPACE}/.git"
    if [ -d "$git_directory" ]; then
      find "$git_directory" -type f -name '*.lock' -print -delete
    fi
```

Use it only because a runner executes one job at a time in its workspace. Do
not delete the checkout, `.git`, application data or arbitrary lock files.

## 8. Dedicated runner installation

Create a separate user and runner directory. Replace placeholders first.

```bash
adduser --disabled-password --gecos '' <RUNNER_USER>
install -d -m 0750 -o <RUNNER_USER> -g <RUNNER_USER> \
  /home/<RUNNER_USER>/actions-runner
```

Download the current runner archive using the exact commands shown by GitHub:

```text
Repository -> Settings -> Actions -> Runners -> New self-hosted runner
```

Verify the published checksum. Extract as the runner user. Generate a fresh,
short-lived registration token from GitHub and enter it only on the server;
never paste it into chat or commit it.

Run configuration as the non-root runner user:

```bash
su - <RUNNER_USER>
cd /home/<RUNNER_USER>/actions-runner
./config.sh \
  --url https://github.com/<GITHUB_OWNER>/<GITHUB_REPOSITORY> \
  --token '<FRESH_TOKEN>' \
  --name '<RUNNER_NAME>' \
  --labels '<RUNNER_LABEL>' \
  --unattended
exit
```

Install the system service as root:

```bash
cd /home/<RUNNER_USER>/actions-runner
./svc.sh install <RUNNER_USER>
./svc.sh start
./svc.sh status
```

Confirm GitHub shows the runner as `Idle`. Record the generated systemd unit
name and verify it is enabled so it returns after reboot:

```bash
systemctl list-unit-files --type=service | grep -i 'actions.runner'
systemctl is-enabled '<GENERATED_RUNNER_SERVICE>'
systemctl is-active '<GENERATED_RUNNER_SERVICE>'
```

Grant Docker access only after explicitly accepting that this user can control
the host. The correct method depends on the installed Snap Docker
configuration; inspect the working RFLY runner's access rather than assuming a
`docker` group exists. Validate as the new user:

```bash
su - <RUNNER_USER> -c 'docker info >/dev/null && docker compose version'
```

## 9. External deployment directories and secrets

Use unique external roots:

```bash
install -d -m 0750 -o <RUNNER_USER> -g <RUNNER_USER> \
  /opt/<APP_SLUG>-staging \
  /opt/<APP_SLUG>-production

install -d -m 0700 -o <RUNNER_USER> -g <RUNNER_USER> \
  /opt/<APP_SLUG>-staging/secrets \
  /opt/<APP_SLUG>-staging/backups \
  /opt/<APP_SLUG>-production/secrets \
  /opt/<APP_SLUG>-production/backups
```

Create staging and production secrets independently. Use restrictive modes:

```bash
chmod 0600 /opt/<APP_SLUG>-*/deployment.env
chmod 0400 /opt/<APP_SLUG>-*/secrets/*
chown -R <RUNNER_USER>:<RUNNER_USER> /opt/<APP_SLUG>-staging /opt/<APP_SLUG>-production
```

Environment files contain configuration references, not committed secrets.
They must define unique deployment names, bind addresses, ports, databases,
secret-file paths, image tags and resource limits. Keep example files in Git
with placeholders only.

## 10. Deployment script contract

The committed script should fail closed and perform this order:

1. validate required environment and secret files;
2. validate Compose rendering;
3. verify Docker access and that external secret files are mountable;
4. verify the host port is free or belongs to this exact Compose project;
5. set the image tag to the checked-out source SHA;
6. build or pull immutable images;
7. start and health-check the database, if present;
8. create a PostgreSQL custom-format backup outside the checkout;
9. verify the backup with `pg_restore --list` and calculate SHA-256;
10. run the one-shot migration container;
11. start application services without recreating unrelated workloads;
12. verify `/healthz` and the application/database health endpoint;
13. append non-secret deployment evidence and rollback guidance; and
14. on failure, print bounded diagnostics without exposing secrets.

Application deployment must preserve named volumes. Never use `down --volumes`,
`docker volume prune`, database initialization, demo seeds or a wipe command in
CD.

## 11. Network exposure

- Staging should bind only to `172.20.96.10` or another approved internal
  interface and be reachable through the managed split-tunnel VPN if remote
  testing is required.
- Do not reuse RFLY ports `8088` or `8089`.
- Do not expose PostgreSQL, Redis, internal APIs, message brokers or admin
  dashboards publicly.
- A temporary public-IP HTTP deployment is not a production security baseline.
  Prefer a client-approved domain, TLS reverse proxy and explicit trusted-proxy
  configuration before broader use.
- Firewall changes must name the exact source network and port and must not
  alter OpenVPN or unrelated application rules.

## 12. First deployment sequence

1. Push CI/containerization work to `dev`.
2. Require green CI and review.
3. Promote the exact accepted SHA to `staging`.
4. Confirm staging CD uses the isolated staging environment and port.
5. Run application acceptance, restart persistence and backup/restore evidence.
6. Protect `main` and configure the production GitHub Environment.
7. Promote the exact staging SHA to `main`.
8. Confirm CI succeeds.
9. Confirm production CD creates a backup, applies migration once and passes
   both health endpoints.
10. Verify existing workloads, especially RFLY `8088` and `8089`, remain
    healthy and unchanged.

Never test a destructive migration first on the production database.

## 13. Rollback and incident rules

- Keep the prior immutable image/source SHA available.
- Prefer application rollback to the prior compatible image.
- Database migrations should be additive and backward compatible across the
  rollback window.
- Do not automatically restore a database backup merely because a deployment
  fails. Restore only for verified data corruption through an
  outage-controlled, approved procedure.
- A failed migration must prevent new application containers from replacing
  the healthy prior version.
- Preserve and checksum pre-migration backups outside the repository.
- Record who owns incident response, rollback approval, backups and alerts.

## 14. Acceptance checklist

- [ ] New repository has protected `dev`, `staging` and `main` flow.
- [ ] CI runs on GitHub-hosted runners and is required by branch protection.
- [ ] Dedicated on-prem runner is online, enabled after reboot and restricted
      to protected CD workflows.
- [ ] Runner/service account, label and directories do not overlap RFLY.
- [ ] Staging and production Compose projects, ports, volumes, networks,
      databases and secret files are unique.
- [ ] Snap Docker compatibility is narrow and documented.
- [ ] Containers run non-root with remaining hardening controls.
- [ ] Database/internal ports are not published.
- [ ] Staging is internally bound and production exposure is approved.
- [ ] Successful CI SHA is exactly the deployed SHA.
- [ ] Pre-migration backup is non-empty, readable and checksummed.
- [ ] Migrations are idempotent and do not seed, wipe or silently import data.
- [ ] Health checks pass after deployment and after server/runner restart.
- [ ] Release images have no fixable high/critical findings and have SBOM and
      digest evidence.
- [ ] RFLY and every unrelated workload remain healthy.
- [ ] Rollback has been rehearsed without touching live customer data.

## 15. Prompt to give a future coding agent

Attach this file and use the following request:

> Implement a safe CI/CD framework for `<GITHUB_OWNER>/<GITHUB_REPOSITORY>` on
> the shared office server described in this handoff. First inspect the target
> repository and perform only read-only server/repository discovery. Produce a
> concrete isolation table for runner user/service/label, staging and
> production paths, Compose projects, ports, volumes, networks, databases and
> GitHub Environments. Do not reuse or modify RFLY resources. Add GitHub-hosted
> CI first. Containerize the monolith with non-root runtime, health checks,
> isolated networks, external secrets, additive migrations and verified
> backups. Add staging and production `workflow_run` deployment workflows that
> deploy only the exact successful CI SHA using a dedicated self-hosted runner.
> Account for Snap Docker's `no-new-privileges` incompatibility only in the
> server-specific overlay. Test locally and in isolated staging before
> production. Never put credentials/customer data in Git or chat, never seed or
> wipe an established database, never expose database/internal ports, and stop
> for maintainer approval before runner installation, firewall changes, first
> staging deployment or production promotion. Report every changed file,
> command needed from the maintainer, test result, deployment evidence and
> rollback path.

One prompt can direct the work, but it cannot safely supply unknown application
details, credentials, GitHub permissions, ports or approval. Those must be
discovered and confirmed during execution.

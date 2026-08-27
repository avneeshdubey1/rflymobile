# RFLY CI/CD Operations Context

**Status:** current implementation handoff
**Reviewed:** August 25, 2026
**Scope:** the RFLY web stack, guarded importer images, Pilot and Operations
Android artifacts, and the office on-premises delivery path.

This is a description of the workflows that are committed in this repository.
It is not authority to modify server secrets, import data, change VPN rules, or
deploy an unreviewed branch.

## 1. Branch flow and deployment boundary

```text
developer work
  -> dev
  -> reviewed pull request
  -> staging
  -> reviewed maintainer promotion
  -> main

staging CI succeeds -> automatic internal staging deployment
main CI succeeds    -> automatic office production deployment
```

CI runs on pull requests and pushes to `dev`, `staging`, and `main`. A green
CI run is necessary but does not by itself import customer data, create demo
accounts, seed a database, or wipe anything.

`staging` is the internal stack, currently `rfly-onprem-staging` on office-LAN
port 8089. `main` is the current live stack, historically named
`rfly-onprem-demo`, on port 8088. The historical word `demo` in the production
Compose project name must not be interpreted as permission to seed or reset it.

## 2. Workflows and their responsibilities

| Workflow file | Trigger | Execution location | Responsibility |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR or push to `dev`, `staging`, `main` | GitHub-hosted Ubuntu runners, except the staging APK job | Validates source, dependencies, tests and a disposable isolated Compose stack. |
| `.github/workflows/onprem-staging-deploy.yml` | Successful `application-and-container-gates` run for `staging` | Dedicated RFLY self-hosted office runner | Deploys the exact current staging commit internally. |
| `.github/workflows/onprem-deploy.yml` | Successful `application-and-container-gates` run for `main` | Dedicated RFLY self-hosted office runner | Deploys the exact current `main` commit to the office production stack. |
| `.github/workflows/release-images.yml` | Successful `application-and-container-gates` run for `main` | GitHub-hosted Ubuntu runners | Builds, scans, publishes commit-addressed GHCR images and keeps SBOM/image-digest evidence. It runs alongside production CD; production CD currently builds the exact source locally and does not pull these GHCR images. |
| `.github/workflows/operations-production-apk.yml` | Maintainer dispatch from `main` with the exact deployed SHA and confirmation phrase | Dedicated RFLY self-hosted office runner | Verifies that the matching production web revision is healthy, then builds a separate internal Operations APK pointed at the production endpoint. |
| `.github/workflows/pilot-production-apk.yml` | Maintainer dispatch from `main` with the exact deployed SHA and confirmation phrase | Dedicated RFLY self-hosted office runner | Verifies the matching production revision, mobile-API activation and health before building a separate internal Pilot APK pointed at production. |

The authoritative reusable server isolation guidance is
[SHARED_ONPREM_CICD_SERVER_HANDOFF.md](SHARED_ONPREM_CICD_SERVER_HANDOFF.md).

## 3. Hosted CI: `application-and-container-gates`

### Backend job

Runs on a fresh GitHub-hosted Ubuntu runner with an ephemeral PostgreSQL 16
service. It installs lockfile-pinned dependencies, generates per-run test
secrets, audits dependencies, validates Prisma, applies migrations to the
throwaway database, enables test-only history cleanup, seeds test-only data,
and runs the backend test suite serially. The database disappears with the CI
runner.

### Frontend job

Installs from `frontend/package-lock.json`, performs the configured production
dependency audit, runs ESLint, and creates a same-origin Vite production build.
It does not deploy browser assets.

### Pilot mobile job

Installs the Pilot Expo/React Native dependencies from the lockfile, performs
the configured audit, then runs TypeScript checks, Jest tests, and Expo Doctor.
The CI API URL is a non-routable test address; this job does not contact the
office server.

### Isolated container-stack job

Runs only after backend, frontend and Pilot mobile checks succeed. It creates
fresh temporary secret files and an ephemeral deployment environment, validates
the rendered Compose configurations, builds the application and importer image
targets, starts a disposable stack, and checks `/healthz` and `/api/health`.
It also proves the database and backend do not publish host ports.

The job verifies both importer boundaries:

- Farmer importer preflight has no network, database dependency or secrets.
- Client-master importer preflight has the same no-network/no-secret boundary.
- Commit-capable importers receive only their required internal network and
  file-mounted secrets.

The job uses intentionally invalid workbooks to prove both preflight commands
reject invalid input safely. It removes the disposable stack and volumes even
when a check fails.

## 4. Android APK evidence

The `pilot-staging-apk` job is part of `ci.yml`. It runs only for a successful
push to `staging`, after the backend, frontend, Pilot mobile and isolated stack
jobs. It runs on the trusted office runner because Android SDK/Gradle builds are
too resource-intensive for the normal hosted workflow budget.

It checks out the current staging tip, verifies it is not stale, installs pinned
Android SDK components, re-runs Pilot source checks, prebuilds a clean native
Android project, and produces an arm64 standalone release APK. It verifies:

- the package is `com.rfly.pilot.staging`;
- the APK signature is structurally valid;
- foreground fine location is present; and
- prohibited background/storage/overlay permissions are absent.

The artifact contains its checksum and build metadata, including its source SHA
and staging API address. GitHub retains it for seven days. It is an internally
debug-signed staging APK: it is not automatically installed, not served by the
web stack, and not a Play Store release. Metro is not required to run it.

The `operations-staging-apk` job follows the same exact-SHA and seven-day
evidence boundary for the separate Expo/React Native Operations Companion. It
runs the Operations TypeScript, Jest, Expo Doctor and critical dependency
gates again on the office runner, generates a clean Android project, and
produces `com.rfly.operations.staging` pointed at the VPN/LAN staging URL. It
also verifies the signature, embedded staging endpoint and prohibited Android
permission boundary before uploading the artifact.

The separate `operations-production-apk` workflow is deliberately manual. It
must be dispatched from `main` with the full current `main` SHA and the explicit
confirmation phrase. It refuses to build unless the office production frontend
container uses that exact SHA and both production health endpoints respond. It
then produces `com.rfly.operations`, pointed at the temporary production HTTP
endpoint. This remains an internal, debug-signed artifact, not a Play release,
until company signing custody, Play ownership, a domain and HTTPS are approved.

The separate `pilot-production-apk` workflow has the same explicit dispatch,
exact-current-`main` and matching-deployed-image boundary. It additionally
refuses to build unless the production backend container has
`MOBILE_API_ENABLED=true`. It produces `com.rfly.pilot`, verifies foreground
location and the prohibited-permission boundary, and records the source SHA,
endpoint and checksum. Its `production-internal-http` configuration exists only
for the current direct-IP field trial. The ordinary `production` app variant
continues to reject non-HTTPS endpoints.

## 5. CD: exact-commit office deployment

Both staging and production CD jobs start only when the hosted CI workflow has
concluded successfully for the target branch. They use `workflow_run.head_sha`,
then fetch the protected branch and refuse deployment if that SHA is no longer
the branch tip. This prevents an older successful CI run from rolling a newer
commit backward.

The deployment script `deploy/onprem-selfhosted-deploy.sh` then:

1. loads the environment file outside the repository;
2. stages only required secret files into a Docker-readable private runner
   directory;
3. verifies Docker access and that the requested host port belongs only to this
   deployment;
4. renders Compose with the exact source SHA as the local image tag;
5. builds the DB/migration/backend/frontend images locally from that exact
   source;
6. starts the database and waits for health;
7. creates and verifies a custom-format PostgreSQL backup before migration;
8. runs the one-shot reviewed migration container;
9. starts backend and frontend; and
10. verifies browser and API health endpoints, then records non-secret source
    SHA/checksum evidence in the private deployment changelog.

If a deployment step fails, the script prints scoped Compose diagnostics. It
does not seed, wipe, bootstrap, or import customer data. A source release is
therefore separate from any farmer, drone, or client-master data import.

## 6. Release-image evidence and scanning

On a successful `main` CI run, `release-images.yml` builds backend, migration,
frontend and importer targets. For each target it:

1. builds a local candidate;
2. blocks on fixable HIGH/CRITICAL Trivy findings;
3. publishes an immutable GitHub Container Registry image addressed by the
   source SHA;
4. attaches provenance and an SBOM during publishing;
5. generates and retains an SPDX JSON SBOM artifact;
6. uploads Trivy SARIF evidence; and
7. uploads image digest/source-SHA evidence.

An **SBOM** is a Software Bill of Materials: a machine-readable inventory of
the software packages in an image. **Trivy** is the scanner used for known
container/dependency vulnerability findings. A failed scan or image-evidence
workflow must be investigated; never bypass it solely to obtain deployment.

## 7. Operations rules

- Never manually run a production deployment from a stale local checkout.
- Do not re-run a failed deployment blindly. First read its job log and the
  deployment script's scoped diagnostics.
- Never alter production data with raw SQL, `node -e`, `prisma db push`, seed,
  reset, or initial-admin bootstrap commands.
- Customer, drone and client-master imports are separate approved operator
  actions. Follow [MIGRATION_ON_MAIN.md](../MIGRATION_ON_MAIN.md) or
  [CLIENT_MASTER_IMPORT_OPERATIONS.md](CLIENT_MASTER_IMPORT_OPERATIONS.md), as
  appropriate.
- Keep environment files, backups, source workbooks, signing materials, VPN
  profiles and all secrets outside Git and Actions logs.
- The office server uses Snap Docker. Its host-specific Compose overlay resets
  only unsupported `no-new-privileges` behaviour; do not remove the other
  container hardening controls.

## 8. Quick diagnosis map

| Symptom | First place to inspect |
|---|---|
| Pull request or `dev` is red | `application-and-container-gates` job that failed. No server change should have occurred. |
| `staging` CI green but staging deployment failed | `onprem-staging-auto-deploy`; inspect its deployment diagnostics and current staging health. |
| `main` CI green but production deployment failed | `onprem-auto-deploy`; production may still be serving the previous healthy containers. Inspect before retrying. |
| Production deploy is green but release evidence is red | `release-image-evidence`; deployment may have occurred because the two workflows are parallel. Treat missing release evidence as a release-control gap. |
| APK job failed | `pilot-staging-apk` in `ci.yml`; the staging web deployment waits for the whole CI workflow, so fix it before considering the staging revision accepted. |
| APK is needed for a phone | Download the matching seven-day GitHub artifact, verify its SHA-256 file, and install it only on an approved staging device. |

## 9. Pre-promotion checklist

Before merging to `main`, ensure all of the following are true:

1. The source is already present and reviewed on `staging`.
2. All CI jobs for that exact staging SHA are green, including the Android job
   when Pilot code has changed.
3. Internal staging acceptance is recorded for the affected workflow.
4. Any required schema migration has passed its disposable replay and staging
   deployment.
5. No customer-data import is bundled into the release.
6. The maintainer has reviewed the diff, risks and rollback point.

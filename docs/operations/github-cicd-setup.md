# GitHub CI/CD setup for the on-prem live branch

This repository should be owned by the deployment owner, not an intern's personal account. The intended private repository is:

```text
https://github.com/Waz00-m/RFLY
```

## Branch model

```text
dev-ing  -> active development
main     -> live office on-prem server branch
```

Normal flow:

```text
developer branch/dev-ing
  -> pull request
  -> CI passes
  -> owner approval
  -> merge to main
  -> CI passes on main
  -> self-hosted runner deploys that CI-passed commit on the office server
```

Do not give routine developers direct push access to `main`.

## Required GitHub branch protection

In GitHub repository settings, protect `main`:

- require a pull request before merging;
- require at least one approval from the owner/maintainer;
- dismiss stale approvals when new commits are pushed;
- require status checks to pass before merging;
- require the branch to be up to date before merging if practical;
- block force pushes;
- block deletions;
- restrict who can push to `main`.

Optional but recommended:

- require signed commits;
- require conversation resolution before merge;
- use CODEOWNERS when more maintainers join.

## Self-hosted runner requirement

GitHub-hosted runners cannot reach the office server's private LAN address. Install a GitHub self-hosted runner on the office server and assign these labels:

```text
self-hosted
linux
rfly-onprem
```

Run the runner as a dedicated deployment user, preferably `waseem`, and ensure that user can run Docker non-interactively without restarting Docker or touching the existing `srs` container.

Before enabling the workflow, prepare:

```text
/opt/client-demo-app/deployment.env
/opt/client-demo-app/secrets/db_password
/opt/client-demo-app/secrets/recovery_hash_secret
/opt/client-demo-app/secrets/otp_hash_secret
/opt/client-demo-app/deployment-notes/
```

Use [onprem-demo-deployment.md](onprem-demo-deployment.md) for the exact server preparation steps.

## Auto-deploy workflow

`.github/workflows/onprem-deploy.yml` deploys automatically only after `application-and-container-gates` passes on `main`, or when manually dispatched by an authorized maintainer. It runs on the self-hosted server runner and executes:

```text
deploy/onprem-selfhosted-deploy.sh
```

The script:

- verifies Docker access;
- verifies the existing `srs` container is still running;
- renders `compose.production.yml + compose.onprem-demo.yml`;
- rebuilds/updates the app stack;
- waits for health;
- verifies local health endpoints;
- appends a non-secret deployment record.

## Important security note

The current on-prem path is direct HTTP on port `8088` until the client/company decides domain and HTTPS. This is acceptable only as a temporary office-hosted pilot path. Move to the HTTPS production deployment path as soon as a domain/subdomain and TLS route are approved.

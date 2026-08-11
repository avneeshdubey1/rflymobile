# Isolated container deployment

> **Operational record:** current product and release requirements are defined in [docs/plan/AGENTS.md](../docs/plan/AGENTS.md), not in legacy product documents.

The production Compose definition runs one customer-neutral application stack and one PostgreSQL database for exactly one operating company. Deploy another company with a different Compose project name, secret directory, database volume, domain, and image release. Never attach two companies to the same database or volume.

Use this file together with the reviewed Compose definitions, deployment script,
workflow YAML, and environment examples in `deploy/`. `example.env` deliberately
contains no credential values; copy it outside the repository and replace its
deployment-specific entries.

The stack is not a TLS terminator. The frontend port binds to loopback by default and must sit behind an approved HTTPS load balancer or host reverse proxy. The backend rejects requests not marked as HTTPS by that trusted proxy chain.

After the application gates pass on the current `main` tip, the `release-image-evidence` GitHub Actions workflow can publish backend, migration, frontend, and importer images to GHCR with source-linked immutable tags, digests, SBOM artifacts, and vulnerability-scan artifacts. A local image scan blocks publication on fixable high or critical findings. Treat those artifacts as release inputs, not production approval. Staging/production deployment still requires the chosen host, domain, TLS, backup, monitoring, alert, and rollback owners.

The one-shot importer is deliberately excluded from normal API images and is never run by the automatic deployment script. Use `compose.import.yml` only through the approved import procedure after dry-run review and backup verification. Its preflight service has no network, database secret, or staging key; the committing service can reach only the private data network. Workbook and key paths must be outside the checkout and readable through the host's Docker filesystem boundary. On confined Docker installations, use an approved Docker-visible staging directory rather than weakening filesystem confinement.

The office server's snap-packaged Docker engine rejects process startup when
`no-new-privileges` is enabled. On that verified host only, append
`compose.snap-import.yml` after `compose.import.yml`. The compatibility overlay
removes that single unsupported option from the one-shot importer services; it
retains their non-root identity, read-only filesystem and input mounts, dropped
capabilities, resource limits, secrets boundary, and network restrictions. Do
not apply this overlay to normal application services or to another host without
reproducing the same engine failure first.

For the current office production stack, use `compose.onprem-demo.yml` and
`deploy/onprem-demo.env.example`. The historical `demo` identifier remains in
the deployment name, but the stack on port `8088` is live. Customer-data import
must follow [the production migration runbook](../docs/MIGRATION_ON_MAIN.md) and
must not modify unrelated host services or containers.

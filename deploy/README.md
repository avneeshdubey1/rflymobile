# Isolated container deployment

> **Operational record:** current product and release requirements are defined in [docs/plan/AGENTS.md](../docs/plan/AGENTS.md), not in legacy product documents.

The production Compose definition runs one customer-neutral application stack and one PostgreSQL database for exactly one operating company. Deploy another company with a different Compose project name, secret directory, database volume, domain, and image release. Never attach two companies to the same database or volume.

Start with [the deployment runbook](../docs/operations/deployment.md). `example.env` deliberately contains no credential values; copy it outside the repository and replace its deployment-specific entries.

The stack is not a TLS terminator. The frontend port binds to loopback by default and must sit behind an approved HTTPS load balancer or host reverse proxy. The backend rejects requests not marked as HTTPS by that trusted proxy chain.

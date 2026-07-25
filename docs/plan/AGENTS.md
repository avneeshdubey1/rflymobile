# Canonical Engineering Agent Guide

**Status:** authoritative planning baseline
**Last reviewed:** July 25, 2026

This is the only engineering-agent entry point for future work. Legacy guidance is EOL or historical only. The current code does not yet implement every requirement in this planning set; do not claim that a documented target already exists in the application.

## Required reading order

1. [CONTEXT.md](CONTEXT.md) for the operating model and product rationale.
2. [SPEC.md](SPEC.md) for the approved implementation contract.
3. [production_hardening.md](production_hardening.md) before any security, privacy, authentication, deployment, integration, billing, or live-data work.
4. [current_placeholders.md](current_placeholders.md) whenever a company-owned value, provider, migration input, or external system is involved.
5. [plan_for_production_rediness.md](plan_for_production_rediness.md) for sequencing, delivery packages, release gates, and acceptance evidence.

Do not treat a dated report, a legacy document, a seed value, or current application behaviour as an approved requirement when it conflicts with these documents.

## Decision hierarchy

- Follow an explicit user instruction when it is safe and within scope.
- Otherwise follow this canonical planning set, then the existing code conventions.
- If an implementation decision would change customer data, money, privacy, retention, external-provider behaviour, or production topology, record it in the relevant canonical document before or with the change.
- Never put credentials, reset codes, private keys, customer data, raw telemetry, exact GPS coordinates, or payment payloads in source, documentation, fixtures, logs, or audit records.

## Engineering invariants

1. **Repository pattern:** controllers, routes, sockets, and jobs do not access Prisma directly. Database access goes through repositories.
2. **Auditability:** every state-changing action writes a credential-free, coordinate-free AuditLog entry through the audit service.
3. **Server enforcement:** permissions and state-machine transitions are enforced by the server, not merely hidden in the UI.
4. **Configuration over literals:** pricing, thresholds, radii, maintenance/compliance windows, currency, and operational policy values are company configuration, never hardcoded business values.
5. **Visible human fallback:** automation fails to a visible staff queue or follow-up task; it never silently drops work.
6. **i18n:** every newly touched farmer-facing string uses the localization system. Do not hardcode English wording in farmer-facing components or message templates.
7. **Least privilege:** browser roles never receive database access, provider secrets, password hashes, raw SQL, or rewrite access to append-only audit history.
8. **Safe money:** use precise decimal or minor-unit money, immutable approved price snapshots, idempotency, and separate invoice and settlement state.
9. **Privacy by design:** exact location is only collected where operationally required; it is never copied into AuditLog. Raw telemetry has its own retention and access policy.
10. **Fresh handover:** use migrations plus the guarded initial-Admin bootstrap only. Development seed data is never used for client handover, staging intended to mirror production, or production.

## Approved product rules

- The product is customer-neutral. One isolated application stack, database/volume, secret set, and domain serve one operating company.
- Phone-based Sales intake is primary. The public booking form is secondary. Google Form/surveyor intake is being retired.
- Every intake channel must pass strict service-area validation. Out-of-area work is declined; there is no appeal, transport-fee negotiation, or exception scheduling path.
- An assignment reserves a pilot, drone, and LMV. The assigned pilot drives the LMV. Capacity is recorded for future expansion, but one LMV supports one pilot-and-drone crew at a time in the initial release.
- Mission completion releases the drone and LMV immediately. Billing is a separate workflow and cannot hold fleet resources.
- Billing evidence is vendor-neutral. Raw telemetry ingestion remains disabled until the company approves the vendor, retention, access, encryption, and incident policy.
- Farmer communications use WhatsApp with SMS fallback. A delivery failure creates a human follow-up task; do not build robo-calling.
- Sales may approve final acreage and issue an internal invoice draft. Admin may oversee or correct it. Tax/GST issuance is deferred until company rules are supplied.
- Kubernetes is deferred. The initial live topology is one isolated Docker Compose deployment per company, built with portable container contracts.

## Implementation discipline

- Map work to the ordered delivery packages in the production-readiness plan before coding.
- Preserve unrelated dirty worktree changes. Do not reset, checkout, delete, or reformat unrelated files.
- Prefer a focused migration or feature commit. Include documentation, tests, and verification evidence with the corresponding implementation.
- For destructive operations, resolve the exact target first, require the approved guard/confirmation path, make backups where applicable, and record the result without sensitive values.
- Do not activate a provider merely because an adapter exists. Build and test the fallback path first.
- Do not use legacy Bhumeet/mock marketplace material as a production telemetry or billing dependency.

## Completion and evidence

For each delivery package:

1. Update the applicable canonical specification, hardening register, and placeholder register.
2. Add or update tests for happy paths, rejected paths, retries, authorization, and state transitions.
3. Run the relevant backend, schema, frontend, browser, container, and operational checks.
4. Add a dated, concise entry to the repository history record with scope, evidence, and remaining gates.
5. Do not call the application production-ready until the hardening release gates have real staging and operational evidence.

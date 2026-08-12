# Canonical Engineering Agent Guide

**Status:** authoritative engineering entry point
**Last reviewed:** August 10, 2026

This is the only engineering-agent entry point for future work. Verify current
code and tests before relying on a planning statement. Historical guidance is
kept under `docs/unrealted_docs_for_current_version/` and is never authoritative.

## Required reading order

1. [CURRENT_ENGINEERING_STATE.md](CURRENT_ENGINEERING_STATE.md) for the exact
   implemented/deployed state and next safe work.
2. [CONTEXT.md](CONTEXT.md) for the operating model and product rationale.
3. [SPEC.md](SPEC.md) for the approved implementation contract.
4. [production_hardening.md](production_hardening.md) before any security,
   privacy, authentication, deployment, integration, billing, or live-data work.
5. [current_placeholders.md](current_placeholders.md) whenever a company-owned
   value, provider, migration input, or external system is involved.
6. [plan_for_production_rediness.md](plan_for_production_rediness.md) for
   remaining delivery sequencing and release gates.
7. [AUTO_ASSIGNMENT_POLICY_IMPLEMENTATION_PLAN.md](AUTO_ASSIGNMENT_POLICY_IMPLEMENTATION_PLAN.md)
   before changing automatic assignment, scheduling policy, resource selection,
   Fleet calendar behaviour, or scheduling tests.
8. Before importing or changing live data, read
   [../MIGRATION_ON_MAIN.md](../MIGRATION_ON_MAIN.md) and follow it exactly.
9. Before adding another repository or application to the shared office server,
   read [SHARED_ONPREM_CICD_SERVER_HANDOFF.md](SHARED_ONPREM_CICD_SERVER_HANDOFF.md)
   and preserve its runner, path, port, volume, network and secret isolation.
10. Before changing the Pilot API, mobile authentication, offline mission
    synchronization, Android application, or Play release workflow, read
    [PILOT_ANDROID_APP_IMPLEMENTATION_PLAN.md](PILOT_ANDROID_APP_IMPLEMENTATION_PLAN.md),
    then use
    [PILOT_ANDROID_APP_MICROTASKS.md](PILOT_ANDROID_APP_MICROTASKS.md) as the
    dependency-ordered execution workbook.

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
11. **Application-owned phone proof:** the application, not a delivery provider, generates, hashes, rate-limits, expires, verifies, and consumes OTP challenges. A provider only transports an approved message and reports delivery. Never trust a browser-supplied phone number, Firebase token, or delivery receipt as proof of account ownership.

## Approved product rules

- The product is customer-neutral. One isolated application stack, database/volume, secret set, and domain serve one operating company.
- Phone-based Sales intake is primary. The public booking form is secondary. Google Form/surveyor intake is being retired.
- Every intake channel must pass strict service-area validation. Out-of-area work is declined; there is no appeal, transport-fee negotiation, or exception scheduling path.
- The operational unit reserves a primary Pilot, a Copilot, one drone, and one LMV. Both crew members share driving and field duties, and the unit may receive multiple explicitly ordered jobs per day. This server-side assignment model is implemented and frozen by the Pilot mobile Phase M00 baseline; mobile work must preserve it.
- Every Pilot must belong to an active operating centre before account creation. Admin and Fleet may change that centre only while the Pilot has no active assignment.
- Operational chat follows `Admin > Fleet Manager > Sales > Pilot`: a higher role may open a direct chat only with a lower role, the higher role sends the first message, and only Admin may close a chat.
- Mission completion releases the drone and LMV immediately. Billing is a separate workflow and cannot hold fleet resources.
- Billing evidence is vendor-neutral. Raw telemetry ingestion remains disabled until the company approves the vendor, retention, access, encryption, and incident policy.
- Firebase Authentication is a retired target dependency. Replace its SMS-only phone proof with an application-owned verification challenge, WhatsApp-first delivery, and SMS fallback; do not retain a Firebase compatibility path after the approved cutover.
- Farmer communications use WhatsApp with SMS fallback. A delivery failure creates a human follow-up task; do not build robo-calling.
- Sales may approve final acreage and issue an internal invoice draft. Admin may oversee or correct it. Tax/GST issuance is deferred until company rules are supplied.
- Kubernetes is deferred. The initial live topology is one isolated Docker Compose deployment per company, built with portable container contracts.

## Implementation discipline

- Map work to the ordered delivery packages in the production-readiness plan before coding.
- Preserve unrelated dirty worktree changes. Do not reset, checkout, delete, or reformat unrelated files.
- Prefer a focused migration or feature commit. Include documentation, tests, and verification evidence with the corresponding implementation.
- For destructive operations, resolve the exact target first, require the approved guard/confirmation path, make backups where applicable, and record the result without sensitive values.
- Do not activate a provider merely because an adapter exists. Build and test the fallback path first.
- No OTP delivery provider is selected. Build the OTP core behind a stable provider adapter and validated environment/secret-file configuration; a provider API key can select only an adapter that has been deliberately implemented and tested. Meta is a candidate, not an implementation dependency. A free service-message or advertising-entry window is never an OTP design assumption.
- Do not use legacy Bhumeet/mock marketplace material as a production telemetry or billing dependency.

## Data and automation safety

- Never write an ad-hoc JavaScript file, `node -e` command, or raw SQL mutation
  to change staging or production data. Use a committed, reviewed operator CLI
  that calls the service and repository layers.
- A bulk-data tool must support a read-only preflight, deterministic dry run,
  explicit target deployment, Admin approval, verified backup reference, exact
  confirmation phrase, atomic/idempotent commit, reconciliation, and a PII-safe
  report. It must fail closed on drift.
- Never run `prisma db push`, development seed scripts, demo preparation,
  database wipes, or the initial-Admin bootstrap against an established client
  database. Apply reviewed migrations with the deployment workflow.
- Never hardcode user IDs, batch IDs, credentials, customer values, server
  paths, or production decisions in source. Discover identifiers from the
  selected target and validate their cardinality before use.
- Source workbooks, exports, database dumps, generated profiles, secrets, and
  raw customer data stay outside Git and outside the Actions checkout.
- Archive files are evidence only. Do not resurrect code or requirements from
  them without comparing against current source and receiving explicit approval.

## Branch and verification flow

- Normal flow is `dev` -> reviewed PR -> `staging` -> reviewed promotion ->
  `main`. CI runs on all three; staging and main deploy only after their CI gate
  passes.
- Do not bypass a failing gate or weaken lint, security, migration, or container
  checks to obtain a green run.
- Before committing, run the focused tests for the change. Before promotion,
  run backend tests, Prisma validation/generation when schema is involved,
  frontend lint/build, and the isolated container stack gate.
- Production data work is a separate operator action after deployment. A code
  push must never seed, wipe, or silently import customer data.

## Completion and evidence

For each delivery package:

1. Update the applicable canonical specification, hardening register, and placeholder register.
2. Add or update tests for happy paths, rejected paths, retries, authorization, and state transitions.
3. Run the relevant backend, schema, frontend, browser, container, and operational checks.
4. Add a dated, concise entry to the repository history record with scope, evidence, and remaining gates.
5. Do not call the application production-ready until the hardening release gates have real staging and operational evidence.

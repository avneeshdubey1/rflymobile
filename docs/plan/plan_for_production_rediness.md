# Production Readiness Delivery Plan

**Status:** approved planning baseline
**Last reviewed:** July 25, 2026
**Scope of this document migration:** documentation and operational guidance only. It does not change application behaviour.

## Outcome

The target product is a phone-first, strictly service-area-limited agricultural drone operation with schedulable LMVs, optional customer status portals, evidence-backed billing, and controlled Compose-based production delivery.

The codebase is not yet at that target. The existing application still contains Google Form/surveyor intake, out-of-range appeal behaviour, immediate manual-acreage payment creation, and Bhumeet mock material. It has no LMV model, Billing Case, flight-evidence store, object-storage integration, dedicated evidence worker, release registry, or automated production promotion.

## Locked decisions

- Sales phone intake is primary; the public booking form is secondary.
- Google Form/surveyor intake is retired.
- Every intake channel uses strict service-area validation. Out-of-area requests become 30-day contact-only declined enquiries; appeals and transport-fee negotiation are retired.
- Farmer and Business accounts are optional, read-only status portals. Business accounts represent farm groups or companies with explicit record linkage.
- A job reserves one pilot, one drone, and one LMV. The pilot is the LMV driver. Vehicle capacity is recorded for future use, but the initial rule is one crew per LMV.
- Operational completion immediately releases drone and LMV resources. Billing begins afterward and cannot block fleet reuse.
- Billing is vendor-neutral. Sales approves final acreage and releases an internal invoice draft; Admin can correct or oversee it.
- Route distance is evidence only, never an automatic price. A manually approved LMV charge may be included in the invoice draft.
- The normal target is an invoice draft within 30 minutes after usable evidence arrives.
- WhatsApp is supported with SMS fallback; failed delivery creates a human follow-up task.
- Raw telemetry upload remains disabled until the client approves the vendor, sample export, retention, access, deletion, encryption, and incident policy.
- The first live topology is one isolated Docker Compose stack per company on a provider-neutral Linux host. Kubernetes remains a future migration option, not an initial operational requirement.
- Development seed data is demo-only. Fresh client handover uses migrations plus the guarded initial-Admin bootstrap.

## Delivery packages

### 1. Canonical documentation and credential-artifact remediation

- Create and maintain the canonical planning set under docs/plan.
- Replace active legacy policy documents with EOL redirects.
- Keep reports, history, evidence, and runbooks as non-authoritative records.
- Remove credential-like documentation artifacts from the workspace without copying their contents; require external rotation evidence from the credential owner.
- Correct runbook references to the current recovery-secret and guarded bootstrap model.

**Acceptance:** canonical links resolve, legacy guidance cannot be mistaken for the current product contract, and no credential-like document artifact is staged or retained in the workspace.

### 2. Strict intake and legacy-path retirement

- Retire Google Form/surveyor, appeal, transport-fee, and Bhumeet/mock production paths.
- Introduce transient geofence checking and minimal Declined Enquiry storage with a 30-day idempotent purge.
- Preserve public booking and authenticated Sales intake while enforcing the same service-area policy everywhere.

**Acceptance:** an out-of-area request can never become a Lead, assignment, appeal, payment, or schedule; declined coordinates and distance are not persisted.

### 3. LMV fleet and assignment invariants

- Add Admin-managed LMV master data, maintenance/compliance status, and operating-centre relationship.
- Require pilot, drone, and LMV availability for auto and manual scheduling.
- Enforce one active crew per LMV until a later transport-run design is approved.

**Acceptance:** server-side conflict, maintenance, cancellation, completion, and audit tests cover all three resources.

### 4. Phone-first customer experience and communications

- Improve Sales call intake with customer lookup, canonical phone identity, location capture, and clear service-area result.
- Implement isolated Farmer and Business status portal reads.
- Add WhatsApp-to-SMS delivery fallback and staff follow-up tasks.

**Acceptance:** portals expose only linked records, duplicate/replayed requests are safe, and a communication failure reaches a visible staff queue.

### 5. Evidence-backed billing and settlement

- Add Billing Case, evidence, flight-leg, invoice-draft, invoice-line, and settlement concepts.
- Use durable idempotent processing, precise money, approved price snapshots, human final-acreage approval, and optional manual LMV lines.
- Add a dedicated worker and an evidence-review queue. Use object-storage metadata in PostgreSQL and encrypted files outside it.
- Keep raw upload disabled behind the approved retention-policy gate; begin with approved manual/summary evidence and synthetic test fixtures only.

**Acceptance:** clean and mismatched evidence, multi-leg jobs, retries, invoice correction, UPI/cash settlement, and fleet release before billing all pass automated tests.

### 6. Validated Excel and Zoho master-data import

- Import only approved core master data: staff, pilots, LMVs, drones, centres, customer organizations, and configuration.
- Use a staging table, validation report, canonical-phone deduplication, dry run, reconciliation, and approved commit step.
- Do not import historic financial or flight records in the first handover.

**Acceptance:** a dry run reports invalid/duplicate rows without changing production data; an approved import is auditable and reversible through a verified backup/restore procedure.

### 7. Production delivery and operations

- Extend GitHub Actions with browser acceptance, dependency/static/secret/image scans, SBOM generation, immutable image publishing, and release evidence.
- Automatically deploy approved immutable images to staging. Require an approved production promotion, backup/migration gate, health checks, and documented rollback.
- Add encrypted backup automation, restore rehearsals, central logs, metrics, alert routing, worker monitoring, TLS/reverse-proxy configuration, and externalized secret management.

**Acceptance:** staging and production workflow evidence demonstrates image provenance, backup/restore, migration/rollback, alert delivery, worker retry, and approval-controlled promotion.

### 8. Client acceptance and live launch

- Complete provider sandboxes, physical-device checks, low-network tests, access review, privacy approvals, and operational ownership handoff.
- Run a production-like rehearsal against a fresh, non-demo client dataset.
- Promote only after every release blocker has evidence and named ownership.

## CI/CD contract

| Trigger | Required result |
|---|---|
| Pull request | Unit/integration tests, schema validation, frontend lint/build, browser acceptance, dependency/static/secret/image scans, SBOM. |
| Merge to main | Immutable images identified by source revision/digest and automatic staging deployment. |
| Production promotion | Environment approval, pinned image digest, verified backup, controlled migration, health/workflow verification, monitoring confirmation, rollback window. |

## Inputs still required from the company

- Exact drone/controller vendor, sample evidence exports, usable-evidence definition, and telemetry retention/access/deletion policy.
- Approved service radii, operating centres, LMV and drone master data, compliance rules, pricing, currency, and manual-LMV-fee policy.
- Tax/GST rules, invoice numbering, legal merchant/UPI account, settlement/reconciliation/refund policy.
- WhatsApp/SMS/email providers, approved templates, sender/opt-in evidence, and sandbox access.
- Hosting provider, production domain, TLS owner, monitoring/alert recipients, backup target, RPO/RTO, and incident/support owners.
- Excel/Zoho source mapping and accountable import/reconciliation owner.

## Non-negotiable rollout rules

- Do not seed demo data into handover, staging intended to mirror production, or production.
- Do not activate telemetry upload without approved retention and access policy.
- Do not delete or transform non-empty client data without an approved backup, exact target confirmation, and evidence.
- Do not place credentials, customer data, raw telemetry, or production values in Git, documentation, chat, logs, or fixtures.

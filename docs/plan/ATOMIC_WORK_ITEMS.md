# Atomic Delivery Work Items

**Status:** canonical execution index
**Last reviewed:** July 26, 2026
**Purpose:** split the remaining delivery plan into small, bounded handoffs suitable for a smaller coding agent. This file does not change the approved product specification or authorize production deployment.

## How to assign one card

Use exactly one card per agent turn and copy this prompt pattern:

> Execute only `<CARD-ID>` from `docs/plan/ATOMIC_WORK_ITEMS.md`. Start with `docs/plan/AGENTS.md`, read this card and its prerequisites, preserve unrelated changes, and stop if a listed client gate is missing. Do not add provider credentials, demo data, exact coordinates, or scope from another card. Add focused tests, run the listed checks, update the canonical records, and make one focused commit only when the card is complete.

Every implementation card must:

1. touch only its stated concern and direct test/documentation files;
2. use repositories rather than Prisma from controllers, routes, sockets, or jobs;
3. enforce authorization and state changes on the server;
4. write coordinate-free, credential-free audit records for mutations;
5. leave a clear human queue or follow-up task when automation cannot finish;
6. stop rather than invent company policy, a provider, a secret, a tax rule, or production values.

Do not run cards in parallel when they edit the same schema, assignment lifecycle, authentication/session flow, or deployment workflow. A card marked **gate** is a decision/evidence task, not a coding task.

## Dependency map

```text
Phase-1 evidence ─┬─> LMV fleet ────────────────> Billing completion/release
                  ├─> Phone-first + portal data ─> OTP core ─> provider cutover
                  └─> CI/Compose hardening ──────> staging ─> launch rehearsal

LMV + approved masters ─> Excel/Zoho import
Billing + provider/finance decisions ─> settlement activation
All code packages + named owners ─> client acceptance ─> production promotion
```

## Mandatory external gates

| Gate | Required before dependent coding/activation | Never infer or fabricate |
|---|---|---|
| G-01 | Docker Desktop / disposable PostgreSQL available for Phase 1 evidence | A passing migration or browser audit |
| G-02 | Approved operating centres, radii, LMV masters, capacity, maintenance/compliance policy | Fleet/legal values |
| G-03 | Portal enrolment/linking policy and organization-membership rules | Public self-registration |
| G-04 | OTP provider decision, sender/account, template, opt-in, rate card, sandbox, callback details | A live WhatsApp/SMS adapter or secret |
| G-05 | Billing evidence definition, pricing/currency, tax/GST, LMV-fee and correction rules | Invoice/tax/payment behaviour |
| G-06 | Evidence vendor, sample exports, retention, access, encryption, deletion, and incident policy | Raw telemetry upload or vendor sync |
| G-07 | Excel/Zoho mappings, data owner, reconciliation owner, import approval | Production import of any client data |
| G-08 | Host, domain, TLS, backup, monitoring, alert, RPO/RTO, and incident owners | Staging/production deployment |

## 0. Finish Phase 1 evidence first

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| P1-E01 | Diagnose and start only the approved local Docker engine; make no code change. | G-01 | `docker ps` succeeds. |
| P1-E02 | Replay all Prisma migrations against a newly created disposable PostgreSQL database. | P1-E01 | `prisma migrate deploy` succeeds from an empty database. |
| P1-E03 | Run the complete disposable-database backend suite. | P1-E02 | The test runner completes with no failures. |
| P1-E04 | Run the browser acceptance audit against the disposable stack. | P1-E02 | The audit completes and evidence contains no failure. |
| P1-E05 | Record exact Phase 1 evidence and any remaining release blockers. | P1-E03, P1-E04 | Hardening register/history are accurate and committed separately. |

## 1. Package 3 — LMV fleet and assignment invariants

**Scope boundary:** do not start BillingCase, raw telemetry, OTP, or production import work in these cards.

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| LMV-01 | Record the final LMV fields, states, compliance semantics, and fresh/legacy migration decision in canonical docs. | G-02 | The data contract has an accountable owner; otherwise stop. |
| LMV-02 | Add only LMV enums/models/indexes and a reviewed Prisma migration. | LMV-01 | Schema validates and migration has focused model tests. |
| LMV-03 | Add the LMV repository with no controller/job Prisma access. | LMV-02 | Repository tests cover basic lookup and safe status filters. |
| LMV-04 | Add Admin LMV create/list service and server authorization/audit path. | LMV-03 | Negative role/input tests and coordinate-free audit test pass. |
| LMV-05 | Add Admin LMV edit/deactivate path with confirmation-safe validation. | LMV-04 | An active assigned LMV cannot be silently deleted. |
| LMV-06 | Add maintenance and compliance evaluation service for a single LMV. | LMV-03, G-02 | Due/expired/maintenance states are server-tested. |
| LMV-07 | Add Fleet/Admin LMV master-data screen only. | LMV-04, LMV-05 | UI has loading/error/empty states and localized touched strings. |
| LMV-08 | Add the Assignment-to-LMV relationship and safe migration/backfill policy. | LMV-02, G-02 | Existing-row handling is explicit; no assignment can obtain an arbitrary LMV. |
| LMV-09 | Add one repository query that returns eligible LMVs for a centre/date. | LMV-06, LMV-08 | Maintenance, inactive, compliance, and conflict exclusions are unit-tested. |
| LMV-10 | Change automatic assignment to choose an eligible pilot–drone–LMV triple. | LMV-09 | No-candidate result becomes a visible manual-scheduling case. |
| LMV-11 | Change manual scheduling API to require and validate an eligible LMV. | LMV-09 | Wrong-centre, conflict, maintenance, and role attempts fail server-side. |
| LMV-12 | Add the Fleet scheduler LMV selector and availability feedback only. | LMV-11 | UI cannot submit without a valid LMV and handles server conflict responses. |
| LMV-13 | Release LMV and drone on completion/cancellation using the central lifecycle service. | LMV-08 | Completion/cancellation tests prove resources become reusable; billing is not started here. |
| LMV-14 | Add focused end-to-end/regression cases for LMV conflict, lifecycle, and audit history. | LMV-10 through LMV-13 | Backend/browser checks cover all required negative paths. |
| LMV-15 | Update specification, hardening register, placeholders, history, and make the focused LMV commit. | LMV-14 | No production claim; verification evidence is recorded. |

## 2. Package 4A — phone-first intake and read-only portal isolation

**Scope boundary:** these cards improve data ownership and user experience. They do not remove Firebase or activate OTP delivery.

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| CX-01 | Map the current Sales intake, Farmer, and Business identity paths; document the smallest safe replacement seams. | — | No code change; impacted routes/models are listed. |
| CX-02 | Add canonical-phone customer lookup service for Sales intake only. | CX-01 | Lookup cannot expose unrelated customer records. |
| CX-03 | Add Sales UI lookup/confirmation and clear service-area result. | CX-02 | Phone-first workflow works without requiring a portal account. |
| PORTAL-01 | Record approved Farmer linking and Business membership rules. | G-03 | Stop if the client has not chosen the rule. |
| PORTAL-02 | Add minimal explicit portal-link/membership data model and migration. | PORTAL-01 | Schema is scoped to record linkage, not self-registration. |
| PORTAL-03 | Add repositories and server filters for Farmer-owned request/invoice/settlement reads. | PORTAL-02 | Cross-customer access tests fail safely. |
| PORTAL-04 | Add repositories and server filters for Business organization membership reads. | PORTAL-02 | Only explicit member + linked work is returned. |
| PORTAL-05 | Make Farmer portal surfaces read-only status views. | PORTAL-03 | No portal mutation can create an exception, price, or schedule. |
| PORTAL-06 | Make Business portal surfaces read-only status views. | PORTAL-04 | Browser and negative API isolation checks pass. |
| PORTAL-07 | Add the portal isolation regression suite and documentation update. | PORTAL-03 through PORTAL-06 | Anonymous, wrong-user, wrong-organization, and role tests pass. |

## 3. Package 4B — application-owned OTP and communication boundary

**Scope boundary:** build the internal challenge before any real delivery provider. A provider receipt never authenticates a user.

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| OTP-01 | Record exact challenge purpose, expiry, attempt, resend, retention, and enrolment policy values as company configuration requirements. | G-03 | No default value is silently presented as client approval. |
| OTP-02 | Add `PhoneVerificationChallenge` schema and migration only. | OTP-01 | No raw code, full phone, or provider payload field is added. |
| OTP-03 | Add `VerificationDeliveryAttempt` and durable outbox schema/migration only. | OTP-02 | Attempt/outbox records use safe references and idempotency keys. |
| OTP-04 | Add repositories for challenge, delivery attempt, and outbox. | OTP-03 | Repositories are the only database boundary. |
| OTP-05 | Implement cryptographic code generation, dedicated-secret HMAC, constant-time check, and one-time consumption primitives. | OTP-04 | Unit tests cover wrong, expired, reused, and replaced codes. |
| OTP-06 | Implement issue/resend/rate-limit service for one purpose and one recipient. | OTP-05 | Non-enumerating and abuse-limit tests pass. |
| OTP-07 | Implement transactional verification-to-opaque-session service for one approved purpose. | OTP-06 | Concurrent/replay/wrong-purpose tests cannot issue two sessions. |
| OTP-08 | Add disabled production-safe and deterministic test delivery adapters. | OTP-04 | Default configuration cannot send a real message. |
| OTP-09 | Add validated provider-selector and secret-file configuration boundary. | OTP-08 | Unknown provider or source credential fails startup safely. |
| OTP-10 | Add durable outbox worker/retry/dead-letter handling only. | OTP-08 | Restart/retry cannot create a second challenge or code. |
| OTP-11 | Add generic OTP request/verify API endpoints with CSRF/rate/error controls. | OTP-06, OTP-07 | Browser response never reveals account existence or code. |
| OTP-12 | Add signed, replay-safe callback verification and normalized delivery status update. | OTP-09 | A callback cannot verify an account or issue a session. |
| OTP-13 | Add Follow-up Task data/service for terminal delivery failure. | OTP-10 | Failed WhatsApp/SMS yields staff work without OTP/message disclosure. |
| OTP-14 | Replace Farmer login browser flow with internal challenge flow. | OTP-11, OTP-13 | Farmer session uses only the application session. |
| OTP-15 | Replace Business recovery browser flow with internal challenge flow. | OTP-11, OTP-13 | Recovery cannot elevate Admin or expose account existence. |
| OTP-16 | Add focused OTP API/worker/browser security regression tests. | OTP-05 through OTP-15 | Expiry, replay, purpose, limits, callback, outage, and fallback cases pass. |
| OTP-17 | Implement the selected real WhatsApp/SMS adapter only after sandbox approval. | G-04, OTP-09, OTP-12 | Sandbox send, signature, template, budget, and fallback evidence exist. |
| OTP-18 | Run staging cutover/retry/failure/restart evidence with the selected adapter. | OTP-17 | All delivery failures create safe follow-up work. |
| OTP-19 | Remove Firebase browser/server packages, configuration, token-proof code, tests, and deployment references. | OTP-14, OTP-15, OTP-18 | Build contains no Firebase dependency or accepted Firebase proof. |
| OTP-20 | Obtain and record external Firebase service-account revocation evidence. | OTP-19 | Owner records non-secret revocation evidence. |

## 4. Package 5 — evidence-backed billing and settlement

**Scope boundary:** raw telemetry stays disabled. Begin only with approved manual/summary evidence and synthetic fixtures.

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| BILL-01 | Record usable evidence, pricing, currency, LMV-fee, correction, tax, and settlement decisions. | G-05, G-06 | Stop on any missing money/privacy decision. |
| BILL-02 | Add billing state enums and `BillingCase` schema/migration only. | BILL-01 | One case per completed assignment is enforced. |
| BILL-03 | Add BillingCase repository and server state-transition service. | BILL-02 | Invalid state changes and unauthorized roles fail. |
| BILL-04 | On mission completion, release fleet resources and create/update BillingCase. | LMV-13, BILL-03 | Billing cannot hold drone or LMV reuse. |
| BILL-05 | Add manual/summary evidence metadata model and repository only. | BILL-02 | No raw file/blob/upload path exists. |
| BILL-06 | Add FlightLeg model and idempotent evidence/leg matching service. | BILL-05 | Duplicate identifiers do not duplicate financial work. |
| BILL-07 | Add evidence mismatch/review queue and Follow-up Task integration. | BILL-06 | Mismatch is visible to staff, not silently priced. |
| BILL-08 | Add precise money/pricing snapshot primitives and configuration validation. | BILL-01 | Floats cannot represent final invoice/settlement money. |
| BILL-09 | Add InvoiceDraft and approved-acreage release service. | BILL-03, BILL-08 | Only Sales/Admin can release an internal draft. |
| BILL-10 | Add InvoiceLine and manually approved LMV-charge line service. | BILL-09 | LMV fee is explicit, approved, and audited. |
| BILL-11 | Add audited invoice correction/void path. | BILL-09 | Issued snapshot cannot be silently rewritten. |
| BILL-12 | Add cash/UPI settlement state and reconciliation service without a live gateway. | BILL-09 | Settlement is separate from invoice approval. |
| BILL-13 | Add Sales evidence-review and invoice-draft UI. | BILL-07, BILL-09 | UI exposes queue/error/review states without raw telemetry. |
| BILL-14 | Add Admin correction/settlement oversight UI. | BILL-11, BILL-12 | Authorization and audit tests pass. |
| BILL-15 | Add durable billing worker/retry/backlog/dead-letter behaviour. | BILL-06, BILL-07 | Restart/idempotency tests pass. |
| BILL-16 | Add raw-upload feature gate and regression tests proving it remains disabled. | BILL-05, G-06 | No API/UI can upload telemetry before approval. |
| BILL-17 | Add selected UPI gateway adapter only after legal merchant/sandbox approval. | G-05, BILL-12 | Signed idempotent callback and reconciliation evidence exist. |

## 5. Package 6 — validated Excel/Zoho core-master import

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| IMP-01 | Approve source field mapping, importer, reconciliation owner, and excluded historic data. | G-07 | Stop if mapping or ownership is absent. |
| IMP-02 | Add import batch/staging data model and repository only. | IMP-01 | No production master is changed by file receipt. |
| IMP-03 | Add parser boundary for one approved file format only. | IMP-02 | Size/type/header errors are reported safely. |
| IMP-04 | Add canonical phone/centre/role/LMV/drone validation for staging rows. | IMP-03, G-02 | Invalid rows never reach master tables. |
| IMP-05 | Add duplicate detection and deterministic reconciliation report. | IMP-04 | Existing/staged duplicates are visible without mutation. |
| IMP-06 | Add dry-run API/UI/report only. | IMP-05 | Dry run changes no production record. |
| IMP-07 | Add approved, confirmed import commit transaction and audit trail. | IMP-06 | Only authorized approver can commit a validated batch. |
| IMP-08 | Add rollback/backup verification procedure and import acceptance tests. | IMP-07 | Restore/reconciliation evidence proves a safe reversal. |

## 6. Package 7 — production delivery and operations

**Scope boundary:** Compose remains the initial runtime. Do not introduce Kubernetes operation in these cards.

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| OPS-01 | Map existing CI, images, Compose contracts, and missing release evidence. | — | No code change; a short gap record is committed. |
| OPS-02 | Add CI schema/backend/frontend/browser test jobs. | OPS-01 | Each job has deterministic inputs and artifact output. |
| OPS-03 | Add dependency/static/secret scanning job with non-secret artifacts. | OPS-02 | High/critical policy and owner are explicit. |
| OPS-04 | Add SBOM generation for built images. | OPS-02 | SBOM is attached to the build revision. |
| OPS-05 | Add immutable image build, scan, and publishing workflow. | OPS-03, OPS-04 | Image digest is tied to source revision. |
| OPS-06 | Add release manifest/evidence record using digest, migration, and test identifiers. | OPS-05 | No mutable tag is treated as a release. |
| OPS-07 | Design approved external secret store/mounted-secret contract. | G-08 | Stop before adding any real secret. |
| OPS-08 | Add provider-neutral staging deployment workflow. | OPS-05, OPS-06, OPS-07, G-08 | Staging uses a pinned image digest and isolated stack. |
| OPS-09 | Add controlled migration preflight/backup/health workflow to staging. | OPS-08 | Migration failure prevents backend promotion. |
| OPS-10 | Add documented, tested rollback workflow. | OPS-09 | Rollback selects known digest and records outcome. |
| OPS-11 | Configure TLS/reverse proxy/network exposure contract for the chosen host. | G-08 | DB/backend are not public; proxy hops are explicit. |
| OPS-12 | Add encrypted backup automation and retention configuration. | G-08 | Backup target/key owner/RPO are recorded without secrets. |
| OPS-13 | Run an isolated restore rehearsal and record evidence. | OPS-12 | Restore meets named RTO/RPO expectation. |
| OPS-14 | Add redacted logs, health/worker metrics, and storage/queue monitoring. | OPS-08 | Logs exclude credentials, OTPs, and private payloads. |
| OPS-15 | Add alert routing, acknowledgement, escalation, and worker-backlog alerts. | OPS-14, G-08 | Test alert reaches the named owner. |
| OPS-16 | Add approved production-promotion workflow with manual environment approval. | OPS-09 through OPS-15 | Promotion pins digest, backup, migration, health, and rollback window. |

## 7. Package 8 — client acceptance and live launch

| ID | Small outcome | Depends / stop condition | Done when |
|---|---|---|---|
| UAT-01 | Load fresh, non-demo approved master data through the validated handover procedure. | IMP-08, G-02, G-07 | No development seed is used. |
| UAT-02 | Run physical Android and desktop browser acceptance checks. | OTP-18 where applicable, OPS-08 | Results record device/browser/version and failures. |
| UAT-03 | Run low-bandwidth/offline/restart/duplicate-request rehearsal. | OPS-08 | Recovery and queue behaviour have evidence. |
| UAT-04 | Run role/access/privacy review, including portal isolation and live-location policy. | PORTAL-07, G-03 | Named privacy/access owner signs findings. |
| UAT-05 | Run communication provider sandbox/fallback/follow-up rehearsal. | OTP-18, G-04 | No code/message exposure and visible staff follow-up are proven. |
| UAT-06 | Run billing/evidence/settlement operational rehearsal. | BILL-17 where applicable, G-05, G-06 | Fleet release and 30-minute draft target are measured. |
| UAT-07 | Run backup/restore, alert, migration, and rollback rehearsal. | OPS-13 through OPS-16 | Operations owners acknowledge evidence. |
| UAT-08 | Complete client training, support ownership, incident contacts, and go/no-go checklist. | UAT-01 through UAT-07 | Every release blocker has owner/evidence or is explicitly deferred. |
| UAT-09 | Perform approved production promotion and post-release workflow check. | UAT-08 | Promotion follows the controlled release procedure. |

## Recommended low-credit execution order

1. Assign `P1-E01` through `P1-E05` one at a time when Docker is available.
2. Assign `LMV-01` through `LMV-15` serially; do not overlap schema/lifecycle cards.
3. In parallel only where files do not overlap: `CX-*`/`PORTAL-*` and the early `OPS-*` gap/CI cards.
4. Run `OTP-01` through `OTP-16` before asking the client to select a real provider. Hold `OTP-17` through `OTP-20` behind G-04.
5. Hold billing activation behind G-05/G-06, import behind G-07, and deployment/launch behind G-08.

An agent that finishes a card should report: card ID, commit ID, files changed, checks run, checks blocked, and the next unblocked card. It must never report the whole product as deployable merely because one card passed.

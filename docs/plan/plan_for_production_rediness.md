# Production Readiness Delivery Plan

**Status:** approved planning baseline
**Last reviewed:** July 26, 2026
**Scope of this document migration:** documentation and operational guidance only. It does not change application behaviour.

## Outcome

The target product is a phone-first, strictly service-area-limited agricultural drone operation with schedulable LMVs, optional customer status portals, application-owned phone verification, evidence-backed billing, and controlled Compose-based production delivery.

The codebase is not yet at that target. The existing application still contains Google Form/surveyor intake, out-of-range appeal behaviour, immediate manual-acreage payment creation, Bhumeet mock material, and Firebase-dependent Farmer/Business phone proof. It has no LMV model, Billing Case, flight-evidence store, object-storage integration, dedicated evidence worker, generic application-owned phone-verification challenge, release registry, or automated production promotion.

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
- Firebase Authentication is retired from the target. The application creates and verifies purpose-bound OTP challenges; a WhatsApp/SMS provider only delivers an approved message and reports delivery status.
- Direct Meta WhatsApp Cloud API is the provisional WhatsApp cost baseline. It is not activated until the client owns a verified eligible WABA/sender, has approved authentication templates and opt-in wording, confirms the then-current India rate, and proves sandbox callback/fallback behaviour. SMS remains launch-capable when WhatsApp eligibility is pending or delivery fails.
- No recurring free production allowance is assumed for WhatsApp authentication messages. Free service-message or advertising-entry windows are not a login design.
- Raw telemetry upload remains disabled until the client approves the vendor, sample export, retention, access, deletion, encryption, and incident policy.
- The first live topology is one isolated Docker Compose stack per company on a provider-neutral Linux host. Kubernetes remains a future migration option, not an initial operational requirement.
- Development seed data is demo-only. Fresh client handover uses migrations plus the guarded initial-Admin bootstrap.

## Phone-verification and provider decision record

### Architecture decision

Build an application-owned `PhoneVerificationChallenge` and a separate `VerificationDeliveryAttempt` record. The server owns code generation, HMAC storage, expiry, attempt limits, resend/cooldown, purpose/recipient binding, one-time consumption, and opaque-session issuance. A provider never verifies a code, grants a role, or issues a session.

The first approved purposes are Farmer portal authentication, an approved Farmer phone link/invitation, and Business recovery. OTP possession proves control of a phone only; it must not automatically create a Farmer/Business portal account or grant Admin recovery. The initial enrolment default is an existing explicit link or an approved invitation; any public self-registration needs a separate client decision.

Use a durable outbox and worker, signed/replay-safe idempotent delivery webhooks, delivery/fallback metrics, and a dead-letter/follow-up queue. Never retain a raw code unless an encrypted, TTL-bound worker payload is unavoidable; never place it, a message body, full phone number, provider credential, or raw callback into logs, AuditLog, fixtures, or browser responses.

### Provider and free-tier finding — researched July 26, 2026

| Option | WhatsApp OTP fit | Free allowance finding | Decision |
|---|---|---|---|
| Firebase Authentication | No. Its documented phone flow sends SMS, not WhatsApp. | First 10 SMS/day are unbilled on the paid Identity Platform path; India is currently listed at US$0.07/SMS thereafter. This is not WhatsApp capacity. | Retire after staged cutover. |
| Direct Meta WhatsApp Cloud API | Yes, using approved Authentication Templates while the application owns the code. | No unconditional recurring free authentication-message allowance. Meta's free service window and conditional 72-hour click-to-WhatsApp/Page entry window cannot be used as a normal login design. | Preferred WhatsApp adapter once client eligibility and sandbox gates pass. |
| Infobip trial | Testable through a BSP. | 100 WhatsApp conversations for 60 days, only to verified numbers through a shared sender; not live production capacity. | Optional sandbox comparison, not a production free tier. |
| Twilio Verify | Not suitable as WhatsApp-primary in India: its documentation says India WhatsApp Verify falls back to SMS; it also makes Twilio the verification service. | Trial only; paid verification and channel fees apply. | Do not select for this WhatsApp-primary, application-owned design. |

There is therefore no "most messages" recurring free tier to choose for production WhatsApp OTP. The largest identified WhatsApp test allowance is Infobip's 100 conversations/60 days, but it is deliberately restricted to test traffic. The only open-ended Meta free case is eligible service traffic, which is not an authentication OTP. Treat trials as sandbox evidence only.

For current India planning, a published BSP pass-through shows an approximately INR 0.115 delivered-authentication-template baseline, but that number is volatile and not a committed repository value. At activation, capture the official Meta/WABA rate-card evidence, any provider fee, taxes, delivery volume, fallback-SMS rate, and a budget alert. The decision must use total monthly cost, not a headline free tier.

The direct Meta route minimizes fixed BSP markup. A client may instead select a single India-focused BSP such as MSG91 for WhatsApp plus DLT SMS if operational simplicity outweighs its subscription/markup; that is a company procurement decision, not an application dependency. In either case, Meta business verification, sender registration, authentication-template approval, applicable messaging-limit/scaling eligibility, consent, callback signing, and sandbox delivery are hard gates. Do not misclassify an OTP as a utility message to avoid those gates.

Research sources: [Firebase phone authentication](https://firebase.google.com/docs/auth/web/phone-auth), [Google Identity Platform pricing](https://cloud.google.com/identity-platform/pricing), [Meta Authentication Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates), [WhatsApp Business Platform pricing](https://business.whatsapp.com/products/platform-pricing/), [TRAI sender requirements](https://trai.gov.in/advice-to-senders), [Infobip WhatsApp trial](https://www.infobip.com/docs/whatsapp/get-started), [Twilio Verify templates](https://www.twilio.com/docs/verify/verification-templates), and [MSG91 India WhatsApp pricing](https://msg91.com/in/pricing/whatsapp). Revalidate every rate, policy, template, and eligibility condition before staging activation or production promotion.

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

### 4. Phone-first customer experience, internal OTP, and communications

- Improve Sales call intake with customer lookup, canonical phone identity, location capture, and clear service-area result.
- Implement isolated Farmer and Business status portal reads.
- Add server-owned purpose-bound OTP challenges and delivery-attempt records for Farmer portal authentication, approved Farmer linking/invitation, and Business recovery. Preserve opaque application sessions; do not accept Firebase tokens after cutover.
- Add durable WhatsApp-to-SMS delivery fallback, signed idempotent callbacks, provider-budget visibility, and staff follow-up tasks. Do not enable WhatsApp OTP before the Meta/business/template eligibility gate; SMS is a separately compliant launch path/fallback.
- Remove Firebase browser/server packages, configuration, deployment references, token-proof services, and legacy tests only after provider staging evidence and external service-account revocation are complete.

**Acceptance:** portals expose only linked records; OTP request, expiry, replay, concurrency, wrong-purpose, abuse-rate, provider-webhook, delivery failure, worker-restart, and fallback tests pass; no delivery receipt creates a session; Firebase is absent from the built application; and a communication failure reaches a visible staff queue without exposing a code.

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
- Client-owned WABA/sender, Meta business/scaling eligibility evidence, approved WhatsApp authentication templates, opt-in wording, current India rate-card evidence, signed callback sandbox access, and an India DLT-compliant SMS provider/Principal Entity/header/content-template setup.
- Hosting provider, production domain, TLS owner, monitoring/alert recipients, backup target, RPO/RTO, and incident/support owners.
- Excel/Zoho source mapping and accountable import/reconciliation owner.

## Non-negotiable rollout rules

- Do not seed demo data into handover, staging intended to mirror production, or production.
- Do not activate telemetry upload without approved retention and access policy.
- Do not activate WhatsApp OTP based on a trial, a service-message free window, a click-to-WhatsApp free-entry window, or an unapproved template. Do not accept Firebase proof after the approved cutover.
- Do not delete or transform non-empty client data without an approved backup, exact target confirmation, and evidence.
- Do not place credentials, customer data, raw telemetry, or production values in Git, documentation, chat, logs, or fixtures.

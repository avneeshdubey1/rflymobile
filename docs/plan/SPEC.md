# Production Target Technical Specification

**Status:** approved future-state contract
**Last reviewed:** July 25, 2026
**Important:** this specification supersedes legacy product guidance. The documentation migration does not itself change runtime behaviour; current legacy routes and models remain until their delivery package is implemented and verified.

## 1. Scope and baseline

The product coordinates one agricultural drone-service company per isolated deployment. The approved target replaces four legacy assumptions:

1. Google Form/surveyor intake is no longer a supported operational channel.
2. Out-of-area appeal and transport-fee negotiation are removed.
3. A pilot, drone, and LMV are scheduled as one operational crew.
4. Billing is evidence-backed and separate from mission completion.

Current code is a baseline, not proof of this target. Existing appeal, Google Form, immediate-payment, and Bhumeet/mock paths must be removed or retired in later implementation packages. No code should claim the target is already complete merely because this document exists.

## 2. Platform and deployment contract

| Area | Approved direction |
|---|---|
| Frontend | React/Vite SPA with localized farmer-facing content and an offline-capable pilot surface. |
| Backend | Node/Express, Socket.io, server-enforced authorization and state transitions. |
| Data | PostgreSQL through Prisma repositories only. |
| Deployment | One isolated Docker Compose stack, PostgreSQL volume, secret set, and domain per operating company. |
| CI/CD | GitHub Actions verifies source and containers, deploys immutable images to staging, then uses approved promotion to production. |
| Scale path | Containers remain portable to Kubernetes; operating Kubernetes is deferred. |
| Files | Encrypted, external object storage for future raw billing evidence. Never database blobs for raw telemetry. |
| Queue/worker | A dedicated durable worker handles evidence processing and retryable billing jobs. |

Every service must be stateless except for approved persistent stores. Compose is the initial orchestration boundary, not a claim of high availability.

## 3. Roles and access

| Role | Allowed responsibility | Explicitly forbidden |
|---|---|---|
| Admin | Audited oversight, master-data control, correction, configuration, account administration, and billing correction. | Secrets, password hashes, raw SQL, audit-log rewrites. |
| Sales | Phone intake, request processing, customer follow-up, final-acreage approval, invoice-draft release, cash/UPI follow-up. | Fleet-resource conflicts, provider configuration, unrestricted customer access. |
| Fleet Manager | Pilot/drone/LMV availability, maintenance visibility, manual scheduling, operational exceptions. | Final billing approval unless granted a future explicit policy. |
| Pilot | Accept/start/complete own assignment, current active-mission location, and evidence submission for own work. | Pricing approval, invoice release, another crew's work. |
| Farmer | Optional verified-phone read-only view of matching requests, approved invoice drafts, and settlement state. | Creating a bypass around service-area checks or viewing other records. |
| Business | Optional read-only view of explicitly linked farm-group/company work, invoices, and settlements. | Viewing unrelated farmer data or administering staff. |

The server, not the UI, enforces every restriction. All privileged mutation endpoints require authentication, role checks, input validation, an AuditLog event, and negative authorization tests.

## 4. Target data model

Names below express the required business relationships. Final Prisma naming may follow repository conventions, but it must preserve the stated constraints.

### 4.1 Existing operational masters

- OperatingCenter: active service geometry, operational contact data, and configurable service radius.
- User: staff identity, canonical phone/email identity, role, activation state, language, pilot licence, and centre assignment.
- Drone: model, serial number, centre, availability, airworthiness, and maintenance state.
- Pricing/Operational Configuration: company-owned values, versioned or snapshot-safe where history depends on them.

### 4.2 Customer identity

- Customer: canonical customer identity keyed by verified or staff-confirmed phone and optional linked Farmer account.
- BusinessOrganization: a farm group, cooperative, or company customer.
- BusinessMembership: explicit business-user-to-organization membership and read permission.
- ServiceRequest/Lead: an accepted in-area request, linked to a customer and optionally business organization.
- DeclinedEnquiry: a separate, non-schedulable contact-only record for out-of-area intake.

DeclinedEnquiry may store only contact name, canonical phone, source channel, generic decline reason, created time, expiry time, and non-sensitive staff/system identifiers. It must not store the rejected address, coordinates, distance, acreage, route, appeal, payment, or assignment. A daily idempotent purge removes it after 30 days.

### 4.3 LMV fleet

- LMV: unique registration, centre, future capacity, availability state, maintenance history, compliance/insurance/permit fields supplied by the company, and audit history.
- Assignment: requires pilot, drone, and LMV references. The pilot reference is the LMV driver; do not duplicate a separate driver field.

Required LMV states are AVAILABLE, ASSIGNED, MAINTENANCE, and OUT_OF_SERVICE. The exact compliance dates and warning windows are company configuration. Initial scheduling reserves one crew per LMV even when capacity is greater than one.

### 4.4 Evidence, billing, and settlement

- BillingCase: exactly one per completed operational assignment; owns evidence and approval state.
- BillingEvidence: immutable metadata for uploaded or manually entered evidence, including object-store reference only when raw uploads are enabled.
- FlightLeg: one or more reviewed flight segments linked to a BillingCase.
- InvoiceDraft: immutable approved pricing snapshot, approved acreage, currency, status, issuer, approver, and correction/void history.
- InvoiceLine: explicit service, optional manually approved LMV charge, and later tax lines.
- Settlement: UPI or cash collection record separate from invoice approval.
- FollowUpTask: human-visible task for communication failure, missing evidence, mismatch, or other automated exception.

Money uses decimal-safe or minor-unit fields and a configured ISO currency. Float values cannot represent final prices, invoice lines, settlements, or tax calculations.

## 5. Intake and service-area contract

### 5.1 Supported channels

| Channel | Status |
|---|---|
| MANUAL_SALES | Primary; staff records a phone conversation. |
| WEBSITE | Secondary public booking form. |
| GOOGLE_FORM | Retired; remove webhook, jobs, configuration, tests, templates, and UI references during implementation. |

### 5.2 Required flow

1. Validate and normalize intake fields, including canonical phone identity.
2. Evaluate the supplied operational location against active operating centres before persisting a Lead.
3. If inside a service area, create the accepted ServiceRequest/Lead with the matched centre and normal staff workflow.
4. If outside every service area, return a clear decline response and create only the minimal DeclinedEnquiry.
5. Never persist a rejected request as a Lead and never offer an appeal, transport price, or scheduling exception.

Public booking may create an in-area request but remains subject to Sales processing. Manual Sales intake never bypasses the service-area check.

### 5.3 Retired domain

Remove or retire all active references to:

- OUT_OF_RANGE and APPEAL_PENDING operational states;
- OutOfRangeAppeal data, services, routes, UI, localization, seed values, and tests;
- transport-fee configuration and notifications;
- Google Form shared-secret configuration, routes, sync jobs, and documentation;
- any route that can convert an out-of-area request into a schedule.

Existing non-empty client data must not be destructively removed without backup, explicit approval, and migration evidence. The approved fresh-handover database has no such client data.

## 6. Scheduling and operational state

### 6.1 Resource eligibility

Auto and manual scheduling require an eligible pilot, drone, and LMV from the appropriate operating centre:

- pilot: active, correct centre, no conflicting assignment, valid company-approved compliance state;
- drone: available, correct centre, no conflicting assignment, not in maintenance/out of service;
- LMV: available, correct centre, no conflicting assignment, not in maintenance/out of service, and valid company-approved compliance state.

The scheduler scores or selects triples of pilot, drone, and LMV. It must visibly send no-candidate cases to a staff queue. It must not silently assign a vehicle, crew, or centre that violates the policy.

### 6.2 Operational state machine

The accepted operational path remains:

PROCESSED → SCHEDULED → PILOT_ACCEPTED → IN_PROGRESS → COMPLETED

Supported exception paths include NEEDS_MANUAL_SCHEDULING, FLAGGED, and CANCELLED. Any transition must be server-enforced and audited.

At completion or cancellation:

- release the drone and LMV unless the event requires maintenance or out-of-service status;
- retain the operational record and coordinate-free audit trail;
- create or update the BillingCase without blocking the release.

## 7. Billing state machine

Operational completion starts a separate BillingCase:

AWAITING_EVIDENCE
  → EVIDENCE_RECEIVED
  → REVIEW_REQUIRED or READY_FOR_PRICING
  → INVOICE_DRAFT
  → SETTLEMENT_PENDING
  → SETTLED

Visible exception paths include missing evidence, duplicate evidence, unmatched flight leg, mismatch, rejected evidence, corrected invoice, voided invoice, and failed settlement. Every change requires an audit record with IDs and reasons only, never raw routes or evidence content.

### 7.1 Evidence rules

- A BillingCase can have multiple FlightLegs and multiple evidence records.
- Uploads and provider callbacks are idempotent by stable file/content/provider identifiers.
- Raw route distance is never a charge calculation.
- A Sales user approves the final acreage and releases an internal InvoiceDraft; Admin can correct through an audited path.
- Pilot and Fleet roles may submit evidence but cannot approve financial values.
- An optional LMV invoice line is manual and requires the same approved pricing/audit path.
- UPI and cash create Settlement records. A settlement cannot silently rewrite the approved invoice snapshot.

### 7.2 Vendor and retention gate

The first implementation uses an adapter boundary and approved manual/summary evidence. Raw telemetry upload and vendor API sync remain feature-disabled until the client supplies:

- drone/controller vendor and sample export;
- definition of usable evidence;
- retention, deletion, access, and incident policy;
- object-storage provider, encryption/key ownership, and backup policy.

When usable evidence arrives, a clean case should reach InvoiceDraft within 30 minutes. A delay or mismatch creates a visible FollowUpTask and monitoring signal.

Tax/GST issuance, provider-specific parsing, and historic financial/flight import are explicitly out of scope until company inputs are approved.

## 8. Customer portals and communication

### 8.1 Portal isolation

Farmer portal reads use verified canonical phone linkage. Business portal reads require explicit organization membership and request linkage. APIs must filter server-side; client-side filtering is insufficient.

No customer portal can:

- create a service-area exception;
- approve acreage, invoice, or settlement;
- see a pilot’s exact route or another customer’s records;
- access Admin, Fleet, Sales, or raw-evidence functions.

### 8.2 Messaging

Customer lifecycle messages support WhatsApp with SMS fallback. Delivery status, consent/opt-in where required, and provider failures are recorded without message content or credentials in logs.

When both automatic channels fail or a policy requires personal contact, create a FollowUpTask for staff. Do not build automated voice calling.

Password recovery remains a separate security workflow governed by the hardening register and must support approved channel fallback without revealing account existence.

## 9. Administration and import

Admin Operations Control must provide audited, validated, confirmation-protected management of:

- users, pilots, customer organizations, and account status;
- centres and strict service radii;
- drones and LMVs;
- maintenance/compliance state;
- operating/pricing configuration;
- requests, assignments, BillingCases, InvoiceDrafts, settlements, follow-up tasks, and alerts.

Excel/Zoho import begins with core masters only: staff, pilots, LMVs, drones, centres, customer organizations, and configuration. It uses a staging/import report, validation, canonical-phone deduplication, dry run, reconciliation owner, approved commit step, audit trail, and verified backup/restore. Historic flight and financial records are excluded from the first import.

## 10. Delivery, security, and observability

### 10.1 CI/CD

- Pull requests: backend tests, schema validation, frontend lint/build, browser acceptance, dependency/static/secret/image scans, and SBOM.
- Main branch: immutable images linked to source revision/digest and automatic staging deployment.
- Production: environment approval, pinned digest, backup and controlled migration, health/workflow checks, monitoring confirmation, and rollback window.

### 10.2 Production controls

- encrypted, tested backups with explicit RPO/RTO;
- TLS edge/reverse proxy and exact trusted-proxy configuration;
- externalized secrets and no secret-bearing documentation;
- redacted central logs, metrics, health checks, worker heartbeat, and alert routing;
- idempotent queue/worker processing with retries and dead-letter visibility;
- one isolated Compose stack per company, with no DB/backend public port.

## 11. Acceptance matrix

Implementation is not complete until evidence proves:

1. strict service-area validation works for phone Sales, public website, and authenticated portal-adjacent flows;
2. no appeal, Google Form, transport-fee, or Bhumeet production path remains active;
3. LMV conflict, maintenance, compliance, release, and audit checks work with pilot and drone checks;
4. phone-first intake, portal isolation, 30-day declined-enquiry purge, and WhatsApp/SMS/staff follow-up work;
5. evidence upload is idempotent, multi-leg cases reconcile, mismatches queue for review, and billing cannot hold fleet resources;
6. Sales/Admin invoice control, manual LMV line approval, UPI/cash settlement, and correction/void paths are tested;
7. staging, backup restore, migration/rollback, worker restart, alert delivery, and approved production promotion have recorded evidence.

## 12. Explicit exclusions until approved inputs exist

- operating Kubernetes;
- live raw telemetry ingestion or vendor cloud sync;
- tax/GST invoice issuance;
- historic financial or flight import;
- real WhatsApp/SMS/UPI/weather providers;
- unapproved customer branding, production values, or compliance thresholds.

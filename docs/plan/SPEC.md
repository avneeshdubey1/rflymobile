# Production Target Technical Specification

**Status:** approved future-state contract
**Last reviewed:** July 31, 2026
**Important:** this specification supersedes legacy product guidance. Phase 1 source changes retire the legacy intake paths and add strict intake enforcement, but the migration and staging acceptance evidence remain required before any production claim.

## Client intake and crew amendment — August 21, 2026

- Admin maintains active Cluster, Crop, Spray Purpose, B2B Sub-Category, B2C Classification and Lead Source masters. Cluster Type is owned by the Cluster (`CLUSTER`, `HUB`, `SPOKE`, or `MINIHUB`) and is derived in intake screens. `CLUSTER` is an honest transitional classification for client locations that have not yet been classified as a hub, spoke, or mini-hub.
- Staff lead intake records `B2B` or `B2C`; B2B requires an active B2B Sub-Category while B2C forbids it. Intake also records one active Cluster, Reporting Admin, Lead Source, Crop, and at least one active Spray Purpose.
- Seasonal crop, chemical brand/proof and manually selected drone fields are retired from the active staff lead form. Existing nullable legacy columns remain only for compatibility until a later removal migration is approved.
- A Pilot may have a preferred Drone and LMV at the Pilot's operating centre. These are non-exclusive preferences: multiple Pilots/Copilots may prefer the same office asset, and an asset may remain unpreferred as backup stock. An actual Assignment still reserves exactly one operational Drone and LMV exclusively for its service window; centre, serviceability, availability, compliance and overlap rules always take precedence.
- Fleet scheduling reserves one Primary Pilot, Drone and LMV. The Primary Pilot selects exactly one eligible Copilot in the Pilot application; lead entry never selects crew. Admin may make an audited manual Copilot assignment or override when operationally necessary; Fleet cannot bypass the Primary-Pilot flow.
- Before mission start, the assigned Primary Pilot may reject with a required reason. The rejection is retained, assets are released, and the lead moves to the visible Admin/Fleet manual-scheduling queue.

## 1. Scope and baseline

The product coordinates one agricultural drone-service company per isolated deployment. The approved target replaces four legacy assumptions:

1. Google Form/surveyor intake is no longer a supported operational channel.
2. Out-of-area appeal and transport-fee negotiation are removed.
3. A pilot, drone, and LMV are scheduled as one operational crew.
4. Billing is evidence-backed and separate from mission completion.

Current code remains a baseline, not proof of the complete target. Phase 1 removes active appeal, Google Form, and Bhumeet/mock intake paths from source; LMV, customer/portal isolation, internal OTP/Firebase retirement, Pilot centre enforcement, and operational-chat hierarchy have local source/test evidence. The incomplete immediate-payment surface and public Business self-registration are retired from the runtime until their approved replacement workflows exist. Billing evidence, live provider delivery, production worker/webhook/fallback, import, and staging work remain later packages. No code should claim the target is complete merely because this document exists.

## 2. Platform and deployment contract

| Area | Approved direction |
|---|---|
| Frontend | React/Vite SPA with localized farmer-facing content and an offline-capable pilot surface. |
| Backend | Node/Express, Socket.io, server-enforced authorization and state transitions. |
| Data | PostgreSQL through Prisma repositories only. |
| Deployment | One isolated Docker Compose stack, PostgreSQL volume, secret set, and domain per operating company. |
| CI/CD | GitHub Actions verifies every branch. A CI-passed `staging` revision deploys to an isolated internal office staging stack; an approved `staging` to `main` promotion deploys the CI-passed `main` revision to the separate production stack. |
| Scale path | Containers remain portable to Kubernetes; operating Kubernetes is deferred. |
| Files | Encrypted, external object storage for future raw billing evidence. Never database blobs for raw telemetry. |
| Queue/worker | A dedicated durable worker handles evidence processing and retryable billing jobs. |
| Phone verification | Application-owned, purpose-bound OTP challenges; a provider-neutral delivery adapter is configured through deployment secrets after the client selects and approves a provider. Firebase Authentication is not part of the target. |

Every service must be stateless except for approved persistent stores. Compose is the initial orchestration boundary, not a claim of high availability.

## 3. Roles and access

| Role | Allowed responsibility | Explicitly forbidden |
|---|---|---|
| Admin | Audited oversight, master-data control, correction, configuration, account administration, and billing correction. | Secrets, password hashes, raw SQL, audit-log rewrites. |
| Sales | Phone intake, request processing, customer follow-up, final-acreage approval, invoice-draft release, cash/UPI follow-up. | Fleet-resource conflicts, provider configuration, unrestricted customer access. |
| Fleet Manager | Pilot/drone/LMV availability, maintenance visibility, manual scheduling, operational exceptions. | Final billing approval unless granted a future explicit policy. |
| Pilot | Accept/start/complete own assignment, current active-mission location, evidence submission, and an optional exact B2C cash-handover report after completion. | Pricing approval, invoice release, settlement reconciliation, another crew's work. |
| Farmer | Optional verified-phone read-only view of matching requests, approved invoice drafts, and settlement state. | Creating a bypass around service-area checks or viewing other records. |
| Business | Optional read-only view of explicitly linked farm-group/company work, invoices, and settlements. | Viewing unrelated farmer data or administering staff. |

The server, not the UI, enforces every restriction. All privileged mutation endpoints require authentication, role checks, input validation, an AuditLog event, and negative authorization tests.

Operational direct chat follows the same authority order: `Admin > Fleet Manager > Sales > Pilot`. A higher role may initiate only with a lower role; the superior sends the first message before a subordinate may reply. Pilot cannot initiate a chat. Fleet Manager may initiate with Sales or Pilot, Sales may initiate with Pilot, and Admin may initiate with any lower operational role. Only Admin may close a chat. Admin may oversee all operational chat sessions; every other role sees only sessions in which it participates.

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

#### CX-01 current-state map and replacement seams

The current source retains legacy contact fields on Lead while also providing a lightweight Customer linkage:

- `Customer` stores the canonical phone identity and optional linked Farmer user. Legacy `Lead.farmerName` and `Lead.farmerPhone` remain for compatibility.
- Sales phone intake enters a `MANUAL_SALES` Lead through `POST /api/leads/ingest/manual`.
- Public booking enters a `WEBSITE` Lead through `POST /api/leads/ingest/website`.
- Authenticated Farmer booking enters through `POST /api/leads/new` and uses the signed-in Farmer user's name and phone.
- Farmer portal login now uses the application-owned OTP request/verify flow under `/api/auth/farmer/request-otp` and `/api/auth/farmer/login`; Firebase proof is removed. Farmer self-registration is retired until an approved invitation/link workflow exists.
- Business login and recovery use the Business user role paths under `/api/auth/business/*`; Business recovery now uses application-owned OTP under `/api/auth/business/recovery/request-otp` and `/api/auth/business/recovery/complete`. Organization membership/linkage has local portal-isolation implementation.
- Sales has a searchable customer table, staff-confirmed customer creation, and a staff-scoped service view that raises a request without issuing or impersonating a Farmer session.

The implemented Sales-assisted rules are:

1. Use canonical-phone Customer lookup/create services for Sales and controlled Admin enablement.
2. Let Sales search registered customers by safe identifiers and create a staff-confirmed Customer record during a call without OTP.
3. Preserve the customer's own public/Farmer request option; do not remove the Farmer request surface.
4. Add a staff-scoped "Farmer Service View" that lets Sales raise a request on behalf of a selected customer while retaining the Sales user's own session, role, CSRF, and audit identity.
5. Do not issue a real Farmer session to Sales and do not silently impersonate the Farmer. Every staff-assisted action records the Sales actor, selected customer, and safe reason/context.
6. Continue strict service-area validation for Sales-assisted, public website, and authenticated Farmer-created requests.
7. Keep OTP out of this Sales-assisted path. OTP is required only when the Farmer is proving phone possession for their own external portal access or for an approved phone-link/invitation flow.

DeclinedEnquiry may store only contact name, canonical phone, source channel, generic decline reason, created time, expiry time, and non-sensitive staff/system identifiers. It must not store the rejected address, coordinates, distance, acreage, route, appeal, payment, or assignment. A daily idempotent purge removes it after 30 days.

### 4.2.1 Phone verification and delivery

- PhoneVerificationChallenge: an opaque challenge ID, recipient reference or protected short-lived canonical-phone value, purpose, code HMAC, expiry, attempt counters, resend/cooldown state, one-time consumption state, and minimal lifecycle timestamps.
- VerificationDeliveryAttempt: a separately recorded provider/channel attempt with a safe provider reference, sanitized status, retry/fallback reason, and timestamps. It must not store an OTP, message body, provider secret, or raw webhook payload.

The initially approved purposes are `FARMER_PORTAL_AUTH`, `FARMER_PHONE_LINK`, and `BUSINESS_RECOVERY`. A code is bound to one recipient and one purpose; it cannot be reused for another account, purpose, role, phone change, or reset. A provider delivery receipt is evidence of transport only, never proof that the recipient owns an application account.

Only the server can create, verify, replace, revoke, or consume a challenge. It uses a cryptographically secure 6-digit numeric code, stores only a dedicated-secret HMAC of that code, uses constant-time comparison, and transactionally invalidates a consumed or superseded challenge. The approved initial policy is: 5-minute challenge expiry, 5 verification attempts, 30-second resend cooldown, one active challenge per recipient and purpose, same-day delivery-attempt retention for successful/consumed challenges, 7-day retention for failed/abuse/dead-letter metadata, and no raw OTP retention outside an explicit local/test CLI display. Budget and provider-rate limits remain company configuration after provider selection.

### 4.3 LMV fleet

- LMV: unique registration, optional label, centre, lightweight capacity placeholder, availability state, optional notes, append-only status/retirement activity, and accountable maintenance requests. Insurance, permit, fitness, pollution, odometer, repair work orders, and detailed service costs remain deferred until the company asks for those fields.
- Assignment target: requires primary Pilot, Copilot, drone, and LMV references. Both crew members may perform driving and field-operation duties; do not create a separate fixed driver role.

Required LMV states are AVAILABLE, ASSIGNED, MAINTENANCE, and OUT_OF_SERVICE. Scheduling reserves one two-person crew and one drone per LMV. For the first LMV release, MAINTENANCE and OUT_OF_SERVICE block scheduling; detailed compliance dates and warning windows remain future placeholders. The development branch has an additive nullable-Copilot migration for legacy rows and requires a Copilot for every new assignment; production migration evidence remains required.

An operational unit may receive multiple jobs on the same day. Each job records its required service time and daily sequence. Server-side conflict checks cover both crew members, the drone, and the LMV. Manual sequencing is acceptable initially; route optimization requires later client rules and acceptance data.

Every Pilot account requires an active `homeCenterId` at creation. Admin and Fleet Manager may update that centre through the audited Pilot-centre workflow, but an active assignment blocks the move. Assignment creation and rescheduling must revalidate that the Pilot is active, unarchived, has role PILOT, and belongs to the request's matched operating centre.

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
- create or update the BillingCase without blocking the release once the billing package is implemented.

Until that package exists, mission completion must not create a price, payment, settlement, or invoice from manually entered acreage. The retired immediate-payment routes and UI remain unavailable.

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

### 8.3 Application-owned phone verification

Firebase Authentication is an SMS-only legacy proof mechanism and is retired from the target. The server, not Firebase, the browser, or a delivery provider, owns every OTP lifecycle. The existing opaque server session remains the only application session; no Firebase ID token or third-party identity token is accepted after cutover.

The standard flow is:

1. A public or authenticated caller requests one approved purpose using a normalized phone number.
2. The server applies account/purpose, phone, IP, global, and provider-budget controls; gives a generic non-enumerating response; creates or safely replaces one challenge; and places delivery in a durable outbox.
3. A worker sends an approved WhatsApp authentication template through the selected adapter. It invokes SMS fallback only after a terminal WhatsApp failure or an approved delivery timeout, never merely because a send request was accepted.
4. Signed, replay-safe, idempotent provider webhooks update delivery status only. They cannot verify a challenge or issue a session.
5. The frontend submits the opaque challenge ID and code only to the application server. A successful one-time verification performs the permitted action and creates the normal opaque session where appropriate.

#### Provider adapter and configuration contract

The OTP core exposes a small provider port: `sendAuthenticationOtp`, `verifyWebhook`, `normalizeDeliveryEvent`, and declared channel capabilities. It has a disabled production-safe adapter, a deterministic test adapter, and an explicit local developer CLI/console adapter before any real provider adapter exists. The CLI/console adapter may display the OTP in a local terminal window only when the application is running in an approved development/test mode; it must fail closed in production, must not return the OTP to the browser, and must not write the OTP to AuditLog, persistent application logs, fixtures, reports, or documentation. A provider-specific adapter translates that port to the selected provider's request format, sender/template requirements, delivery callbacks, and signature verification without changing challenge or session logic.

`OTP_DELIVERY_PROVIDER` is a validated configuration selector for an installed adapter; the default is disabled. Provider credentials, sender identifiers, template identifiers, endpoints, and webhook secrets are supplied only through the deployment secret store or mounted secret files, never source, fixtures, browser configuration, or documentation. An arbitrary API key alone cannot make an unknown provider work: its adapter must be implemented, reviewed, sandbox-tested, and added to the allowed selector before the configuration is accepted.

Meta Cloud API is a researched candidate, not a chosen dependency. If the client selects it, business verification, sender registration, approved localized templates, opt-in wording, webhook validation, current India rate-card confirmation, sandbox delivery, and budget alerting become activation gates. Any selected SMS adapter must meet the applicable Indian sender, header, template, and consent requirements.

No raw OTP, full phone number, message body, provider credential, raw webhook payload, or provider error payload may enter an AuditLog, application log, fixture, browser response, or operational report. If a worker must retain a send payload, it is encrypted, TTL-bound, access-limited, and deleted with the challenge; otherwise the fallback issues a replacement challenge without retaining the prior code. Failed automatic delivery creates a visible staff task, but staff must never ask for or relay a code.

Phone possession is not automatic portal enrolment. Only an active, explicitly linked Farmer/Business account or an approved invitation can receive portal access. Open public self-registration is not approved unless the client makes and records that separate product decision. Phone OTP is not sufficient for privileged Admin recovery; Admin recovery needs an approved stronger/manual process.

### 8.4 Firebase retirement and cutover

The application already owns its users, roles, local phone identities, and opaque sessions; no Firestore, Storage, or Firebase identity data migration is expected. Existing users must prove the local phone identity again at their next affected action after cutover.

The implementation sequence is: build and test the internal challenge, provider port, disabled/test/CLI adapters, configuration validation, and outbox path; replace all browser Firebase flows; move Business recovery to the internal proof; then immediately remove Firebase packages, configuration, SDK initialization, environment references, deployment references, and Firebase-specific tests in the same internal OTP cutover. Real WhatsApp/SMS adapters and provider-process activation are held behind the client/provider gate and are not required before Firebase removal, because local/test validation uses the disabled, deterministic, and CLI adapters. Revoke external Firebase service-account access through the owner after repository removal. No permanent dual-provider compatibility path is approved.

## 9. Administration and import

Admin Operations Control must provide audited, validated, confirmation-protected management of:

- users, pilots, customer organizations, and account status;
- centres and strict service radii;
- drones and LMVs;
- maintenance/compliance state;
- operating/pricing configuration;
- requests, assignments, BillingCases, InvoiceDrafts, settlements, follow-up tasks, and alerts.

Excel/Zoho import begins with approved customer/farmer records and core masters only: staff, pilots, LMVs, drones, centres, customer organizations, and configuration. It uses a staging/import report, validation, canonical-phone and source-ID deduplication, dry run, reconciliation owner, approved commit step, audit trail, and verified backup/restore. Historic flight and financial records are excluded from the first import. The first importer is a controlled one-time operational script, not a standing browser feature.

## 10. Delivery, security, and observability

### 10.1 CI/CD

- Pull requests: backend tests, schema validation, frontend lint/build, browser acceptance, dependency/static/secret/image scans, and SBOM.
- Staging branch: immutable images linked to source revision/digest and automatic deployment to the isolated internal staging stack.
- Main branch: production promotion only from approved staging, followed by backup and controlled migration, health/workflow checks, monitoring confirmation, and a rollback window.

### 10.2 Production controls

- encrypted, tested backups with explicit RPO/RTO;
- TLS edge/reverse proxy and exact trusted-proxy configuration;
- externalized secrets and no secret-bearing documentation;
- redacted central logs, metrics, health checks, worker heartbeat, and alert routing;
- idempotent queue/worker processing with retries and dead-letter visibility;
- a durable verification-delivery outbox, signed webhook processing, delivery/fallback metrics, and provider-budget alerts that contain no OTP or message content;
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
8. application-owned OTP challenges reject enumeration, replay, wrong-purpose, expired, excessive-attempt, and delivery-webhook attacks; WhatsApp-to-SMS fallback is controlled; and no Firebase package, configuration, or accepted proof remains after cutover.

## 12. Explicit exclusions until approved inputs exist

- operating Kubernetes;
- live raw telemetry ingestion or vendor cloud sync;
- tax/GST invoice issuance;
- historic financial or flight import;
- live WhatsApp/SMS/UPI/weather providers before their approved accounts, templates, rate/usage controls, sandbox evidence, and security gates exist;
- Firebase Authentication or a Firebase compatibility path after the approved phone-verification cutover;
- unapproved customer branding, production values, or compliance thresholds.

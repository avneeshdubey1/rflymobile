# RFLY DaaS Source-Free Architecture Review Brief

**Status:** current, sanitized reviewer handoff
**Observed:** August 25, 2026
**Audience:** internal reviewer without repository, server or customer-data
access

## 1. Review purpose and evidence boundary

RFLY DaaS coordinates farmer/customer intake, service-area validation, field
crew scheduling, drone and LMV use, mission execution, customer visibility and
the later billing handoff. This document supports an architecture and product
correctness critique without exposing source code, infrastructure coordinates,
credentials, customer records or operational workbooks.

A source-free review can challenge domain boundaries, threat assumptions,
workflow completeness, data ownership, privacy and release controls. It cannot
prove implementation quality, vulnerability absence, test coverage or runtime
correctness. Any such conclusion must be labelled as a question or hypothesis
until maintainers provide scoped evidence.

## 2. Operational lifecycle

```text
phone/web/customer intake
  -> canonical customer identity and phone normalization
  -> farm location and strict service-area decision
  -> Lead/service request
  -> schedule Primary Pilot + Copilot + Drone + LMV
  -> crew acceptance and mission execution
  -> completion releases fleet resources immediately
  -> separate evidence, invoice and settlement process
```

The client-approved crew model uses a Primary Pilot and Copilot. The scheduled
Primary Pilot normally selects an eligible Copilot; Admin has an audited
override. Eligibility and conflicts are server-enforced. A Pilot marked offline
cannot receive work. Foreground mission location is accepted only for an
assigned, accepted or active mission; background tracking and route history are
disabled.

## 3. Roles and trust boundaries

| Role | Current operational purpose |
|---|---|
| Admin | Account, master-data, service-area and fleet oversight; scheduling and exceptional Copilot override. |
| Fleet Manager | Fleet availability, scheduling, exceptions and active mission oversight. |
| Sales | Phone-first customer creation/search and service-request intake. |
| Pilot | Availability, assigned work, Copilot selection, mission actions, offline sync and foreground active-mission location. |
| Farmer | Phone-linked status portal and secondary self-service request path. |
| Business | Account-isolated visibility for explicitly linked jobs and later commercial records. |

Authorization must be enforced by the backend. Hiding a screen or button is not
an access-control decision. Browser sessions, Farmer OTP and mobile installation
tokens are separate authentication boundaries.

## 4. Current technical architecture

### User clients

- The browser client is React/Vite and serves the employee, Farmer and Business
  role workspaces.
- The Pilot client is Expo/React Native. It uses a versioned mobile API, secure
  token storage, local SQLite-backed offline state and foreground location.
- An interim Operations Android client is a Capacitor WebView wrapper around
  the responsive web SPA. It is useful for controlled web-parity demonstrations
  but is not the planned native non-Pilot application.
- The planned native Operations Companion will be a separate Expo/React Native
  application for Admin, Fleet, Sales, Farmer and Business. Its implementation
  is incomplete.

### Application and data layers

- Node.js/Express and Socket.IO provide HTTP and real-time application services.
- Routes and controllers perform transport validation; services own domain
  transitions; repositories are the only normal Prisma/database access layer.
- Prisma manages the PostgreSQL schema and reviewed additive migrations.
- PostgreSQL stores operational masters, customer identity, Leads, assignments,
  fleet state, audit records, mobile installations and import evidence.
- Application containers run in isolated Docker Compose stacks. Database and
  backend services are not intended to publish host ports directly.

### Identity and security boundaries

- Employee browser authentication uses server sessions/cookies and CSRF
  protection for state changes.
- Farmer phone proof is application-owned: the server creates, hashes,
  rate-limits, expires and consumes OTP challenges. A future provider only
  transports WhatsApp/SMS messages.
- Mobile clients use app-scoped, installation-bound bearer sessions and
  versioned DTOs. Pilot and Operations tokens are not interchangeable.
- Role, assignment, state-machine and resource-conflict rules belong on the
  server. Audit records must exclude credentials and exact coordinates.

## 5. Scheduling and fleet model

An assignment reserves four resources: Primary Pilot, Copilot, Drone and LMV.
Resources must be active, compliant, available, centre-compatible and free of
overlapping work. One crew can receive multiple explicitly ordered jobs in a
day. Mission completion or cancellation releases Drone and LMV capacity without
waiting for billing.

The scheduling engine supports automatic assignment, manual assignment,
rescheduling and a visible manual fallback queue. Automation is not allowed to
silently drop an unsatisfied request. Pointer drag/resize acceptance remains a
known calendar UI evidence gap even though server-side conflict enforcement is
present.

## 6. Data migration and master data

Customer, historical-service, village-visit, Drone and client-master data use
reviewed one-shot operator tools rather than browser upload buttons or direct
SQL. The guarded pattern is:

```text
read-only preflight -> deterministic plan -> human review -> verified backup
-> explicit Admin approval -> atomic/idempotent commit -> reconciliation
```

Imports must preserve existing production customers, fail on plan drift, avoid
demo accounts and emit PII-safe reports. A code deployment does not seed, wipe
or automatically import customer data.

## 7. CI/CD and release controls

The branch path is `dev` -> reviewed `staging` -> maintainer-promoted `main`.
Hosted CI checks backend migrations/tests, frontend lint/build, Pilot mobile
type/tests/Expo health and a disposable isolated Compose stack. Main CI also
produces vulnerability, image-digest and Software Bill of Materials evidence.

Successful staging and main CI trigger exact-commit deployments on a dedicated
office self-hosted runner. Deployment backs up PostgreSQL before migration,
applies reviewed migrations once, starts the scoped stack and verifies health.
Android artifacts are commit-addressed, checksum-labelled and short-lived.
Internal direct-IP APKs currently use HTTP and debug signing; they are not Play
Store releases.

## 8. Implemented versus incomplete

### Implemented core

- Employee role login and guarded account management.
- Customer search/create and phone-first service-request intake.
- Strict service-area validation and no appeal workflow.
- Pilot/Drone/LMV masters and two-person crew scheduling rules.
- Automatic/manual assignment, conflict checks and mission-state transitions.
- Pilot native authentication, bootstrap, assignments, offline action sync,
  availability, Copilot workflow and scoped foreground location.
- Guarded workbook/master import flows and migration/backup deployment gates.
- Web production, isolated staging, release-image evidence and internal Android
  artifact workflows.

### Incomplete or intentionally disabled

- Full billing-evidence review, invoicing and settlement workflow.
- Approved WhatsApp provider with SMS fallback.
- Raw telemetry ingestion and retention policy.
- External encrypted object storage for evidence.
- Complete production TLS/domain, company release signing and Play ownership.
- Full monitoring/alert ownership and proven restore schedule.
- Native non-Pilot Operations Companion and its offline/capability parity.
- Background Pilot tracking and route-history collection.

## 9. Known review risks

1. The office production endpoint is temporarily public HTTP. Authentication
   credentials and tokens are not transport-encrypted until TLS is deployed.
2. The production Compose override still carries historical development-mode
   compatibility and should be removed during the TLS production cutover.
3. The interim Operations APK is a WebView shell, not a native/offline client;
   expectations must be labelled accordingly.
4. Canonical plans include target behaviour that can be ahead of current code.
   Reviewers must distinguish approved target from verified implementation.
5. Billing, delivery-provider, telemetry and some operational-observability
   gates are deliberately incomplete.
6. Legacy/prototype documents and exports exist locally; they are not current
   engineering authority.
7. Administrative/demo preparation endpoints and public registration
   assumptions should receive a focused authorization and release-mode review.

## 10. Review checklist

Please report concrete questions and failure scenarios under these headings:

- **Domain correctness:** Are customer, Lead, assignment, mission and billing
  states separated correctly? Which transitions are ambiguous?
- **Authorization:** Can every mutation be tied to an allowed role, target
  resource and server-side policy? What cross-role leakage should be tested?
- **Data integrity:** Which uniqueness, overlap, state and historical-record
  invariants should exist in both services and the database?
- **Mobile/offline:** Are commands idempotent, ordered and safely retried? What
  happens after token revocation, device loss or long offline periods?
- **Privacy:** Is exact location minimized, scoped, retained and disclosed?
- **Failure handling:** Does each automation failure enter a visible human
  queue? Are recovery and rollback behaviours explicit?
- **Quality:** Which happy, rejected, concurrent and recovery paths lack test
  evidence? Which workflows require physical-device/browser acceptance?
- **Operations:** Are health, backup, restore, monitoring, secrets, SBOM,
  vulnerability and rollback ownership sufficient?
- **Usability/accessibility:** Can rural/low-bandwidth users understand pending,
  failed and synchronized states? Are role workflows keyboard/mobile usable?

Use this finding format:

```text
Finding title:
Area:
Assumption being challenged:
Failure scenario:
Business/security impact:
Evidence needed:
Suggested acceptance test:
Severity rationale:
```

## 11. Documents safe and useful to share

Recommended reviewer packet:

1. This document.
2. `CONTEXT.md` for business rationale and operating assumptions.
3. `SPEC.md` for the approved target contract, clearly labelled as target state.
4. `production_hardening.md` for open release gates.

Do not share server/VPN handoffs, CI/CD operations paths, live migration
runbooks, deployment environment files, workbooks, database dumps, raw logs,
generated APK signing material, attachments or documents under
`unrealted_docs_for_current_version/`. Those are unnecessary for a source-free
review and may contain operationally sensitive or obsolete context.

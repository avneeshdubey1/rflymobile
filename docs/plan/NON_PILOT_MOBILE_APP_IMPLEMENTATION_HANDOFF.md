# RFLY Operations Companion Implementation Handoff

**Status:** canonical execution handoff for the non-Pilot mobile application  
**Recorded:** August 23, 2026  
**Application:** RFLY Operations Companion  
**Roles:** Admin, Fleet Manager, Sales, Farmer/customer, Business/B2B  
**Excluded role:** Pilot; Pilot Field remains a separate Android application

## 1. Instruction to the next AI agent

Build one separately packaged Expo/React Native Android application for every
supported user except Pilot. Start by extending and testing the existing Node.js
mobile API. Do not begin by pasting Stitch HTML or recreating website screens.

Read this file completely, then follow the repository entry point at
`docs/plan/AGENTS.md`. Inspect current source and branch tips before changing
anything. Planning documents describe intent; current routes, services,
repositories, contracts, migrations and tests remain the executable baseline.

Use normal branch flow:

```text
dev -> reviewed PR -> staging -> reviewed promotion -> main
```

Do not change production data while developing the app. Do not run an importer,
seed, bootstrap, database wipe, `prisma db push`, raw SQL mutation or ad-hoc
`node -e` data script.

## 2. Completed hotfix boundary

The August 2026 web/client-master hotfix is closed for mobile planning. Treat it
as the current domain baseline unless an observed regression is separately
reported.

The closed scope includes:

- RFLY DaaS product naming and the simplified New Lead navigation;
- customer/lead Cluster and Cluster Type support;
- B2B/B2C request classification and conditional B2B subcategory;
- Crop, Spray Purpose, Lead Source and Reporting Admin master-backed inputs;
- removal of the superseded seasonal-crop, chemical-proof, discount and manual
  Drone-selection inputs from the intake flow;
- current Primary Pilot/Copilot and Admin override rules;
- safer manual-queue removal/navigation behaviour;
- the guarded client-master workbook importer; and
- imported client reference masters, inactive Pilot roster records, and
  out-of-service Drone/LMV records.

The maintainer declared the production hotfix/import complete on August 23,
2026. A future agent may perform read-only API/UI verification, but must not
rerun or amend the production import merely to begin mobile work. PRICE remains
excluded and is not an approved pricing implementation.

## 3. Existing planning assets

These files already exist and remain supporting inputs:

- `STITCH_NON_PILOT_MOBILE_APP_HANDOFF.md`: complete screen and interaction
  design brief.
- `STITCH_NON_PILOT_REVISION_HANDOFF.md`: corrections to the first incomplete
  Stitch export and rejection of fabricated capabilities.
- `MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`: two-application boundary,
  role/capability rules and shared mobile security direction.
- `GEMINI_MOBILE_INTEGRATION_HANDOFF.md`: older integration details for the
  first Operations API slices. Its historical status statements are stale;
  verify source before using them.
- `one-ness planning.md`: wider parity-planning context for web, Pilot Field and
  Operations Companion.
- `CICD_OPERATIONS_CONTEXT.md`: current CI/CD and Android build rules.

This document supplies the missing implementation sequence connecting those
inputs to a functional, tested application.

## 4. Product and application boundary

RFLY has one server-owned operational domain and three clients:

1. the existing web SPA;
2. RFLY Pilot Field for Pilot accounts; and
3. RFLY Operations Companion for all approved non-Pilot roles.

Operations Companion is one app with server-selected role workspaces. It is
not five unrelated apps and it has no client-side role picker after login.

Authentication entry paths are distinct:

- Admin, Fleet Manager and Sales: employee email/password;
- Farmer/customer: application-owned phone OTP;
- Business/B2B: staff-provisioned Business credentials and only the approved
  recovery flow.

The server returns the authenticated role and capabilities. Navigation and
actions derive from those capabilities. Changing a route, local value or UI
state must never grant another role.

The app never connects to PostgreSQL. It uses only versioned HTTP APIs. Prisma
is confined to backend repositories.

## 5. Verified source baseline to inspect first

At this handoff, there is no production Operations Companion source directory.
The repository contains `pilot-mobile/` and Stitch design exports, but Stitch
exports are not application code.

The existing backend mobile boundary includes:

```text
POST   /api/mobile/v1/operations/auth/login
GET    /api/mobile/v1/operations/bootstrap
GET    /api/mobile/v1/operations/sales/customers
GET    /api/mobile/v1/operations/sales/customers/by-phone
POST   /api/mobile/v1/operations/sales/customers
POST   /api/mobile/v1/operations/sales/customers/:customerId/leads
GET    /api/mobile/v1/operations/fleet/schedule
GET    /api/mobile/v1/operations/fleet/exceptions
POST   /api/mobile/v1/operations/assignments/:assignmentId/copilot-override
POST   /api/mobile/v1/auth/logout
POST   /api/mobile/v1/auth/logout-all
DELETE /api/mobile/v1/installations/:installationId
```

The current `OPERATIONS` mobile session supports Admin, Fleet Manager and Sales.
Farmer and Business currently use browser-oriented portal authentication and
summary routes; they do not yet have a complete installation-bound mobile
session and mobile DTO boundary. This must be solved on the server before their
mobile screens become functional.

The first implementation task must inventory the current branch and update this
endpoint list. Do not assume every website action already has a safe mobile API.

## 6. Binding engineering invariants

1. Routes/controllers call services; services call repositories; only
   repositories use Prisma.
2. Permissions, role capabilities, geofence decisions, assignment conflicts,
   state transitions and idempotency are enforced on the server.
3. Every state mutation writes a credential-free and coordinate-free audit
   event through the approved audit service.
4. Mobile responses are minimal role-specific DTOs validated against a
   versioned contract. Never return broad Prisma objects.
5. Tokens and installation keys use Android secure storage. They never enter
   AsyncStorage, ordinary SQLite, logs, analytics or source.
6. Cached user data is encrypted/user-scoped and purged on logout, revocation
   and account change.
7. Offline UI never reports success until the server confirms it.
8. Exact GPS remains latest-mission operational data only. No route history,
   background tracking or audit-log coordinates.
9. Firebase Authentication remains retired. OTP generation, hashing, expiry,
   attempts and consumption remain application-owned; providers only deliver.
10. Do not weaken browser security, CSRF, mobile bearer isolation, rate limits,
    response validation, migrations or CI to accelerate the mobile UI.
11. Do not hardcode credentials, client records, production URLs, company
    thresholds, master values or business policy.
12. Stitch output is design evidence only. Implement repository-native React
    Native components.

## 7. Target role/capability boundary

| Capability | Admin | Fleet | Sales | Farmer | Business |
|---|---:|---:|---:|---:|---:|
| Employee/mobile session management | Full | Own | Own | Own OTP session | Own |
| Customer search/read | Yes | Bounded read | Yes | Own profile only | Linked records only |
| Customer registration | Yes | No | Yes | No self-registration | No |
| Lead/request intake | Staff-assisted | No | Staff-assisted | Own request | Only if later approved |
| Schedule read | Full | Full | No | Own safe status | Linked safe status |
| Schedule/reassign | Override | Authorized | No | No | No |
| Crew exception/override | Yes | Yes | No | No | No |
| Drone/LMV/Pilot management | Yes | Bounded | No | No | No |
| Feasible regions and policy | Yes | Read/bounded where approved | No | Result only | Result only |
| Latest active-mission Pilot location | Yes | Yes | No | No | No |
| Employee/master administration | Yes | Only explicitly exposed Fleet controls | No | No | No |
| Own/linked notifications | Yes | Yes | Yes | Yes | Yes |

Pilot mission execution, Pilot availability, Copilot selection by the Primary
Pilot and Pilot foreground-location submission remain in Pilot Field.

## 8. Delivery graph

```text
OC-00 baseline freeze and capability inventory
  -> OC-01 shared mobile contract/security reconciliation
      -> OC-02 non-Pilot authentication and bootstrap
          -> OC-03 shared app foundation and role shells
              -> OC-04 Sales/customer intake slice
              -> OC-05 Fleet schedule/exception slice
              -> OC-06 Admin operational slices
              -> OC-07 Farmer OTP/portal/request slice
              -> OC-08 Business isolation slice
          -> OC-09 offline/cache/notification policy
      -> OC-10 contract, security and cross-client regression
  -> OC-11 Android CI, staging APK and physical-device acceptance
  -> OC-12 production API/release readiness and Play release
```

Each package is a separate reviewable commit or small commit series. Do not
combine authentication, schema migration, every role UI and deployment into one
change.

## 9. Detailed implementation packages

### OC-00 — Freeze and inventory the current baseline

- Record branch/SHA and current staging/main deployment SHA.
- Run existing backend, frontend, Pilot-mobile and container checks.
- Inventory every website capability required by the five non-Pilot roles.
- Inventory current `/api/mobile/v1/operations` routes and DTO fixtures.
- Classify each desired screen as implemented API, reusable service, missing
  mobile DTO, missing domain capability or deferred policy.
- Confirm that client-master dropdown data is read from the server and never
  duplicated as app literals.

**Done when:** a traceable matrix maps every approved screen ID to a server
capability and no planned button lacks an authorized backend outcome.

### OC-01 — Reconcile the shared mobile contract

- Keep the existing versioned `/api/mobile/v1` boundary unless a breaking
  contract demonstrably requires v2.
- Extend the JSON contract and sanitized fixtures for Operations Companion.
- Centralize stable error codes, request IDs, timestamps, decimal strings,
  pagination/cursors and capability names.
- Decide compatibility for the existing `OPERATIONS` mobile app enum before a
  migration. Prefer retaining it as the server identity while branding the
  client “RFLY Operations Companion” unless a security requirement needs a new
  enum value.
- Add minimum DTOs for notifications, profiles and server-backed master choices
  only as their slices require them.

**Tests:** schema fixture validation, extra/missing field rejection, role-negative
DTO tests and response-size/minimum-data assertions.

### OC-02 — Complete authentication and capability bootstrap

- Retain installation-bound bearer sessions, idle/absolute expiry, two-device
  limit, logout, logout-all and Admin lost-device revocation.
- Keep employee email/password login for Admin/Fleet/Sales.
- Add a versioned Farmer mobile OTP request/resend/verify flow that reuses the
  application-owned challenge service without browser cookies or CSRF.
- Add Business mobile credential login and approved recovery without exposing
  whether an arbitrary account exists.
- Extend the Operations app role allow-list only through explicit role tests.
- Return role-specific profile, capabilities, feature flags, version policy,
  server time and operating timezone from bootstrap.
- Provide no post-login role picker.

**Tests:** valid login per role, wrong app, wrong role, inactive/archived user,
OTP expiry/reuse/cooldown/attempt limit, installation limit, revoked session,
401/403/426, logout data boundary and generic credential failures.

### OC-03 — Create the application foundation

Create `operations-mobile/` as a separate Expo/React Native application using
the repository-supported Expo SDK and Android tooling proven by `pilot-mobile/`.
Do not copy Pilot navigation or mission state.

Implement:

- unique package/application identity and versioning placeholders;
- local, staging and production environment profiles;
- no hardcoded API address;
- centralized API transport, bearer injection, timeout and safe errors;
- runtime response validation against maintained TypeScript schemas;
- secure installation/session storage;
- encrypted user-scoped local database where caching is approved;
- splash/session restoration, login gateway, mandatory upgrade, access denied,
  offline and profile/security shells;
- server-capability navigation for all five roles; and
- shared navy/orange design tokens matching Pilot Field.

**Done when:** each synthetic role can authenticate against a disposable/staging
server, receive only its navigation shell and log out without leaving user data.

### OC-04 — Sales and customer-intake slice

Use the existing mobile Sales endpoints and current hotfix contract. Add only
missing bounded endpoints/fields through services and repositories.

Implement:

- exact normalized-phone lookup and debounced customer search;
- duplicate-aware customer registration;
- customer detail and “New Lead” entry;
- server-backed Cluster/Cluster Type, Crop, Spray Purpose, B2B/B2C,
  conditional B2B subcategory, Reporting Admin and Lead Source choices;
- map pin/address/Plus Code capture resolved to numeric coordinates before
  server submission;
- strict geofence accepted/manual-scheduling/contact-only-decline outcomes;
- no appeal and no manual Drone choice; and
- loading, empty, validation, offline draft, server conflict and retry states.

High-impact submissions require an online server confirmation. An unsent local
draft may be stored, but must not appear as a created customer or lead.

### OC-05 — Fleet schedule and exception slice

Start with implemented schedule projection, exception queue and reasoned
Copilot override. Then add bounded mobile mutations only where the current web
service already has a safe shared domain operation.

Implement:

- day/week ordered schedule;
- assignment detail with Primary Pilot, Copilot, Drone, LMV, centre, window and
  sequence;
- manual queue and explicit server reason codes;
- Copilot override with eligibility, expected revision and mandatory reason;
- conflict refresh rather than overwrite;
- Drone/LMV/Pilot read/detail/status/centre controls only when mobile endpoints
  explicitly authorize them; and
- latest active-mission Pilot location with explicit map loading.

Do not fake calendar drag/drop, reassignment, resource transfer or status
mutation if the API is read-only. A visible accessible “Move assignment” action
is required whenever pointer drag is eventually enabled.

### OC-06 — Admin operational slices

Expose Admin capabilities progressively in this order:

1. operational home and review queues;
2. customers and staff-assisted intake reuse;
3. assignment list/detail and Fleet exception reuse;
4. Team management with one protected Admin;
5. Drone, LMV and Pilot management/centre transfer guards;
6. feasible-region management with map/Plus Code/radius confirmation;
7. auto-assignment policy with revision conflict protection;
8. server-backed master-data management for specified roles; and
9. latest active-mission Pilot location.

Every Admin mutation requires server authorization, confirmation, audited
reason where applicable, and explicit stale/conflict handling. Never expose
secrets, password hashes, database controls or audit-history mutation.

### OC-07 — Farmer OTP, portal and request slice

- Add Farmer mobile OTP session support from OC-02.
- Return only the phone-linked customer’s profile, services and requests.
- Build the five-step request wizard: service/crop, location, preferred window,
  review and server result.
- Reuse current server-backed masters and strict geofence rules.
- Permit local drafts; require online submission and authoritative result.
- Show safe assignment/request status without internal notes, staff data,
  exact crew contact details or other customers.
- Use localization for every touched Farmer-facing string.

No Farmer self-registration resurrection, appeal flow, raw coordinates or
client-authoritative status changes.

### OC-08 — Business/B2B isolation slice

- Add Business mobile session support from OC-02.
- Return organization identity and only explicitly linked requests/records.
- Enforce membership/link isolation in repositories and services.
- Provide overview, linked request list/detail, notifications and profile.
- Add a Business-created request only if an approved server capability exists;
  otherwise omit the control.

Do not invent commissions, GST invoices, payments, settlements, subscriptions
or commercial dashboards.

### OC-09 — Offline, caching and notifications

Use this policy unless a stricter approved requirement replaces it:

| Operation | Offline policy |
|---|---|
| Previously viewed bounded lists/details | Encrypted read cache with stale label |
| Farmer/Sales unsubmitted form | Encrypted local draft |
| Customer/lead/request creation | Online confirmation required; explicit retry |
| Schedule/resource/policy/team mutation | Online only; never silently queued |
| Notification read acknowledgement | Queue only if idempotent contract exists |
| Logout/revocation/account switch | Purge user-scoped cache and pending drafts |

All pending/retry/conflict states are visible. Never expose “overwrite server.”
Background synchronization, push-provider activation and offline high-impact
mutation replay require separate approved contracts.

### OC-10 — Backend and cross-client regression

- Add service/repository/controller contract tests for every new endpoint.
- Test every allowed role and every forbidden role.
- Confirm web and Pilot Field behaviour remains unchanged.
- Test audit events, redaction, rate limits, version handling and installation
  revocation.
- Replay all Prisma migrations from empty and populated baselines if schema
  changes.
- Run backend suite, frontend lint/build, both mobile typechecks/tests, Expo
  Doctor, dependency/secret scan and isolated Compose gate.

### OC-11 — CI, staging APK and physical-device acceptance

- Add an `operations-mobile` CI job parallel to, but isolated from,
  `pilot-mobile`.
- Typecheck, test and run Expo Doctor on `dev`, `staging` and `main`.
- Build a standalone arm64 staging APK only after hosted staging gates pass.
- Use a unique artifact/package name and the VPN-only staging API profile.
- Never share signing keys or package identity with Pilot Field.
- Retain private staging artifacts for the approved short period.
- Verify physical devices for Admin, Fleet, Sales, Farmer and Business.
- Test poor network, process death, session expiry, revocation, account switch,
  large text, sunlight contrast and Android back navigation.

### OC-12 — Production and Play release readiness

Production mobile release is blocked until the company supplies/approves:

- production domain and HTTPS/TLS;
- Android package ID and Play Console ownership;
- production signing key custody and backup;
- privacy policy, support contact and store listing owner;
- notification/OTP delivery provider and production credentials;
- location notice, retention and supervisor-visibility wording;
- supported languages and client-approved copy; and
- monitoring, rollout, rollback and incident owners.

Release with an internal track, then closed testing, staged rollout and rollback
evidence. The current HTTP office endpoint is not a Play production baseline.

## 10. Required functional acceptance journeys

1. Employee login resolves Admin, Fleet and Sales navigation from capabilities.
2. Farmer phone OTP resolves only the linked Farmer workspace.
3. Business login resolves only explicitly linked Business records.
4. Sales exact-phone lookup autofills an existing customer and creates a lead
   using server-backed master values.
5. Duplicate customer registration is rejected/resolved safely.
6. Out-of-area intake is declined without appeal or scheduling.
7. Fleet opens schedule, sees all four resources, encounters an overlap
   rejection, refreshes and completes a valid move/override.
8. Admin creates/manages a permitted employee while the sole Admin remains
   protected.
9. Admin/Fleet sees one latest Pilot location only during an eligible mission.
10. Farmer draft survives process death but is not shown as submitted until
    server confirmation.
11. Session expiry/revocation returns to login and purges protected local data.
12. A role or app mismatch is rejected by the server even with a manually
    constructed request.

## 11. Explicit exclusions

- Pilot mission controls in Operations Companion;
- direct PostgreSQL access;
- Firebase Authentication;
- raw Drone telemetry or route-history billing;
- background location tracking;
- Bhumeet/mock marketplace integration;
- predictive “best fit,” route optimization or demand heatmaps;
- fabricated weather/aviation capabilities;
- unapproved billing, commissions, GST, settlement or pricing;
- client-authoritative conflict overwrite; and
- production credentials, customer data or server secrets in source/tests.

## 12. Completion evidence required from the next agent

For every package return:

- branch and commit;
- changed contracts/routes/services/repositories/screens;
- tests added and exact results;
- role-negative/security evidence;
- migration evidence when applicable;
- Android artifact identity/checksum when built;
- staging deployment SHA and physical-device acceptance;
- unresolved placeholders and intentionally deferred features; and
- rollback boundary.

Do not claim the app complete because screens render. Completion requires the
five authenticated role journeys, server enforcement, safe offline behaviour,
CI, staging APK and physical-device evidence.

## 13. Copy/paste prompt for another AI agent

> Read `AGENTS.md`, `docs/plan/AGENTS.md`, and
> `docs/plan/NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md` completely. Inspect
> the current branch and source before acting. Continue the RFLY Operations
> Companion implementation in dependency order beginning with the first
> incomplete `OC-xx` package. This is one non-Pilot app for Admin, Fleet, Sales,
> Farmer and Business, while Pilot Field remains separate. Extend the Node.js
> `/api/mobile/v1` contracts and server authorization before implementing a UI
> action; use services/repositories, minimal DTOs, audited mutations,
> installation-bound sessions, secure storage and capability-driven navigation.
> Treat the August web/client-master hotfix as closed and do not rerun production
> imports. Do not use archived documents, Stitch code, Firebase, direct DB
> access, hardcoded master values or client-side business authority. Work in
> small verified commits through `dev -> staging -> main`, preserve production
> data, and report test, security, staging and rollback evidence for every
> package.

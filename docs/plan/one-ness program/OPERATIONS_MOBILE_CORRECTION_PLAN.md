# Operations Companion Corrective Recovery Plan

**Status:** corrective implementation completed locally; physical-device acceptance remains open
**Applies to:** `operations-mobile/`, its `/api/mobile/v1/operations/*` backend
surface, Operations Android CI, and physical-device acceptance
**Baseline reviewed:** local `staging` at `9cc8472` on August 26, 2026
**Production gate:** OC-12 is blocked until every OMR package below is complete

## Implementation checkpoint — August 27, 2026

The corrective implementation is present in the local dirty working tree and
has not been pushed or deployed. Verified evidence:

- Operations Mobile TypeScript, 24 Jest tests, and all 21 Expo Doctor checks pass.
- A staging Android/Hermes bundle and native Android prebuild complete with the
  staging package identity, API endpoint, foreground-only location policy,
  blocked high-risk permissions, and explicit staging cleartext allowance.
- The full backend regression suite passes 172 of 172 tests against a newly
  migrated disposable PostgreSQL 16 database.
- Frontend lint and the same-origin production build pass.
- The obsolete Capacitor Operations APK job and competing standalone APK
  workflow have been replaced by one React Native Operations APK job gated on
  the main application/container checks.

This evidence does not replace physical-device acceptance. OMR-11 and OC-12
remain open until role-by-role staging-device tests, VPN reachability, APK
identity/signature checks on the office runner, and maintainer approval are
recorded.

## 1. Objective

Recover the separate non-Pilot React Native application for Admin, Fleet
Manager, Sales, Farmer/customer, and Business/B2B users. The recovered client
must use the existing Node.js backend as its authority, preserve the separate
Pilot Field application, enforce server-issued capabilities, behave safely
offline, and produce a verified staging APK from the office runner.

This is an evolution and correction of the current implementation. Do not
reset or rewrite the OC commit history, copy the website into a WebView, or
replace the application with the older Capacitor shell. Repair forward through
small reviewed commits.

## 2. Authoritative inputs

Before implementing any package, read in this order:

1. `AGENTS.md`
2. `docs/plan/AGENTS.md`
3. `docs/plan/CURRENT_ENGINEERING_STATE.md`
4. `docs/plan/NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md`
5. `docs/plan/one-ness program/OC-OPERATIONS-COMPANION-PLAN.md`
6. `docs/plan/MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`
7. `docs/plan/PILOT_MOBILE_API_CONTRACT.md`
8. `docs/plan/production_hardening.md`
9. `docs/plan/CICD_OPERATIONS_CONTEXT.md` before OMR-11

The current backend routes and DTOs are the implemented contract only where
they agree with the approved specification. A rendered screen, a green
TypeScript command, or an old commit message is not completion evidence.

## 3. Confirmed correction scope

The August 26 audit confirmed these defects:

- Staff Sign In bypasses authentication and navigates directly to a shared
  role shell.
- Staff navigation exposes Sales, Fleet, and Admin screens without using the
  authenticated role or server capabilities.
- Customer creation sends `name`; the backend accepts `displayName`.
- Lead creation sends `crop`, `area`, `purpose`, and a stub `location`; the
  backend accepts `cropType`, `acreage`, `sprayPurpose`, numeric latitude and
  longitude, and the documented intake fields.
- Fleet schedule requests use `date`; the backend requires bounded `from` and
  `to` timestamps. The UI model also does not match the schedule DTO.
- Copilot override sends `copilotId` and `copilotReason`; the backend requires
  `candidateId`, `expectedRevision`, and `reason`. The UI asks for a raw UUID
  instead of presenting eligible server-provided candidates.
- Several Admin actions are stubs or console-only navigation.
- Farmer and Business screens call dashboard, request, notification, and
  profile routes that do not exist.
- The generic network interceptor queues every failed mutation, stores
  user-sensitive request details without a safe account boundary, and has no
  replay or reconciliation engine.
- Push notification support is a console-only placeholder.
- OC-10 tests are assertion shells and do not send authenticated requests.
- The Operations Android workflow does not implement the approved CI gates,
  runner isolation, staging identity, stale-source guard, APK verification, or
  evidence retention.
- The app uses Expo SDK 51 while the repository-proven Pilot toolchain uses
  Expo SDK 57. Expo Doctor reports React Native and TypeScript incompatibility.
- The dependency audit currently reports 31 findings, including one critical
  finding. Do not use `npm audit fix --force`.
- `android/` is generated but is not currently excluded by the app-local
  `.gitignore` as required.

## 4. Non-negotiable boundaries

1. `pilot-mobile/` remains a separate application and package identity.
2. The server is authoritative for authentication, roles, capabilities,
   resource visibility, state transitions, and company policy.
3. Never infer authorization from a visible tab or locally stored role.
4. Never expose Admin operations to Farmer or Business sessions.
5. Business data is limited to explicitly linked company jobs, invoices, and
   payments. No broad customer or fleet visibility is allowed.
6. Customer/lead creation, scheduling, policy changes, account changes, and
   asset changes require online confirmation. They are never silently queued.
7. Logout, revocation, or account switching purges all user-scoped caches and
   drafts.
8. Do not add background location, raw telemetry, Firebase authentication, or
   a speculative push provider.
9. Do not place credentials, production URLs, customer data, signing keys, or
   private server information in source or artifacts.
10. Do not weaken backend checks or CI to make the client appear functional.
11. No production deployment, data import, seed, wipe, or schema reset belongs
    to this recovery sequence.

## 5. Delivery graph

```text
OMR-00 Baseline and reproducibility
  -> OMR-01 Toolchain and project foundation
      -> OMR-02 Typed client and session lifecycle
          -> OMR-03 Capability-driven navigation
              -> OMR-04 Sales/customer intake
              -> OMR-05 Fleet schedule and exception handling
              -> OMR-06 Admin operational surfaces
              -> OMR-07 Farmer OTP and request portal
              -> OMR-08 Business linked-data portal
          -> OMR-09 Approved offline/cache behaviour
      -> OMR-10 Real regression and cross-client tests
          -> OMR-11 CI, staging APK, and device acceptance
              -> OC-12 maintainer decisions and production readiness
```

OMR-04 through OMR-08 may be implemented independently only after OMR-02 and
OMR-03 are complete. OMR-10 cannot be accepted until every enabled role slice
has real backend and client behaviour.

## 6. OMR-00 — Freeze the factual baseline

### Work

- Record the exact branch, commit, Node/npm versions, Expo Doctor output,
  dependency-audit output, and dirty working-tree paths.
- Preserve existing uncommitted `operations-mobile/package.json` and lockfile
  work until its ownership and purpose are understood. Do not reset it.
- Inventory every navigation route, screen, API method, backend route, DTO,
  placeholder, and missing endpoint.
- Create a client-to-server contract matrix with columns: screen/action,
  allowed roles, capability, method/path, request DTO, success DTO, error codes,
  online/offline rule, and tests.
- Classify screens as `WORKING`, `CONTRACT_MISMATCH`, `STUB`, `MISSING_SERVER`,
  or `REMOVE_UNTIL_SUPPORTED`.
- Confirm that no generated `android/` content or local signing material is
  tracked.

### Verification

- No application or database changes.
- The inventory accounts for all five user types.
- Every existing OC-02 through OC-11 claim maps to observable evidence or an
  explicit recovery item.

### Done when

The maintainer can identify exactly what the next commit changes and no dirty
user work has been lost.

## 7. OMR-01 — Repair the Expo project foundation

### Work

- Align the application with the repository-supported Expo/React Native
  toolchain proven by `pilot-mobile/`. Use `npx expo install` compatibility
  resolution; do not manually guess versions and do not force audit upgrades.
- Replace static `app.json` with a variant-aware configuration if required by
  the chosen Expo pattern.
- Define distinct identities:
  - development: `com.rfly.operations.dev`
  - staging: `com.rfly.operations.staging`
  - production: `com.rfly.operations`
- Make API configuration fail closed. A physical Android build must never fall
  back to `localhost`.
- Add `typecheck`, `test`, `doctor`, and platform export scripts.
- Add the approved test dependencies and runtime schema validator.
- Add `/android/`, generated outputs, signing files, local environment files,
  and Metro/Expo artifacts to `.gitignore`.
- Restore valid app icon, adaptive icon, splash, and scheme configuration
  rather than deleting broken asset references.
- Keep Android permissions minimal and explicitly block unnecessary storage,
  overlay, background-location, and foreground-location-service permissions.

### Verification

Run from `operations-mobile/`:

```text
npm ci
npm audit --omit=dev --audit-level=critical
npm run typecheck
npm test -- --runInBand
npm run doctor
```

No critical runtime finding may be waived. Any high build-tool finding must be
documented with its dependency path, exploitability decision, upstream fix,
and removal gate.

### Done when

A clean checkout installs reproducibly, all scripts exist, Expo Doctor passes,
and the app configuration produces distinct development and staging package
identities without hardcoded credentials or production values.

## 8. OMR-02 — Typed API client and complete session lifecycle

### Backend contract

Staff login uses `POST /api/mobile/v1/operations/auth/login` with only:

- `email`
- `password`
- `installationKey`
- `platform`
- `appVersion`
- `deviceLabel`

After login, call `GET /api/mobile/v1/operations/bootstrap`. Logout,
logout-all, installation revocation, session revocation, and mandatory upgrade
must use the existing mobile-auth contract.

### Client work

- Replace the staff bypass button with a real credential form.
- Generate and securely retain one installation key per installation.
- Store only the minimum session material in SecureStore.
- Add maintained runtime schemas for every response; do not return `any` DTOs.
- Send the bearer token and approved application/version headers.
- Normalize server errors into typed states: validation, authentication,
  forbidden, not found, conflict, rate limited, upgrade required, retryable
  service failure, and offline.
- On 401/revocation, purge the session and user-scoped data and return to the
  login gateway.
- On 426, show the mandatory-upgrade screen and block the application.
- Restore valid sessions at startup through bootstrap; do not trust a cached
  profile without server validation except for explicitly approved read-only
  offline presentation.
- Separate Farmer OTP and Business login state from staff login while using the
  same response/error discipline.

### Tests

- Valid and invalid staff login for Admin, Fleet, and Sales.
- Farmer and Business credentials are rejected by generic staff login.
- Wrong password does not reveal whether an account exists.
- Revoked installation, disabled account, expired session, wrong app identity,
  and unsupported app version.
- Process restart restores a valid session.
- Logout and account switch remove token, profile, capabilities, caches, and
  drafts.

### Done when

No role enters an authenticated navigator without a server-issued Operations
session and a validated bootstrap response.

## 9. OMR-03 — Capability-driven role navigation

### Work

- Replace the shared RoleShell menu with navigators derived from bootstrap
  capabilities.
- Keep server roles as coarse identity and capabilities as the UI permission
  source. The backend remains the final authority.
- Admin receives approved Admin, Fleet, and Sales supervisory functions.
- Fleet receives only Fleet functions and explicitly approved lower-scope
  functions.
- Sales receives customer search/registration and lead intake only.
- Farmer sees only the phone-linked Farmer portal.
- Business sees only explicitly linked Business records.
- Unauthorized deep links resolve to Access Denied without rendering protected
  data.
- Android Back cannot reveal a prior user's screen or return an authenticated
  user to the login screen unless the session ends.

### Tests

Use one synthetic session per role and assert both visible and forbidden
routes. Test deep links, restored sessions, logout, and account switching.

### Done when

Each role has one deterministic navigation tree, and no client-only route can
expand backend access.

## 10. OMR-04 — Sales and customer intake correction

### Contract alignment

- Customer create uses `displayName`, `phone`, and only approved optional
  customer fields.
- Lead create uses backend-supported names, including `acreage`, `cropType`,
  `sprayPurpose`, numeric `latitude`, numeric `longitude`, and the approved
  intake fields.
- Use server-backed master data for crops, purposes, request classification,
  cluster, reporting Admin, and lead source where the backend contract exposes
  them. Do not hardcode company lists in the app.

### Work

- Implement normalized phone search and duplicate-aware customer creation.
- Implement customer detail and recent service/lead presentation from the
  maintained DTO.
- Replace the location stub with map pin/address/Plus Code capture that resolves
  to validated numeric coordinates before submission.
- Display geofence outcomes exactly: accepted, needs manual scheduling, or
  contact-only decline. Do not provide an appeal path.
- Do not permit manual Drone selection during intake.
- An unsent form may be an encrypted user-scoped draft, but it must never appear
  as a created customer or lead.

### Tests

- Existing customer lookup with Indian phone normalization.
- Duplicate create, valid create, unexpected fields, invalid location,
  out-of-area decline, accepted intake, and manual-scheduling outcome.
- Sales allowed; Fleet, Farmer, Business, and unauthenticated callers rejected
  according to the server policy.

### Done when

A physical Sales device can search/create a customer and submit one valid lead
with server-confirmed state and no DTO mismatch.

## 11. OMR-05 — Fleet schedule, exceptions, and Copilot correction

### Contract alignment

- Schedule and exception requests send bounded ISO `from` and `to` timestamps.
- Consume the server DTO fields: `status`, `crewFormationState`,
  `serviceWindow`, nested `crew`, nested `drone`, optional `lmv`, operating
  centre, revision, and exception codes.
- Never invent flat fields such as `pilotName`, `droneLabel`, or `startTime`.
- Copilot override submits exactly `candidateId`, `expectedRevision`, and
  `reason` after retrieving eligible candidates.

### Work

- Build day/range schedule views with loading, empty, stale, error, and refresh
  states.
- Display unscheduled leads and assignment exceptions distinctly.
- Present eligible Copilots by display name/employee code; never ask a user to
  type a UUID.
- Follow the current server rule that only an active Admin may override a
  Copilot unless the product specification and backend policy are deliberately
  changed together.
- Treat assignment revision conflicts as refresh-required; never overwrite the
  server.

### Tests

- Valid/invalid time windows, empty schedule, nested DTO rendering, unscheduled
  lead, incomplete crew, missing LMV, issue exception, stale revision,
  ineligible Copilot, and role rejection.

### Done when

Fleet schedule and exception screens render actual backend DTOs and every
mutation is online-confirmed, conflict-aware, authorized, and audited.

## 12. OMR-06 — Finish or remove Admin placeholders

### Work

- Inventory Users, Pilot centre assignment, Drones, LMVs, Regions, Assignment
  Policy, Master Data, and approved Pilot-location views.
- For each visible action, implement its complete backend contract, validation,
  loading/error/success state, authorization, audit event, and test—or hide the
  action until supported.
- Remove `console.log` navigation, `Alert('Stub')`, raw IDs, and buttons without
  complete workflows.
- Preserve the one-Admin rule and prevent Admin deletion.
- Do not expose raw database, audit mutation, secret, or production operator
  functions through the mobile app.

### Tests

- Admin happy paths and forbidden-role coverage for every endpoint.
- Fleet permissions tested separately; do not assume Admin parity.
- Account disable, centre transfer conflict, asset state transition, policy
  validation, and master-data validation.

### Done when

Every visible Admin control completes a real server operation or is absent.

## 13. OMR-07 — Farmer OTP and request portal

### Work

- Retain application-owned OTP challenge generation and verification. Delivery
  provider selection remains separate.
- Define and implement missing Farmer dashboard/request endpoints through
  controller, service, and repository layers before enabling their screens.
- Scope the authenticated Farmer identity to its linked customer records only.
- Implement request status/detail and the approved service-request wizard.
- Use localized Farmer-facing strings; no hardcoded English-only flow.
- Apply the same strict geofence policy as public and Sales intake.

### Tests

- OTP request/resend cooldown/expiry/attempt limits/consume-once behaviour.
- Unknown and known phone privacy behaviour.
- Farmer A cannot access Farmer B data.
- In-area request accepted; out-of-area request becomes only the approved
  declined-contact record.
- Logout/account switch purges Farmer data.

### Done when

The Farmer flow uses only implemented endpoints and passes isolation and OTP
tests on a physical staging device.

## 14. OMR-08 — Business linked-data portal

### Work

- Specify and implement missing Business dashboard, linked requests,
  notifications, and profile endpoints before enabling their screens.
- Resolve the Business organization and explicit links on the server; never
  trust a client-supplied company or customer ID.
- Return minimal Business DTOs. Exclude unrelated customers, internal fleet
  details, employee data, and unlinked financial records.
- Do not implement commissions until the company supplies and approves that
  policy.

### Tests

- Business A cannot access Business B or unlinked Farmer data.
- Staff login and Business login remain separate.
- Disabled/unlinked Business account, empty linked list, notification scoping,
  session revocation, and direct-ID probing.

### Done when

All Business screens use real isolated endpoints and direct-object reference
tests prove the server boundary.

## 15. OMR-09 — Replace speculative offline and notification code

### Approved offline matrix

| Operation | Offline behaviour |
|---|---|
| Read previously approved customer/schedule summary | User-scoped encrypted cache with timestamp and stale label |
| Unsubmitted Sales/Farmer form | User-scoped encrypted draft only |
| Customer/lead/request creation | Online confirmation required |
| Fleet schedule/Copilot/resource change | Online confirmation required |
| Admin user/asset/region/policy/master change | Online confirmation required |
| Business linked-data reads | Cache only if approved by the data-minimization review |
| Logout, revocation, account switch | Purge all user-scoped cache and drafts |

### Work

- Remove the generic “queue every failed non-GET” interceptor.
- Use a user-scoped encrypted local database suitable for bounded structured
  cache/drafts; do not use SecureStore as a bulk database.
- Define cache TTL, maximum size, last-confirmed timestamp, stale label, and
  purge rules per dataset.
- Never persist bearer headers, passwords, OTPs, exact location history, or raw
  response envelopes in a generic queue.
- Keep push provider integration disabled until approved. If notification
  screens are retained, implement server-backed in-app notifications first.
- Remove console-only notification claims or label the feature explicitly as
  unavailable.

### Tests

- Process death and restart, poor network, stale cache, draft survival,
  successful submission, failed submission, logout purge, account switch,
  revocation, storage corruption, and storage-cap enforcement.

### Done when

The application never presents an unconfirmed mutation as successful and no
user can inherit another user's cached data.

## 16. OMR-10 — Replace test shells with real evidence

### Backend tests

- Replace `expect(true).toBe(true)` and path-definition tests with authenticated
  Supertest requests against disposable PostgreSQL.
- Test every allowed role and every forbidden role for every Operations route.
- Test request validation, response minimization, audit creation/redaction,
  version gates, installation revocation, rate limits, and object isolation.
- Add real Farmer and Business tests only when their routes exist.
- Confirm the existing Web SPA and Pilot mobile API remain unchanged.

### Client tests

- Runtime schema acceptance/rejection for every DTO.
- Authentication/session state transitions.
- Capability navigation and forbidden deep links.
- Sales and Fleet request serialization.
- Farmer and Business isolation views.
- Cache/draft/purge behaviour.
- Error, retry, empty, loading, stale, and mandatory-upgrade states.

### Full regression

- Backend tests and Prisma validation/generation.
- Frontend lint and production build.
- Pilot typecheck, tests, and Expo Doctor.
- Operations typecheck, tests, and Expo Doctor.
- Dependency and secret scans.
- Isolated Docker Compose gate.

### Done when

The suite fails when a role, field name, route, DTO, offline rule, or package
identity is deliberately broken. Syntax-only assertions are prohibited.

## 17. OMR-11 — Correct CI, staging APK, and device acceptance

### Main CI job

Add `operations-mobile` to `.github/workflows/ci.yml`:

- Ubuntu GitHub-hosted runner.
- Node 24.
- npm cache keyed by `operations-mobile/package-lock.json`.
- `npm ci`.
- critical runtime dependency audit.
- typecheck.
- tests in-band.
- Expo Doctor.
- Runs on `dev`, `staging`, and `main` with backend/mobile-contract changes in
  scope, not only when `operations-mobile/**` changes.
- The isolated-container job depends on this gate where shared contracts are
  affected.

Retire the incomplete standalone workflow after equivalent behaviour exists in
the main CI. Do not keep two competing APK workflows.

### Staging APK job

- Runs only for a push to `staging`, after all required gates pass.
- Uses `[self-hosted, linux, rfly-onprem]` because the laptop lacks reliable
  Gradle/Metro memory.
- Refuses non-staging and stale source by comparing the checked-out SHA with the
  current remote staging tip.
- Uses the VPN-only staging API configuration through the approved environment.
- Generates native Android with `expo prebuild --platform android --clean`.
- Builds a standalone `arm64-v8a` APK with bounded Gradle workers/memory.
- Verifies package ID `com.rfly.operations.staging`.
- Verifies signature, APK badging, cleartext/staging policy, and forbidden
  permissions.
- Produces SHA-256 and credential-free metadata containing source SHA, variant,
  package ID, build type, distribution boundary, and Metro requirement.
- Uploads `rfly-operations-companion-staging-<sha>` for seven days.
- Never shares Pilot signing identity or keys.

### Physical-device acceptance

Create `docs/plan/one-ness program/OC_STAGING_ACCEPTANCE.md` and record:

- Exact source SHA and artifact checksum.
- Device model and supported Android version, without personal identifiers.
- Admin, Fleet, Sales, Farmer, and Business login journeys.
- Role/deep-link isolation.
- Customer search/create and lead submission.
- Fleet schedule, exception, and authorized Copilot path.
- Enabled Admin workflows.
- Farmer OTP/request and Business linked-data isolation.
- Poor network, process death, session expiry, revocation, account switch,
  large text, sunlight contrast, and Android Back behaviour.
- Cache/draft stale labels and purge behaviour.
- Known deferred items with no false success claim.

### Done when

The main CI is green, the exact staging SHA produces a verified APK, and all
five physical-device role journeys have dated evidence. A successful Gradle
command by itself is insufficient.

## 18. OC-12 entry gate

Do not begin production or Play release work until OMR-00 through OMR-11 are
complete. OC-12 additionally requires maintainer/company decisions for:

- production domain and HTTPS/TLS;
- Play Console ownership and package identity;
- release signing key ownership, backup, and rotation;
- privacy policy, data-safety answers, retention, and support contact;
- OTP delivery provider and templates;
- push notification provider and consent policy;
- minimum/recommended application versions and upgrade policy; and
- production acceptance and rollback owners.

The current public HTTP deployment is not an acceptable Play production
credential transport endpoint.

## 19. Commit and branch discipline

- Normal flow: `dev` -> reviewed PR -> `staging` -> reviewed promotion ->
  `main`.
- Use one focused commit per OMR package or independently testable sub-package.
- Do not bundle SDK migration, authentication, every role screen, CI, and
  production release in one commit.
- Do not amend or erase the historical Gemini commits; repair them forward.
- Before committing, include focused tests and run their validation commands.
- Before staging, run OMR-10 full regression.
- A failed gate is a defect to diagnose, not a reason to weaken the gate.
- Re-running the same workflow does not substitute for correcting a
  deterministic failure.

## 20. Handoff record required after every package

Each OMR package must leave a concise record containing:

- package identifier and exact commit;
- files and contracts changed;
- tests added and exact commands/results;
- roles allowed and rejected;
- security/privacy/offline impact;
- staging evidence, if applicable;
- placeholders or decisions still unresolved; and
- the next unblocked package.

Do not label a package complete when screens merely render. Completion requires
server enforcement, correct DTOs, safe lifecycle behaviour, meaningful tests,
and reproducible evidence.

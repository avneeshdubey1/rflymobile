# Gemini Mobile Integration Handoff

Status date: 2026-08-13

Backend branch: local `staging`

Backend acceptance commit: `8e50df5` and preceding mobile commits
Deployment status: not pushed and not deployed

## 1. Purpose and authority

This is the implementation handoff for the AI/developer building the Android
clients. It describes the server capabilities that are finished and the work
that remains in the apps.

Use these current sources as the executable contract:

1. `backend/routes/mobileV1Routes.js` for available routes;
2. `backend/contracts/mobile/v1/mobile-api.schema.json` for strict DTO shapes;
3. `backend/contracts/mobile/v1/fixtures/` for sanitized examples;
4. `docs/plan/MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md` for role and app boundaries;
5. this handoff for integration order and acceptance expectations.

Do not derive behavior from old files under
`docs/unrealted_docs_for_current_version/`, screenshots, Stitch-generated
placeholder logic, browser routes or direct database assumptions. Neither app
may connect to PostgreSQL.

## 2. Product boundary

There are two separately packaged Android clients sharing one versioned Node.js
API:

- **Pilot Field app:** only `PILOT` accounts. It handles assigned work, Primary
  Pilot Copilot selection, mission actions, issue reporting and offline sync.
- **RFLY Operations app:** `ADMIN`, `FLEET_MANAGER` and `SALES`. Its first
  slices are Sales customer/lead intake and Fleet schedule/exceptions.

The app selected at login is a security boundary. A Pilot session cannot be
used in Operations and an Operations session cannot be used in Pilot Field.
Menus must be generated from server `capabilities`, not merely from a locally
stored role.

## 3. Backend work completed

### Shared mobile security

- versioned `/api/mobile/v1` boundary;
- opaque bearer sessions independent of browser cookies and CSRF;
- installation-bound sessions with hashed installation identity and token;
- two active installations per user/app by default;
- idle and absolute expiry;
- logout, logout-all and lost-device installation revocation;
- Admin installation revocation;
- role/app isolation and generic login failures;
- minimum/recommended application version response;
- audit records without raw password, token, phone or coordinate values.

### Pilot Field server capabilities

- bounded assignment list and assignment detail;
- minimal farmer, farm, crop, crew, drone, LMV and centre DTOs;
- server-calculated `allowedActions`;
- provisional assignments reserve Primary Pilot, drone and LMV while waiting
  for the Primary Pilot to choose a Copilot;
- eligible Copilot list and revision-guarded selection;
- assigned Primary and Copilot can read the ready assignment;
- idempotent, revision-guarded `ACCEPT`, `START`, `COMPLETE` and
  `REPORT_ISSUE` actions;
- controlled issue categories with coordinate-free notes;
- cursor-based assignment changes, removal tombstones and ordered mutation
  batches;
- durable mutation receipts for response-loss retry safety;
- 30-day server change-feed retention.

### Operations server capabilities

- capability bootstrap for Admin, Fleet and Sales;
- customer search and normalized exact-phone lookup;
- customer registration by Sales/Admin;
- read-only customer lookup by Fleet;
- customer-linked Sales/Admin lead intake using existing phone normalization,
  crop validation, acreage rules, strict geofencing and auto-assignment;
- bounded Fleet/Admin schedule projection for at most 14 days;
- Fleet/Admin exception queue for pending Copilot formation, legacy crew review,
  missing LMV, mission issues and unscheduled leads;
- reasoned, revision-guarded Fleet/Admin Copilot override;
- privacy-minimized Operations DTOs without exact farm coordinates, farmer
  remarks, subscription details, portal identifiers or credential fields.

### Verification already completed

- backend regression: **158/158 passed**;
- focused mobile-auth regression: **4/4 passed** after disabling the location
  capability advertisement;
- clean and populated migration replay: **28 migrations, 61 validated checks**;
- backend production dependency audit: **0 vulnerabilities**;
- frontend production dependency audit: **0 critical vulnerabilities**;
- frontend lint and production build: passed;
- isolated Docker Compose stack: healthy;
- backend and database publish no host ports; non-root runtime users verified;
- disposable stack, networks and database volume removed after testing.

## 4. Environment prerequisite

Mobile API is enabled by default only outside production. Staging/production
must explicitly configure:

```text
MOBILE_API_ENABLED=true
MOBILE_SESSION_IDLE_TIMEOUT_MS=1800000
MOBILE_SESSION_ABSOLUTE_TIMEOUT_MS=28800000
MOBILE_SESSION_TOUCH_INTERVAL_MS=60000
MOBILE_MAX_INSTALLATIONS_PER_APP=2
MOBILE_MINIMUM_VERSION=1.0.0
MOBILE_RECOMMENDED_VERSION=1.0.0
```

The Android clients must use the staging HTTPS base URL supplied by the
maintainer. Do not hardcode the office IP, production URL, credentials or
tokens. Development, staging and production must be separate build-time
profiles.

The current local backend commits have not yet been pushed or deployed.
Integration against staging can begin only after the maintainer pushes and the
staging deployment is green.

## 5. Shared app work required from Gemini

### Installation and authentication

Each app installation must generate one cryptographically random opaque
`installationKey` of at least 32 characters, store it in Android secure storage
and reuse it across logins. Never regenerate it per request. Never log it.

Login requests:

```text
POST /api/mobile/v1/pilot/auth/login
POST /api/mobile/v1/operations/auth/login
```

Required body fields are `email`, `password`, `installationKey`,
`platform: "ANDROID"`, semantic `appVersion` and a bounded `deviceLabel`.
Store the returned bearer access token in secure storage, not AsyncStorage,
SQLite, Redux persistence or source code.

Every protected request uses:

```text
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The app must support:

```text
POST   /api/mobile/v1/auth/logout
POST   /api/mobile/v1/auth/logout-all
DELETE /api/mobile/v1/installations/:installationId
```

On 401, clear the local session and require login. On 426, show the mandatory
upgrade screen. On installation/session revocation, purge user-specific cached
data according to the local retention rules.

### Bootstrap and capability routing

After every login and cold authenticated launch, call the app-specific
bootstrap endpoint:

```text
GET /api/mobile/v1/pilot/bootstrap
GET /api/mobile/v1/operations/bootstrap
```

Persist the safe profile, app version policy, server time, operating timezone,
capabilities, feature flags and sync cursor. Hide unsupported screens/actions.
Do not invent capabilities from role names.

### Error handling

Use the stable response envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Safe user message",
    "retryable": false,
    "requestId": "server-correlation-id"
  }
}
```

Display the safe message, retain `requestId` for support, and branch logic on
`code`, not on English message text. Never display raw HTTP or JavaScript error
objects to field users.

## 6. Pilot Field app work required

### Read and cache assignments

```text
GET /api/mobile/v1/pilot/assignments?from=<ISO>&to=<ISO>
GET /api/mobile/v1/pilot/assignments/:assignmentId
GET /api/mobile/v1/pilot/changes?cursor=<cursor>&limit=<1..100>
```

Render actions only from each assignment's `allowedActions`. Show assignments
awaiting a Copilot as non-executable. Preserve server ordering using service
window and `dailySequence`.

Use encrypted/local application storage for assignment cache, cursor and
pending actions. The database is a cache, not a second authority. Removal
tombstones must delete inaccessible assignments locally.

### Copilot selection

Only show this flow when `SELECT_COPILOT` is allowed:

```text
GET  /api/mobile/v1/pilot/assignments/:assignmentId/eligible-copilots
POST /api/mobile/v1/pilot/assignments/:assignmentId/copilot
```

Selection body contains `candidateId` and the displayed assignment's
`expectedRevision`. On revision/conflict errors, refresh from the server and
show a clear retry/review state. Never let the client write `copilotId`
directly or accept an arbitrary person.

### Mission actions

```text
POST /api/mobile/v1/pilot/assignments/:assignmentId/actions
```

Supported actions:

- `ACCEPT` with `expectedRevision`;
- `START` with `expectedRevision`;
- `COMPLETE` with `expectedRevision` and positive `actualAcreage`;
- `REPORT_ISSUE` with `expectedRevision`, approved `issueCategory` and a
  coordinate-free note of 1–500 characters.

Generate one UUID `clientActionId` when the user creates an action. Persist the
complete request locally before transmission. Every retry of that logical
action must reuse the identical UUID and identical payload. Never create a new
UUID merely because the response timed out.

Handle receipt outcomes:

- `APPLIED`: apply returned revision, then refresh/sync;
- `ALREADY_APPLIED`: treat as success, then refresh/sync;
- `CONFLICT`: keep visible for review and refresh server state;
- `REJECTED`: show the safe reason and do not retry automatically;
- `RETRY_LATER`: retain and retry with bounded exponential backoff.

### Ordered offline synchronization

```text
POST /api/mobile/v1/pilot/sync
```

Send the current cursor and 1–20 mutations in creation order. Do not reorder
Accept → Start → Complete. Persist pending actions before network transmission;
retain them across process death and temporary logout where safe. If the server
returns `fullResyncRequired`, replace the assignment cache from the returned
authoritative snapshot while preserving unresolved local action evidence.

The Sync Status UI must show pending, retrying, conflicted and failed actions.
Do not provide “overwrite server” or client-authoritative merge controls.

## 7. Operations app work required

### Sales slice

```text
GET  /api/mobile/v1/operations/sales/customers?q=<bounded search>
GET  /api/mobile/v1/operations/sales/customers/by-phone?phone=<phone>
POST /api/mobile/v1/operations/sales/customers
POST /api/mobile/v1/operations/sales/customers/:customerId/leads
```

Recommended phone-call workflow:

1. normalize only for display; send the user's phone input to exact lookup;
2. if found, show the minimal customer record and recent leads;
3. if absent and `SALES_INTAKE` exists, collect and register the customer;
4. collect service acreage, crop, location and approved operational fields;
5. submit the lead and show accepted, manual-scheduling or out-of-area result.

Location input for lead intake must resolve to numeric latitude/longitude before
submission because geofencing is server enforced. The UI may accept a map pin
or Plus Code only if the app resolves it safely; do not ask staff to type raw
coordinates. Do not store rejected exact coordinates after the server response.

Fleet can search/read customers but must not see registration or lead-creation
actions because it lacks `SALES_INTAKE`.

### Fleet slice

```text
GET  /api/mobile/v1/operations/fleet/schedule?from=<ISO>&to=<ISO>
GET  /api/mobile/v1/operations/fleet/exceptions?from=<ISO>&to=<ISO>
POST /api/mobile/v1/operations/assignments/:assignmentId/copilot-override
```

The range must be positive and no longer than 14 days. Present assignments in
server order. Clearly distinguish pending-Copilot assignments from unscheduled
leads and mission/resource issues.

Copilot override is available only to Fleet/Admin and requires `candidateId`,
`expectedRevision` and a meaningful reason. On conflict, refresh rather than
silently overwriting the server.

The current Operations mobile API does not add full drag/drop scheduling,
resequence or resource reassignment mutations. Do not fake those actions in the
app. They remain web/server workflows until separately specified and exposed.

## 8. Features Gemini must not implement yet

- foreground or background GPS submission;
- route-history recording;
- chat;
- Firebase authentication or Firebase OTP;
- direct PostgreSQL access;
- client-authoritative assignment edits;
- arbitrary Copilot entry;
- broad Admin master-data screens beyond exposed APIs;
- invented telemetry, ratings, callsigns or equipment rankings;
- billing, commission or Farmer/Business functionality inside these employee
  apps unless a later approved API contract adds it.

`foregroundLocation` and `backgroundLocationEnabled` are false, and location is
not advertised as a capability. It requires an approved privacy, cadence and
retention policy plus a later backend task.

## 9. Required local architecture

Gemini should keep these boundaries even if Stitch supplied the visual design:

```text
screens/components
    -> application use cases
        -> API client + local repositories
            -> secure token store / encrypted SQLite / network transport
```

- keep API transport separate from UI components;
- validate environment and server responses;
- keep Pilot and Operations navigation/package identities separate;
- use one typed API model generated or manually maintained from the strict
  JSON contract;
- centralize bearer injection, timeout, safe errors and 401/426 handling;
- centralize UUID generation and durable action queue behavior;
- keep secrets and installation identity in Android secure storage;
- implement original RFLY components from the approved visual direction; do
  not copy Zerodha assets/branding or paste unreviewed generated HTML into the
  production app.

## 10. Gemini delivery order

1. Establish separate build profiles and secure installation identity.
2. Implement shared API transport, safe error parsing and secure session store.
3. Complete login, bootstrap, session restore, logout and revoked/upgrade UI.
4. Implement Pilot assignment cache and read screens.
5. Implement Copilot selection and online actions.
6. Implement durable ordered offline queue and cursor synchronization.
7. Implement controlled Pilot issue reporting.
8. Implement Operations Sales lookup/registration/intake.
9. Implement Operations Fleet schedule/exceptions/override.
10. Add localization, accessibility, privacy-safe app switcher and diagnostics.
11. Run physical-device and destructive network tests.
12. Add mobile CI, signed internal build and controlled distribution.

Do not combine secure storage, offline synchronization or release signing into
one large unreviewed change. Commit small verified slices.

## 11. Acceptance evidence Gemini must return

At minimum provide:

- exact repository/branch and commit IDs;
- package IDs and app/version codes;
- lint, type-check and unit-test results;
- Android debug/release build result and artifact checksum;
- screenshots or recordings for each role/capability state;
- physical-device login/bootstrap/logout evidence;
- Pilot online lifecycle evidence;
- Copilot eligibility/selection and conflict evidence;
- offline Accept → Start → Complete with process restart;
- response-loss retry proving no duplicate mutation;
- cursor full-resync and reassignment tombstone evidence;
- Sales duplicate-phone and out-of-area behavior;
- Fleet role isolation and revision-conflict behavior;
- proof tokens, passwords, phone numbers and coordinates are absent from logs;
- dependency and secret scan results;
- a list of deferred or mocked functionality.

## 12. Handoff checkpoint

Server-side mobile adoption is complete for the approved Pilot Field and first
Operations slices, except foreground location which is intentionally deferred.
The immediate dependency is to push the current local `staging` commits,
activate the mobile API in staging, and publish the staging HTTPS base URL.

The Android work is not complete merely when screens render. Completion means
the two clients obey the server capability model, secure session lifecycle,
revision/idempotency contract and offline reconciliation rules, and pass the
evidence in section 11.

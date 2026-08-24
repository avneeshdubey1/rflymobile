# RFLY One-ness Planning Handoff

**Purpose:** planning context for Gemini or another planning agent
**Status:** planning input only; not authorization to write code
**Created:** August 21, 2026
**Repository:** `Waz00-m/RFLY`
**Working branch at creation:** `staging`
**Observed source revision:** `19f6e6b`

## 1. Instruction to the planning agent

Prepare an implementation plan that makes the RFLY web and mobile experiences
feel like clients of one operational system. Do not write, generate, patch,
delete, move, commit, merge, push, deploy, migrate, seed, or mutate anything.

First inspect the current source. Treat this document as a map, not as proof
that a feature works. Where source, tests, deployed behaviour, and an older
document disagree, report the disagreement instead of choosing the most
convenient version.

Do not use anything under
`docs/unrealted_docs_for_current_version/` as implementation guidance. Do not
resurrect old Gemini scripts, emergency UI code, Firebase code, Bhumeet mocks,
raw SQL utilities, one-off `node -e` commands, or archived migration commands.

The requested output is a detailed, dependency-ordered plan suitable for later
execution by a coding agent. It must include small work packages, affected
surfaces, API/schema impact, tests, staging acceptance, rollback boundaries,
and unresolved client decisions. It must not contain fabricated functionality
or pretend that a Stitch prototype is production code.

## 2. Mandatory reading order

Read these files before planning:

1. `AGENTS.md`
2. `docs/plan/AGENTS.md`
3. `docs/plan/CURRENT_ENGINEERING_STATE.md`
4. `docs/plan/CONTEXT.md`
5. `docs/plan/SPEC.md`
6. `docs/plan/production_hardening.md`
7. `docs/plan/current_placeholders.md`
8. `docs/plan/MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`
9. `docs/plan/PILOT_MOBILE_API_CONTRACT.md`
10. `docs/plan/PILOT_ANDROID_APP_IMPLEMENTATION_PLAN.md`
11. `docs/plan/PILOT_ANDROID_APP_MICROTASKS.md`
12. `docs/plan/GEMINI_PILOT_MOBILE_REBUILD_HANDOFF.md`
13. `docs/plan/STITCH_NON_PILOT_MOBILE_APP_HANDOFF.md`
14. `docs/plan/STITCH_NON_PILOT_REVISION_HANDOFF.md`
15. `docs/plan/AUTO_ASSIGNMENT_POLICY_IMPLEMENTATION_PLAN.md`
16. `docs/plan/SHARED_ONPREM_CICD_SERVER_HANDOFF.md`

Then inspect the live source areas:

- `backend/routes/mobileV1Routes.js`
- `backend/controllers/mobileV1Controller.js`
- `backend/controllers/mobileAssignmentController.js`
- `backend/services/mobileAuthService.js`
- `backend/services/mobileAssignmentService.js`
- `backend/src/repositories/mobileSessionRepository.js`
- `backend/tests/phase31-mobile-auth-foundation.test.js`
- other current `phase3x` mobile tests
- `pilot-mobile/`
- `frontend/src/`
- `.github/workflows/ci.yml`
- `.github/workflows/onprem-staging-deploy.yml`
- `.github/workflows/onprem-deploy.yml`

Stitch exports may be inspected only as visual/product-design inputs. They are
not trusted source and must not be pasted wholesale into either application:

- `stitch_UI_old_and_corrected/`
- `stitch_export/`
- `stitch_new_export/`

## 3. Product boundary

RFLY is one agricultural drone-service operations platform with one backend
and one operational database per deployed company. It currently has or plans
three client surfaces:

1. **Web SPA** — the current broad operational interface for Admin, Fleet
   Manager, Sales, Pilot, Farmer, and Business roles.
2. **RFLY Pilot Field Android app** — a bounded field application for Pilot
   work, offline-safe assignment access, Copilot formation, mission actions,
   foreground mission location, availability, and synchronization.
3. **RFLY Operations Companion app** — a planned role-aware application for
   Admin, Fleet Manager, Sales, Farmer/customer, and Business/B2B users. Its
   current Stitch material is a prototype/design input, not a completed app.

The target is not one giant client with every capability shown to everyone.
“One-ness” means:

- one identity and session policy per client type;
- one server-enforced role and capability model;
- one vocabulary for statuses, errors, resources, and actions;
- one set of state machines and scheduling rules;
- one source of truth for assignments, customers, fleet, and audit history;
- intentional parity where two surfaces perform the same job;
- explicit, documented divergence where field/mobile constraints require it;
- a recognizable shared visual system and interaction language; and
- no duplicate client-side business logic that can disagree with the server.

## 4. Current repository and branch state

At handoff creation:

```text
staging HEAD / origin-staging: 19f6e6b
main / origin-main:             1731515
branch flow:                    dev -> staging -> main
```

The observed recent staging commits are:

```text
19f6e6b fix(ci): align Pilot Expo SDK patches
8672cba fix(mobile): include Pilot availability in bootstrap
e175af8 fix(ci): install native Android build tools
e405fd3 fix(ci): configure Java before Android prebuild
44d542c feat(mobile): stage Pilot Field Android app
```

The maintainer reports that the Pilot Android app now signs in and runs against
staging. Before planning implementation, verify the exact branch tips and do
not assume the deployed SHA solely from this statement.

Do not touch `main` during planning. Production is actively used and contains
client data. A code deployment must never seed, wipe, re-import, or silently
rewrite that data.

## 5. Known deployed topology

The known office host context is:

| Concern | Current value |
|---|---|
| Host | Ubuntu Linux, public address `103.238.230.152` |
| Internal host address | `172.20.96.10` |
| Container engine | Snap-packaged Docker with Docker Compose |
| Production stack | `rfly-onprem-demo` (historical name; it is live) |
| Production web | port `8088` |
| Staging stack | `rfly-onprem-staging` |
| Staging web/API entry | `http://172.20.96.10:8089` |
| Staging access | internal network or managed split-tunnel OpenVPN |
| Deployment runner | repository-scoped self-hosted GitHub Actions runner |
| Runner label | `rfly-onprem` |
| Runner service | `actions.runner.Waz00-m-RFLY.meet-rfly-onprem.service` |
| Data isolation | separate production and staging PostgreSQL containers/volumes |

Only the frontend/reverse-proxy ports are published for the RFLY stacks. The
application backend and containerized PostgreSQL databases must remain on
internal Docker networks. A separate host PostgreSQL listener and unrelated
legacy containers have existed on this machine; do not infer that they belong
to RFLY or modify them.

Staging mobile access is deliberately VPN-only and currently uses HTTP on the
internal address. This is acceptable only for controlled staging. Production
mobile release requires an approved domain, TLS, release signing, privacy
decisions, and Play distribution work.

## 6. CI/CD state

GitHub Actions runs application and container gates on `dev`, `staging`, and
`main`. The current CI includes backend, frontend, Pilot-mobile, and isolated
container-stack gates.

For `staging`, a successful hosted gate also permits an arm64 standalone Pilot
APK build on the protected office runner. The APK embeds the staging API URL,
is internally signed for testing, and is retained as a short-lived private
artifact. It is not a production or Play Store build.

Staging and production deployment workflows use `workflow_run` and deploy the
exact successful branch SHA. Normal deployments run reviewed Prisma migrations
but do not seed, wipe, bootstrap, or import customer data. Bulk import is a
separate guarded operator procedure.

## 7. Current Pilot Field implementation

The current `pilot-mobile/` application is Expo/React Native with Expo Router.
It has a standalone Android build and does not require Metro after installation.

The implemented client structure includes:

- employee Pilot login and installation-bound mobile session;
- strict runtime validation of mobile API responses;
- capability/bootstrap loading;
- assignment list and assignment detail;
- farmer operational contact and farm location display;
- Plus Code display and an OpenStreetMap link when coordinates exist;
- Pilot-selected eligible Copilot flow with confirmation;
- accept, start, complete, and issue/decommission mission actions;
- AVAILABLE/OFFLINE Pilot state;
- foreground-only location reporting during eligible active work;
- encrypted user-scoped SQLite assignment cache on Android;
- durable queued mutations and synchronization receipts;
- sync state/error UI and manual retry;
- profile and logout flows that purge local user data; and
- tests for auth, API validation, database behaviour, and synchronization.

Current mobile API routes include:

```text
POST   /api/mobile/v1/pilot/auth/login
POST   /api/mobile/v1/auth/logout
POST   /api/mobile/v1/auth/logout-all
GET    /api/mobile/v1/pilot/bootstrap
PUT    /api/mobile/v1/pilot/availability
GET    /api/mobile/v1/pilot/assignments
GET    /api/mobile/v1/pilot/changes
POST   /api/mobile/v1/pilot/sync
GET    /api/mobile/v1/pilot/assignments/:assignmentId
GET    /api/mobile/v1/pilot/assignments/:assignmentId/eligible-copilots
POST   /api/mobile/v1/pilot/assignments/:assignmentId/copilot
POST   /api/mobile/v1/pilot/assignments/:assignmentId/actions
POST   /api/mobile/v1/pilot/assignments/:assignmentId/location
```

Recent staging diagnosis proved login and bootstrap both returned HTTP `200`.
The app-side schema failure was caused by bootstrap omitting
`pilotAvailabilityState`; commit `8672cba` added it to the mobile session
projection and added regression coverage. Commit `19f6e6b` aligned Expo SDK
patch versions after Expo Doctor advanced its compatibility expectations.

## 8. Known parity problem

The maintainer’s observed problem is valid: the web Pilot workspace and Pilot
Field app feel like separate products sharing a backend. Do not solve this by
copying every web screen into the Android app.

The plan must build an evidence-based parity matrix with at least these
classifications for every Pilot capability:

| Classification | Meaning |
|---|---|
| Shared and equivalent | Same server rule and outcome; presentation may differ. |
| Mobile field-first | Required in Pilot Field; web may provide fallback/read-only access. |
| Web fallback | Present on web for continuity but not a primary field workflow. |
| Deliberately excluded | Unsafe, irrelevant, or too privileged for Pilot Field. |
| Missing defect | Approved capability absent or inconsistent on one surface. |
| Pending client decision | Cannot safely implement until policy is confirmed. |

Compare at minimum:

- authentication, logout-all, installation revocation, and session expiry;
- Pilot profile and operational availability;
- assigned/today/upcoming work visibility and ordering;
- assignment detail fields and terminology;
- Pilot/Copilot identity and crew-formation rules;
- accept, start, wait/exception, resume, complete, and cancellation outcomes;
- issue reporting and Fleet/Admin visibility;
- foreground location start/stop conditions and visible privacy state;
- calling the farmer and opening the farm location;
- sync/offline behaviour, conflicts, retry, and stale-data indication;
- notification expectations;
- chat/support, if it remains an approved capability;
- language/localization;
- accessibility, loading, empty, error, forbidden, and offline states; and
- audit events and server authorization for every mutation.

Do not infer that visual similarity equals functional parity. Verify request
payloads, response contracts, role enforcement, transitions, audit events, and
test coverage.

## 9. Operations Companion / all-in-one login scope

The planned second mobile application is **RFLY Operations Companion**. It is
not the Pilot Field app with more tabs. It should provide one role-aware entry
experience for the approved non-Pilot roles:

- Admin;
- Fleet Manager;
- Sales;
- Farmer/customer; and
- Business/B2B customer.

“All-in-one login” does not mean one shared authentication method:

- Admin, Fleet, and Sales use employee credentials and mobile installation
  policy.
- Farmer uses the application-owned, phone-linked OTP flow.
- Business uses a staff-provisioned Business identity and its approved recovery
  flow.
- The server returns the authenticated role/capabilities and the client renders
  only that authorized workspace.

The backend already exposes an Operations mobile authentication/bootstrap
boundary and some Operations routes. The planning agent must inventory exactly
what exists, what merely appears in Stitch, and what needs new bounded mobile
contracts. It must never expose broad web payloads simply to make the app quick
to build.

The plan must preserve customer isolation, operational hierarchy, minimal-data
mobile responses, server-enforced authorization, session/installation
revocation, and auditability.

## 10. UX and design consistency target

Use the Pilot Field visual language as the binding mobile family baseline:

- deep navy operational text;
- orange primary action/accent;
- light neutral backgrounds and white cards;
- large touch targets and field-readable contrast;
- consistent status chips, confirmation sheets, error banners, sync state,
  offline state, empty state, and destructive-action treatment;
- real pressed, loading, disabled, success, retry, and conflict states; and
- role-aware navigation rather than decorative buttons.

The web application does not need to become a pixel copy of the mobile app.
Create shared product tokens, terms, status colours, icons, and interaction
semantics while respecting desktop information density and mobile field use.

Stitch enhancement decisions already recorded in the revision handoff remain
the starting point:

- adaptive density: accept with limits;
- geofence/mission visualization: partial acceptance;
- predictive smart suggestions: defer;
- guided Farmer request wizard: accept;
- offline/sync visibility: accept with explicit safety rules.

## 11. Safety and architecture constraints

The implementation plan must preserve these invariants:

1. Controllers and routes do not access Prisma directly; use repositories and
   services.
2. The server owns permissions, capability decisions, assignment conflicts,
   state transitions, and idempotency.
3. Every state mutation is audited without credentials or exact coordinates in
   general audit payloads.
4. Mobile contracts expose the minimum role-appropriate data and are versioned
   under `/api/mobile/v1` until a deliberate version change is required.
5. Offline mutations are durable, idempotent, user-scoped, conflict-aware, and
   never reported as successful before server acceptance.
6. Logout/revocation removes local user data and prevents another user from
   inheriting it.
7. Exact live mission location is short-lived operational data, not route
   history or billing telemetry.
8. Background tracking and raw telemetry remain disabled until privacy,
   retention, consent, and operational policies are approved.
9. Firebase Authentication remains retired. OTP is application-owned and
   delivery-provider-neutral.
10. Do not weaken CI, response validation, rate limits, CSRF, role checks,
    session binding, or container isolation to gain UI parity.
11. Do not hardcode server addresses, roles, credentials, business thresholds,
    status transitions, or client data.
12. Do not mutate production data while building or testing clients.

## 12. Server/data facts that affect planning

- Production is actively used and contains accumulated client data.
- Staging and production databases are different persistent volumes.
- The validated farmer workbook import exists in staging as historical/customer
  data; it intentionally created no live Leads.
- Production farmer import is a separate, not-yet-assumed operator action.
- Normal CI/CD migrations are additive and must preserve existing data.
- The fleet model includes Primary Pilot, Copilot, drone, LMV, operating centre,
  ordered daily jobs, availability/compliance, and conflict prevention.
- The current automatic assignment implementation is advanced but pointer
  drag/resize acceptance was still recorded as a gap in the canonical state.
- Billing, raw telemetry ingestion, live messaging-provider activation, and
  complete Business commercial rules are not finished merely because a screen
  exists.

## 13. Client feedback and “nicks and nacks” intake

The client’s newest defect/change list is not embedded in this handoff. Gemini
must request or consume the supplied list and convert every item into a traceable
register. Do not silently mix a defect, UI preference, new policy, and new
feature into one task.

For every item record:

```text
ID
original client wording
affected role and surface
current observed behaviour
expected behaviour
classification: defect / parity / UX / policy / new capability
backend contract impact
data or migration impact
security/privacy impact
acceptance test
priority and dependency
unresolved question
```

## 14. Required planning deliverables

Gemini must produce one coherent plan containing:

1. **Verified baseline** — branch/SHA, current test state, deployed staging SHA,
   and clearly separated production state.
2. **Surface inventory** — web, Pilot Field, and Operations Companion screens,
   routes, APIs, capabilities, and current implementation status.
3. **Pilot parity matrix** — every relevant web/mobile capability classified
   using Section 8.
4. **Operations role matrix** — exact Admin/Fleet/Sales/Farmer/Business mobile
   capabilities and forbidden actions.
5. **Contract-gap register** — existing reusable mobile endpoints versus new or
   revised endpoints, with minimum response fields.
6. **Shared design-system plan** — tokens, components, content/status glossary,
   accessibility, localization, and platform-specific exceptions.
7. **Offline plan** — what may be read offline, what may be queued, what must be
   online, conflict behaviour, encryption, purge, and visible sync states.
8. **Ordered microtasks** — small IDs with prerequisites, exact scope, likely
   files, tests, and definition of done.
9. **Test strategy** — unit, contract, role-negative, offline/retry, browser,
   Android physical-device, container, staging, and regression coverage.
10. **Release strategy** — local verification, `dev`, staging deployment,
    private APK acceptance, production API activation, signed mobile release,
    rollback, and monitoring.
11. **Decision register** — every missing client policy; use safe placeholders
    rather than invented answers.
12. **Traceability** — map each client feedback item and approved requirement to
    one or more work packages and acceptance checks.

## 15. Recommended implementation sequence for the plan

The planning agent should organize later coding approximately as follows, but
may refine dependencies after source inspection:

1. Freeze and test the current web/Pilot/API baseline.
2. Build the authoritative role/capability/status glossary.
3. Produce the Pilot web/mobile parity and divergence decisions.
4. Repair shared backend contract defects before duplicating UI work.
5. Align Pilot Field functionality and states to the approved parity matrix.
6. Extract/reuse mobile design-system and contract primitives safely.
7. Complete the Operations mobile API inventory and minimum contracts.
8. Implement Operations authentication/bootstrap and role shells.
9. Implement role workspaces in dependency order, beginning with the client’s
   immediate operational priorities.
10. Add offline behaviour only to explicitly approved workflows.
11. Close client feedback items with automated and human acceptance evidence.
12. Validate both apps and web against the same staging revision and dataset.
13. Prepare, but do not assume, production mobile activation and store release.

Each package must be independently reviewable and must not combine schema,
authentication, broad UI replacement, and production deployment into one
unbounded change.

## 16. Questions the plan must surface, not invent

- Which Pilot web capabilities must remain as fallback after mobile rollout?
- Is Pilot Field mandatory for every Pilot or optional during transition?
- Which non-Pilot roles are in the first Operations Companion release?
- Does “all-in-one login” require an account-type chooser, identifier detection,
  or separate employee/customer entry actions?
- What is the approved mobile session lifetime and installation limit?
- What notifications are required, through which approved provider?
- What exact states are needed for “waiting for spare”, travel, spraying,
  pause/resume, and operational exceptions?
- What live-location notice, retention, sampling, and supervisor visibility has
  the company approved?
- Which customer actions must work offline, if any?
- Which languages and final client-reviewed wording are required at launch?
- Which client feedback items block the next demonstration versus later release?
- What domain, TLS, signing identity, Play account, privacy policy, support
  contact, and release owner will be used?

## 17. Copy/paste prompt for Gemini

> Read `docs/plan/one-ness planning.md` completely, then follow its mandatory
> reading order and inspect the current source. This is a planning-only task:
> do not write or change code, files, Git state, databases, server configuration,
> or deployments. Produce an evidence-based, dependency-ordered implementation
> plan to make the web SPA, RFLY Pilot Field app, and planned RFLY Operations
> Companion app behave as clients of one coherent platform. Build explicit
> Pilot parity/divergence and non-Pilot role-capability matrices; inventory the
> current `/api/mobile/v1` contracts; separate implemented code, Stitch-only
> design, missing defects, and unresolved policies; incorporate the supplied
> client feedback as traceable items; and break implementation into small
> testable packages with security, offline, data, CI/CD, staging, physical-device,
> and rollback acceptance. Preserve server-owned authorization/state machines,
> minimal mobile data, auditability, customer isolation, encrypted user-scoped
> offline storage, and production data safety. Do not use historical files under
> `docs/unrealted_docs_for_current_version/`, do not revive Firebase/Bhumeet or
> unsafe one-off scripts, and do not claim parity or release readiness without
> source and test evidence.


# RFLY Operations Companion — Native App Implementation Plan

**Status:** active planning — ready for execution
**Created:** August 25, 2026
**Planner:** Antigravity (Gemini)
**All worker models:** Gemini only (Flash 2.5 for atomic tasks / Gemini 2.5 Pro for packages)
**Canonical source doc:** `docs/plan/NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md`
**Authoritative entry point:** `docs/plan/AGENTS.md`

---

## What exists today

| Item | State |
|---|---|
| `operations-mobile/` source directory | DOES NOT EXIST — must be created from scratch |
| Backend `/api/mobile/v1/operations` routes | PARTIALLY EXISTS — Auth, bootstrap, Sales and Fleet endpoints present; Farmer and Business mobile sessions absent |
| Capacitor WebView APK (`frontend/android/`) | EXISTS — interim shell, not this app |
| Pilot Field app (`pilot-mobile/`) | EXISTS — separate; do not touch |
| Backend test coverage (phases 31-34) | EXISTS for current routes — must be extended with every new endpoint |

**The Capacitor WebView and this native app are separate projects.**
The WebView shell ships quickly to give staff something to use.
This native app is built properly while that shell is in use.

---

## Model assignment

| Model | Mode | Task type |
|---|---|---|
| Gemini Flash 2.5 | Default (no extended thinking) | Read-only inventory, single-file edits, config, gitignore, package.json setup |
| Gemini 2.5 Pro | Extended thinking | Backend service/repo/route packages, auth flows, React Native screen packages, CI job |

Flash gets atomic tasks (max 2 files, binary success criterion).
Pro gets full packages (OC-xx series — backend + tests together, or app scaffold + auth together).

---

## Hard constraints inherited from NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md

1. Firebase Authentication is retired — no `firebase/auth`, no Firebase SDK.
2. OTP: application-owned challenge service; provider only delivers.
3. Tokens and install keys use Android secure storage — never AsyncStorage, SQLite, logs.
4. Repository pattern strictly enforced: routes → controllers → services → repositories → Prisma.
5. Every state mutation writes a credential-free, coordinate-free audit event.
6. Mobile responses are minimal role-specific DTOs — never raw Prisma objects.
7. Farmer mobile OTP reuses the existing challenge service — do not invent a new path.
8. Background location and raw telemetry remain disabled.
9. `main` is live with real client data — never seed, wipe, or import via code push.
10. Stitch exports are design evidence only — implement repository-native React Native components.
11. `pilot-mobile/` is untouched — two separate apps, shared runner, separate package IDs.
12. No hardcoded URLs, credentials, customer records, or business policy values in source.
13. Farmer-facing strings use the localization system (i18next or react-i18next equivalent).
14. Normal branch flow: `dev` → staging PR → main promotion. Maintainer may push directly.

---

## Existing backend mobile API (do not duplicate, do extend)

```
POST   /api/mobile/v1/operations/auth/login       ← Admin, Fleet, Sales only
GET    /api/mobile/v1/operations/bootstrap         ← role-specific profile + capabilities
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

Farmer and Business do NOT yet have installation-bound mobile sessions.
OC-02 adds them before any Farmer or Business screen can be built.

---

## Delivery graph

```
OC-00 Baseline inventory (Flash)
  → OC-01 Contract + security reconciliation (Pro)
      → OC-02 Auth + bootstrap for all 5 roles (Pro)
          → OC-03 App foundation — operations-mobile/ scaffold (Pro)
              → OC-04 Sales / customer-intake slice (Pro)
              → OC-05 Fleet schedule / exception slice (Pro)
              → OC-06 Admin operational slices (Pro)
              → OC-07 Farmer OTP / request slice (Pro)
              → OC-08 Business isolation slice (Pro)
          → OC-09 Offline / cache / notification policy (Pro)
      → OC-10 Backend + cross-client regression (Pro)
  → OC-11 CI job + staging APK + device acceptance (Flash + Pro)
  → OC-12 Production readiness (maintainer decisions required)
```

OC-04 through OC-08 run in parallel after OC-03 ships.
OC-09 runs in parallel with OC-04–08 (offline policy doesn't block screens, screens don't block policy).
OC-10 is integration — runs after all slices complete.
OC-11 is CI — can be started (scaffold job) after OC-03, extended as slices land.

---

## OC-00 — Baseline inventory
**Model: Gemini Flash 2.5 | Read-only | Prompt: OC-00-FLASH-PROMPT.md**

Read-only. No file changes. Returns a matrix.

Flash must:
1. Read `docs/plan/AGENTS.md` and `docs/plan/NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md` fully.
2. Run `git log --oneline -10` and record current staging SHA.
3. Read `backend/routes/` and list every `/api/mobile/v1/operations` route file.
4. Read `backend/tests/phase31*.js phase32*.js phase33*.js phase34*.js` — note what each tests.
5. List every web SPA screen (`frontend/src/pages/`, `frontend/src/components/`) with its role.
6. For each of the 5 roles (Admin, Fleet, Sales, Farmer, Business), classify each desired screen:
   - `API_EXISTS` — mobile endpoint exists and is tested
   - `SERVICE_EXISTS` — backend service exists but no mobile route
   - `MISSING_DTO` — domain capability exists but mobile DTO is absent
   - `MISSING_ENDPOINT` — needs new backend work
   - `DEFERRED` — not in current scope
7. Confirm `operations-mobile/` does not exist.
8. Confirm no Farmer or Business mobile session in current routes.

Output format: markdown table, one row per screen/capability, columns: Role | Screen | Classification | Notes.
No file changes. Report only.

**Done when:** classification matrix delivered, no files changed.

---

## OC-01 — Shared mobile contract reconciliation
**Model: Gemini 2.5 Pro | Backend only | Scope: backend/ only**

Pro reads OC-00's matrix and the existing mobile contract files.

Tasks:
- Audit `backend/src/` for any mobile DTO or contract fixture files — record exact paths.
- Confirm `/api/mobile/v1` version boundary is retained (no v2 unless justified).
- Extend/document the JSON contract for Operations Companion:
  - stable error codes
  - request ID, server time, timezone in all responses
  - decimal string format for money/area values
  - pagination cursor format
  - capability name enum for role navigation
  - notification DTO placeholder
- Add/extend `backend/tests/` fixture tests for the new contract additions.
- Run `npm test` in backend/ — must pass 164+ tests, 0 failing.

Files changed: backend contract/DTO files only. No route additions yet (those are OC-02).

**Done when:** npm test passes; contract doc committed; OC-00 matrix updated with confirmed DTO status.

---

## OC-02 — Complete authentication + bootstrap for all 5 roles
**Model: Gemini 2.5 Pro | Backend + tests | Scope: backend/ only**

This is the most critical backend package. All screen work depends on it.

**Employee login (Admin/Fleet/Sales) — already exists; extend only:**
- Confirm installation-bound bearer session, idle/absolute expiry, two-device limit.
- Confirm logout and logout-all endpoints.
- Confirm Admin lost-device revocation.
- Add any missing role-negative tests (wrong app, inactive user, wrong role).

**Farmer mobile OTP — NEW:**
- Add `POST /api/mobile/v1/operations/auth/farmer/request-otp`
- Add `POST /api/mobile/v1/operations/auth/farmer/verify-otp`
- Reuses the existing application-owned OTP challenge service (not Firebase).
- Produces installation-bound bearer session like employee login.
- OTP cooldown, attempt limit, expiry enforced server-side.
- Returns Farmer-role bootstrap on success.

**Business mobile credential login — NEW:**
- Add `POST /api/mobile/v1/operations/auth/business/login`
- Email/password credential (staff-provisioned account, not self-registration).
- Safe error: does not reveal whether account exists.
- Approved recovery path (no arbitrary enumeration).
- Returns Business-role bootstrap on success.

**Bootstrap extension:**
- `GET /api/mobile/v1/operations/bootstrap` must return role-specific profile, capabilities array, feature flags, server version policy, server time, operating timezone.
- No post-login role picker — role is determined server-side from the session.
- Extend bootstrap for Farmer and Business roles.

**Tests — all required:**
- Valid login per role (5 roles)
- Wrong app (Operations app, wrong session type)
- Wrong role (employee trying Farmer OTP path)
- Inactive/archived user — 401
- OTP expiry, reuse, cooldown, attempt limit
- Installation limit (2 devices max) — reject on 3rd
- Revoked session — 401
- Logout purges only the device token
- Logout-all revokes all installations
- Bootstrap returns only role-appropriate fields
- Role-negative DTO: Sales cannot see Fleet-only fields in bootstrap

Run `npm test` — must pass all tests, 0 failing.

**Done when:** all 5 role auth paths tested; npm test green; committed to dev.

---

## OC-03 — Create operations-mobile/ application scaffold
**Model: Gemini 2.5 Pro | New directory | Scope: operations-mobile/ (new)**

Creates `operations-mobile/` as a peer to `pilot-mobile/`.
Modelled on pilot-mobile/ structure — same Expo SDK version, same TypeScript config baseline.
Do NOT copy Pilot navigation, mission state, or Copilot logic.

**Bootstrap the project:**
```
npx create-expo-app@latest operations-mobile --template blank-typescript
```
Then align to the same Expo SDK version as pilot-mobile/.

**Implement:**
1. `app.json` — unique package identity placeholder `com.rfly.operations` (production ID pending DEC-13).
2. Environment profiles: `local`, `staging`, `production` via `RFLY_OC_APP_VARIANT`.
3. `EXPO_PUBLIC_OC_API_URL` — no hardcoded server address.
4. Centralized API transport: `src/api/client.ts` — bearer injection, timeout, safe error types.
5. Runtime response validation against TypeScript schemas (zod or equivalent).
6. Secure installation/session storage: `expo-secure-store` — never AsyncStorage for tokens.
7. Encrypted user-scoped local database placeholder (react-native-mmkv or SQLite with encryption).
8. Navigation shell: `src/navigation/` — role-gated navigator, one per role.
9. Screens (stubs — no data yet):
   - `LoginScreen` — email/password form for Admin/Fleet/Sales; OTP phone entry for Farmer; credential for Business
   - `RoleShellScreen` — renders correct role navigator after bootstrap
   - `AccessDeniedScreen` — wrong role or app mismatch
   - `OfflineScreen` — no connectivity
   - `MandatoryUpgradeScreen` — version policy gate
   - `LoadingScreen` — session restoration in progress
10. Navy `#1A2B44` + Safety Orange `#FF6B00` design tokens in `src/theme/`.
11. `src/i18n/` — localization scaffolding (i18next), Farmer-facing strings externalized.
12. `package.json` scripts: `typecheck`, `test`, `doctor`.
13. `.gitignore` — excludes `android/` build outputs, `.expo/`, `node_modules/`, secrets.

**Tests:**
- Each synthetic role authenticates against a mock/staging server and receives only its navigation shell.
- Logout leaves no user token in secure storage.

**Done when:**
- `npm run typecheck` passes
- `npm test` passes (scaffold-level tests)
- `npx expo-doctor` passes
- Each role shell renders; login gateway shown if no session; logout clears storage.

---

## OC-04 — Sales and customer-intake slice
**Model: Gemini 2.5 Pro | Backend (if missing endpoints) + operations-mobile/screens**

**Backend additions (only if missing from OC-00 matrix):**
- Verify server-backed master data endpoint for Cluster, Crop, Spray Purpose, Lead Source, B2B subcategory.
- Add if absent: `GET /api/mobile/v1/operations/sales/masters`
- Verify Reporting Admin endpoint.
- Add geofence result endpoint if not exposed to mobile.

**App screens (in operations-mobile/):**
- `CustomerSearchScreen` — exact normalized-phone lookup + debounced name search.
- `CustomerDetailScreen` — profile, service history, lead list.
- `CustomerRegisterScreen` — duplicate-aware; server-backed dropdown fields only.
- `NewLeadScreen` — server-backed master values; map pin + Plus Code; geofence result display.
- Geofence decline: show safe outcome message; no appeal flow; no manual drone choice.
- Loading, empty, validation, offline draft, server-conflict, retry states for each screen.

**Offline policy for Sales (from OC-09 spec):**
- Unsubmitted form → encrypted local draft.
- Customer/lead creation → online confirmation required; local draft must not appear as created.

**Tests (backend):** role-negative (Fleet cannot access Sales endpoints), missing-field rejection, geofence boundary.

**Done when:** Sales can complete a full customer search → register → lead cycle against staging.

---

## OC-05 — Fleet schedule and exception slice
**Model: Gemini 2.5 Pro | Backend (if missing) + operations-mobile/screens**

**Backend:** verify schedule projection, exception queue, and copilot override endpoints from OC-00 matrix. Add any missing bounded mobile mutations only where the service layer already supports them safely.

**App screens:**
- `ScheduleScreen` — day/week ordered list of assignments.
- `AssignmentDetailScreen` — Primary Pilot, Copilot, Drone, LMV, centre, window, sequence.
- `ExceptionQueueScreen` — manual queue with server reason codes.
- `CopilotOverrideScreen` — eligibility check, expected revision, mandatory reason, conflict refresh.
- `LiveLocationScreen` — latest active-mission Pilot location; explicit map load consent required.
- Resource (Drone/LMV/Pilot) read/detail/status — only when mobile endpoints explicitly authorize.

No fake drag/drop reassignment. No silent overwrite. Conflict → refresh prompt.

**Done when:** Fleet can view schedule, raise exception, and submit copilot override with server confirmation.

---

## OC-06 — Admin operational slices
**Model: Gemini 2.5 Pro | Backend (if missing) + operations-mobile/screens**

Implement in this order (each sub-item is a separate commit):

1. Operational home + review queues.
2. Customer list/detail + staff-assisted intake (reuse OC-04 screens).
3. Assignment list/detail + Fleet exception reuse (reuse OC-05 screens).
4. Team management — create/edit employees; one protected Admin guard.
5. Drone, LMV, Pilot management + operating-centre transfer guards.
6. Feasible-region management — map/Plus Code/radius; server confirmation.
7. Auto-assignment policy — revision conflict protection; server-authorized only.
8. Server-backed master-data management (for approved master types only).
9. Latest active-mission Pilot location (reuse OC-05 LiveLocationScreen).

Every mutation: server authorization + confirmation + audited reason where applicable + stale/conflict handling. No secrets, password hashes, DB controls, or audit-history mutation exposed.

---

## OC-07 — Farmer OTP, portal and request slice
**Model: Gemini 2.5 Pro | Depends on OC-02 Farmer auth + operations-mobile/screens**

**App screens:**
- `FarmerPhoneScreen` — phone entry for OTP request.
- `FarmerOTPScreen` — OTP verification; cooldown timer; resend.
- `FarmerDashboardScreen` — own profile, service history, request status.
- `ServiceRequestWizard` — 5 steps: service/crop → location → preferred window → review → server result.
  - Step 3 (location): map pin + Plus Code; resolved to numeric coordinates before submission.
  - Step 5: geofence result; decline is final; no appeal.
- Local draft survives process death; not shown as submitted until server confirms.
- Assignment/request status shown without internal notes, staff data, exact crew contacts, or other customers.
- All Farmer-facing strings externalized to i18n files (no hardcoded English).

No self-registration. No appeal flow. No raw coordinates stored.

---

## OC-08 — Business/B2B isolation slice
**Model: Gemini 2.5 Pro | Depends on OC-02 Business auth + operations-mobile/screens**

**App screens:**
- `BusinessLoginScreen` — email/password credential.
- `BusinessDashboardScreen` — organization identity; linked requests overview.
- `LinkedRequestListScreen` — only explicitly linked records; no other customers visible.
- `LinkedRequestDetailScreen` — detail + status.
- `NotificationsScreen` — own/linked notifications only.
- `ProfileScreen` — organization profile.
- Business-created request: include only if approved server capability exists; otherwise omit control entirely.

Membership/link isolation enforced in repository and service layers — never client-side.
No commissions, GST, billing, settlements, or commercial dashboards.

---

## OC-09 — Offline, cache and notification policy
**Model: Gemini 2.5 Pro | Cross-cutting | Implement in operations-mobile/**

| Operation | Policy |
|---|---|
| Previously viewed bounded lists/details | Encrypted read cache; stale label shown |
| Farmer/Sales unsubmitted form | Encrypted local draft; not shown as submitted |
| Customer/lead/request creation | Online confirmation required; explicit retry |
| Schedule/resource/policy/team mutation | Online only; never silently queued |
| Notification read acknowledgement | Queue only if idempotent server contract exists |
| Logout/revocation/account switch | Purge ALL user-scoped cache and pending drafts |

All pending/retry/conflict states are visible to the user.
Never expose "overwrite server" option.
Background sync, push provider and offline mutation replay require separate approved contracts — do not implement speculatively.

---

## OC-10 — Backend and cross-client regression
**Model: Gemini 2.5 Pro | Backend tests only**

After all slices (OC-04–08) land:

- Add service/repo/controller contract tests for every new endpoint added across OC-02–08.
- Test every allowed role AND every forbidden role per endpoint.
- Confirm web SPA and Pilot Field API behaviour is unchanged (no regressions).
- Test audit events, redaction, rate limits, version header handling, installation revocation.
- If any schema migration was added: replay all migrations from empty + populated baseline.
- Run full suite: backend tests, frontend lint/build, pilot-mobile typecheck/test/doctor, Compose gate.

**Done when:** backend suite passes (164+ tests → extended total), 0 failures; Compose gate green; no regressions in web or Pilot.

---

## OC-11 — CI job, staging APK and device acceptance
**Model: Gemini Flash 2.5 (CI yml) + Gemini 2.5 Pro (acceptance doc)**

**Flash task — add `operations-mobile` CI job to `.github/workflows/ci.yml`:**

Modelled exactly on the existing `pilot-mobile` job:
```yaml
operations-mobile:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  defaults:
    run:
      working-directory: operations-mobile
  env:
    RFLY_OC_APP_VARIANT: production
    EXPO_PUBLIC_OC_API_URL: https://oc-ci.example.invalid
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4 (node 24, cache operations-mobile/package-lock.json)
    - npm audit --omit=dev --audit-level=critical
    - npm run typecheck
    - npm test -- --runInBand
    - npm run doctor
```

Separate from `pilot-mobile` — own job name, own cache key, own working-directory.

**Flash task — add `operations-companion-staging-apk` job:**

Modelled on `operations-capacitor-apk` (which is modelled on `pilot-staging-apk`):
- Runs only on push to staging, after all gates pass.
- Builds standalone arm64 staging APK via `npx expo prebuild --platform android --clean`.
- Package ID: `com.rfly.operations.staging` (distinct from Pilot and from production ID).
- Artifact: `rfly-operations-companion-staging-<sha>` — 7-day retention.
- Verifies package name, permission boundary (no BACKGROUND_LOCATION etc.), SHA-256.
- Never shares signing keys with Pilot Field.

**Physical device acceptance (Pro writes the acceptance doc):**
- Test all 5 role login paths.
- Test poor network, process death, session expiry, revocation, account switch.
- Test large text, sunlight contrast, Android back navigation.
- Test offline draft survival and proper not-submitted labelling.

**Done when:** CI green on staging; APK artifact produced; acceptance doc written at `docs/plan/one-ness program/OC_STAGING_ACCEPTANCE.md`.

---

## OC-12 — Production and Play release readiness
**Who: Maintainer decisions required before any AI work begins**

Production mobile release is blocked until the company supplies/approves:

| Decision | Owner |
|---|---|
| DEC-13: Production Android package ID | Maintainer |
| DEC-12: Production domain + HTTPS/TLS | Maintainer |
| Production signing key custody and backup | Maintainer |
| Play Console account ownership | Company |
| Privacy policy and store listing owner | Company |
| Notification/OTP delivery provider + credentials | Company |
| Location notice wording (Farmer-facing) | Company |
| Supported languages and client-approved copy | Company |
| Monitoring, rollout, rollback, incident owners | Company |

**Release sequence when gates are approved:**
1. Internal track → closed testing → staged rollout.
2. Rollback evidence documented before each stage.
3. HTTP endpoints replaced with HTTPS domain.
4. Production signing key replaces debug signing.

The current HTTP office endpoint is NOT a Play Store production baseline.

---

## Explicit exclusions (from NON_PILOT handoff)

- Pilot mission controls in this app
- Firebase Authentication (retired)
- Direct PostgreSQL access
- Background location tracking
- Raw Drone telemetry or route-history billing
- Bhumeet/mock marketplace integration
- Predictive routing, demand heatmaps, weather/aviation fabrication
- Unapproved billing, commissions, GST, pricing
- Client-authoritative conflict overwrite
- Production credentials or customer data in source or tests

---

## Completion evidence required per package

For every OC-xx return:

- Branch and commit SHA
- Changed contracts / routes / services / repositories / screens (list exactly)
- Tests added and exact pass count
- Role-negative and security test evidence
- Migration replay evidence if schema changed
- Android artifact identity and SHA-256 when built
- Staging deployment SHA and physical-device acceptance record
- Unresolved placeholders and intentionally deferred items
- Rollback boundary statement

**Do not claim a package complete because screens render.**
Completion requires server enforcement, safe offline behaviour, and test evidence.

---

## How to run a package

1. Copy the relevant OC-xx section above into a fresh Gemini session.
2. Prefix it with the copy-paste prompt from NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md §13:

> Read `AGENTS.md`, `docs/plan/AGENTS.md`, and
> `docs/plan/NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md` completely. Inspect
> the current branch and source before acting. Continue the RFLY Operations
> Companion implementation in dependency order beginning with the first
> incomplete OC-xx package. This is one non-Pilot app for Admin, Fleet, Sales,
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

3. Then append the specific OC-xx task description from this file.
4. The model works, reports, and you review. Do not merge without the completion evidence checklist above.

---

*End of Operations Companion Plan*
*Start: OC-00 → Flash 2.5, read-only inventory*

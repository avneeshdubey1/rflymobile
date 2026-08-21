# Gemini / Antigravity Pilot Mobile Rebuild Handoff

**Status:** copy/paste engineering prompt and ordered repair workbook
**Audience:** Gemini, Antigravity or another coding agent
**Primary target:** `pilot-mobile/`
**Design input:** corrected Stitch images/specifications produced from
`STITCH_MOBILE_REDESIGN_HANDOFF.md`
**Server authority:** existing `/api/mobile/v1` implementation and contract
**Safety:** no production deployment, database mutation, credential creation,
branch push or release without explicit maintainer approval

## 1. How to use this handoff

Give the coding agent this complete document after the corrected Stitch design
package has been exported. The agent must implement one numbered package at a
time and return evidence before continuing. “The screen renders” is not
completion.

Do not ask an agent to “integrate the whole Stitch export.” Stitch HTML is not
React Native and is not approved repository source. The agent may inspect
`screen.png`, `screen-spec.md`, design tokens and navigation/state documents.
It must manually implement repository-native React Native components.

The Pilot Field app and the web application may have different UI. They remain
compatible by using the same authoritative Node.js services and PostgreSQL
data through versioned APIs. A web UI change does not automatically appear in
mobile, and a mobile screen must never bypass the API.

## 2. Mandatory reading before any change

Read these files in this order and report that they were read:

1. `docs/plan/AGENTS.md`
2. `docs/plan/CURRENT_ENGINEERING_STATE.md`
3. `docs/plan/production_hardening.md`
4. `docs/plan/MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`
5. `docs/plan/PILOT_MOBILE_API_CONTRACT.md`
6. `docs/plan/GEMINI_MOBILE_INTEGRATION_HANDOFF.md`
7. `docs/plan/RFLY_MOBILE_UI_DESIGN_BRIEF.md`
8. `docs/plan/STITCH_MOBILE_REDESIGN_HANDOFF.md`
9. `pilot-mobile/AGENTS.md`
10. `backend/routes/mobileV1Routes.js`
11. `backend/contracts/mobile/v1/mobile-api.schema.json`
12. every sanitized fixture under `backend/contracts/mobile/v1/fixtures/`

Do not use `docs/unrealted_docs_for_current_version/`, old chat output,
archived JavaScript, old seeds, legacy Firebase code or Stitch `code.html` as
requirements.

## 3. Non-negotiable boundaries

- Modify `pilot-mobile/` only unless a numbered package explicitly authorizes
  a focused CI/document change.
- Pilot Field accepts active `PILOT` accounts only.
- Do not put Admin, Fleet Manager or Sales navigation in Pilot Field.
- Do not create the Operations app inside `pilot-mobile/`.
- Do not change backend routes, schema, authorization or state machines merely
  to accommodate a client mistake.
- Do not add Firebase Authentication, Firebase OTP or a Firebase compatibility
  layer.
- Do not access PostgreSQL from the app.
- Do not hardcode credentials, tokens, people, assignments, farms, coordinates,
  Pilot IDs, Copilot IDs, Drone values, LMV values or operational decisions.
- Do not log access tokens, installation keys, passwords, phones, coordinates,
  entire Axios errors or cached assignment payloads.
- Do not add background location, telemetry, chat, ratings, billing,
  commission, Farmer or Business functionality.
- Do not use `npm audit fix --force`, bypass peer dependencies or weaken CI.
- Do not commit local `.env`, generated native credentials, signing material,
  Expo state, customer data or screenshots containing live data.
- Do not commit, push, merge, deploy or touch staging/production data unless the
  maintainer explicitly requests that separate action.

## 4. Existing server contract

The backend already exposes these Pilot Field routes:

```text
POST   /api/mobile/v1/pilot/auth/login
POST   /api/mobile/v1/auth/logout
POST   /api/mobile/v1/auth/logout-all
DELETE /api/mobile/v1/installations/:installationId
GET    /api/mobile/v1/pilot/bootstrap
GET    /api/mobile/v1/pilot/assignments
GET    /api/mobile/v1/pilot/changes
POST   /api/mobile/v1/pilot/sync
GET    /api/mobile/v1/pilot/assignments/:assignmentId
GET    /api/mobile/v1/pilot/assignments/:assignmentId/eligible-copilots
POST   /api/mobile/v1/pilot/assignments/:assignmentId/copilot
POST   /api/mobile/v1/pilot/assignments/:assignmentId/actions
```

The strict DTO source is
`backend/contracts/mobile/v1/mobile-api.schema.json`. Do not infer fields from
Prisma or browser responses.

Important rules:

- login returns the token at `response.data.session.accessToken`;
- bearer tokens stay in Android secure storage;
- controls come from bootstrap `capabilities` and assignment
  `allowedActions`;
- every mission mutation has one durable `clientActionId` and
  `expectedRevision`;
- retries of the same logical action reuse the same UUID and payload;
- Copilot selection makes the assignment ready but does not accept/start it;
- conflict means refresh/review, never overwrite;
- server error handling branches on `error.code`, not English message text.

## 5. Current repository audit

The Expo project now type-checks and bundles, and the login token nesting defect
was corrected locally. It is still a prototype. The following defects must be
treated as known work, not rediscovered one at a time.

| Area/file | Current defect | Required correction |
|---|---|---|
| `src/lib/api.ts` | Local URL is one `.env` value; no explicit build profiles or runtime diagnostics | Validated development/staging/production profiles; staging/production HTTPS; safe offline/network error mapping |
| `src/store/authStore.ts` | Stores only token/capability subset; incomplete profile, installation and version state | Typed login/bootstrap state, safe profile, installation ID, capability flags, version policy, server time/timezone and deterministic purge rules |
| `src/store/authStore.ts` | Bootstrap/network failure can become unauthenticated without a clear recoverable state | Distinguish no-session, expired/revoked, offline-with-valid-cache, mandatory upgrade and retryable bootstrap failure |
| `src/lib/database.ts` | Assignment/farmer/coordinate data is stored in ordinary SQLite JSON | Use an approved encrypted-at-rest native cache in a development build; document key ownership and migration |
| `src/lib/database.ts` | Cache is not scoped to the authenticated user/installation and is not purged on account change | User/app/installation namespace and atomic purge on identity mismatch, revocation and required logout paths |
| `src/lib/database.ts` | Mutation state supports only `PENDING`/`FAILED` and stores no receipt/retry evidence | Durable pending/retrying/conflict/rejected/applied records, attempt metadata and safe request IDs |
| `src/lib/syncManager.ts` | Conflict and rejected mutations are deleted, losing the evidence the Sync UI needs | Retain terminal/conflict evidence and expose it for review; delete only under an approved retention path |
| `src/lib/syncManager.ts` | Fire-and-forget sync, no network/app-state orchestration or bounded backoff | Single durable sync coordinator with connectivity/app-state triggers, queue locking and bounded retry |
| `src/lib/syncManager.ts` | Errors are mostly swallowed/logged; UI cannot explain queue state | Typed sync result observable by screens; privacy-safe diagnostics without Axios/token payloads |
| `app/_layout.tsx` | Database initialization failure may leave an endless blank/spinner state | Explicit initialization error and safe retry; deterministic auth/navigation state machine |
| `(tabs)/_layout.tsx` | Pilot app exposes Fleet and Map tabs that are out of scope/disabled | Replace with Work, Sync and Profile only |
| `(tabs)/index.tsx` | Branding says `RFLY Ops`; work list has no assignment-detail journey | Pilot Field branding; Today/Upcoming, detail route and complete state handling |
| `(tabs)/index.tsx` | `ACCEPT` is not represented; cards respond mainly to Select Copilot or Start | Render the server’s next allowed action; explicit Accept before Start |
| `(tabs)/index.tsx` | Loading/refresh failure/offline/cancelled/reassigned/review states are incomplete | Implement every state from corrected Stitch specification |
| `(tabs)/fleet.tsx` | Empty and unauthorized Pilot placeholder | Remove from Pilot navigation and production bundle |
| `(tabs)/map.tsx` | Empty placeholder while location capability is disabled | Remove from navigation; external farm navigation belongs to assignment detail |
| `(tabs)/profile.tsx` | Empty placeholder | Implement safe bootstrap profile, language, operating centre and session actions |
| `select-copilot.tsx` | Candidate selection has incomplete offline/conflict/error states | Typed candidates, retry/no-candidate/Fleet-follow-up and revision refresh |
| `confirm-selection.tsx` | Candidate name is trusted from route parameters and success returns without an explicit result model | Resolve display from server-returned candidate data; validate route IDs; refresh authoritative assignment after success |
| `selection-confirmed.tsx` | Hardcoded person, Drone and duration; assignment ID is lost; likely orphaned | Remove it or rebuild from authoritative assignment/result data; never invent values |
| `mission-active.tsx` | Opening the screen automatically enqueues `START` | Delete all mount/focus auto-mutation; Start requires an explicit confirmation press |
| `mission-active.tsx` | Fake 42% battery, simulated completion map target and remote Google image | Remove invented telemetry/map/image; show only contract fields |
| `mission-active.tsx` | Issue category/note are hardcoded and UI claims success before receipt | Controlled issue form, validation and queued/applied/conflict/rejected outcomes |
| `mission-completed.tsx` | No positive decimal validation; rejected completion can disappear from queue | Decimal-safe local validation plus authoritative receipt state; do not claim completion prematurely |
| `upgrade.tsx` | Static text with no version policy/details or approved destination | Render bootstrap/426 policy safely; keep distribution URL configurable/deferred |
| Whole app | Missing assignment detail, Sync Status and session/security journeys | Implement the approved Pilot inventory before release |
| Whole app | No automated tests or mobile CI | Add contract, reducer/use-case, storage, sync and navigation tests plus CI gates |
| `app.json` | Anonymous package ID, no approved versionCode/release ownership | Keep release blocked until company package ID, Play ownership and signing are approved |
| Whole app | Expo Go is being treated as the final runtime | Use Expo Go only for early visuals; use a native development build for encryption/device integration and release evidence |

## 6. Required target architecture

Refactor toward these boundaries without creating one large rewrite commit:

```text
app routes/screens
  -> feature view-models/use cases
    -> typed mobile API client + sync coordinator
      -> secure session/installation store
      -> encrypted user-scoped assignment/action repository
```

Suggested feature boundaries:

```text
src/config/
src/contracts/
src/api/
src/auth/
src/storage/
src/sync/
src/design-system/
src/features/work/
src/features/copilot/
src/features/mission/
src/features/issues/
src/features/profile/
src/features/sync-status/
```

Screens may never call SQLite or SecureStore directly. API calls should live in
typed repositories/use cases rather than visual components. Navigation params
contain identifiers, not authoritative display/business data.

## 7. Ordered implementation packages

Complete and verify each package before starting the next.

### GM-00 Baseline and input validation

1. Record branch, commit, worktree and current untracked files.
2. Verify corrected Stitch inputs are images/specifications, not trusted code.
3. Run and record baseline:
   - `npm ci` or explain why the current untracked prototype lacks a committed
     clean-install baseline;
   - `npx expo-doctor`;
   - `npx tsc --noEmit`;
   - Android Expo export;
   - dependency audit without forced changes.
4. Inventory all current routes and compare them with the backend contract.
5. Do not delete unrelated user work.

Acceptance: a written baseline with every failure and no source change hidden
inside setup.

### GM-01 Contract and configuration foundation

1. Create typed request/response models from the strict JSON schema/fixtures.
2. Add runtime response validation at trust boundaries.
3. Validate API base URLs and separate development, staging and production
   build profiles.
4. Never embed secrets in `EXPO_PUBLIC_*`; the base URL is public configuration.
5. Centralize timeout, bearer injection, safe error parsing, request ID,
   401/426 handling and privacy-safe diagnostics.
6. Preserve the corrected `session.accessToken` login path.

Acceptance: malformed login/bootstrap/assignment/error fixtures fail closed;
valid fixtures pass; physical-device local URL can be diagnosed without
displaying credentials.

### GM-02 Authentication and capability bootstrap

1. Keep one cryptographically random installation key in secure storage.
2. Implement login, bootstrap, cold restoration, logout, logout-all,
   installation revocation, expiry, revocation and upgrade states.
3. Keep profile, app identity and capabilities typed.
4. Reject a bootstrap for the wrong app/role.
5. Purge or isolate cached data when authenticated identity/app changes.
6. Do not add Firebase.

Acceptance: physical Pilot login/bootstrap/logout works; Admin/Sales/Fleet are
rejected by Pilot Field; token is absent from logs and ordinary storage.

### GM-03 Encrypted user-scoped storage

1. Move from plaintext shared assignment JSON to an approved encrypted native
   cache suitable for Android development/release builds.
2. Scope assignments, cursor, pending mutations and receipts by user/app and
   installation as required.
3. Add schema versioning and tested migrations.
4. Define terminal-assignment and logout/revocation purge behaviour from the
   canonical contract.
5. Preserve unresolved local action evidence through safe offline sessions and
   full resync.

Acceptance: a second Pilot on the same device cannot read the first Pilot’s
cache; raw assignment phone/coordinates are not readable from ordinary SQLite
files; storage migration and purge tests pass.

### GM-04 Durable synchronization engine

1. Persist the complete mutation before attempting network transmission.
2. Reuse `clientActionId` and payload for every retry.
3. Preserve order: Accept → Start → Complete.
4. Send at most 20 mutations per sync request.
5. Store and display APPLIED, ALREADY_APPLIED, CONFLICT, REJECTED and
   RETRY_LATER outcomes.
6. Use bounded exponential backoff and one sync lock.
7. Handle cursor changes, full resync and removal tombstones.
8. Never drop conflict/rejection evidence silently.
9. Do not log full transport errors or sensitive payloads.

Acceptance: airplane-mode/process-restart and response-loss tests prove no
duplicate action and no reordering; full resync preserves unresolved evidence.

### GM-05 Navigation and design-system implementation

1. Recreate corrected Stitch tokens/components manually in React Native.
2. Replace tabs with Work, Sync and Profile.
3. Keep transactional screens in a stack.
4. Add accessible labels, 48 dp targets, dynamic text and translated-string
   resilience.
5. Remove Pilot Fleet/Map placeholders and all remote prototype imagery.
6. Do not add Operations screens to this package.

Acceptance: navigation follows capability/action state and has no blank
placeholder destinations.

### GM-06 Work list and assignment detail

1. Implement initial bounded assignment download and cached offline display.
2. Implement Today/Upcoming in server order.
3. Implement detail with only allow-listed assignment DTO fields.
4. Show LMV, Drone, crew, service window, sequence and notes.
5. Add external phone/navigation intents with confirmation and safe absence
   states.
6. Render only server `allowedActions`.
7. Handle loading, empty, offline, refresh, cancelled, reassigned, removed and
   stale states.

Acceptance: no broad server object is cached/rendered; `ACCEPT` is visible when
allowed and `START` is absent until allowed.

### GM-07 Copilot formation

1. Fetch candidates only when `SELECT_COPILOT` is allowed.
2. Display only ID-safe candidate fields.
3. Keep selected candidate in trusted feature state, not display-name route
   parameters.
4. Confirm with current `expectedRevision`.
5. Refresh detail after success.
6. Implement no-candidate, offline, conflict and Fleet-follow-up states.
7. Do not accept or start the mission.

Acceptance: arbitrary/stale candidate selection is rejected safely; success
shows the server-confirmed crew and READY state.

### GM-08 Mission actions and issues

1. Add explicit Accept confirmation.
2. Add explicit Start confirmation; never mutate from render/mount/focus.
3. Build active mission summary without telemetry or fake maps.
4. Build controlled issue category/note form.
5. Build completion with positive decimal acreage validation.
6. Show queued/applied/already-applied/conflict/rejected/retry outcomes.
7. Never show final success solely because the local queue accepted a write.

Acceptance: allowed-actions and revision guards control every mutation; opening
and backing out of screens causes zero server/local mutation.

### GM-09 Sync status, Profile and security

1. Implement ordered pending/retrying/conflict/rejected action views.
2. Implement safe retry/refresh without server overwrite.
3. Implement profile, language, centre and safe session information.
4. Implement logout, logout-all and installation revocation journeys.
5. Implement blocking upgrade state without inventing a release URL.

Acceptance: a field user can understand whether work is local, pending,
applied or requires Fleet/support without seeing technical/sensitive data.

### GM-10 Automated tests and CI

Add tests for:

- login response nesting and malformed response rejection;
- token/session clearing on 401/revocation;
- capability navigation isolation;
- user-scoped cache isolation;
- queue persistence, ordering, retry UUID reuse and process restart;
- every receipt outcome;
- cursor/full-resync/tombstone behaviour;
- Copilot success and revision conflict;
- no mutation on screen mount;
- Accept/Start/Complete state sequence;
- positive acreage and issue validation;
- removal of deferred Pilot Fleet/Map functionality.

Add mobile CI gates for clean install, Expo Doctor, TypeScript, unit tests,
Android bundle/export, dependency audit and secret scanning. Do not weaken root
web/backend/container gates.

Acceptance: CI fails when the login token path, route contract or
auto-start-on-mount defect is reintroduced.

### GM-11 Physical-device acceptance

Use synthetic staging accounts/data only. Capture privacy-safe evidence for:

1. fresh install and Pilot login;
2. cold session restoration and logout;
3. mandatory upgrade/revocation;
4. Today/Upcoming and detail while online/offline;
5. Copilot selection success/no-candidate/conflict;
6. Accept → Start → Complete;
7. issue report;
8. offline ordered queue through process death;
9. response-loss retry without duplicate mutation;
10. reassignment/removal tombstone;
11. second-user cache isolation;
12. logs containing no token/password/phone/coordinate payload.

Expo Go is acceptable for early visual checks only. Native development-build
evidence is required for secure/encrypted storage and final device behaviour.

### GM-12 Release readiness, not release

1. Keep permanent package ID, Play ownership, signing and distribution channel
   as explicit maintainer/client decisions.
2. Do not publish an APK/AAB from anonymous package identity.
3. Produce a release-readiness report listing remaining placeholders.
4. Do not deploy or upload to Play without explicit approval.

## 8. Definition of done for every screen

A screen is complete only if:

- its data maps to named contract fields;
- every action maps to a named route and capability/allowed action;
- no value is invented when unavailable;
- loading, empty, offline, unauthorized, validation, conflict, retry and
  success states are implemented as applicable;
- screen readers, large text and touch targets are considered;
- navigation preserves only identifiers and trusted local feature state;
- mount/render/back navigation performs no unintended mutation;
- tests cover happy, rejected, conflict and offline paths;
- TypeScript, Expo Doctor and Android bundle pass.

## 9. Required agent report after each package

Return:

1. package number completed;
2. exact files changed;
3. API routes/contract fields consumed;
4. tests added and exact results;
5. Expo Doctor, TypeScript and Android bundle results;
6. physical-device evidence when required;
7. security/privacy checks performed;
8. remaining mocks/placeholders/blocked decisions;
9. confirmation that no commit, push, deployment or data mutation occurred
   unless explicitly authorized.

Do not claim “fully working” merely because the app launches.

## 10. Copy/paste execution instruction for Gemini/Antigravity

Treat this document as binding. Begin with GM-00 only. Before changing code,
return the baseline, a corrected Stitch input inventory and any conflict
between the design and the API contract. Then implement one numbered package at
a time in dependency order. Never paste Stitch HTML, invent missing backend
features or weaken security to make a screen render. If a design control has no
current route/capability, mark it deferred and stop that control’s
implementation. Preserve unrelated worktree changes. Do not commit, push,
merge, deploy or touch any database without explicit maintainer permission.

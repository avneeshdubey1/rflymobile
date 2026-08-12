# Pilot Mobile Backend Baseline

**Status:** verified implementation baseline for mobile Phase M00
**Recorded:** August 12, 2026
**Source branch/revision:** `dev` at `4db3771` before this batch's local edits
**Scope:** M00-01 through M00-05

This file records behaviour that already exists in the Node.js server. Mobile
work must preserve these rules and must not infer contracts from frontend
labels. It is a baseline, not a promise that the current browser-shaped API is
the final mobile API.

## 1. Authentication and session routes

| Route | Authorization and input | Current implementation | Response/effect |
|---|---|---|---|
| `POST /api/auth/login` | Public; employee email/employeeId and password; Pilot is an allowed employee role | `routes/authRoutes.js` -> `controllers/authController.login` -> user/password/session services and repositories | `{ success, user }`; establishes opaque session and CSRF cookies; records `SESSION_CREATED` |
| `GET /api/auth/me` | Authenticated session | `authController.me` | `{ success, user }` using the public user projection |
| `POST /api/auth/logout` | Authenticated, CSRF-protected mutation | `authController.logout` -> auth-session repository | Revokes the current session, clears cookies, disconnects its sockets and records an audit event |
| `POST /api/auth/logout-all` | Authenticated, CSRF-protected mutation | `authController.logoutAll` -> session service | Revokes all sessions for the user, clears cookies, disconnects user sockets and records an audit event |

Current production authentication is browser-oriented: the session token is an
HttpOnly cookie and mutations require the matching CSRF cookie/header. Bearer
tokens are accepted only by the test-only authentication path. A native mobile
opaque-token flow, installation identity and secure refresh/bootstrap contract
do **not** exist yet.

## 2. Pilot assignment and location routes

All mutation routes below pass through `middleware/auth.js`, role authorization,
`controllers/assignmentController.js`, `services/missionStateService.js`, and
`src/repositories/assignmentOperationRepository.js` unless stated otherwise.

| Route | Role/input | Current response and transition |
|---|---|---|
| `GET /api/assignments/pilot` | Pilot uses authenticated user ID; Admin/Fleet Manager must provide `pilotId` | `{ success, missions }`; returns assignments where the user is either `pilotId` or `copilotId`, ordered by date and daily sequence |
| `POST /api/assignments/:id/accept` | Assigned Pilot or Copilot; assignment must be `SCHEDULED` | Sets `acceptedAt`; Lead becomes `PILOT_ACCEPTED`; closes the pending escalation |
| `POST /api/assignments/:id/start` | Assigned Pilot or Copilot; Lead must be `PILOT_ACCEPTED` | Sets `startedAt`; Lead becomes `IN_PROGRESS`; rejects resource conflicts and an incomplete earlier job in the same crew/day sequence |
| `POST /api/assignments/:id/complete` | Assigned Pilot or Copilot; positive `actualAcreage` or compatibility `enteredAcres`; Lead must be `IN_PROGRESS` | Sets completion and acreage; Lead becomes `COMPLETED`; recalculates only the assignment's drone and LMV availability |
| `POST /api/assignments/:id/decommission` | Assigned Pilot or Copilot; non-empty reason; accepted or in progress | Flags Lead, records reason, moves the assigned drone to maintenance, releases its LMV when no other active job uses it, closes escalation and alerts Fleet |
| `POST /api/assignments/:id/location` | Assigned Pilot or Copilot; valid latitude/longitude; accepted or in progress | Stores only the latest coordinate and timestamp; emits `location:update`; audit state records that a location was captured but omits exact coordinates |
| `GET /api/assignments/:id/location` | Admin or Fleet Manager | Returns latest assignment location and timestamp |

Fleet/Admin scheduling routes already exist at `POST /manual`,
`PUT /:id/reschedule`, `PATCH /:id/sequence`, `POST /auto-assign`, and Lead-scoped
`POST /api/leads/:leadId/auto-assign`. They remain authoritative for creating,
reassigning and ordering Pilot work; the Pilot mobile application must not gain
those permissions.

### Current assignment response shape

The repository returns Assignment plus Lead, primary Pilot, Copilot, Drone,
compatibility CopilotDrone, LMV and reschedule history. That response currently
contains more operational and personal fields than a mobile Pilot necessarily
needs. A later minimum-exposure task must create a deliberate mobile projection
instead of returning this object unchanged.

## 3. Pilot chat contract

REST routes under `/api/chat` require an operational employee role:

- `GET /participants`, `GET /sessions`, `POST /sessions`;
- `GET /sessions/:id/messages`, `POST /sessions/:id/read`;
- `POST /sessions/:id/close`.

The hierarchy in `services/chatLifecycleService.js` is
Admin > Fleet Manager > Sales > Pilot. Only a higher role may open a direct
session downward; a subordinate cannot send the first message; only Admin may
close a session. Live messages use authenticated Socket.IO events
`chat:join`, `chat:send`, `chat:read`, and `chat:close`. This socket handshake is
also tied to the current browser session and needs an explicit mobile session
transport later.

## 4. Database dependencies

| Model | Pilot workflow dependency |
|---|---|
| `User` | Role, active/archive state, authVersion, phone/email, preferred language, home centre and licence expiry; `assignments` and `copilotAssignments` preserve both crew roles |
| `AuthSession` | Hashed opaque token, hashed CSRF token, authVersion, idle/absolute expiry and revocation; no installation/device relation yet |
| `Assignment` | Unique Lead; required primary Pilot and Drone; compatibility-nullable Copilot and LMV for legacy rows; service windows, `dailySequence`, legacy quarantine marker, timestamps, acreage, discrepancy/decommission state and latest location |
| `Lead` | Owns lifecycle status. Relevant sequence is `SCHEDULED -> PILOT_ACCEPTED -> IN_PROGRESS -> COMPLETED`; decommission moves it to `FLAGGED` |
| `Drone` / `LMV` | Assignment assets with home centre, operational/availability state and history; ordinary new scheduling requires one of each |
| `Notification` / `NotificationEscalation` | Assignment notice and durable response/escalation clock; acceptance/decommission closes the active escalation |
| `ChatSession` / `ChatMessage` | Hierarchical staff conversation and read/close state |
| `AuditLog` | Append-only action trail with `actorId`; location audit deliberately excludes coordinates |
| `LeadHistory` / `DroneHistory` / `LMVHistory` | Versioned state histories with `actorUserId` supplied by transactional history context |
| `ScheduleChangeLog` | Fleet/Admin reschedule history; it is view data for Pilot, not Pilot-editable data |

Important schema constraints and compatibility facts:

- one Lead has at most one Assignment;
- Pilot, Copilot, Drone and LMV all have scheduling indexes by date;
- current new writes require two distinct active Pilot users, one Drone and one
  LMV at the Lead's operating centre;
- legacy assignments may have null Copilot/LMV only when quarantined by
  `legacyCrewIncomplete`; they are not valid templates for new mobile writes;
- `copilotDroneId` is a deprecated compatibility alias and does not represent a
  second operational Drone.

## 5. Frozen operational semantics

1. Primary Pilot and Copilot share the same assignment queue.
2. Either assigned crew member may accept, start, complete, decommission or
   send an allowed live-location ping.
3. An unrelated Pilot is rejected.
4. The actual acting user's ID is recorded in AuditLog and model history.
5. A later daily-sequence job cannot start while an earlier active job for the
   same full crew/Drone/LMV unit remains incomplete.
6. Completing one job leaves its Drone and LMV `ASSIGNED` when another active
   job still uses them.
7. Completing the final active job releases those assets immediately; billing
   does not participate in resource release.
8. Release recalculation is scoped to the assignment's own Drone and LMV and
   must not change unrelated assets.
9. Decommission is the relevant exceptional terminal path: it moves the
   assignment's Drone to maintenance and releases only the corresponding LMV
   when safe.

## 6. Existing browser offline behaviour is reference only

`frontend/src/services/offlineActionQueue.js` stores a small, user-bound queue
in IndexedDB with a 24-hour TTL, a 100-item cap and location coalescing. It sends
cookie/CSRF browser requests. It is useful behavioural evidence, but it is not
safe native storage, durable mobile synchronization, mutation idempotency or a
mobile conflict protocol. The Android client must not wrap or copy it as its
security design.

## 7. Evidence and remaining mobile gaps

Focused evidence:

- `phase20-two-person-daily-crew.test.js`: shared visibility/actions, unrelated
  Pilot rejection, ordering and final resource release;
- `phase25-assignment-transactionality.test.js`: atomic scheduling, conflict
  locking, ordering, actor history/audit and scoped release/decommission;
- `phase4-state-machine.test.js`: lifecycle and role enforcement;
- `phase9-live-location.test.js`: location authorization, socket update and
  coordinate-free audit logging;
- `phase6-chat.test.js`: hierarchy, first-message and Admin-only close rules.

Server gaps to address in later microtasks include: a versioned mobile API and
minimum-data projection; native opaque-token/session transport; installation
identity and revocation; stable error codes; assignment revisions and mutation
receipts/idempotency; cursor-based change synchronization; explicit mobile
bootstrap; and an approved mobile location/privacy policy.

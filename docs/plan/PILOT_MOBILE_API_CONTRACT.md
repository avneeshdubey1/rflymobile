# Pilot Mobile API Contract Decisions

**Status:** R00-revised v1 contract; authentication/bootstrap and foreground mission-location foundation implemented locally
**Recorded:** August 12, 2026
**Scope:** M00-06 through M00-10

This document defines the privacy boundary and error vocabulary for
`/api/mobile/v1`. R00 approved the two-application boundary and
Primary-Pilot Copilot-selection workflow. The local backend now mounts
installation-bound authentication and capability bootstrap for Pilot Field
and Operations. Production remains explicitly disabled until staging and
operator approval. Foreground-only mission location is implemented locally but
remains production-gated; background location, route history, and external
providers remain disabled.

## 1. Minimum Pilot data exposure

The mobile API will use explicit DTO allow-lists. It must never serialize the
current broad Prisma `include` graph directly.

| Data | Operational purpose | Visibility | Device/server retention target |
|---|---|---|---|
| Pilot ID, display name, employee code, preferred language | Identify the signed-in worker and localize the app | Own authenticated profile only | Device: current session plus approved offline grace; server: authoritative User record |
| Home-centre ID, code and display name | Explain assignment ownership and scheduling context | Own profile and assigned jobs | Device: while profile is cached; server: authoritative master/history policy |
| Assignment ID, Lead ID, revision, lifecycle status, sequence and service window | Order work and synchronize mutations | Primary Pilot and Copilot while assigned | Device: bounded working set; purge 24 hours after a terminal state in development; production duration requires approval |
| Farmer display name and operational phone | Find and contact the customer for the assigned service | Assigned crew only, within the bounded assignment window | Device: encrypted cache; purge 24 hours after terminal state in development; production contact window requires Operations/Privacy approval |
| Farm display address, full Plus Code and exact coordinates | Navigate to the assigned farm | Assigned crew only; reveal only for an assigned, non-terminal job | Device: encrypted assignment cache; purge with assignment; server: operational record under approved Customer/FarmLocation retention |
| Crop and expected/actual acreage | Prepare and close operational work | Assigned crew only | Device: assignment retention; server: operational record/history |
| Other crew member ID and display name | Coordinate the two-person unit | Assigned crew only | Device: assignment retention; no email, phone, address, proof or licence identifier |
| Drone code/serial and LMV registration/label | Identify reserved assets | Assigned crew only for that assignment | Device: assignment retention; server: fleet master/history |
| Bounded operational notes | Communicate safety and service instructions | Assigned crew only | Device: assignment retention; exclude CRM remarks, payment notes and unrestricted free-form histories |
| B2C cash handover status and exact reported amount | Let assigned crew report physical cash after mission completion without approving price or invoice | Assigned crew for its own completed B2C assignment; Admin read-only reconciliation queue | Online confirmation only; immutable server record in integer minor units; no offline replay, QR payload, merchant secret or invoice state in the Pilot cache |
| Server-calculated allowed actions | Render controls without copying policy into the app | Assigned crew only | Recomputed on every server response; never authoritative on the device |
| Latest own synchronization state and safe receipts | Explain pending/applied/conflicted work | Owning user and installation only | Development receipt/cache retention: 24 hours after terminal assignment; production duration requires approval |

The Pilot DTO must exclude password/authentication internals, personal identity
documents, home addresses, licence identifiers, unrelated staff/customer data,
CRM history, billing/payment data other than the narrowly allow-listed B2C cash
handover status for the Pilot's own completed assignment, AuditLog, provider payloads, internal
configuration, database fields, and unrestricted nested relations.

The development bootstrap window is **today plus 14 upcoming days and one prior
day**, capped by server pagination/response limits. This is a safe test value,
not an approved production operating policy.

## 2. Mobile session policy placeholders

The target is an opaque, hashed, revocable bearer session separate from browser
cookie sessions. The following values are development defaults only:

| Control | Development default | Production gate |
|---|---:|---|
| Idle lifetime | 30 minutes while online | Security/Operations approval |
| Absolute lifetime | 8 hours | Security/Operations approval and field trial |
| Offline read/action grace | Earlier of absolute expiry or 8 hours since last successful authentication | Field workflow and lost-device risk approval |
| Maximum active installations per Pilot | 2 | Device-ownership and replacement policy |
| Local terminal-assignment retention | 24 hours | Operations/Privacy approval |
| Revocation owners | Pilot: own session/logout-all; Admin: lost installation; password/authVersion change: system | Admin support procedure and audit review |

Offline grace never extends the server session. The app may retain encrypted
pending actions during the approved grace, but it may synchronize only after a
valid server session is restored. Expired credentials cannot be used to mint a
new session offline. Installation records must not contain IMEI, hardware
serial, advertising ID or an invented device fingerprint.

Production mobile login remains blocked until these values are configurable,
approved, tested for revocation, and supported by an operator procedure.

## 3. Location policy placeholders

- Background location is disabled. The Android manifest must not request a
  background-location permission.
- Foreground capture is permitted only for an assignment visible to the
  authenticated Primary Pilot/Copilot.
- An accepted or in-progress assignment may submit periodic foreground
  location while the app is open and the signed-in Pilot is part of its crew.
- Development cadence is no more frequent than one accepted sample every 60
  seconds. Development accuracy target is 100 metres or better.
- A sample more than five minutes old or more than two minutes in the future is
  rejected. These thresholds remain configurable production placeholders.
- Capture stops on completion, cancellation, reassignment, logout, session or
  installation revocation, permission denial, or app backgrounding.
- Admin and Fleet Manager are the only staff viewers, and only for an active
  operational assignment. Pilot sees only their own submitted state.
- The current target stores only the latest sample; route history remains
  disabled. Exact coordinates stay out of AuditLog, general logs, diagnostics,
  notifications and analytics.
- Development cleanup clears the terminal assignment's latest exact location
  within 24 hours. Production retention, deletion owner, notice/consent wording
  and privacy contact require written approval before field activation.

Location denial must not block downloaded job details, non-location mission
actions, chat or support. The app must explain that navigation/live visibility
is unavailable rather than pretending a coordinate was submitted.

## 3.1 Pilot operational availability

`pilotAvailabilityState` is separate from the security-sensitive account
`active` flag. A Pilot may switch between `AVAILABLE` and `OFFLINE` through
`PUT /api/mobile/v1/pilot/availability`. Going offline is rejected while that
Pilot is Primary Pilot or Copilot on a `SCHEDULED`, `PILOT_ACCEPTED`, or
`IN_PROGRESS` assignment. Offline Pilots are excluded by auto-assignment,
manual scheduling, Copilot selection, and crew formation on the server.

The switch does not disable the account or revoke the mobile session. The
server remains authoritative and records a coordinate-free availability audit
event. The mobile client stops foreground location capture whenever the Pilot
is offline.

## 3.2 Foreground mission-location endpoint

`POST /api/mobile/v1/pilot/assignments/:assignmentId/location` accepts only
`latitude`, `longitude`, `accuracyMetres`, and `capturedAt`. It requires an
active, nonarchived, available Primary Pilot/Copilot and a
`PILOT_ACCEPTED`/`IN_PROGRESS` mission. Samples outside coordinate, accuracy,
age, future-skew, or cadence bounds are rejected. The response acknowledges
only the assignment and accepted timestamp; it does not echo coordinates.

Admin and Fleet continue to view the latest location through the existing
authorized assignment-location flow. A terminal mission clears the stored
latest coordinate immediately. No route history or background collection is
implemented.

## 4. Stable mobile error envelope

Every mobile error uses this shape:

```json
{
  "success": false,
  "error": {
    "code": "ASSIGNMENT_REVISION_CONFLICT",
    "message": "This assignment changed. Refresh it before continuing.",
    "retryable": false,
    "requestId": "safe-correlation-id",
    "details": {
      "currentRevision": 4
    }
  }
}
```

`message` is safe for a user but is not a stable programmatic key. `details` is
optional and allow-listed per code. It must never expose stack traces, SQL,
tokens, credentials, raw provider responses, exact coordinates, unrestricted
payloads, or another user's/resource's existence.

| Code | HTTP | Retry | Meaning/client action |
|---|---:|---|---|
| `VALIDATION_FAILED` | 400 | No | Correct local input; field names may be returned from an allow-list |
| `AUTHENTICATION_REQUIRED` | 401 | No | No valid bearer session; sign in |
| `INVALID_CREDENTIALS` | 401 | No | Generic login failure; do not reveal account existence |
| `SESSION_EXPIRED` | 401 | No | Reauthenticate; retain eligible encrypted pending work |
| `SESSION_REVOKED` | 401 | No | Reauthenticate/re-enrol as directed |
| `ROLE_NOT_ALLOWED` | 403 | No | Account is not an active Pilot role |
| `RESOURCE_NOT_FOUND` | 404 | No | Missing or inaccessible resource; preserve ID-substitution opacity |
| `ASSIGNMENT_REVISION_CONFLICT` | 409 | No | Refresh authoritative assignment and reconcile pending action |
| `ASSIGNMENT_REASSIGNED` | 409 | No | Remove from active work and show safe conflict guidance |
| `ASSIGNMENT_CANCELLED` | 409 | No | Stop work/location and refresh |
| `MISSION_STATE_CONFLICT` | 409 | No | Action is invalid for current lifecycle state |
| `SEQUENCE_BLOCKED` | 409 | No | Complete the earlier server-identified sequence first |
| `RESOURCE_UNAVAILABLE` | 409 | No | Fleet must resolve crew/Drone/LMV state |
| `ISSUE_REJECTED` | 422 | No | Correct controlled issue input or contact Fleet |
| `LOCATION_NOT_ALLOWED` | 409 | No | Stop capture; assignment/session is no longer eligible |
| `LOCATION_INVALID` | 422 | No | Invalid bounds, accuracy or capture time |
| `ACTIVE_ASSIGNMENT_BLOCKS_OFFLINE` | 409 | No | Finish or release active work before going offline |
| `RATE_LIMITED` | 429 | Yes | Retry only after server-provided seconds |
| `CLIENT_UPGRADE_REQUIRED` | 426 | No | Install a supported app version before continuing |
| `RETRY_LATER` | 503 | Yes | Preserve ordered queue and use bounded backoff |
| `INTERNAL_ERROR` | 500 | Yes | Preserve work and use request ID for support; no internals returned |

Successful idempotent replay is not an error. It returns a mutation receipt
with outcome `ALREADY_APPLIED`. Batch outcomes are `APPLIED`,
`ALREADY_APPLIED`, `CONFLICT`, `REJECTED`, or `RETRY_LATER`.

## 5. Contract fixtures

Machine-readable schemas and sanitized fixtures live under
`backend/contracts/mobile/v1/`. Stored fixtures use explicit runtime
placeholders for password, bearer token and exact coordinates; the contract
test substitutes generated synthetic values only in memory. Fixtures therefore
contain no credential, token, customer value or exact location.

The fixtures define login, bootstrap, assignment, mutation receipt, incremental
change page and conflict shapes. They are design evidence only until later
tasks mount `/api/mobile/v1` and make the running server conform to them.

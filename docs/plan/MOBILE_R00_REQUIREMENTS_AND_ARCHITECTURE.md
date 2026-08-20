# Mobile R00 Requirements and Architecture Decision

**Status:** approved backend implementation baseline
**Recorded:** August 13, 2026
**Scope:** R00-01 through R00-09
**Approval basis:** maintainer approved the autonomous backend run and the
conservative defaults recorded below. Unlisted future client requests remain
out of scope until separately captured.

## 1. Requirement register

| ID | Requirement | Actors | Release | Acceptance |
|---|---|---|---|---|
| MOB-001 | Deliver two separately packaged employee applications sharing the existing Node.js API | Pilot, Copilot, Admin, Fleet, Sales | Foundation | Pilot Field and Operations have separate navigation, capability allow-lists and release identities; neither connects to PostgreSQL |
| MOB-002 | Preserve the web application as the reference operational client | All employee roles | Foundation | Mobile work does not remove or weaken browser authentication, authorization or workflow tests |
| MOB-003 | Let the assigned Primary Pilot select an eligible Copilot | Primary Pilot, Copilot, Fleet, Admin | Pilot v1 | Selection is server-authorized, same-centre, revision-checked, conflict-checked and audited |
| MOB-004 | Keep provisional work non-executable until crew formation is complete | Pilot, Copilot, Fleet | Pilot v1 | A pending-Copilot assignment cannot be accepted or started and appears in the Fleet exception queue when unresolved |
| MOB-005 | Expose an ordered, bounded Pilot work list and assignment details | Pilot, Copilot | Pilot v1 | DTOs expose only assigned operational data, daily sequence, service window and server-calculated allowed actions |
| MOB-006 | Support mission accept, start, issue and completion actions | Pilot, Copilot | Pilot v1 | Existing state, sequence and resource rules remain server-owned; completion requires actual acreage |
| MOB-007 | Support intermittent connectivity without client-side authority | Pilot, Copilot | Pilot v1 | Mutations use installation-scoped action IDs, expected revision and deterministic receipts; stale actions conflict safely |
| MOB-008 | Provide foreground-only bounded location submission | Pilot, Copilot, Fleet, Admin | Pilot v1 gated | Background permission and route history remain absent; exact coordinates stay out of audit/general logs |
| MOB-009 | Provide role-aware Operations capabilities progressively | Admin, Fleet, Sales | Operations slices | Every endpoint and menu capability is server-authorized; no role inherits another role merely by using the app |
| MOB-010 | Use the Stitch export only as visual evidence | Design, engineering | Design | Production code is repository-native; telemetry, ratings and unsafe overwrite controls from the prototype are excluded |

## 2. Approved product defaults

1. Pilot Field is limited to active `PILOT` accounts. Primary and Copilot are
   assignment roles, not separate account roles.
2. Operations initially supports `ADMIN`, `FLEET_MANAGER` and `SALES` through
   explicit capabilities. Farmer and Business accounts remain outside both
   employee apps.
3. Fleet/manual or automatic scheduling reserves Primary Pilot, Drone and LMV
   and creates a provisional assignment awaiting Copilot selection.
4. Only the assigned Primary Pilot may select the Copilot.
5. A candidate must be an active, non-archived Pilot in the same operating
   centre, with valid required compliance and no overlapping assignment.
6. Copilot selection does not start or accept the mission. It only changes crew
   formation from `PENDING_COPILOT_SELECTION` to `READY`.
7. The selected Copilot does not perform a separate nomination-acceptance step
   in v1. Either crew member may subsequently accept the ready assignment under
   the existing mission rule.
8. Fleet or Admin may replace/override the Copilot before mission start through
   a reason-required audited operation. No ordinary replacement is allowed
   after start.
9. The selection deadline is the assignment service-window start. Missing or
   conflicting selection creates a visible Fleet exception; it never silently
   cancels or auto-selects another person.
10. Drone and LMV stay reserved while Copilot selection is pending. Existing
    cancellation/reassignment procedures release them.
11. Background tracking, raw telemetry, aircraft battery/signal/altitude/speed,
    Pilot ratings, callsigns, equipment preferences and flight-hour rankings
    are not part of v1.

## 3. Role-capability matrix

`R` read, `A` act, `O` override with reason, `-` intentionally unavailable.

| Capability | Admin | Fleet | Sales | Primary Pilot | Copilot | Farmer | Business |
|---|---:|---:|---:|---:|---:|---:|---:|
| View own assigned work | - | - | - | R | R | - | - |
| Select eligible Copilot | - | - | - | A | - | - | - |
| Resolve/override Copilot exception | O | O | - | - | - | - | - |
| Accept/start/complete assigned mission | - | - | - | A | A | - | - |
| Report assigned-resource issue | - | - | - | A | A | - | - |
| View active mission location | R | R | - | own submission only | own submission only | - | - |
| Schedule/resequence/reassign work | O | A | - | - | - | - | - |
| Customer search/register/lead intake | R/A | R | A | - | - | separate portal | separate portal |
| User/master administration | A | bounded Fleet masters | - | - | - | - | - |

## 4. Web/mobile parity matrix

| Capability | Server | Web | Pilot Field | Operations |
|---|---|---|---|---|
| Employee login/session revocation | Shared implementation | Required | Required | Required |
| Pilot work list/detail | Shared DTO/service | Required reference | Required | Fleet/Admin read view later |
| Copilot formation | Shared transactional service | Required Primary/Fleet reference | Required Primary flow | Required Fleet/Admin exception flow |
| Mission transitions | Existing shared state service, revised DTO/idempotency adapter | Required regression | Required | Read/exception only |
| Offline mutation reconciliation | Mobile API only, server authoritative | Not applicable beyond current browser queue | Required | Deferred until an approved Operations slice needs it |
| Foreground location | Shared assignment/location policy | Existing Fleet view | Required when activated | Fleet/Admin view required when activated |
| Sales customer/lead workflow | Existing customer/lead services | Required | Not applicable | Required in Sales slice |
| Admin/Fleet masters | Existing role services | Required | Not applicable | Progressive, explicitly allow-listed |

## 5. Copilot-formation state machine

Crew formation is separate from Lead mission lifecycle.

| Current crew state | Actor/action | Guard | Next state/effect |
|---|---|---|---|
| `PENDING_COPILOT_SELECTION` | Primary requests candidates | Assignment is assigned to actor, nonterminal and before service-window start | No mutation; minimal eligible list returned |
| `PENDING_COPILOT_SELECTION` | Primary selects candidate | Expected revision matches; candidate revalidated in serialized transaction | `READY`; `copilotId` recorded; revision incremented; audit/history/notification written |
| `PENDING_COPILOT_SELECTION` | Deadline passes/no candidate/conflict | Durable worker or failed selection | State remains pending; visible Fleet exception created/updated |
| `PENDING_COPILOT_SELECTION` or `READY` | Fleet/Admin override with reason | Mission not started; full eligibility/conflict recheck | Candidate replaced or selected; revision incremented; audit/history written |
| `READY` | Assigned crew accepts | Existing lifecycle guards | Lead `SCHEDULED -> PILOT_ACCEPTED` |
| Any nonterminal state | Cancellation/reassignment | Existing authorized path | Reservations recalculated; pending exception closed |

Every mutation accepts an installation-scoped `actionId` and expected assignment
revision. A repeated identical action returns `ALREADY_APPLIED`; a stale or
different action returns a stable conflict. The client never writes `copilotId`
directly.

## 6. Current implementation gap

- `Assignment` has no revision or crew-formation state.
- Normal `manualAssign` and `autoAssign` require both Pilot IDs before creation.
- `transitionMission` has no crew-readiness guard independent of Lead status.
- `AuthSession` is browser-cookie/CSRF oriented and has no app installation.
- Assignment responses expose broad nested records rather than a mobile DTO.
- There is no `/api/mobile/v1`, capability bootstrap, cursor change feed,
  idempotent mutation receipt or installation revocation path.
- The current browser IndexedDB queue is not a native synchronization contract.
- Current location storage is latest-sample-only, which is reusable, but its
  cadence/retention activation remains a production placeholder.

The migration must be additive. Existing complete assignments backfill `READY`;
legacy quarantined incomplete assignments remain non-executable and must not be
silently converted to the new provisional workflow.

## 7. Two-application boundary

Both apps share API schemas, safe error vocabulary, localization keys, secure
storage/session infrastructure and design tokens where practical. They do not
share navigation or role authority.

- **Pilot Field:** Pilot login, bounded work, Copilot selection, mission actions,
  issue reporting, foreground location, offline queue, profile/security.
- **RFLY Operations:** role-aware home; Sales intake first; Fleet schedule and
  crew exceptions second; bounded Admin controls later.

Permanent Android package IDs, Play Console ownership and signing remain
external placeholders. No package is released until company ownership is
approved.

Pilot operational availability is an explicit server-owned state, distinct
from account activation. Available Pilots may be scheduled; Offline Pilots are
excluded from every crew/assignment path. A Pilot with scheduled, accepted, or
in-progress work cannot switch offline until Fleet/Admin releases or completes
that work. Foreground location operates only for an available assigned crew
member on an accepted/in-progress mission and stops when the app backgrounds.

## 8. Stitch review decision

The exported navy/orange visual system, typography, status hierarchy and large
touch targets are accepted as exploratory direction. Production implementation
must correct these prototype defects:

- separate Pilot and Operations branding/navigation;
- preserve assignment acceptance before start;
- remove invented telemetry, ratings, callsigns and equipment rankings;
- replace `Keep Local (Push)`/`Overwrite from Server` with server-authoritative
  refresh, retry or staff-review outcomes;
- add LMV, crew, service-window and sequence details;
- add login, loading, unauthorized, validation, issue and safe offline states;
- regenerate malformed exported images; and
- implement components manually rather than importing generated HTML.

## 9. Contract classification

- Reuse: stable error envelope, timestamps/UUIDs/decimals, assignment minimum
  customer/farm/resource fields and mutation outcome vocabulary.
- Revise: login/session becomes shared employee mobile session with app identity;
  assignment adds crew formation and revision; bootstrap adds capabilities and
  supported-version policy.
- Add: installation registration/revocation, eligible Copilot list, selection
  receipt, issue DTO, cursor synchronization request/page and Operations
  capability slices.
- Retire: any client-authoritative overwrite, live telemetry, ranking or broad
  nested Prisma representation.

## 10. Replacement dependency graph

```text
D00 additive crew/revision/idempotency schema and repository primitives
  -> W00 web reference Copilot formation and Fleet exception workflow
  -> S00 shared two-app session/install/capability foundation
       -> P00 Pilot work DTOs and crew formation API
       -> P10 mission mutation, issue, sync and location API
       -> O00 Operations Sales slice
       -> O10 Operations Fleet exception slice
  -> Q00 cross-client regression, migration and container evidence
  -> A00 Pilot Field implementation/release
  -> B00 Operations implementation/release
```

Schema migration, authentication, idempotency, synchronization and location
activation remain separate reviewable commits. No production data operation or
deployment is part of this graph.

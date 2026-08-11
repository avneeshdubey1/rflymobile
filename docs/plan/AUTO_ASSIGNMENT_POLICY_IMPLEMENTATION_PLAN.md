# Auto-Assignment Policy Implementation Plan

**Status:** approved implementation plan; application code is not yet changed by this document
**Prepared:** August 11, 2026
**Target flow:** `dev` -> reviewed PR -> `staging` -> accepted promotion -> `main`
**Primary implementer profile:** small coding agent working one bounded microtask at a time

## Implementation progress

**Local state observed August 11, 2026:** `AA-00` through `AA-08` are
implemented in the working tree and are not yet committed, pushed, deployed, or
accepted in staging.

- Typed singleton policy schema and additive migration are present.
- Existing assignment windows are compatibility-backfilled without making the
  columns mandatory, preserving previous-image rollback compatibility.
- The guarded migration harness passes clean 23-migration replay, second-deploy
  no-op, populated 22-to-23 migration, exact core row-count preservation, 49
  validated checks, singleton creation, and window backfill.
- Policy repository/service validation, optimistic revision protection,
  Serializable update transaction, and coordinate-free audit are implemented.
- Authenticated policy HTTP endpoints enforce Admin/Fleet/Sales representations,
  Admin-only revision-protected updates, and Admin/Fleet-only explicit retry.
- `OPERATING_TIME_ZONE` is validated as IANA configuration; local operating-day
  windows are deterministic across host timezones and DST-capable zones.
- Every existing automatic trigger now reaches the same policy-gated
  orchestration, with disabled/unavailable/weather/manual-capacity outcomes,
  stable reason codes, visible Fleet fallback, and idempotent existing
  assignments.
- Complete-unit reuse and new-resource selection use deterministic fairness
  tuples. New assignments persist policy-derived start/end windows and obey
  turnaround, job-count, acreage, horizon, and working-day caps.
- Service windows are authoritative for manual, automatic, and reschedule
  writes. Overlap checks cover either Pilot role, drone, and LMV; resource
  writes use Serializable transactions with bounded retry and a safe exhausted
  outcome. A competing-window test proves only one allocation commits while
  the existing sequence-based mission-start guard remains intact.
- Complete backend regression passes 133/133.
- Existing Phase 3/5/20/24/25 disposable-test teardown was repaired to use the
  established `_test`-only history-mutation guard; append-only deployed-database
  protection was not weakened.

`AA-09` and the deterministic parts of `AA-10` now have local real-browser
evidence: role-specific policy views, bounded month/week/day queries, persisted
windows and four-resource edits, sequence changes, overlap rollback, keyboard
manual scheduling, and terminal-status filtering pass 6/6 with health. Pointer
drag/resize remains unaccepted because real-browser attempts were not stable
with the resource-column calendar; do not replace this gap with a flaky test or
claim it from lint/build. The remaining local gates otherwise pass: backend
133/133, frontend lint/build, 23-migration clean/populated replay, isolated
Compose migrate/health, and zero known production dependency vulnerabilities.
The local candidate has passed the recorded gates, but branch promotion and
staging acceptance are pending; production is unchanged. Pointer drag/resize
remains an explicit follow-up and the editor is the accepted rescheduling path
for this staging candidate.

## 1. Objective

Keep auto-assignment as a supported operational feature and turn the current
unconditional, partly hardcoded behaviour into a typed, company-wide,
Admin-controlled policy.

The completed feature must:

1. preserve strict service-area and operating-centre enforcement;
2. reserve one primary Pilot, one distinct Copilot, one drone, and one LMV;
3. schedule multiple ordered jobs for the same complete unit in one day without
   giving every job the same visual start time;
4. make every automatic decision deterministic, auditable, concurrency-safe,
   explainable to Fleet, and reversible through normal manual scheduling;
5. route every disabled, uncertain, or no-capacity result to a visible Fleet
   queue instead of dropping a Lead;
6. make the Fleet calendar display the resulting schedule accurately; and
7. preserve current production data through an additive migration and staged
   rollout.

This document is the implementation authority for this package. Do not infer
requirements from old emergency handoffs, archived documents, seed values, or
the existing personal Settings checkbox.

## 2. Current verified baseline

### 2.1 What is already real

- A `PROCESSED` Lead can be automatically assigned by
  `backend/services/autoAssignmentService.js`.
- The repository transaction validates a complete two-person crew, drone, LMV,
  operating centre, resource state, licence/airworthiness state, and daily
  conflicts.
- A successful automatic assignment creates an `Assignment`, changes the Lead
  to `SCHEDULED`, reserves the resources, creates audit/notification records,
  and starts the pilot-acceptance escalation.
- Failure to find a complete eligible unit moves the Lead to
  `NEEDS_MANUAL_SCHEDULING`.
- A Fleet Manager or Admin can manually assign, reschedule, and resequence jobs.
- Mission start is serialized by `dailySequence`; a later job cannot start
  before an earlier active job for the same operational unit is complete.
- The Fleet calendar renders assignment events and can drag an existing
  `SCHEDULED` or `PILOT_ACCEPTED` event to another start time.

### 2.2 Current defects this package must remove

- Auto-assignment is invoked unconditionally by supported Sales processing
  paths. No company policy is read first.
- `User.preferences.autoAssignLeads` is a personal checkbox that the scheduler
  never reads. It falsely suggests that a Fleet employee controls company-wide
  automation.
- Resource selection is effectively first-match ordering, not a documented and
  deterministic fairness rule.
- The search is hardcoded to five days and 09:00.
- A missing weather provider fails open and schedules with a warning; that
  behaviour is not an explicit Admin policy.
- Multiple jobs for one unit can share the same 09:00 start even though they
  have different `dailySequence` values.
- `Assignment.serviceWindowStart` and `serviceWindowEnd` exist but are not the
  scheduling source of truth.
- Calendar events use an artificial two-hour end time.
- Concurrent scheduler requests are not proven safe against selecting the same
  resources in competing transactions.
- Calendar clicking, detailed editing, queue-to-calendar scheduling, duration
  editing, and visible resequencing are incomplete.
- The list API is not scoped to the visible calendar date range.

## 3. Locked product decisions

### 3.1 Ownership and authorization

- Auto-assignment policy is one company-wide policy per isolated deployment.
- Only `ADMIN` may change the policy.
- `ADMIN` and `FLEET_MANAGER` may read the full policy and manually request an
  auto-assignment retry.
- `SALES` may see a safe summary such as `automatic`, `manual`, or
  `temporarily paused`; Sales must not edit policy or select fleet resources.
- Normal Sales processing may trigger the system-owned scheduler when policy is
  enabled. The Sales actor remains the initiating audit actor, but the server
  owns resource selection.
- Remove `SALES` authorization from the direct `/api/assignments/auto-assign`
  operator endpoint. This does not prevent system auto-assignment after a Sales
  intake or Sales processing action.
- Manual assignment remains available to Admin and Fleet regardless of whether
  automatic assignment is enabled.

### 3.2 Policy-disabled behaviour

Disabling auto-assignment must not reject or lose an accepted in-area Lead.

When an eligible Lead reaches `PROCESSED` while the policy is disabled:

1. do not allocate resources;
2. transition it to `NEEDS_MANUAL_SCHEDULING` atomically;
3. use reason code `AUTO_ASSIGNMENT_POLICY_DISABLED`;
4. create a visible Fleet notification/task; and
5. write a coordinate-free audit event containing the policy revision and
   reason code.

Re-enabling policy does not silently schedule old manual-queue Leads. Fleet or
Admin explicitly selects `Retry auto-assignment`, individually or through a
future separately approved batch action.

### 3.3 Initial policy fields and defaults

Use a typed `AutoAssignmentPolicy` model. Do not store operational policy in
`User.preferences`, `PricingConfig`, an unvalidated JSON blob, or frontend
local storage.

| Field | Type | Initial value | Validation and meaning |
|---|---|---:|---|
| `singletonKey` | stable unique string | `COMPANY` | Enforces exactly one active policy row per isolated deployment. |
| `enabled` | Boolean | `true` | Preserves current automatic behaviour during migration. |
| `searchHorizonDays` | integer | `5` | Inclusive range 1-14. |
| `workingDayStartMinutes` | integer | `540` | 09:00 local operating time; range 0-1439. |
| `workingDayEndMinutes` | integer | `1080` | 18:00 local operating time; must be after start. |
| `defaultJobDurationMinutes` | integer | `120` | Initial display/planning duration; range 15-720. It is not a billing value. |
| `turnaroundMinutes` | integer | `30` | Buffer after one job before the same unit's next job; range 0-240. |
| `maxJobsPerUnitPerDay` | nullable integer | `null` | `null` means no unapproved business cap; when set, range 1-20. |
| `maxAcreagePerUnitPerDay` | nullable Decimal | `null` | `null` means no unapproved acreage cap; never use Float. |
| `weatherUnavailableAction` | enum | `SCHEDULE_WITH_WARNING` | Other allowed value: `MANUAL_REVIEW`. |
| `revision` | positive integer | `1` | Increment on every successful policy mutation. |
| `updatedByUserId` | nullable User reference | migration/system null | Required for browser/API mutations. |
| `createdAt`, `updatedAt` | timestamps | generated | Audit metadata. |

The application must use an explicitly configured IANA operating timezone.
Add validated deployment configuration `OPERATING_TIME_ZONE`. Staging and the
current office production deployment use `Asia/Kolkata`; do not hardcode that
value in application logic. Production startup must reject a missing or invalid
timezone after deployment configuration has been prepared.

Do not add route optimization, pricing, billing, or estimated chemical usage to
this policy.

### 3.4 Trigger rules

The same policy decision service must guard every automatic entry point:

- Sales manual phone intake when it creates a `PROCESSED` Lead;
- staff-assisted Customer Lead creation;
- public website Lead after Sales changes it from `NEW` or
  `MANUAL_CALL_REQUIRED` to `PROCESSED`;
- explicit Admin/Fleet `Retry auto-assignment`;
- automatic reassignment after the pilot-acceptance escalation releases an
  unaccepted unit.

No controller may duplicate the enabled/disabled decision. Controllers call one
application service. That service loads the policy, records the policy revision,
and selects exactly one outcome.

### 3.5 Outcomes and stable reason codes

Return a stable machine-readable outcome and reason code. UI text is localized
separately.

| Outcome | Reason code examples | Required action |
|---|---|---|
| `SCHEDULED` | `AUTO_ASSIGNMENT_SUCCESS` | Persist assignment and notify both Pilots. |
| `MANUAL_SCHEDULING` | `AUTO_ASSIGNMENT_POLICY_DISABLED` | Visible Fleet queue. |
| `MANUAL_SCHEDULING` | `NO_ELIGIBLE_PILOT_PAIR` | Visible Fleet queue with safe resource category. |
| `MANUAL_SCHEDULING` | `NO_ELIGIBLE_DRONE` | Visible Fleet queue. |
| `MANUAL_SCHEDULING` | `NO_ELIGIBLE_LMV` | Visible Fleet queue. |
| `MANUAL_SCHEDULING` | `NO_CAPACITY_IN_HORIZON` | Visible Fleet queue. |
| `MANUAL_SCHEDULING` | `WEATHER_REVIEW_REQUIRED` | Visible Fleet weather-review queue. |
| `SKIPPED` | `LEAD_NOT_PROCESSED` | No mutation; safe response. |
| `SKIPPED` | `ASSIGNMENT_ALREADY_EXISTS` | Idempotent success-style response containing existing assignment ID. |
| `RETRYABLE` | `SCHEDULER_CONCURRENCY_RETRY_EXHAUSTED` | Visible Fleet task plus operational alert. |

Never include exact coordinates, farmer contact data, credentials, or provider
payloads in policy audit events or scheduler logs.

## 4. Deterministic scheduling algorithm

Implement the algorithm in the following fixed order. Do not mix controller,
UI, notification, and database concerns into one function.

### 4.1 Preconditions

1. Load Lead through the Lead repository.
2. If missing, return the existing not-found error contract.
3. If an Assignment already exists for the Lead, return idempotently.
4. If Lead is not `PROCESSED`, return `SKIPPED/LEAD_NOT_PROCESSED`.
5. Revalidate the accepted Lead's service area and matched active centre.
6. Load the singleton policy.
7. If missing, fail closed into manual scheduling with
   `AUTO_ASSIGNMENT_POLICY_UNAVAILABLE`; never silently invent runtime policy.
8. If disabled, use the policy-disabled flow above.

### 4.2 Candidate dates and weather

For each local operating date from today through `searchHorizonDays`:

1. construct the working-day bounds using `OPERATING_TIME_ZONE`;
2. request weather suitability through the current weather abstraction;
3. if weather is unsuitable, skip that date;
4. if weather is unavailable and policy is `MANUAL_REVIEW`, move the Lead to
   the Fleet queue with `WEATHER_REVIEW_REQUIRED`;
5. if weather is unavailable and policy is `SCHEDULE_WITH_WARNING`, continue
   with `weatherSuitable=null` and a safe warning;
6. load active assignments intersecting that working day; and
7. evaluate complete operational units and available schedule windows.

Do not compare dates using the server's implicit local timezone.

### 4.3 Eligible resources

Primary Pilot and Copilot must each be:

- active and not archived;
- role `PILOT`;
- assigned to the Lead's active matched operating centre;
- equipped with all currently required licence fields;
- not expired at the planned service-window start;
- distinct people; and
- free from an overlapping active assignment.

Drone must be:

- assigned to the same active centre;
- `IN_SERVICE`;
- schedulable by both legacy status and normalized availability state;
- not in maintenance or out of service;
- airworthy through the planned start; and
- free from an overlapping active assignment.

LMV must be:

- assigned to the same active centre;
- `IN_SERVICE`;
- schedulable by both legacy status and normalized availability state;
- not in maintenance or out of service; and
- free from an overlapping active assignment.

Legacy incomplete assignments must block their known resources but must never
be selected as a reusable complete unit.

### 4.4 Complete-unit selection and fairness

A unit is the exact tuple:

`primaryPilotId + copilotId + droneId + lmvId`

First evaluate complete units already working that day. Prefer keeping a unit
together for its next job because the drone is physically carried by its LMV.
Reject the unit if policy caps would be exceeded.

Rank reusable units using this deterministic tuple:

1. earliest available next start;
2. lowest current daily job count;
3. lowest current assigned acreage total;
4. oldest most-recent assignment time; and
5. stable lexical IDs as the final tie-breaker.

If no reusable unit is eligible, form a new unit from currently free resources.
Rank each resource by:

1. lowest active job count in the policy horizon;
2. lowest assigned acreage in the policy horizon;
3. oldest last assignment time, with never-assigned first; and
4. stable lexical ID.

Take the highest-ranked distinct Pilot pair, drone, and LMV. Never use random
ordering or database natural order.

### 4.5 Time-window calculation

- First job for a new unit starts at `workingDayStartMinutes`.
- A reused unit's next job starts at the latest preceding
  `serviceWindowEnd + turnaroundMinutes`.
- End is start plus `defaultJobDurationMinutes`.
- If the calculated end exceeds `workingDayEndMinutes`, try the next unit or
  date.
- If `maxJobsPerUnitPerDay` is set, reject a candidate that reaches the cap.
- If `maxAcreagePerUnitPerDay` is set, use precise Lead acreage and reject a
  candidate that exceeds the cap.
- Persist `scheduledDate = serviceWindowStart` during the compatibility period.
- Persist both `serviceWindowStart` and `serviceWindowEnd` for every new or
  rescheduled Assignment.
- Calendar and conflict logic must use service windows. `scheduledDate` remains
  a compatibility alias until a later separately approved cleanup migration.

### 4.6 Conflict and concurrency safety

Conflict checks cover either Pilot role, drone, and LMV across all active
assignment states and use interval overlap:

`existing.start < proposed.end AND existing.end > proposed.start`

The create/reschedule transaction must:

1. run with Prisma `Serializable` isolation;
2. re-read the Lead, policy revision, candidate resources, and intersecting
   assignments inside the transaction;
3. retry only serialization/write-conflict errors a small bounded number of
   times;
4. return an explicit retry-exhausted outcome after the bound;
5. rely on the unique Lead-to-Assignment relation for duplicate-Lead
   idempotency; and
6. never retry validation, authorization, state, or policy failures.

Add a focused concurrency test that launches two assignments competing for the
same resources and proves at most one conflicting allocation commits.

## 5. Data and migration design

### 5.1 Additive migration only

The migration must:

- add the policy enum and typed singleton table;
- create the singleton `COMPANY` row with compatibility defaults;
- preserve every existing User, Lead, Assignment, centre, drone, LMV, audit,
  notification, and imported customer record;
- backfill missing service windows on existing assignments using
  `scheduledDate` and the initial 120-minute compatibility duration;
- add validated checks for minute ranges, positive revision, positive optional
  caps, and end-after-start;
- add indexes required for centre/date and resource/window conflict queries;
- not delete the obsolete personal preference JSON key in SQL; and
- remain valid for populated staging and production databases.

Remove `autoAssignLeads` from user preferences lazily in application writes or
leave the unknown JSON key ignored. Do not rewrite every User row merely to
clean cosmetic JSON.

### 5.2 Migration verification

Extend the existing disposable migration harness. It must prove:

- clean replay of every migration;
- populated legacy replay with existing Customers and Assignments;
- exact row-count preservation for core tables;
- policy singleton created exactly once;
- compatibility defaults match current behaviour;
- existing assignments receive valid windows;
- all new constraints are validated;
- a second migration deploy is a no-op; and
- the harness refuses any database name without the required `_test` suffix.

Never test this migration first against staging or production.

## 6. Backend architecture

Use the repository pattern already required by `AGENTS.md`.

### 6.1 Expected components

Names may be adjusted to current conventions, but responsibilities may not be
collapsed:

- `autoAssignmentPolicyRepository`: singleton read and guarded update.
- `autoAssignmentPolicyService`: validation, authorization-independent policy
  semantics, revision increment, and audit orchestration.
- `autoAssignmentPolicyController`: HTTP parsing and non-sensitive responses.
- `autoAssignmentPolicyRoutes`: authenticated role enforcement.
- `autoAssignmentService`: orchestration and outcome selection only.
- `assignmentOperationRepository`: transactional candidate queries, conflict
  checks, allocation, reschedule, and resequence writes.
- `schedulingTimeService`: timezone-safe date/window construction.
- existing weather and notification abstractions: reused, not bypassed.

Controllers, routes, jobs, and sockets must not import Prisma.

### 6.2 Proposed API contract

| Method and path | Roles | Purpose |
|---|---|---|
| `GET /api/auto-assignment-policy` | Admin, Fleet | Full typed policy. |
| `GET /api/auto-assignment-policy/summary` | Admin, Fleet, Sales | Safe mode/revision summary. |
| `PUT /api/auto-assignment-policy` | Admin only | Validated full update requiring expected revision. |
| `POST /api/leads/:leadId/auto-assign` | Admin, Fleet | Explicit retry using current policy. |

Policy update request includes `expectedRevision`. A stale revision returns
HTTP 409 and current safe revision metadata; it must not overwrite another
Admin's update.

Use consistent status codes:

- 200 for read/update and idempotent existing-assignment result;
- 201 for a newly created assignment;
- 400 for malformed input;
- 401/403 for authentication/authorization;
- 404 for missing Lead;
- 409 for state/resource/revision conflict;
- 422 only for well-formed policy values that violate cross-field rules.

Do not expose eligibility lists, hidden compliance data, full customer contact
details, or exact coordinates through policy endpoints.

### 6.3 Audit events

Required events include:

- `AUTO_ASSIGNMENT_POLICY_UPDATED`;
- `AUTO_ASSIGNMENT_SCHEDULED`;
- `AUTO_ASSIGNMENT_DEFERRED`;
- `AUTO_ASSIGNMENT_RETRY_REQUESTED`;
- `AUTO_ASSIGNMENT_REASSIGNED_AFTER_TIMEOUT`; and
- `ASSIGNMENT_WINDOW_RESCHEDULED`.

Policy audit before/after state may contain typed policy values, revision, actor
ID, and reason. Scheduling audit may contain Lead/Assignment/resource IDs,
policy revision, outcome, safe reason code, window, and sequence. It may not
contain coordinates, farmer phone, message bodies, weather-provider payloads,
or credentials.

## 7. Frontend implementation

### 7.1 Replace the misleading personal preference

- Remove the `autoAssignLeads` control from `EmployeeSettings`.
- Do not delete auto-assignment.
- Add an Admin-only Operations Control section named `Auto-assignment policy`.
- Fleet receives a read-only policy summary on the scheduling board.
- Sales receives only a mode indicator where Lead processing occurs.
- All new user-facing strings use the existing localization system.

### 7.2 Admin policy editor

Show:

- enabled/paused state;
- search horizon;
- working-day start/end;
- default job duration;
- turnaround buffer;
- optional daily job cap;
- optional daily acreage cap;
- weather-unavailable action;
- revision and last update metadata; and
- a warning that changing policy affects future automatic attempts only.

Require an explicit confirmation before disabling or enabling automation. Send
the loaded revision with save. On HTTP 409, reload and explain that another
Admin changed the policy.

### 7.3 Fleet scheduling board

For this package the Fleet calendar must become operationally truthful:

- event start/end come from service windows, not a hardcoded two hours;
- event click opens a details/editor panel;
- editor shows Lead, centre, primary Pilot, Copilot, drone, LMV, start, end,
  daily sequence, auto/manual origin, weather warning, and safe audit reason;
- Admin/Fleet can edit start/end, complete unit, sequence, and mandatory reason
  while status is `SCHEDULED` or `PILOT_ACCEPTED`;
- dragging an event changes its window only after server validation;
- resizing changes end time only after server validation;
- a Lead in `NEEDS_MANUAL_SCHEDULING` can be selected and scheduled into an
  empty calendar slot; direct queue-card form remains as an accessible fallback;
- daily sequence is visible and can be changed through an explicit control;
- conflict responses explain which resource category is unavailable without
  leaking private details;
- terminal assignments are hidden by default but available through a filter;
  and
- calendar requests include visible `from` and `to` bounds.

Queue-to-calendar drag is desirable but not required if accessible slot
selection plus the existing form achieves the same operation reliably. Do not
make drag-and-drop the only scheduling method.

## 8. Test contract

### 8.1 Policy unit/service tests

Test:

- default singleton load;
- Admin update and revision increment;
- non-Admin update rejection;
- stale revision rejection;
- every numeric boundary and cross-field rule;
- nullable caps;
- invalid timezone startup/configuration;
- disabled policy -> manual queue;
- re-enable does not silently process old queue entries; and
- coordinate-free audit payload.

### 8.2 Scheduler integration tests

Test:

- complete eligible unit scheduled;
- primary and Copilot are distinct;
- wrong-centre resource rejected;
- inactive/archived/expired Pilot rejected;
- maintenance/out-of-service/unavailable drone rejected;
- maintenance/out-of-service/unavailable LMV rejected;
- expired airworthiness rejected;
- unsuitable weather skips a date;
- unavailable weather follows both policy modes;
- reusable same unit receives the next non-overlapping window;
- job/acreage caps force another unit/date or manual queue;
- fairness ordering is deterministic across repeated runs;
- service-window end never exceeds working-day end;
- no capacity in horizon becomes visible manual scheduling;
- existing Assignment makes retry idempotent;
- reassignment excludes the timed-out primary Pilot and follows current policy;
- simultaneous requests cannot double-book either Pilot role, drone, or LMV;
- retry exhaustion becomes a visible staff exception; and
- every mutation has its required audit and notification.

### 8.3 API authorization tests

Test reads and writes for anonymous, Farmer, Business, Pilot, Sales, Fleet and
Admin roles. Explicitly prove:

- only Admin updates policy;
- Fleet reads policy and retries a Lead;
- Sales cannot call the direct operator retry endpoint;
- automated scheduling still runs after an authorized Sales workflow when
  policy is enabled; and
- no role can bypass service-area revalidation.

### 8.4 Calendar browser tests

Use the real browser harness, not only component mocks. Prove:

- month/week/day render with bounded date requests;
- event uses persisted start and end;
- event click opens correct details;
- drag reschedules and survives refresh;
- resize updates duration and survives refresh;
- invalid overlap is rejected and original event remains;
- resource edit updates all four unit members and survives refresh;
- manual queue slot scheduling works without drag;
- sequence change is visible and survives refresh;
- disabled-policy status is visible; and
- keyboard-accessible scheduling remains possible.

### 8.5 Full gates

Before staging:

1. Prisma format, validate, and generate;
2. disposable clean and populated migration harness;
3. focused policy/scheduler/calendar backend tests;
4. complete backend suite;
5. frontend lint and production build;
6. real browser scheduling audit;
7. isolated production Compose build/start/migrate/health test; and
8. scoped dependency and secret scan.

Do not weaken lint, audit, security, or container gates to pass this package.

## 9. Microtask execution order for a smaller coding agent

Complete exactly one microtask, run its focused checks, report changed files,
and stop before beginning the next. Preserve unrelated dirty files.

### AA-00 — Baseline and worktree safety

- Read `docs/plan/AGENTS.md` and this file completely.
- Confirm branch, HEAD, remotes, and dirty files.
- Record current focused Phase 3, Phase 5, Phase 20, Phase 24 and Phase 25 test
  results on a disposable `_test` database.
- Do not edit or stage the existing documentation-cleanup changes as part of
  feature code.
- Stop if baseline failures are unrelated to this package.

**Done when:** baseline evidence and exact pre-existing dirty paths are known.

### AA-01 — Typed policy schema and migration

- Add enum/model/relations/checks/indexes.
- Add the compatibility singleton row.
- Backfill assignment windows without changing operational row counts.
- Update Prisma client.
- Do not add UI or scheduler logic.

**Done when:** schema validates and migration SQL review shows additive,
population-safe behaviour.

### AA-02 — Migration harness

- Extend the guarded disposable migration verifier.
- Cover clean replay, populated replay, backfill, singleton, constraints,
  second deploy, row preservation, and `_test` refusal.
- Do not touch staging or production.

**Done when:** focused migration verification passes and disposable databases
are removed.

### AA-03 — Policy repository and service

- Implement singleton reads, expected-revision updates, validation, and audit.
- Use repository-only Prisma access.
- Add unit/service tests.
- Do not connect the scheduler yet.

**Done when:** policy tests pass including stale update and negative roles at the
service boundary.

### AA-04 — Policy HTTP API

- Add routes/controller validation and role enforcement.
- Add full and summary representations.
- Remove Sales from the direct assignment retry route.
- Add API authorization matrix tests.

**Done when:** API tests prove all role outcomes and no sensitive response data.

### AA-05 — Timezone-safe window service

- Validate `OPERATING_TIME_ZONE` configuration.
- Implement local-day bounds and minute-to-instant conversion.
- Test DST-capable IANA zones even though current deployment uses
  `Asia/Kolkata`.
- Update Compose examples and CI test configuration with non-secret values.

**Done when:** time tests are deterministic across host timezones.

### AA-06 — Policy-gated orchestration

- Route every automatic trigger through one policy-aware service.
- Implement disabled/missing-policy/manual-review outcomes and reason codes.
- Make existing-assignment retry idempotent.
- Preserve current post-commit notification behaviour.

**Done when:** all trigger-path tests prove identical policy enforcement.

### AA-07 — Deterministic candidate selection

- Implement reusable-unit and new-unit ranking exactly as Section 4.
- Add optional cap handling.
- Persist policy revision/reason in safe audit state.
- Do not change calendar UI.

**Done when:** repeat runs with shuffled fixture creation produce the same
selection.

### AA-08 — Service windows and overlap safety

- Make service windows authoritative for new assignment and reschedule writes.
- Add interval conflict checks for both Pilot roles, drone, and LMV.
- Add Serializable transaction and bounded write-conflict retry.
- Preserve sequence-based mission start safety.

**Done when:** overlap and concurrency tests pass without double booking.

### AA-09 — Admin policy UI

- Remove the misleading personal checkbox.
- Add Admin editor, Fleet read-only summary, Sales mode indicator and localized
  messages.
- Add revision-conflict handling and confirmation.

**Done when:** frontend lint/build and role-focused component/browser tests pass.

### AA-10 — Calendar truthfulness

- Use service windows and bounded queries.
- Add event details/edit, drag, resize, accessible slot scheduling, resource
  changes, reason, sequence and status filters.
- Keep the non-drag form fallback.

**Done when:** the browser acceptance cases in Section 8.4 pass.

### AA-11 — Regression and isolated stack

- Run every gate in Section 8.5.
- Inspect container logs for hidden scheduler errors.
- Confirm database migrations run once and health remains green.
- Confirm no client workbook, dump, secret, OTP or exact coordinate was staged.

**Done when:** all local gates are green on the exact candidate commit.

### AA-12 — Staging deployment and acceptance

- Merge through the normal reviewed flow into `staging`.
- Allow CI-gated staging auto-deploy; do not run improvised data commands.
- Verify migration evidence and policy singleton.
- Configure `OPERATING_TIME_ZONE=Asia/Kolkata` through staging deployment
  configuration before the application version requiring it starts.
- Test policy enabled and disabled, automatic assignment, no-capacity fallback,
  manual scheduling, calendar edit, overlap rejection, restart persistence and
  audit visibility using non-production data.

**Done when:** named tester acceptance and non-secret evidence are recorded.

### AA-13 — Production promotion and legacy database migration

- Promote the exact accepted staging revision to `main`; do not rebuild from a
  different source commit.
- Follow the production backup and controlled migration runbook.
- Configure production timezone before startup.
- Verify existing production Customer, Lead, Assignment and imported record
  counts are preserved.
- Verify singleton defaults preserve enabled auto-assignment.
- Do not rerun farmer/drone imports merely because schema migration ran.
- Perform a smoke test with a controlled test Lead only if the operations owner
  approves it; otherwise use read-only policy/health verification.
- Keep rollback ready through the agreed observation window.

**Done when:** production health, migration, data-count, policy, audit and
rollback evidence are recorded without sensitive values.

## 10. Staging acceptance checklist

- [ ] Exactly one policy row exists.
- [ ] Policy revision begins at 1 and changes only through Admin mutation.
- [ ] Existing assignment/customer/import counts survived migration.
- [ ] Enabled policy automatically schedules a complete eligible unit.
- [ ] Disabled policy sends a processed Lead to the visible manual queue.
- [ ] Re-enable does not silently consume the old manual queue.
- [ ] No eligible unit produces a specific safe reason category.
- [ ] Two jobs for one unit receive ordered, non-overlapping windows.
- [ ] Calendar refresh preserves drag/edit/resize/sequence changes.
- [ ] Either Pilot role, drone, or LMV overlap is rejected.
- [ ] Concurrent attempts cannot double-book resources.
- [ ] Weather-unavailable behaviour matches configured policy.
- [ ] Sales cannot edit policy or call direct operator retry.
- [ ] Fleet cannot edit policy but can read and retry.
- [ ] Admin changes are revision-protected and audited.
- [ ] Application/container restart preserves policy and schedule.
- [ ] Logs and audit contain no exact coordinates or customer contact data.

## 11. Rollback rules

- Application rollback may return to the previous image only if the additive
  schema remains backward compatible with that image.
- Do not drop the policy table or service-window data during an incident.
- If automatic scheduling is producing unsafe results, Admin pauses it through
  the supported policy API/UI. Accepted Leads then enter manual scheduling.
- If policy UI is unavailable but backend is healthy, use only a committed,
  reviewed operator CLI that calls the same service layer. Do not use raw SQL,
  `node -e`, or an ad-hoc script.
- Never restore a database backup merely to undo a policy value.
- Database restore is reserved for a verified data-corruption event and follows
  the production restore procedure with named approval.

## 12. Explicit exclusions

This package does not implement:

- automated route optimization;
- road travel-time estimation;
- permanent named crew templates;
- live weather-provider onboarding;
- Plus Code parsing or geocoding;
- billing, pricing, telemetry, or chemical calculation;
- automatic bulk retry of every manual-queue Lead;
- cross-centre borrowing of crew or assets; or
- a mobile offline calendar.

Plus Code support is a separate location-input package. Once implemented, it
must decode to validated latitude/longitude before normal geofence processing;
the scheduler continues to consume the matched operating centre and does not
need map-provider-specific logic.

## 13. Stop conditions for the implementing agent

Stop and report rather than guessing if:

- current source differs materially from the baseline in Section 2;
- a migration would delete or rewrite populated operational/import records;
- existing dirty changes overlap a file required by the current microtask;
- the company requests cross-centre assignment, route optimization, or a daily
  capacity rule not represented by the nullable policy caps;
- production/staging secrets or data would need to enter Git or chat;
- a test requires weakening authorization, audit, geofence, migration, lint,
  container, or dependency gates;
- a live provider or production data mutation is needed to complete local work;
  or
- the exact same accepted staging commit cannot be identified for promotion.

## 14. Definition of complete

The package is complete only when:

1. policy is typed, singleton, Admin-controlled and revision-protected;
2. every auto-assignment trigger respects it;
3. resource selection and time placement are deterministic and explainable;
4. scheduling and rescheduling are interval- and concurrency-safe;
5. Fleet has a truthful, usable calendar plus accessible manual fallback;
6. all negative authorization, state, resource, migration and browser tests
   pass;
7. staging acceptance is recorded on the exact promoted revision;
8. production migration preserves existing data and is separately verified;
9. no importer is rerun automatically; and
10. canonical state, hardening evidence and placeholders are updated to reflect
    what was actually proven.

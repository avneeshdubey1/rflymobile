# Pilot Android Application Microtask Execution Workbook

**Status:** backend execution active; D00-01 through D00-04 and S00-01 through S00-03 complete locally
**Prepared:** August 12, 2026
**Parent plan:**
[PILOT_ANDROID_APP_IMPLEMENTATION_PLAN.md](PILOT_ANDROID_APP_IMPLEMENTATION_PLAN.md)
**Intended executor:** a narrowly scoped coding agent working on one microtask
at a time under human/lead-agent review

## 1. How to use this workbook

This document decomposes the Pilot Android application into small, dependency-
ordered units. It does not replace the parent plan or the repository safety
rules.

### 1.1 Mandatory execution rules

For every microtask, the assigned agent must:

1. read `docs/plan/AGENTS.md`, `CURRENT_ENGINEERING_STATE.md`, the parent Pilot
   plan, this workbook, and the files explicitly named by the task;
2. inspect the current implementation before proposing edits;
3. perform **only one microtask** unless the lead explicitly assigns a stated
   contiguous batch;
4. preserve unrelated dirty files and user work;
5. use the existing controller/service/repository separation;
6. add or update the focused tests stated by the task;
7. run the focused verification before reporting completion;
8. report files changed, exact checks run, results, assumptions, and remaining
   dependency;
9. stop on an unresolved contract, migration, privacy, or security question;
10. leave commit, push, branch promotion, deployment, signing, and live-data
    actions to a separately authorized task.

### 1.2 Actions forbidden in ordinary microtasks

- No production or staging database mutation.
- No server access or deployment.
- No `prisma db push`, seed, wipe, bootstrap, or ad-hoc data script.
- No raw SQL except inside a reviewed Prisma migration or disposable test
  harness explicitly required by the task.
- No credentials, signing keys, customer data, exact coordinates, or tokens in
  code, fixtures, logs, reports, or documentation.
- No weakening lint, tests, authorization, CSRF, dependency scanning, rate
  controls, or container gates to obtain a passing build.
- No Firebase dependency.
- No direct mobile-to-PostgreSQL connection.
- No WebView wrapper around the existing frontend.
- No new provider activation or background location without explicit approval.
- No broad refactor, dependency upgrade, formatting pass, or file deletion
  outside the assigned scope.

### 1.3 Task result format

Every executor must finish with:

```text
Task: <ID>
Status: PASS | BLOCKED
Files changed: <paths or none>
Checks run: <exact commands/tests>
Result: <counts and failures>
Assumptions: <none or explicit list>
Next dependency: <task ID>
No commit/push/deployment/live-data action performed: confirmed
```

### 1.4 Batch sizing

- Default: one microtask per agent turn.
- Small documentation/test-fixture tasks: at most three adjacent tasks.
- Schema, authentication, synchronization, secure storage, location, signing,
  or release tasks: exactly one task per turn.
- A failed task blocks every dependent task. Fix the failure; do not skip the
  gate.

### 1.5 Execution ledger

| Tasks | Status | Evidence |
|---|---|---|
| M00-01 to M00-02 | PASS | `PILOT_MOBILE_BACKEND_BASELINE.md` records the route, service, repository and database contract |
| M00-03 to M00-05 | PASS | Phase 20 passed 1/1 and Phase 25 passed 5/5 on fresh disposable `_test` databases; actor audit/history, sequence ordering, final release and unrelated-resource isolation are asserted |
| M00-06 to M00-09 | PASS | `PILOT_MOBILE_API_CONTRACT.md` records the minimum DTO, visibility/retention boundaries, development-only session/location placeholders and stable safe error catalog |
| M00-10 | PASS | Strict JSON Schema and seven sanitized fixture templates pass Phase 28 contract tests 3/3; stored templates contain no password, bearer token, phone or exact coordinate values |
| R00-01 to R00-09 | PASS | `MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md` records the approved backend-facing requirements, role/parity matrices, Copilot workflow, source gap, two-app boundary, Stitch review, contract classification and replacement graph. |
| D00-01 to D00-04 | PASS | Crew-state and mobile-identity migrations pass clean/populated replay; transactional Copilot formation and provisional scheduling pass focused Phases 29/30. |
| S00-01 to S00-03 | PASS | `/api/mobile/v1` uses hashed installation-bound bearer sessions, serialized installation limits, login identity-race protection, Pilot/Operations app-role separation, capability bootstrap, logout/revocation, audit events and production-off configuration; Phase 31 passes 4/4 and the complete backend gate passes 146/146. |
| P00-01 to P00-02 | PASS | Bounded assignment list/detail DTOs expose only assigned work; Primary Pilot eligible-Copilot selection and reasoned Fleet/Admin override reuse the serialized crew domain service. Phase 32 passes 3/3. |
| P10-01 | PASS | Accept/Start/Complete require generated client action IDs and expected revisions; concurrent/replayed requests use durable safe receipts and cannot double-apply. Phase 32 passes 4/4 and the complete backend gate passes 150/150. |
| P10-02 | PASS | A database-backed per-Pilot sequence feed returns bounded changed DTOs and removal tombstones, supports ordered mutation batches, detects expired/invalid cursors and purges feed rows after 30 days; the complete backend gate passes 151/151 and 27-migration replay validates 59 checks. |
| P10-03 | PASS | Idempotent issue reporting uses five controlled categories, coordinate-free notes, durable assignment state, Fleet alerts, audit history and immediate resource release; drone malfunction places only the drone into maintenance. Complete backend gate: 152/152; 28-migration replay: 61 validated checks. |
| P10-04 | DEFERRED | Foreground location remains disabled. Written production collection, retention and privacy policy is required before activation; no endpoint or route-history storage was added. |
| O00-01 | PASS | Operations mobile sessions expose role-scoped customer search/phone lookup, Sales/Admin registration and customer-linked geofenced intake through existing canonical services. Fleet is read-only, request fields and DTOs are bounded, strict fixtures pass 3/3 and the complete backend gate passes 155/155. |
| Old M01-01 onward | RETIRED AS EXECUTION ORDER | Existing tasks remain source material. Execute the D00/W00/S00/P00/P10/O00/O10/Q00 packages below instead. |

---

# Phase R00 — Client-change consolidation and replanning

These tasks now precede every unstarted implementation task.

## R00-01 — Capture the complete client meeting requirement register

**Depends on:** user-provided meeting notes
**Objective:** give every requested change an ID, source, affected roles,
priority, business reason, acceptance statement and unresolved questions.
**Touch:** planning documents only.
**Done when:** no meeting request exists only in chat/memory and the client list
is explicitly marked awaiting confirmation or approved.
**Verify:** user/client review.

## R00-02 — Create the role-capability matrix

**Depends on:** R00-01
**Objective:** map each capability across Admin, Fleet Manager, Sales, Pilot,
Copilot, Farmer and Business for web, Pilot Field app and Operations app.
**Touch:** planning documents only.
**Done when:** read/create/update/approve/override permissions and intentional
exclusions are explicit.
**Verify:** compare with server authorization and client intent.

## R00-03 — Create the web/mobile parity matrix

**Depends on:** R00-01, R00-02
**Objective:** identify the single server capability, web interface, Pilot Field
interface and Operations interface for every requirement.
**Touch:** planning documents only.
**Done when:** no one assumes a web screen automatically appears in an app and
every client has `REQUIRED`, `DEFERRED`, or `NOT_APPLICABLE`.
**Verify:** product/engineering review.

## R00-04 — Approve the Copilot-selection state machine

**Depends on:** R00-01, section 4 of the parent plan
**Objective:** settle nomination acceptance, selection deadline, centre scope,
Fleet/Admin approval, decline/replacement, reservation expiry and emergency
replacement.
**Touch:** decision/specification documents only.
**Done when:** provisional assignment, eligibility, concurrency, audit,
notification and Fleet fallback states are unambiguous.
**Verify:** state-transition table reviewed by client and engineering.

## R00-05 — Compare revised workflows with the current schema/server/web

**Depends on:** R00-01 through R00-04
**Objective:** produce a gap report for models, migrations, repositories,
services, routes, web screens and existing test assumptions.
**Touch:** read-only analysis/evidence.
**Done when:** additive migration and compatibility needs are known without
changing data or code.
**Verify:** references point to current source, not historical documents.

## R00-06 — Approve the two-application boundary

**Depends on:** R00-02, R00-03
**Objective:** confirm package identities, first-release roles, shared packages,
separate navigation and release ownership for Pilot Field and Operations.
**Touch:** architecture/decision documents only.
**Done when:** Farmer/Business inclusion is explicit and neither app becomes an
unbounded “all roles” container.
**Verify:** security/product review.

## R00-07 — Produce the RFLY/Coin-inspired design brief

**Depends on:** client reference and R00-06
**Objective:** translate the reference into original RFLY tokens, navigation,
information hierarchy, components, accessibility and sample wireframes.
**Touch:** `RFLY_MOBILE_UI_DESIGN_BRIEF.md` and sanitized design assets only.
**Done when:** the brief states whether the web UI is included and copies no
Zerodha branding, assets or exact protected screen design; generated Stitch
code is explicitly excluded from the repository.
**Verify:** client visual sign-off.

## R00-08 — Revise shared and app-specific API contracts

**Depends on:** R00-03 through R00-07
**Objective:** generalize sessions/installations for two apps, revise Pilot crew
formation contracts and define Operations capability contracts by slice.
**Touch:** contract documentation/fixtures only in a later authorized task.
**Done when:** existing Phase M00 fixtures are classified as reusable, revised
or retired and no endpoint is built from a stale assumption.
**Verify:** schema/contract review.

## R00-09 — Replace the post-M00 dependency graph

**Depends on:** R00-05, R00-08
**Objective:** regenerate microtasks for domain-first web reference slices,
shared mobile foundation, Pilot Field, Operations, QA and two releases.
**Touch:** this workbook and parent plan only.
**Done when:** every task is small, dependency-ordered and names focused tests.
**Verify:** lead-agent execution review; completed in
`MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`.

---

# Replacement backend execution packages

Each item is one focused commit unless verification proves no source change is
required. Schema migration, authentication, idempotency, synchronization and
location activation must never be combined into one commit.

## D00-01 — Add crew-formation and assignment-revision schema

**Depends on:** R00-09
**Objective:** add explicit crew state, revision and formation timestamps without
changing Lead lifecycle states.
**Done when:** complete assignments backfill `READY`; legacy quarantined rows
remain non-executable; clean and populated migration paths pass.
**Verify:** Prisma validation plus disposable clean/populated migration harness.

## D00-02 — Add installation and idempotency schema

**Depends on:** D00-01
**Objective:** add hashed/revocable app installation/session identity and durable
installation-scoped mutation receipts.
**Done when:** tokens are never stored raw and action IDs are unique per
installation.
**Verify:** schema constraints and disposable migration tests.

## D00-03 — Add transactional Copilot formation repository

**Depends on:** D00-01
**Objective:** provide minimal eligibility, Primary selection and Fleet/Admin
reasoned override under serialized conflict checks.
**Done when:** stale revision, cross-centre, inactive, expired, overlapping,
self-selection and post-start replacement are rejected atomically.
**Verify:** focused repository tests including concurrent selection.

## D00-04 — Adapt schedulers to provisional crew formation

**Depends on:** D00-03
**Objective:** reserve Primary Pilot, Drone and LMV without preselecting Copilot
for ordinary new assignments.
**Done when:** pending assignments cannot accept/start; complete-unit legacy rows
and rollback/resource rules remain safe.
**Verify:** auto/manual scheduling, transition and release regression suites.

## W00-01 — Add web Primary-Pilot Copilot reference flow

**Depends on:** D00-04
**Objective:** expose pending crew, eligible list and selection in the existing
web Pilot workspace using the shared server service.
**Done when:** no client-side eligibility or direct `copilotId` update exists.
**Verify:** role, stale conflict, no-candidate and success browser tests.

## W00-02 — Add Fleet/Admin crew exception flow

**Depends on:** D00-04
**Objective:** show unresolved crew formation and reasoned override before start.
**Done when:** exceptions are visible, auditable and close after resolution or
cancellation.
**Verify:** Fleet/Admin authorization and browser tests.

## S00-01 — Implement shared mobile installation/session service

**Depends on:** D00-02
**Objective:** create opaque hashed bearer sessions separate from browser
cookies while reusing password/authVersion/account controls.
**Done when:** login is enumeration-safe; logout, logout-all, expiry, password
change and Admin lost-device revocation work without weakening browser CSRF.
**Verify:** focused auth tests for both app identities and revoked installations.

## S00-02 — Mount `/api/mobile/v1` and stable middleware

**Depends on:** S00-01
**Objective:** add version/content-type/auth/request-context/error middleware and
supported-client enforcement.
**Done when:** routes return the strict safe envelope and never leak internals.
**Verify:** unauthenticated, unauthorized, invalid-version and malformed-input tests.

## S00-03 — Add capability/bootstrap endpoint

**Depends on:** S00-02
**Objective:** return own minimal profile, app/role capabilities, policy values
and bounded initial cursor.
**Done when:** Pilot and Operations responses contain no cross-role capabilities.
**Verify:** DTO allow-list and role-matrix contract tests.

## P00-01 — Add Pilot assignment list/detail projections

**Depends on:** D00-04, S00-03
**Objective:** return only bounded assigned work and the minimum operational DTO.
**Done when:** unrelated jobs and broad Prisma relations cannot be inferred or
serialized.
**Verify:** Primary/Copilot visibility, ID substitution and retention tests.

## P00-02 — Add eligible-Copilot and selection endpoints

**Depends on:** D00-03, P00-01
**Objective:** expose transactional formation to the assigned Primary and the
reasoned Fleet/Admin exception endpoint.
**Done when:** responses omit ratings, phones, licences and invented telemetry.
**Verify:** eligibility, concurrency, replay, role and audit tests.

## P10-01 — Add idempotent mission mutation endpoints

**Depends on:** P00-01, D00-02
**Objective:** adapt accept/start/complete/issue to action ID, expected revision
and deterministic receipts.
**Done when:** response loss/replay cannot double-apply and stale state cannot be
overwritten.
**Verify:** applied, already-applied, conflict, rejected and retry-later tests.

## P10-02 — Add cursor-based Pilot change synchronization

**Depends on:** P10-01
**Objective:** return bounded ordered changes/tombstones and process ordered
mutation batches without a client-authoritative merge.
**Done when:** reassignment/cancellation removes work safely and malformed or
oversized batches fail closed.
**Verify:** replay, partial outcome, pagination and retention tests.

## P10-03 — Add controlled issue reporting

**Depends on:** P10-01
**Objective:** expose approved issue categories and bounded notes through the
existing decommission/alert workflow.
**Done when:** issue actions are audited, coordinate-free and visible to Fleet.
**Verify:** category, invalid input, replay and resource-release tests.

## P10-04 — Add foreground location endpoint policy

**Depends on:** P10-01 and written production policy before activation
**Objective:** validate assignment/session eligibility, bounds, accuracy and
capture time while retaining only the latest sample.
**Done when:** background collection and route history remain absent.
**Verify:** privacy, staleness, authorization, cleanup and redaction tests.

## O00-01 — Add Operations Sales bootstrap and customer/lead DTOs

**Depends on:** S00-03
**Objective:** reuse existing Sales services through mobile minimum DTOs.
**Done when:** phone lookup, registration and lead intake preserve geofence and
normalization rules without exposing other roles.
**Verify:** Sales role, duplicate phone, geofence and DTO tests.

## O10-01 — Add Operations Fleet schedule/exception DTOs

**Depends on:** W00-02, S00-03
**Objective:** expose ordered day schedule, resource state and crew exceptions
without granting scheduling authority to other roles.
**Done when:** Fleet/Admin capabilities match the role matrix.
**Verify:** bounded date range, role isolation and exception tests.

## Q00-01 — Run complete compatibility and migration gates

**Depends on:** completed applicable backend packages
**Objective:** prove browser, mobile contracts, schema and containers together.
**Done when:** backend suite, clean/populated migration replay, frontend
lint/build, audits and isolated Compose health pass without weakening gates.
**Verify:** local evidence followed by separately authorized staging acceptance.

---

# Phase M00 — Decisions and baseline evidence

## M00-01 — Record the existing Pilot route inventory

**Depends on:** none
**Objective:** list current Pilot-facing routes, authorization, controllers,
services, repositories, request fields, responses, and state transitions.
**Touch:** documentation/evidence only.
**Done when:** every existing Pilot assignment, location, login, logout, and
chat route has an implementation reference; no behaviour is inferred from UI
labels alone.
**Verify:** compare inventory against route registration and controller exports;
run `git diff --check` on the evidence file.

## M00-02 — Record the current Pilot database dependencies

**Depends on:** M00-01
**Objective:** map User, AuthSession, Assignment, Lead, Drone, LMV, location,
notification, audit, and schedule-change data used by Pilot workflows.
**Touch:** documentation/evidence only.
**Done when:** required relations, nullability, indexes, status fields, and
legacy-row behaviour are identified from the current Prisma schema/migrations.
**Verify:** cross-check every model/field against `schema.prisma`.

## M00-03 — Freeze Primary Pilot/Copilot semantics

**Depends on:** M00-01
**Objective:** document and test that either assigned crew member can see and
perform permitted actions on the shared assignment, with the actor recorded.
**Touch:** focused assignment tests and contract documentation only.
**Done when:** Primary Pilot and Copilot positive cases and unrelated-Pilot
negative cases pass for existing transitions.
**Verify:** run the focused assignment lifecycle test file.

## M00-04 — Freeze assignment-order semantics

**Depends on:** M00-03
**Objective:** test that a crew cannot start a later sequence while an earlier
active assignment remains incomplete.
**Touch:** focused assignment tests only unless a confirmed defect requires a
separate fix task.
**Done when:** correct-order success and wrong-order rejection are deterministic.
**Verify:** focused test on a disposable database.

## M00-05 — Freeze resource-release semantics

**Depends on:** M00-03
**Objective:** prove completion releases drone and LMV without waiting for
billing and does not release unrelated resources.
**Touch:** tests only unless a defect is separately authorized.
**Done when:** completion and cancellation/relevant exception cases are covered.
**Verify:** focused repository/service test.

## M00-06 — Decide the minimum mobile data exposure

**Depends on:** M00-01, M00-02
**Objective:** approve which farmer contact, farm, crew, asset, and note fields a
Pilot needs before, during, and after a job.
**Touch:** parent plan/placeholder register only.
**Done when:** each field has purpose, visibility window, and retention rule;
unresolved client choices are marked placeholders.
**Verify:** privacy/hardening review; no customer values included.

## M00-07 — Decide mobile session policy placeholders

**Depends on:** M00-02
**Objective:** record configurable idle lifetime, absolute lifetime, offline
grace, maximum installations, and revocation ownership without hardcoded client
claims.
**Touch:** placeholder and security documentation only.
**Done when:** safe development defaults and production activation blockers are
distinguished.
**Verify:** review against `production_hardening.md`.

## M00-08 — Decide location-policy placeholders

**Depends on:** M00-06
**Objective:** record foreground capture states, interval, accuracy threshold,
retention, staff visibility, and deletion ownership.
**Touch:** placeholder/privacy documentation only.
**Done when:** background tracking remains explicitly disabled and exact
coordinates are prohibited from AuditLog/general logs.
**Verify:** privacy review.

## M00-09 — Establish mobile API error vocabulary

**Depends on:** M00-01, M00-03, M00-04
**Objective:** define stable codes for authentication, authorization, stale
revision, reassignment, cancellation, sequence, invalid asset, issue, location,
retry, and required upgrade.
**Touch:** API contract document only.
**Done when:** each error has HTTP status, retryability, user-safe meaning, and
no sensitive content.
**Verify:** contract review for unique/unambiguous codes.

## M00-10 — Create the initial mobile API contract fixture

**Depends on:** M00-06, M00-09
**Objective:** create sanitized request/response fixtures for login, bootstrap,
assignment, mutation receipt, change page, and conflict.
**Touch:** contract fixtures/tests only; no real customer data.
**Done when:** fixtures validate against the chosen schema validator and contain
no secrets/coordinates copied from production.
**Verify:** fixture validation test.

---

# Phase M01 — Mobile session persistence and repository

## M01-01 — Design the MobileInstallation model

**Depends on:** M00-07
**Objective:** specify fields, constraints, relations, indexes, activation, and
revocation for a privacy-minimized installation record.
**Touch:** design note only.
**Done when:** no IMEI, serial, advertising ID, or arbitrary fingerprint exists.
**Verify:** schema design review.

## M01-02 — Design the MobileSession model

**Depends on:** M01-01
**Objective:** specify opaque-token hash, user/installation, auth version,
expiry, touch, and revocation fields and indexes.
**Touch:** design note only.
**Done when:** raw token storage is explicitly impossible and logout scopes are
defined.
**Verify:** security review against current browser AuthSession behaviour.

## M01-03 — Add mobile installation/session Prisma models

**Depends on:** approved M01-01 and M01-02
**Objective:** make additive Prisma schema changes only.
**Touch:** `backend/prisma/schema.prisma` only.
**Done when:** Prisma validation succeeds and existing models are not renamed or
made destructively non-null.
**Verify:** Prisma format/validate and scoped diff review; do not migrate yet.

## M01-04 — Create the additive migration

**Depends on:** M01-03
**Objective:** generate/review one migration for mobile installation/session
tables, constraints, and indexes.
**Touch:** one new migration directory only.
**Done when:** migration is additive, deterministic, and contains no seed/data
wipe.
**Verify:** SQL review and `git diff --check`.

## M01-05 — Extend the disposable migration harness

**Depends on:** M01-04
**Objective:** prove clean replay and populated-upgrade safety for the new
migration.
**Touch:** migration verification harness/tests only.
**Done when:** all migrations replay once; pre-existing core row counts remain;
constraints validate; disposable databases are removed.
**Verify:** harness must refuse any DB name without `_test`.

## M01-06 — Add MobileInstallation repository create/find methods

**Depends on:** M01-05
**Objective:** implement create-or-resolve and safe lookup through repository
layer.
**Touch:** one repository and focused tests.
**Done when:** identity is server-generated, user-bound, and no raw device
fingerprint is accepted.
**Verify:** repository tests on disposable DB.

## M01-07 — Add installation touch/version update method

**Depends on:** M01-06
**Objective:** update last-seen/app-version only for active matching
installations.
**Touch:** installation repository/tests.
**Done when:** revoked or wrong-user records cannot be revived by touch.
**Verify:** focused positive/negative tests.

## M01-08 — Add installation revocation method

**Depends on:** M01-06
**Objective:** atomically revoke one installation and its active mobile sessions.
**Touch:** repository/tests only.
**Done when:** idempotent repeated revocation succeeds safely and other
installations remain active.
**Verify:** transaction rollback and isolation tests.

## M01-09 — Add MobileSession repository creation

**Depends on:** M01-06
**Objective:** persist only token hash and validated expiry/auth-version data.
**Touch:** mobile-session repository/tests.
**Done when:** repository API cannot accept or return a raw token.
**Verify:** repository tests and log-output inspection.

## M01-10 — Add session lookup and atomic touch

**Depends on:** M01-09
**Objective:** resolve active token hash and update idle expiry under bounded
touch policy.
**Touch:** mobile-session repository/tests.
**Done when:** idle, absolute, revoked, inactive-user, archived-user, and auth-
version mismatch cases fail closed.
**Verify:** time-controlled focused tests.

## M01-11 — Add one-session revocation

**Depends on:** M01-10
**Objective:** revoke the current mobile session idempotently with a safe reason.
**Touch:** repository/tests.
**Done when:** another session for the same user remains active.
**Verify:** multi-session test.

## M01-12 — Add user-wide mobile-session revocation

**Depends on:** M01-11
**Objective:** revoke all mobile sessions for a user without altering unrelated
users or browser session behaviour.
**Touch:** repository/tests.
**Done when:** exact scope and idempotency tests pass.
**Verify:** focused multi-user test.

---

# Phase M02 — Mobile authentication services and endpoints

## M02-01 — Implement opaque token primitives

**Depends on:** M01-09
**Objective:** add cryptographically secure token generation and dedicated
hashing helpers.
**Touch:** a focused security utility and unit tests.
**Done when:** adequate entropy, constant representation, and no token logging
are proven; browser session helpers remain unchanged.
**Verify:** deterministic-format and negative-input tests.

## M02-02 — Implement mobile login service

**Depends on:** M01-10, M02-01
**Objective:** verify employee credentials, require active non-archived `PILOT`,
resolve installation, create session, and return raw token once.
**Touch:** service/tests; no route yet.
**Done when:** wrong password, wrong role, disabled, archived, and invalid
installation input fail generically.
**Verify:** service integration tests.

## M02-03 — Add mobile authentication audit events

**Depends on:** M02-02
**Objective:** record session/installation lifecycle without token, password,
phone, or coordinate material.
**Touch:** auth audit service/tests.
**Done when:** successful login, logout, logout-all, expiry, and revocation have
safe events.
**Verify:** audit-state redaction assertions.

## M02-04 — Implement bearer-token parsing middleware

**Depends on:** M01-10, M02-01
**Objective:** strictly parse `Authorization: Bearer`, hash the token, resolve
session, and attach safe mobile auth context.
**Touch:** new middleware/tests.
**Done when:** missing, malformed, expired, revoked, wrong-role, and multiple
authorization header cases fail closed.
**Verify:** middleware tests; cookie middleware remains unchanged.

## M02-05 — Add mobile login controller/route

**Depends on:** M02-02, M02-03
**Objective:** expose `POST /api/mobile/v1/auth/login` with bounded validated
input and generic credential failures.
**Touch:** mobile route/controller/validation and tests.
**Done when:** response matches M00-10 fixture and rate-control hooks apply.
**Verify:** HTTP integration tests.

## M02-06 — Add mobile `me` endpoint

**Depends on:** M02-04, M02-05
**Objective:** return safe Pilot profile and session/installation identifiers.
**Touch:** mobile controller/route/tests.
**Done when:** unrelated user fields and password/auth internals are absent.
**Verify:** exact response-shape test.

## M02-07 — Add current-session logout endpoint

**Depends on:** M01-11, M02-04
**Objective:** revoke the bearer session and return idempotent success.
**Touch:** route/controller/service/tests.
**Done when:** reuse of the logged-out token fails and another session remains.
**Verify:** HTTP lifecycle test.

## M02-08 — Add logout-all endpoint

**Depends on:** M01-12, M02-04
**Objective:** revoke all user mobile sessions with audited outcome.
**Touch:** route/controller/service/tests.
**Done when:** all mobile tokens fail; browser-session scope matches the
approved decision rather than an assumption.
**Verify:** multi-session integration test.

## M02-09 — Add installation-revoked response

**Depends on:** M01-08, M02-04
**Objective:** provide stable `INSTALLATION_REVOKED` behaviour for a revoked
device.
**Touch:** middleware/error mapping/tests.
**Done when:** revoked device cannot mint/retain a session without an approved
re-enrolment flow.
**Verify:** HTTP negative test.

## M02-10 — Add authentication rate and budget controls

**Depends on:** M02-05
**Objective:** apply account/IP/global controls using configuration, not literals.
**Touch:** mobile login route configuration/tests only.
**Done when:** brute-force attempts are bounded, generic, observable, and do not
block unrelated authenticated APIs.
**Verify:** rate-control tests with reset isolation.

## M02-11 — Complete mobile-auth regression gate

**Depends on:** M02-03 through M02-10
**Objective:** run focused auth, existing browser auth, migration, and audit
tests together.
**Touch:** tests/fixtures only if needed; no gate weakening.
**Done when:** all pass with no token/password leakage.
**Verify:** record exact test counts and disposable DB teardown.

---

# Phase M03 — Versioned bootstrap and assignment reads

## M03-01 — Add mobile router boundary

**Depends on:** M02-11
**Objective:** mount `/api/mobile/v1` separately with mobile bearer middleware.
**Touch:** application route registration and smoke tests.
**Done when:** web routes still use their existing cookie/CSRF contract and
mobile routes reject cookies without bearer auth.
**Verify:** positive/negative routing test.

## M03-02 — Implement safe mobile profile mapper

**Depends on:** M00-06
**Objective:** map authenticated Pilot to the approved minimal profile DTO.
**Touch:** mapper/schema/tests.
**Done when:** exact allow-list assertions prevent accidental new-field leakage.
**Verify:** snapshot/schema test.

## M03-03 — Implement mobile configuration service

**Depends on:** M00-07, M00-08
**Objective:** provide safe timezone, feature flags, version policy, and bounded
non-secret operational values.
**Touch:** service/config validation/tests.
**Done when:** missing production-owned values fail safely or remain disabled;
secrets are absent.
**Verify:** environment/config tests.

## M03-04 — Implement bootstrap service

**Depends on:** M03-02, M03-03
**Objective:** compose profile, centre, server time, policy, initial cursor, and
bounded assignment window.
**Touch:** service/repository calls/tests.
**Done when:** only the authenticated Pilot/Copilot's records are returned.
**Verify:** Primary Pilot, Copilot, unrelated Pilot tests.

## M03-05 — Add bootstrap endpoint

**Depends on:** M03-04
**Objective:** expose and validate the M00-10 bootstrap contract.
**Touch:** route/controller/tests.
**Done when:** response is deterministic, bounded, and has server time/cursor.
**Verify:** HTTP contract test.

## M03-06 — Implement assignment allow-list mapper

**Depends on:** M00-06, M00-10
**Objective:** map assignment data to the approved mobile DTO only.
**Touch:** mapper/tests.
**Done when:** authorization, financial, unrelated history, and internal fields
cannot leak through nested includes.
**Verify:** exact deep-key allow-list test.

## M03-07 — Implement server-calculated allowed actions

**Depends on:** M00-03, M00-04, M03-06
**Objective:** derive display hints from current state and crew membership.
**Touch:** pure service/tests.
**Done when:** `ACCEPT`, `START`, `COMPLETE`, and `REPORT_ISSUE` hints cover each
state; they are explicitly non-authoritative.
**Verify:** state-table unit tests.

## M03-08 — Add bounded assignment-list repository query

**Depends on:** M03-06
**Objective:** fetch current/upcoming assignments for actor as Primary Pilot or
Copilot within validated date/cursor bounds.
**Touch:** repository/tests.
**Done when:** no unbounded history query exists and unrelated work is excluded.
**Verify:** range, role, and pagination tests.

## M03-09 — Add assignment-list endpoint

**Depends on:** M03-07, M03-08
**Objective:** expose ordered mobile assignment summaries.
**Touch:** route/controller/tests.
**Done when:** sequence/service-window ordering is stable and response validates.
**Verify:** HTTP contract/pagination tests.

## M03-10 — Add assignment-detail endpoint

**Depends on:** M03-07, M03-08
**Objective:** return one authorized assignment detail DTO.
**Touch:** repository/service/controller/tests.
**Done when:** Primary/Copilot access succeeds; unrelated Pilot and missing ID
do not reveal existence.
**Verify:** HTTP authorization tests.

## M03-11 — Add mobile read API regression gate

**Depends on:** M03-01 through M03-10
**Objective:** run auth, DTO leakage, query bound, web regression, and database
tests together.
**Touch:** tests only if necessary.
**Done when:** no response exceeds the documented contract.
**Verify:** record exact passing counts.

---

# Phase M04 — Assignment revision and action receipts

## M04-01 — Design assignment revision storage

**Depends on:** M00-02, M00-09
**Objective:** choose an additive monotonic revision field and enumerate every
operation that increments it.
**Touch:** design/contract documentation only.
**Done when:** manual schedule, auto schedule, reschedule, resequence,
reassignment, state transitions, issue outcomes, cancellation, and relevant
asset changes are addressed.
**Verify:** repository call-site inventory review.

## M04-02 — Add assignment revision to Prisma

**Depends on:** approved M04-01
**Objective:** add the revision with a safe legacy default.
**Touch:** Prisma schema only.
**Done when:** Prisma validates; no existing row requires destructive backfill.
**Verify:** Prisma validation and scoped diff.

## M04-03 — Add assignment revision migration

**Depends on:** M04-02
**Objective:** create/review additive migration and supporting constraints.
**Touch:** one migration directory.
**Done when:** populated legacy upgrade preserves rows and initializes revision
deterministically.
**Verify:** migration harness clean/populated replay.

## M04-04 — Increment revision on scheduling mutations

**Depends on:** M04-03
**Objective:** update manual/auto schedule, reschedule, resequence, and
reassignment transactions.
**Touch:** assignment operation repository and focused tests.
**Done when:** exactly one increment occurs per committed mutation and rollback
does not increment.
**Verify:** focused transactional tests.

## M04-05 — Increment revision on mission-state mutations

**Depends on:** M04-03
**Objective:** update accept/start/complete/issue state transactions.
**Touch:** assignment operation repository/tests.
**Done when:** each committed transition increments once; rejected transitions
do not.
**Verify:** lifecycle tests.

## M04-06 — Design MobileActionReceipt model

**Depends on:** M00-09
**Objective:** specify unique action identity, ownership, safe result, revision,
TTL/retention, and indexes.
**Touch:** design note only.
**Done when:** payload secrets/coordinates are excluded and uniqueness scope is
unambiguous.
**Verify:** privacy/concurrency review.

## M04-07 — Add action-receipt Prisma model/migration

**Depends on:** approved M04-06
**Objective:** add schema and one additive migration.
**Touch:** Prisma schema, migration, harness assertions.
**Done when:** replay and populated upgrade pass; unique constraints enforce
idempotency.
**Verify:** disposable migration harness.

## M04-08 — Add action-receipt repository lookup

**Depends on:** M04-07
**Objective:** find a receipt only within authenticated user/installation scope.
**Touch:** repository/tests.
**Done when:** another user/installation cannot replay or observe a result.
**Verify:** multi-user negative tests.

## M04-09 — Add atomic receipt-and-mutation wrapper

**Depends on:** M04-08
**Objective:** serialize concurrent duplicate actions and persist one result in
the same transactional outcome as the mutation.
**Touch:** service/repository transaction/tests.
**Done when:** concurrent duplicates produce one business mutation and the same
safe result.
**Verify:** concurrency test with repeated action ID.

## M04-10 — Add stale-revision validator

**Depends on:** M04-05
**Objective:** compare expected/current revisions within the mutation lock and
return the approved conflict code/state.
**Touch:** assignment operation service/repository/tests.
**Done when:** stale actions cannot mutate and fresh actions succeed.
**Verify:** concurrent Fleet/mobile scenario test.

## M04-11 — Wrap Accept in mobile idempotency

**Depends on:** M04-09, M04-10
**Objective:** expose versioned mobile Accept using existing transition rules.
**Touch:** mobile action service/controller/tests.
**Done when:** first call applies, response-loss retry returns original result,
wrong actor/revision rejects.
**Verify:** HTTP integration tests.

## M04-12 — Wrap Start in mobile idempotency

**Depends on:** M04-11
**Objective:** expose Start without bypassing order/conflict checks.
**Touch:** mobile action service/controller/tests.
**Done when:** duplicate, stale, wrong-sequence, and concurrent crew cases pass.
**Verify:** HTTP integration tests.

## M04-13 — Wrap Complete in mobile idempotency

**Depends on:** M04-12
**Objective:** expose precise-acreage completion and resource release.
**Touch:** mobile action service/controller/tests.
**Done when:** response-loss retry does not duplicate completion/audit/release;
invalid acreage rolls back.
**Verify:** HTTP plus database state assertions.

## M04-14 — Add action-receipt retention job

**Depends on:** M04-09
**Objective:** purge receipts only after the approved retry/support window while
retaining necessary safe audit evidence separately.
**Touch:** repository/job/config/tests.
**Done when:** job is idempotent, bounded, observable, and preserves active
retry receipts.
**Verify:** time-controlled job tests.

## M04-15 — Complete revision/idempotency gate

**Depends on:** M04-04 through M04-14
**Objective:** run migration, lifecycle, concurrency, audit, and web regression
tests.
**Touch:** tests only if needed.
**Done when:** all pass with one mutation/receipt per unique action.
**Verify:** exact counts and database cleanup evidence.

---

# Phase M05 — Bidirectional synchronization

## M05-01 — Design synchronization cursor

**Depends on:** M03-11, M04-15
**Objective:** define opaque cursor ordering, scope, expiry, invalidation, and
full-resync behaviour.
**Touch:** API design documentation only.
**Done when:** cursor cannot expose timestamps/IDs that leak unrelated activity
and remains user/installation scoped.
**Verify:** security/ordering review.

## M05-02 — Add assignment-change repository query

**Depends on:** M05-01
**Objective:** return bounded changed assignments visible to the actor after a
cursor.
**Touch:** repository/tests.
**Done when:** create/update/cancel/reassign-away cases and page limits pass.
**Verify:** multi-user pagination tests.

## M05-03 — Represent access removals/tombstones

**Depends on:** M05-02
**Objective:** tell a device to remove a cached assignment after reassignment,
cancellation, expiry, or access loss without leaking the new owner.
**Touch:** sync service/schema/tests.
**Done when:** a safe tombstone is emitted exactly once per cursor progression.
**Verify:** reassignment-away tests.

## M05-04 — Add changes endpoint

**Depends on:** M05-02, M05-03
**Objective:** expose changed DTOs, tombstones, server time, next cursor, and
full-resync flag.
**Touch:** route/controller/service/tests.
**Done when:** invalid/expired/foreign cursors fail safely and page bounds hold.
**Verify:** HTTP contract tests.

## M05-05 — Design batch-action request validation

**Depends on:** M04-15
**Objective:** define maximum actions, payload sizes, permitted types, order,
and per-action schemas.
**Touch:** validation contract/tests only.
**Done when:** unknown action types/fields and oversized batches reject before
business mutation.
**Verify:** validator tests.

## M05-06 — Implement sequential batch processor

**Depends on:** M05-05
**Objective:** dispatch allowed actions in capture order and return one safe
result per action.
**Touch:** sync application service/tests.
**Done when:** dependency failure stops later dependent actions; retryable
server error preserves remaining work.
**Verify:** mixed-outcome service tests.

## M05-07 — Add batch-actions endpoint

**Depends on:** M05-06
**Objective:** expose authenticated, rate-controlled batch synchronization.
**Touch:** route/controller/tests.
**Done when:** response matches contract and no raw payload enters logs/audit.
**Verify:** HTTP and log-redaction tests.

## M05-08 — Add full-resync endpoint behaviour

**Depends on:** M05-04
**Objective:** provide bounded authoritative replacement when cursor state is
unusable.
**Touch:** sync service/tests.
**Done when:** local cache can reconcile deletions without downloading unrelated
history.
**Verify:** expired-cursor scenario test.

## M05-09 — Add sync rate/budget controls

**Depends on:** M05-04, M05-07
**Objective:** configure bounded read/write sync frequency and batch size.
**Touch:** config/routes/tests.
**Done when:** legitimate reconnect works; abusive polling/batches receive safe
retry information.
**Verify:** focused rate tests.

## M05-10 — Complete sync backend gate

**Depends on:** M05-01 through M05-09
**Objective:** run multi-user, cursor, batch, idempotency, assignment, audit, and
web regression suites together.
**Touch:** tests only if needed.
**Done when:** no missing, duplicate, cross-user, or silently skipped outcome.
**Verify:** exact test counts and disposable DB teardown.

---

# Phase M06 — Location, issue, and completion refinement

## M06-01 — Define foreground location request schema

**Depends on:** M00-08, M00-09
**Objective:** validate assignment/revision/action ID, coordinates, captured-at,
accuracy, and optional provider metadata allow-list.
**Touch:** schema/tests only.
**Done when:** bounds, sizes, stale/future time, NaN/infinity, and unknown fields
are covered.
**Verify:** validator test matrix.

## M06-02 — Add location rate and state policy

**Depends on:** M06-01
**Objective:** allow only assigned crew during approved states at configured
frequency/accuracy.
**Touch:** location service/config/tests.
**Done when:** completed/cancelled/reassigned/wrong-crew submissions reject.
**Verify:** time/state-controlled tests.

## M06-03 — Make location submission idempotent

**Depends on:** M04-09, M06-02
**Objective:** prevent duplicate sample/audit/notification processing for one
action ID.
**Touch:** mobile action service/repository/tests.
**Done when:** repeated and concurrent submissions return original safe result.
**Verify:** concurrency test.

## M06-04 — Verify coordinate-free logs and audit

**Depends on:** M06-03
**Objective:** prove exact coordinates and raw location payloads do not enter
general logs or AuditLog.
**Touch:** redaction tests/minimal logging fix only.
**Done when:** failure and success paths are both inspected.
**Verify:** log/audit capture assertions.

## M06-05 — Define issue categories and request schema

**Depends on:** client/placeholder decision from M00-08
**Objective:** create controlled `DRONE`, `LMV`, `SAFETY`, and approved subtype
values with bounded reason.
**Touch:** validation/domain contract/tests.
**Done when:** unknown asset/category, empty/oversized reason, and foreign
assignment reject.
**Verify:** validator/domain tests.

## M06-06 — Implement issue-report service

**Depends on:** M06-05
**Objective:** record the issue and route it to visible Fleet handling without
giving Pilot unrestricted master-data mutation.
**Touch:** service/repositories/tests.
**Done when:** policy-controlled flag/maintenance outcome, audit, notification,
and rollback are covered.
**Verify:** transactional service tests.

## M06-07 — Add idempotent issue endpoint

**Depends on:** M04-09, M06-06
**Objective:** expose mobile `report-issue` with revision/idempotency.
**Touch:** mobile controller/route/tests.
**Done when:** duplicate/replayed/wrong-crew/stale cases are deterministic.
**Verify:** HTTP integration tests.

## M06-08 — Enforce precise completion acreage

**Depends on:** M04-13
**Objective:** remove float ambiguity from the mobile completion boundary using
the repository's approved decimal representation.
**Touch:** validation/service/tests; schema only through a separate migration if
required.
**Done when:** valid precision passes; negative, zero-policy, overflow, NaN,
string tricks, and excessive scale reject.
**Verify:** boundary test matrix.

## M06-09 — Return next assignment after completion

**Depends on:** M04-13, M06-08
**Objective:** return the next authorized daily assignment summary after atomic
completion.
**Touch:** completion service/DTO/tests.
**Done when:** none/next/cancelled/reassigned cases are correct and do not leak
other crews.
**Verify:** ordered-day tests.

## M06-10 — Complete refined-action gate

**Depends on:** M06-01 through M06-09
**Objective:** run lifecycle, sync, location privacy, issue, completion,
migration, and web regression suites.
**Touch:** tests only if necessary.
**Done when:** all backend mobile actions meet the contract.
**Verify:** exact test counts and clean disposable teardown.

---

# Phase M07 — Application version and backend release safety

## M07-01 — Add validated mobile version configuration

**Depends on:** M03-03
**Objective:** configure minimum/recommended version and maintenance state with
safe defaults.
**Touch:** environment schema/config/tests.
**Done when:** malformed values fail startup; no version is hardcoded in route
logic.
**Verify:** configuration tests.

## M07-02 — Add app-version request parsing

**Depends on:** M07-01
**Objective:** validate application version headers/metadata on mobile routes.
**Touch:** middleware/tests.
**Done when:** missing/malformed/supported/obsolete cases are stable.
**Verify:** middleware matrix.

## M07-03 — Add recommended/required upgrade responses

**Depends on:** M07-02
**Objective:** expose nonblocking recommendation and critical required-upgrade
states in bootstrap and API errors.
**Touch:** middleware/bootstrap/tests.
**Done when:** supported old versions work and blocked versions cannot mutate.
**Verify:** HTTP compatibility tests.

## M07-04 — Add mobile API health/metrics without PII

**Depends on:** M05-10
**Objective:** aggregate auth, sync, conflict, duplicate, and failure metrics.
**Touch:** monitoring service/config/tests.
**Done when:** labels exclude user IDs, phones, assignment/customer IDs, tokens,
and coordinates.
**Verify:** metric-label allow-list test.

## M07-05 — Document API compatibility window

**Depends on:** M07-03
**Objective:** define supported-version deployment and deprecation procedure.
**Touch:** operations/release documentation only.
**Done when:** backend-first compatibility and emergency minimum-version policy
are explicit.
**Verify:** documentation link/diff check.

## M07-06 — Run complete backend mobile acceptance

**Depends on:** M06-10, M07-04, M07-05
**Objective:** run full backend, migration, dependency, container, and mobile
contract gates before app scaffolding relies on them.
**Touch:** no code unless a focused failure fix receives a new task ID.
**Done when:** evidence is recorded and unresolved gaps are explicit.
**Verify:** repository-standard commands from current package/workflow files.

---

# Phase M08 — React Native project foundation

## M08-01 — Record mobile toolchain versions

**Depends on:** M07-06
**Objective:** select supported Node, package manager, React Native/Expo,
TypeScript, JDK, Android Gradle, compile/target/min SDK versions.
**Touch:** mobile decision record only.
**Done when:** versions are mutually supported and current Play target rules are
verified from official sources.
**Verify:** documented source links and compatibility review.

## M08-02 — Scaffold `pilot-mobile`

**Depends on:** M08-01
**Objective:** create a minimal TypeScript Expo application without sample
screens, credentials, or provider integrations.
**Touch:** new `pilot-mobile/` only plus root workspace configuration if needed.
**Done when:** clean install, typecheck, and Android development build start.
**Verify:** lockfile-based install and baseline commands.

## M08-03 — Add mobile lint/type/test scripts

**Depends on:** M08-02
**Objective:** define repeatable local checks using project-local dependencies.
**Touch:** mobile configuration/package scripts.
**Done when:** empty baseline passes and a deliberate fixture failure is detected
before being removed.
**Verify:** run each script separately.

## M08-04 — Establish application folder layers

**Depends on:** M08-02
**Objective:** create empty/ minimal `app`, `components`, `domain`, `services`,
`repositories`, `storage`, `api`, `i18n`, and `config` boundaries.
**Touch:** mobile source only.
**Done when:** dependency-direction lint/test prevents screens importing raw
storage or constructing URLs.
**Verify:** architecture rule test.

## M08-05 — Add validated environment profiles

**Depends on:** M08-02
**Objective:** define local/staging/production identifiers, labels, and fixed API
origins without secrets.
**Touch:** Expo/mobile config and tests.
**Done when:** unknown environment fails; staging is visibly distinct;
production rejects HTTP/arbitrary URLs.
**Verify:** configuration unit tests/build config inspection.

## M08-06 — Add navigation shell

**Depends on:** M08-04
**Objective:** configure routes for login, Today, Upcoming, Sync, Profile/help,
and blocking system states.
**Touch:** mobile navigation/screens with placeholder localized content.
**Done when:** no Admin/Fleet/Sales routes exist and unauthenticated navigation
cannot enter protected screens.
**Verify:** navigation component tests.

## M08-07 — Add localization foundation

**Depends on:** M08-04
**Objective:** set translation-key loading, fallback behaviour, interpolation
safety, and locale persistence.
**Touch:** mobile i18n/config/tests.
**Done when:** no user-facing string is required directly in business screens
and missing keys are caught in tests.
**Verify:** locale/fallback/key-parity tests.

## M08-08 — Add theme/accessibility primitives

**Depends on:** M08-04
**Objective:** establish spacing, typography, contrast, touch size, status icon,
loading, error, and confirmation components.
**Touch:** mobile UI primitives/tests.
**Done when:** status is not color-only and controls meet agreed touch targets.
**Verify:** component/accessibility tests.

## M08-09 — Create physical-device development build

**Depends on:** M08-02 through M08-08
**Objective:** prove the scaffold runs on one emulator and one physical Android
device.
**Touch:** build configuration only if necessary.
**Done when:** environment label/version renders and logs contain no secrets.
**Verify:** record device/Android versions and build result; no distribution.

## M08-10 — Complete foundation gate

**Depends on:** M08-03 through M08-09
**Objective:** run clean install, lint, typecheck, tests, and Android debug build.
**Touch:** focused fixes only.
**Done when:** reproducible from a clean checkout using documented commands.
**Verify:** exact commands/artifact path recorded.

---

# Phase M09 — Mobile API client and secure authentication UI

## M09-01 — Add mobile API transport

**Depends on:** M08-10, M00-10
**Objective:** implement bounded timeout, JSON parsing, stable error mapping,
and fixed environment origin without auth storage yet.
**Touch:** mobile API layer/tests.
**Done when:** network, timeout, malformed JSON, 4xx, and 5xx cases map safely.
**Verify:** mocked transport tests.

## M09-02 — Add secure token store adapter

**Depends on:** M08-10
**Objective:** wrap Android secure storage behind a narrow interface.
**Touch:** mobile secure-storage adapter/tests.
**Done when:** token cannot enter AsyncStorage/SQLite/logs; unavailable secure
storage fails closed.
**Verify:** adapter tests and source search.

## M09-03 — Add installation identity store

**Depends on:** M09-02
**Objective:** generate and retain the app-scoped installation bootstrap value
needed by server enrolment without hardware identifiers.
**Touch:** secure/local storage service/tests.
**Done when:** reinstall/new identity and logout retention policy are explicit.
**Verify:** lifecycle tests.

## M09-04 — Add authenticated API wrapper

**Depends on:** M09-01, M09-02
**Objective:** attach bearer token and safe version/install headers, handle 401,
revoked, and upgrade responses centrally.
**Touch:** mobile API/auth service/tests.
**Done when:** headers/logs never reveal token and retry does not loop endlessly.
**Verify:** mocked request tests.

## M09-05 — Build login form

**Depends on:** M09-04, M08-07, M08-08
**Objective:** validated Pilot email/password submission with generic failures.
**Touch:** login screen/form tests.
**Done when:** password is never persisted/logged; duplicate submit is blocked;
wrong role is handled safely.
**Verify:** component tests.

## M09-06 — Persist successful mobile session

**Depends on:** M09-05
**Objective:** store token securely, safe profile/config locally, then navigate
only after persistence succeeds.
**Touch:** auth use-case/tests.
**Done when:** partial persistence rolls back and token never enters UI state
serialization.
**Verify:** failure-injection tests.

## M09-07 — Restore session on app launch

**Depends on:** M09-06
**Objective:** load token, call `me/bootstrap`, and choose authenticated,
offline-grace, expired, revoked, or upgrade state.
**Touch:** auth state machine/tests.
**Done when:** each state is deterministic without navigation flashing.
**Verify:** state-machine tests.

## M09-08 — Implement logout

**Depends on:** M09-07
**Objective:** call server when possible, clear credentials, apply cache/pending-
action policy, and return to login.
**Touch:** auth use-case/screens/tests.
**Done when:** logout works online/offline and does not silently destroy pending
work contrary to policy.
**Verify:** lifecycle tests.

## M09-09 — Implement logout-all

**Depends on:** M09-08
**Objective:** confirm, revoke all sessions, clear local credential/cache, and
display safe result.
**Touch:** auth use-case/UI/tests.
**Done when:** failed network call does not falsely claim server-wide logout.
**Verify:** online/offline component/use-case tests.

## M09-10 — Build expired/revoked/upgrade screens

**Depends on:** M09-07
**Objective:** provide localized recovery paths for each blocking state.
**Touch:** blocking screens/tests.
**Done when:** no state leaks account existence or bypasses required upgrade.
**Verify:** navigation/state tests.

## M09-11 — Complete authentication app gate

**Depends on:** M09-01 through M09-10
**Objective:** run mobile checks plus backend mobile-auth contract tests.
**Touch:** focused fixes only.
**Done when:** emulator and physical device can login, restore, logout, and
handle revocation against local isolated backend.
**Verify:** automated counts plus sanitized manual evidence.

---

# Phase M10 — Local database and server-to-device synchronization

## M10-01 — Design the local SQLite schema

**Depends on:** M03-11, M05-10, M09-11
**Objective:** specify safe profile/config, assignment, tombstone, cursor,
pending action, action result, and conflict tables.
**Touch:** mobile data design only.
**Done when:** retention, keys, indexes, schema version, and purge semantics are
defined; no password/token column exists.
**Verify:** design review against mobile DTOs.

## M10-02 — Create local database adapter

**Depends on:** approved M10-01
**Objective:** open/configure SQLite and expose transactions behind a storage
interface.
**Touch:** storage adapter/tests.
**Done when:** screens cannot import SQLite directly and transaction rollback is
tested.
**Verify:** adapter tests.

## M10-03 — Add local schema migration 1

**Depends on:** M10-02
**Objective:** create initial tables/indexes deterministically.
**Touch:** one mobile local migration and tests.
**Done when:** fresh install and repeat-open are idempotent.
**Verify:** fresh/reopen tests.

## M10-04 — Add assignment local repository

**Depends on:** M10-03
**Objective:** upsert validated DTOs, query Today/Upcoming, and remove by safe
tombstone.
**Touch:** local repository/tests.
**Done when:** revision ordering prevents older server data overwriting newer
data.
**Verify:** repository ordering tests.

## M10-05 — Add cursor/config local repository

**Depends on:** M10-03
**Objective:** transactionally store cursor/server time/config with assignment
changes.
**Touch:** local repository/tests.
**Done when:** cursor cannot advance if assignment persistence fails.
**Verify:** injected rollback test.

## M10-06 — Implement bootstrap persistence

**Depends on:** M10-04, M10-05
**Objective:** validate and save bootstrap atomically, then expose local reads.
**Touch:** bootstrap repository/use-case/tests.
**Done when:** malformed bootstrap preserves previous valid local state.
**Verify:** schema/failure tests.

## M10-07 — Implement incremental pull synchronization

**Depends on:** M10-06
**Objective:** fetch changes, validate, upsert/tombstone, and advance cursor in
one local transaction.
**Touch:** sync repository/use-case/tests.
**Done when:** pagination, no-change, tombstone, and partial-network failure are
safe.
**Verify:** mocked multi-page tests.

## M10-08 — Implement full resynchronization

**Depends on:** M10-07
**Objective:** replace the authorized assignment cache without deleting pending
actions/conflicts.
**Touch:** sync/local repositories/tests.
**Done when:** expired cursor recovers and unrelated local security data remains
intact.
**Verify:** full-resync failure/retry tests.

## M10-09 — Add synchronization scheduler

**Depends on:** M10-07
**Objective:** trigger bounded pull on login, foreground, manual refresh, and
connectivity restoration with deduplicated in-flight work.
**Touch:** mobile sync orchestration/tests.
**Done when:** no unbounded polling or parallel duplicate pull occurs.
**Verify:** timer/connectivity tests.

## M10-10 — Add local cache retention/purge

**Depends on:** M10-04
**Objective:** purge expired completed/customer-sensitive records according to
approved policy while preserving unresolved actions.
**Touch:** local repository/job/tests.
**Done when:** active/upcoming/conflicted/pending records are preserved.
**Verify:** time-controlled retention tests.

## M10-11 — Complete local pull-sync gate

**Depends on:** M10-01 through M10-10
**Objective:** run storage migration, repository, auth, pull-sync, and clean
Android build tests.
**Touch:** focused fixes only.
**Done when:** assignments remain readable after app and phone restart.
**Verify:** automated checks plus physical restart evidence.

---

# Phase M11 — Mission screens and online actions

## M11-01 — Build Today repository/use case

**Depends on:** M10-11
**Objective:** expose locally ordered assignments for the configured operating
timezone.
**Touch:** domain/use-case tests.
**Done when:** midnight/timezone, sequence, cancelled, and completed ordering are
correct.
**Verify:** fixed-clock unit tests.

## M11-02 — Build Today screen

**Depends on:** M11-01, M08-08
**Objective:** show sequence, window, farmer/farm, crop, acreage, crew, drone,
LMV, mission status, and sync status.
**Touch:** Today components/tests.
**Done when:** empty/loading/error/offline states are accessible and localized.
**Verify:** component/accessibility tests.

## M11-03 — Build Upcoming screen

**Depends on:** M10-11
**Objective:** show bounded future assignments grouped by local operating date.
**Touch:** Upcoming use-case/components/tests.
**Done when:** no historical/unrelated assignment appears.
**Verify:** timezone/grouping tests.

## M11-04 — Build mission details screen

**Depends on:** M11-02
**Objective:** render the approved DTO, last sync, and server-calculated action
hints.
**Touch:** detail components/tests.
**Done when:** absent optional data degrades safely and sensitive fields obey
visibility policy.
**Verify:** component contract tests.

## M11-05 — Add navigation intent service

**Depends on:** M11-04
**Objective:** open installed map/navigation apps using validated coordinates,
with full Plus Code/address fallback.
**Touch:** native-link service/tests.
**Done when:** malformed/missing coordinates cannot generate unsafe URLs.
**Verify:** platform intent unit/manual device tests.

## M11-06 — Build reusable mission-action confirmation

**Depends on:** M11-04
**Objective:** show action, assignment, sequence, and consequences; prevent
double taps and generate one action ID.
**Touch:** component/use-case tests.
**Done when:** cancel/confirm/repeated-tap/accessibility cases pass.
**Verify:** component tests.

## M11-07 — Implement online Accept

**Depends on:** M11-06, M04-11
**Objective:** persist action intent, call mobile API, store receipt/assignment,
and display applied/conflict outcome.
**Touch:** action use-case/repository/UI tests.
**Done when:** no optimistic state is labeled synchronized before receipt.
**Verify:** mocked and isolated-backend tests.

## M11-08 — Implement online Start

**Depends on:** M11-07, M04-12
**Objective:** reuse action pipeline and display order/conflict failures safely.
**Touch:** action use-case/UI tests.
**Done when:** later-sequence rejection refreshes authoritative assignment.
**Verify:** integration tests.

## M11-09 — Build actual-acreage form

**Depends on:** M06-08, M11-06
**Objective:** precise localized decimal input with required validation and
optional bounded note.
**Touch:** form/domain tests.
**Done when:** decimal separator policy, scale, negative, overflow, blank, and
double-submit cases pass.
**Verify:** form test matrix.

## M11-10 — Implement online Complete

**Depends on:** M11-08, M11-09, M04-13
**Objective:** submit completion through action pipeline, store result, and show
next job.
**Touch:** use-case/UI/integration tests.
**Done when:** response-loss simulation does not duplicate and resources release
on server.
**Verify:** end-to-end isolated-backend test.

## M11-11 — Build issue-report form

**Depends on:** M06-07, M11-06
**Objective:** controlled asset/category/reason UI.
**Touch:** form/components/tests.
**Done when:** it never presents unrestricted asset-status controls.
**Verify:** validation/accessibility tests.

## M11-12 — Implement online issue reporting

**Depends on:** M11-11
**Objective:** use action pipeline and show Fleet escalation outcome.
**Touch:** use-case/UI/integration tests.
**Done when:** duplicate, stale, and rejected reports are visible.
**Verify:** mocked and isolated-backend tests.

## M11-13 — Complete online mission gate

**Depends on:** M11-01 through M11-12
**Objective:** exercise login -> Today -> details -> navigate -> accept -> start
-> complete and issue flow on physical device.
**Touch:** focused fixes only.
**Done when:** mobile/backend automated suites and manual sanitized evidence
pass.
**Verify:** exact results recorded.

---

# Phase M12 — Durable offline action queue

## M12-01 — Define pending-action local model/state machine

**Depends on:** M05-07, M10-01
**Objective:** define `PENDING`, `SENDING`, `APPLIED`, `CONFLICT`, `REJECTED`, and
`RETRY` transitions, dependencies, attempts, and TTL.
**Touch:** domain design/tests only.
**Done when:** no state permits silent deletion or endless retry.
**Verify:** transition-table tests.

## M12-02 — Add pending-action local repository

**Depends on:** M12-01, M10-03
**Objective:** insert before network send, query ordered owner actions, and
update outcomes transactionally.
**Touch:** local repository/tests.
**Done when:** action IDs are unique; records survive reopen; cross-user reads
fail.
**Verify:** persistence/ownership tests.

## M12-03 — Add queue size and retention policy

**Depends on:** M12-02
**Objective:** bound queue per account and handle stale noncritical location
versus critical mission actions.
**Touch:** repository/config/tests.
**Done when:** critical actions are never evicted to make room silently.
**Verify:** full-queue tests.

## M12-04 — Save actions before transmission

**Depends on:** M12-02
**Objective:** refactor Accept/Start/Complete/Issue so local persistence precedes
every online attempt.
**Touch:** action use-case/tests.
**Done when:** app termination immediately after tap preserves the action.
**Verify:** failure-injection tests.

## M12-05 — Implement ordered queue flusher

**Depends on:** M12-04
**Objective:** submit bounded batches in dependency order through sync endpoint.
**Touch:** sync use-case/tests.
**Done when:** one flusher runs at a time and server outcomes persist before the
next batch.
**Verify:** concurrency/restart tests.

## M12-06 — Implement retry/backoff policy

**Depends on:** M12-05
**Objective:** retry network/408/429/5xx safely with bounded exponential backoff
and server retry hints.
**Touch:** sync scheduler/tests.
**Done when:** 4xx terminal conflicts do not loop and battery-draining tight
loops are impossible.
**Verify:** fake-clock retry matrix.

## M12-07 — Implement conflict persistence

**Depends on:** M12-05
**Objective:** store conflict code, safe message, current assignment, and
resolution requirement.
**Touch:** local repository/use-case/tests.
**Done when:** conflicts survive restart and contain no raw server payload.
**Verify:** persistence/redaction tests.

## M12-08 — Handle dependent-action blocking

**Depends on:** M12-07
**Objective:** block Start after failed Accept and Complete after failed Start,
while allowing an idempotent already-applied predecessor.
**Touch:** queue domain/tests.
**Done when:** dependency graph outcomes are deterministic.
**Verify:** scenario matrix.

## M12-09 — Trigger flush on connectivity/foreground/manual retry

**Depends on:** M12-06
**Objective:** integrate Android connectivity and app lifecycle without relying
on them as proof the server is reachable.
**Touch:** orchestration/native adapter/tests.
**Done when:** repeated events coalesce and manual retry is available.
**Verify:** event-storm tests and physical toggle test.

## M12-10 — Build Sync Status screen

**Depends on:** M12-07, M12-09
**Objective:** show connectivity, last sync, pending/retry/conflict counts,
version, environment, and manual retry.
**Touch:** Sync screen/tests.
**Done when:** “synced” requires confirmed zero pending/conflicts and recent
server success.
**Verify:** component/state tests.

## M12-11 — Build conflict details/resolution UI

**Depends on:** M12-10
**Objective:** explain rescheduled, reassigned, cancelled, sequence, duplicate,
session, asset, and Fleet-help outcomes.
**Touch:** conflict components/tests.
**Done when:** user can acknowledge only after authoritative refresh; no retry
button appears for terminal unsafe actions.
**Verify:** per-code component tests.

## M12-12 — Preserve queue across logout/reauth correctly

**Depends on:** M12-02, M09-08
**Objective:** isolate pending work by user and prevent the next account from
seeing/replaying it.
**Touch:** auth/storage orchestration/tests.
**Done when:** same-user reauth resumes; different-user login cannot access it;
logout policy is visible.
**Verify:** multi-account lifecycle test.

## M12-13 — Complete offline queue gate

**Depends on:** M12-01 through M12-12
**Objective:** prove no-network, response-loss, app-restart, phone-restart,
server-error, duplicate, conflict, and reauth scenarios.
**Touch:** tests/focused fixes only.
**Done when:** no critical action is duplicated or silently lost.
**Verify:** automated matrix plus physical-device evidence.

---

# Phase M13 — Foreground location on Android

## M13-01 — Add Android location permission declarations

**Depends on:** M00-08, M08-10
**Objective:** request only foreground coarse/fine permissions required by
approved policy.
**Touch:** Android/Expo configuration only.
**Done when:** no background permission exists and manifest inspection matches.
**Verify:** generated manifest inspection.

## M13-02 — Build in-context permission explanation

**Depends on:** M13-01, M08-07
**Objective:** explain purpose when an accepted/in-progress job needs location.
**Touch:** localized UI/tests.
**Done when:** deny/approximate/allow states are understandable and nonblocking
outside the feature.
**Verify:** component and physical permission tests.

## M13-03 — Add foreground location adapter

**Depends on:** M13-01
**Objective:** capture coordinates, timestamp, and accuracy through a narrow
platform interface.
**Touch:** mobile native adapter/tests.
**Done when:** timeout, unavailable, denied, approximate, stale, and success are
mapped without logging coordinates.
**Verify:** adapter tests/device test.

## M13-04 — Add active-mission location coordinator

**Depends on:** M13-03, M11-13
**Objective:** start bounded foreground capture only for authorized active work
and stop on transition/logout/background policy.
**Touch:** application service/tests.
**Done when:** multiple active cards cannot start duplicate capture loops.
**Verify:** lifecycle/fake-clock tests.

## M13-05 — Queue supersedable location actions

**Depends on:** M13-04, M12-13
**Objective:** persist location action before send while safely coalescing old
unsent samples per assignment according to policy.
**Touch:** queue location policy/tests.
**Done when:** mission state actions are never evicted/coalesced.
**Verify:** queue ordering/full-capacity tests.

## M13-06 — Submit idempotent location actions

**Depends on:** M13-05, M06-03
**Objective:** send through batch action pipeline and persist outcome.
**Touch:** sync/action use-case tests.
**Done when:** retry does not duplicate and server rejection is visible.
**Verify:** isolated-backend test.

## M13-07 — Build location status UI

**Depends on:** M13-06
**Objective:** show permission, last captured, pending, synchronized, inaccurate,
or unavailable state without displaying raw debug coordinates by default.
**Touch:** mission/status components/tests.
**Done when:** accessibility/localization states pass.
**Verify:** component tests.

## M13-08 — Measure battery/data behaviour

**Depends on:** M13-07
**Objective:** run configured foreground capture on representative low-end and
current devices.
**Touch:** evidence/report only unless a separate optimization task is approved.
**Done when:** interval, battery, data, and OS-kill observations are recorded
without real customer locations.
**Verify:** sanitized test-route evidence.

## M13-09 — Complete location gate

**Depends on:** M13-01 through M13-08
**Objective:** run permission, lifecycle, queue, privacy, server authorization,
and device tests.
**Touch:** focused fixes only.
**Done when:** foreground-only behaviour is proven and background permission is
absent.
**Verify:** automated results plus manifest/device evidence.

---

# Phase M14 — Localization, accessibility, privacy, and support UI

## M14-01 — Populate English message catalogue

**Depends on:** feature screens complete
**Objective:** replace every user-facing literal with a translation key.
**Touch:** mobile strings/components only.
**Done when:** source scan and key-parity test find no prohibited literals.
**Verify:** i18n lint/test.

## M14-02 — Add client-approved language catalogue template

**Depends on:** M14-01, client language decision
**Objective:** create complete reviewed catalogue structure without machine-
claiming unreviewed translations.
**Touch:** i18n resources/tests.
**Done when:** missing/unreviewed strings visibly fall back safely.
**Verify:** key parity and locale-switch tests.

## M14-03 — Test large text and small screens

**Depends on:** M14-01
**Objective:** remove clipping/overlap for supported font scales and device
widths.
**Touch:** focused layout/styles/tests.
**Done when:** critical action labels and errors remain readable.
**Verify:** screenshot/component matrix.

## M14-04 — Audit touch targets and non-color status

**Depends on:** M14-01
**Objective:** ensure field-operable controls and text/icon status cues.
**Touch:** UI primitives/styles/tests.
**Done when:** automated accessibility and manual review pass.
**Verify:** accessibility suite.

## M14-05 — Add privacy-safe background/app-switch view

**Depends on:** M11-13
**Objective:** prevent avoidable mission/customer exposure in Android recent-app
preview according to approved policy.
**Touch:** app lifecycle/privacy UI/tests.
**Done when:** sensitive screen behaviour is verified on device without breaking
normal screenshots needed for support unless policy forbids them.
**Verify:** physical device test.

## M14-06 — Build Profile/help screen

**Depends on:** M09-11, M12-10
**Objective:** show safe Pilot/centre, app version, environment, last sync,
support route, logout, and logout-all.
**Touch:** screen/tests.
**Done when:** no token/device fingerprint/internal config is displayed.
**Verify:** component response allow-list test.

## M14-07 — Add safe diagnostics export

**Depends on:** M14-06
**Objective:** provide support metadata such as app version, environment, safe
error codes, and timestamps without PII/tokens/coordinates/payloads.
**Touch:** diagnostics service/tests.
**Done when:** explicit key allow-list and redaction tests pass.
**Verify:** generated fixture inspection.

## M14-08 — Complete UX/privacy gate

**Depends on:** M14-01 through M14-07
**Objective:** run i18n, accessibility, device layouts, privacy, diagnostics, and
mobile build gates.
**Touch:** focused fixes only.
**Done when:** all first-release screens are accessible/localizable and privacy
review has no open release blocker.
**Verify:** exact results/evidence.

---

# Phase M15 — Automated end-to-end and destructive offline testing

## M15-01 — Select mobile E2E framework and device target

**Depends on:** M14-08
**Objective:** choose a maintained Android-compatible E2E approach and record
CI/emulator requirements.
**Touch:** decision record only.
**Done when:** it can exercise native permissions, restart, and network state.
**Verify:** minimal proof-of-concept outside production.

## M15-02 — Add deterministic mobile test-data factory

**Depends on:** M15-01
**Objective:** create disposable Pilot/Copilot, centre, drone, LMV, farmer, lead,
and assignment fixtures through test repositories/services.
**Touch:** test-only factory/teardown.
**Done when:** no seed/demo/live data dependence; teardown respects history
constraints.
**Verify:** repeat run on `_test` DB.

## M15-03 — Automate login/bootstrap E2E

**Depends on:** M15-02
**Objective:** verify valid/invalid/disabled/revoked login and bootstrap.
**Touch:** E2E tests only.
**Done when:** UI and backend outcomes match.
**Verify:** emulator test run.

## M15-04 — Automate online mission lifecycle E2E

**Depends on:** M15-03
**Objective:** Today -> detail -> accept -> start -> complete -> next job.
**Touch:** E2E tests.
**Done when:** server DB state, revision, audit, and resource release assertions
pass.
**Verify:** isolated end-to-end run.

## M15-05 — Automate Copilot/shared-state E2E

**Depends on:** M15-04
**Objective:** action by one crew member appears for the other; unrelated Pilot
cannot access.
**Touch:** E2E tests.
**Done when:** actor audit and shared assignment state are correct.
**Verify:** two-session E2E run.

## M15-06 — Automate offline Accept/Start/Complete E2E

**Depends on:** M15-04
**Objective:** disable network, queue actions, restart app, reconnect, and verify
ordered exactly-once outcomes.
**Touch:** E2E tests.
**Done when:** no loss/duplication and UI receipts agree with server.
**Verify:** emulator network-control test.

## M15-07 — Automate response-loss duplicate E2E

**Depends on:** M15-06
**Objective:** drop response after server commit and prove retry returns original
receipt.
**Touch:** test proxy/harness and E2E test only.
**Done when:** one mutation/audit/resource release exists.
**Verify:** database assertions.

## M15-08 — Automate Fleet conflict E2E

**Depends on:** M15-06
**Objective:** reschedule, cancel, and reassign while device is offline, then
sync.
**Touch:** E2E tests.
**Done when:** terminal conflicts are visible and unsafe queued actions do not
apply.
**Verify:** scenario matrix.

## M15-09 — Automate sequence conflict E2E

**Depends on:** M15-04
**Objective:** attempt later job before earlier completion online/offline.
**Touch:** E2E tests.
**Done when:** server and UI consistently block and recover.
**Verify:** two-job scenario.

## M15-10 — Automate location permission/lifecycle E2E

**Depends on:** M13-09, M15-03
**Objective:** deny, approximate, allow, active capture, completion stop, and
logout stop.
**Touch:** E2E tests.
**Done when:** manifest/runtime/server privacy assertions pass.
**Verify:** emulator permission tests.

## M15-11 — Run full application/backend/container gate

**Depends on:** M15-01 through M15-10
**Objective:** run backend, migrations, web regression, mobile, E2E, dependency,
and isolated container checks.
**Touch:** no fixes without new focused task.
**Done when:** all pass and artifacts contain no secrets/customer data.
**Verify:** recorded commands/counts/checksums.

---

# Phase M16 — Mobile CI and internal distribution

## M16-01 — Add mobile CI change detection

**Depends on:** M15-11
**Objective:** run mobile gates when `pilot-mobile` or shared API contracts
change; run affected backend gates too.
**Touch:** CI workflow/tests only.
**Done when:** path filters cannot skip shared-contract changes.
**Verify:** workflow syntax and trigger matrix review.

## M16-02 — Add clean install/lint/type/unit jobs

**Depends on:** M16-01
**Objective:** reproduce local mobile checks from lockfile.
**Touch:** CI workflow.
**Done when:** jobs pass and deliberate temporary failure is detected.
**Verify:** CI run on `dev` only.

## M16-03 — Add Android build job

**Depends on:** M16-02
**Objective:** build unsigned/internal nonproduction artifact using pinned
toolchain/cache.
**Touch:** CI/build config.
**Done when:** artifact is versioned by commit and staging cannot contain
production secrets.
**Verify:** CI artifact inspection.

## M16-04 — Add mobile dependency/secret scanning

**Depends on:** M16-02
**Objective:** include mobile dependencies and generated/build inputs in
existing security gates.
**Touch:** CI/scanner config.
**Done when:** high-severity policy is explicit and no gate is weakened.
**Verify:** CI run and scanner evidence.

## M16-05 — Add application artifact provenance/checksum

**Depends on:** M16-03
**Objective:** publish safe build metadata, checksum, source revision, and
retention.
**Touch:** CI workflow/scripts.
**Done when:** no signing secret or sensitive config appears in artifacts/logs.
**Verify:** artifact inspection.

## M16-06 — Configure staging internal build

**Depends on:** M16-05, approved staging HTTPS endpoint
**Objective:** produce visually marked staging APK/AAB connected only to staging.
**Touch:** build profiles/CI secrets references.
**Done when:** installed build reports staging environment and cannot switch to
production.
**Verify:** physical-device API-origin test.

## M16-07 — Add mobile E2E CI lane

**Depends on:** M15-11, M16-03
**Objective:** run critical E2E flows on controlled emulator/staging-like
isolated stack.
**Touch:** CI workflow/harness.
**Done when:** failures preserve sanitized diagnostics only.
**Verify:** successful and deliberately failing CI evidence.

## M16-08 — Complete CI/internal-build gate

**Depends on:** M16-01 through M16-07
**Objective:** prove `dev` and `staging` workflows, artifact isolation, and
backend/mobile compatibility.
**Touch:** focused CI fixes only.
**Done when:** repeat builds are reproducible and internal installation works.
**Verify:** two consecutive green runs and artifact checksums.

---

# Phase M17 — Play ownership, signing, compliance, and release

## M17-01 — Confirm company Play Console ownership

**Depends on:** organizational decision
**Objective:** record company-controlled account, two admins, MFA, recovery,
support owner, and organization/personal account type.
**Touch:** private operations record, never credentials in Git.
**Done when:** no intern/developer personally owns production distribution.
**Verify:** human access review.

## M17-02 — Approve permanent package name

**Depends on:** M17-01
**Objective:** approve production and staging application IDs before first Play
upload.
**Touch:** canonical placeholder/decision documentation.
**Done when:** company/client ownership and future iOS naming are considered.
**Verify:** human approval.

## M17-03 — Enrol in Play App Signing

**Depends on:** M17-01, M17-02
**Objective:** configure Play signing and company-controlled upload-key process.
**Touch:** external Play/secret systems only under explicit authorization.
**Done when:** recovery is documented privately and no key enters Git/chat.
**Verify:** Play Console confirmation.

## M17-04 — Integrate upload signing into protected CI

**Depends on:** M17-03
**Objective:** use approved secret storage to sign/upload without printing or
persisting keys in runner artifacts.
**Touch:** protected CI/release config.
**Done when:** untrusted PRs cannot access signing credentials.
**Verify:** permission and log/artifact review.

## M17-05 — Enforce version-code/release metadata

**Depends on:** M17-04
**Objective:** prevent duplicate/decreasing Play version codes and associate
release with source/API compatibility.
**Touch:** build/release scripts/tests.
**Done when:** invalid version fails before upload.
**Verify:** CI validation tests.

## M17-06 — Prepare privacy policy and Data Safety inputs

**Depends on:** M00-06, M00-08, M14-08
**Objective:** document actual collected/shared/retained data and deletion paths.
**Touch:** approved legal/product materials; no invented claims.
**Done when:** permissions, location, identifiers, diagnostics, and account data
match implementation.
**Verify:** product/legal review.

## M17-07 — Prepare Play listing/reviewer access

**Depends on:** M17-06
**Objective:** prepare description, screenshots, support, content rating,
reviewer instructions, and controlled nonproduction credentials.
**Touch:** Play assets/config under authorization.
**Done when:** no real Pilot/customer account appears in reviewer material.
**Verify:** listing checklist.

## M17-08 — Verify current target API and permissions

**Depends on:** release candidate
**Objective:** recheck current official Play requirements and generated manifest.
**Touch:** build config only if required through reviewed update.
**Done when:** target API, permissions, exported components, and network security
pass current policy.
**Verify:** bundle/manifest inspection and official-source record.

## M17-09 — Publish Internal Testing release

**Depends on:** M17-04 through M17-08
**Objective:** upload signed AAB to Play Internal Testing for approved testers.
**Touch:** Play Console/CI release only under authorization.
**Done when:** installation/update works and environment is production-candidate
but still uses approved test data/process.
**Verify:** Play bundle explorer and device install evidence.

## M17-10 — Run closed field test

**Depends on:** M17-09
**Objective:** operate with approved Pilots for the required test period and
capture usability, crash, sync, GPS, battery, and support evidence.
**Touch:** operational test records; no feature improvisation.
**Done when:** all release blockers have focused issue/task IDs.
**Verify:** signed acceptance report.

## M17-11 — Production readiness review

**Depends on:** M17-10
**Objective:** review backend compatibility, HTTPS, backup/rollback, monitoring,
privacy, support, Play compliance, and client approval.
**Touch:** release checklist only.
**Done when:** every mandatory gate is PASS or production is blocked.
**Verify:** human approval record.

## M17-12 — Gradual production rollout

**Depends on:** M17-11 and explicit release authorization
**Objective:** release 5–10%, monitor, then deliberately advance 25%, 50%, 100%.
**Touch:** Play production controls only.
**Done when:** each stage meets agreed crash/sync/API thresholds.
**Verify:** monitoring and Play rollout evidence.

---

# Phase M18 — Production support and repeatable updates

## M18-01 — Define incident ownership matrix

**Depends on:** M17-10
**Objective:** assign Admin, Fleet, and technical owners for login, lost device,
missing/wrong assignment, conflict, GPS, completion, and asset issues.
**Touch:** operations documentation.
**Done when:** escalation contacts/process are company-owned and kept out of
public source if sensitive.
**Verify:** operational review.

## M18-02 — Add mobile operational dashboards/alerts

**Depends on:** M07-04, approved monitoring provider
**Objective:** alert on safe aggregate login, API, sync backlog, conflict,
completion, location-rejection, crash/ANR, and version metrics.
**Touch:** monitoring configuration/tests.
**Done when:** alerts are actionable and contain no PII/coordinates/tokens.
**Verify:** synthetic alert delivery.

## M18-03 — Document lost-device response

**Depends on:** M01-08, M18-01
**Objective:** verify identity, revoke installation/session, preserve audit, and
re-enrol replacement device.
**Touch:** operator runbook/tests of supported Admin path.
**Done when:** no raw SQL or account deletion is required.
**Verify:** staging exercise.

## M18-04 — Document routine mobile release procedure

**Depends on:** M16-08, M17-12
**Objective:** codify `dev -> staging -> main`, internal build, acceptance,
backend compatibility, AAB publication, staged rollout, and monitoring.
**Touch:** operations documentation.
**Done when:** another authorized maintainer can repeat it without chat-history
commands.
**Verify:** tabletop walkthrough.

## M18-05 — Exercise backend rollback with installed app

**Depends on:** M17-09
**Objective:** prove a supported installed app works during backend rollback or
enters safe maintenance/retry state.
**Touch:** staging exercise/evidence only.
**Done when:** no data loss/duplicate action occurs.
**Verify:** controlled staging rollback test.

## M18-06 — Exercise mobile release halt/rollback response

**Depends on:** M17-09
**Objective:** stop rollout, use server feature flags, and publish corrective
version without breaking old supported clients.
**Touch:** staging/Play test procedure under authorization.
**Done when:** response times/owners and safe user messaging are known.
**Verify:** tabletop or internal-track exercise.

## M18-07 — Close first-release acceptance

**Depends on:** M18-01 through M18-06
**Objective:** confirm every Definition of Functional Completion item in the
parent plan with evidence.
**Touch:** current engineering state/history documentation.
**Done when:** completed capabilities and deferred work are accurately recorded;
no unsupported “production-ready” claim remains.
**Verify:** final engineering/product/operations review.

---

# 5. Execution dependency map

```text
M00 current baseline evidence
  -> R00 complete client-change consolidation
  -> D00 domain workflow and migration microtasks
  -> W00 web reference workflow microtasks
  -> S00 shared two-app mobile foundation
       -> Pilot Field track
       -> Operations role-slice track
  -> cross-client QA and parity
  -> separate Play releases and operations
```

The old M01–M18 sequence below remains detailed source material for the Pilot
track. It is not executable until R00-09 replaces its dependencies and extracts
shared two-app tasks.

# 6. Lead-agent batch guide

Safe small batches for a capable supervising agent are limited to:

- R00-01 through R00-03 (documentation only);
- R00-05 through R00-06 (analysis/architecture only);
- R00-08 through R00-09 (contract/task replanning only);
- M00-01 through M00-02;
- M00-03 through M00-05;
- M01-06 through M01-08;
- M01-09 through M01-12;
- M02-05 through M02-09 only after services/middleware pass;
- M03-06 through M03-10;
- M08-03 through M08-05;
- M08-06 through M08-08;
- M11-01 through M11-05;
- M14-01 through M14-04; and
- documentation-only M18 tasks.

No old M01–M18 batch is currently authorized while the replanning hold is
active, even if it appears in the list above.

Never batch a Prisma migration, authentication middleware, idempotency
transaction, synchronization processor, secure storage, location permission,
signing, or production release task with another implementation task.

# 7. Completion checklist

The program is complete only when:

- every applicable task is `PASS` with evidence;
- skipped/deferred tasks have explicit product approval and do not leave a
  half-visible feature;
- backend and web regression gates remain green;
- mobile API compatibility is documented and tested;
- offline response-loss and Fleet-conflict cases have end-to-end evidence;
- foreground location privacy is proven;
- signed builds belong to the company;
- staging/field acceptance exists;
- Play rollout is gradual and monitored; and
- support, revocation, update, and rollback procedures are exercised.

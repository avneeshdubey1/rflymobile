# RFLY Android Application Suite Implementation Plan

Current server contract and verified Phase M00 baseline:
[PILOT_MOBILE_BACKEND_BASELINE.md](PILOT_MOBILE_BACKEND_BASELINE.md).
Privacy, session/location placeholders, errors and contract fixtures:
[PILOT_MOBILE_API_CONTRACT.md](PILOT_MOBILE_API_CONTRACT.md).
Draft design workflow and sanitized Stitch handoff:
[RFLY_MOBILE_UI_DESIGN_BRIEF.md](RFLY_MOBILE_UI_DESIGN_BRIEF.md).

**Status:** R00 backend architecture approved; backend packages may proceed in
the replacement dependency order while mobile UI remains a separate prototype
**Prepared:** August 12, 2026
**Revised after client meeting:** August 12, 2026
**Primary target:** two production Android applications backed by the existing
Node.js platform: a dedicated Pilot Field application and a separate RFLY
Operations application for approved non-Pilot roles
**Required sequence:** consolidate the complete client requirement delta,
implement each business capability once in the server, prove it through the web
reference workflow, expose stable mobile contracts, then implement and release
the applicable capability in each mobile application

## 0. Client-meeting architecture revision

The client has changed the mobile scope after the original Pilot-only plan was
prepared:

1. the Pilot/Copilot field workflow remains a dedicated application;
2. the remainder of the approved website workspaces must be available through
   a separate Operations application, with the same server-enforced role
   permissions as the web application;
3. the Pilot assigned to a job must choose the Copilot from an eligible list;
4. the mobile visual direction should be calm, compact and information-led like
   the interaction qualities demonstrated in Zerodha Coin; and
5. further substantial workflow changes from the same meeting are still to be
   captured.

The known backend-facing requirements and conservative defaults are approved in
`MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`. Unlisted future meeting changes
remain excluded until captured; the old M01-M18 sequence must not be executed
as though it were current.

The completed Phase M00 work is retained because it records the current server
and proves existing safety behaviour. It is a comparison baseline, not a claim
that current assignment creation is the new target.

**Execution workbook:** use
[PILOT_ANDROID_APP_MICROTASKS.md](PILOT_ANDROID_APP_MICROTASKS.md) for
dependency-ordered, one-agent-sized implementation tasks. The present document
defines architecture and acceptance; the workbook defines execution units.

## 1. Product objective

Build a shared mobile platform with two separately packaged applications.

### 1.1 Pilot Field application

Build a native mobile application that lets an assigned Pilot or Copilot:

1. sign in securely;
2. download the jobs assigned to that crew member;
3. view the ordered schedule for the day;
4. see the farmer, farm, other crew member, drone, and LMV needed for a job;
5. open the farm coordinates or Plus Code in a navigation application;
6. accept an assignment;
7. start the next permitted assignment;
8. report an aircraft, vehicle, or safety problem;
9. enter the actual sprayed acreage and complete an assignment;
10. perform essential work with intermittent or unavailable connectivity;
11. synchronize safely when connectivity returns; and
12. distinguish pending, synchronized, rejected, and conflicted actions.

The revised workflow also lets the assigned Primary Pilot select an eligible
Copilot before the mission becomes ready for acceptance or start.

### 1.2 RFLY Operations application

Build a separate role-aware application for the non-Pilot operational roles
approved by the client. The exact first-release role list remains a requirement
decision. The design must support Admin, Fleet Manager and Sales without
granting any role another role's authority. Farmer and Business access must not
be added to this employee application unless the client explicitly approves
that product boundary.

The long-term target is functional coverage of approved web workflows, adapted
for a mobile interaction model. It is not a pixel-compressed desktop website,
and complex Admin tasks may be delivered in later role-specific increments
while the web console remains the operational fallback.

Both mobile applications are new clients of the existing platform. Neither is
a WebView wrapper and neither owns a separate operational backend.

```text
React/Vite web application ------------\
Pilot Field Android application --------+--> HTTPS Node.js API --> PostgreSQL
RFLY Operations Android application ---/
```

PostgreSQL remains private to the server. The Android application must never
connect directly to it.

## 1.3 What is shared and what is not

Business capabilities are shared through the server, not by copying screens.

| Change | Web and apps automatically benefit? | Required client work |
|---|---|---|
| Database record or server configuration changes | Yes, after the next API refresh/sync | None if the existing contract remains compatible |
| Server business-rule or permission correction | Yes; the server immediately enforces it for every client | Each UI may need new guidance/error presentation |
| New API field in an existing compatible contract | Only clients that consume it | Add it to the relevant web/app screen |
| New workflow or feature | No automatic screen appears | Implement server once, then implement the applicable web and mobile interfaces |
| Website layout, colour or component change | No | Implement separately in each app or through shared mobile design components |
| Shared wording, feature flag or safe configuration | Yes when deliberately server-driven | Clients must already support that key safely |

The web frontend and both mobile applications should share API contracts,
validation vocabulary, localization resources and design tokens where
practical. They should not share authorization decisions or duplicate the
assignment state machine; those remain server-owned.

## 1.4 Website UI decision

The two-app requirement does not technically force a web UI overhaul. Node.js
is the server technology; the visible website is the React frontend. A Coin-like
mobile interface can be built while preserving the current web layout.

For consistency, this plan recommends a progressive web design-system migration
after the client approves the visual brief:

- define shared colour, typography, spacing, status and icon tokens;
- apply them first to newly changed web workflows;
- migrate existing web pages in reviewed modules rather than performing a
  risky full rewrite; and
- keep functional changes and purely visual changes independently testable.

If the client requires the website itself to match the new mobile visual
direction, that becomes a separate web-redesign workstream with page-by-page
acceptance. Do not infer that requirement solely from the Coin app reference.

Coin is an interaction reference, not a template to copy. RFLY must use its own
branding, assets and domain-specific information architecture. The intended
qualities are restrained colour, strong typography, compact summaries,
list-first navigation, clear status, progressive disclosure, predictable
bottom navigation and minimal visual noise.

## 1.5 Delivery strategy

Do not build both finished apps first and attempt to insert changing business
rules later. Do not wait for every future company feature before creating any
mobile foundation either. Use domain-first vertical slices:

1. capture and approve one client workflow;
2. define its role/permission/state/audit/data contract;
3. implement it once in the Node.js service/repository layer;
4. expose and acceptance-test it in the web reference workflow;
5. add a stable versioned mobile contract;
6. implement it in only the app/roles that need it; and
7. validate web/mobile parity, offline behaviour and staging evidence.

Shared mobile authentication, transport, design tokens and test infrastructure
may be built after the revised role/capability boundaries are approved. Deep
domain features must follow the vertical-slice order above.

## 2. Scope boundaries

### 2.1 Pilot Field first release

- Pilot employee login and session restoration.
- Copilot eligibility list and Primary-Pilot selection workflow.
- Visible pending-crew state and Fleet fallback when selection cannot complete.
- Today and upcoming assignment views.
- Assignment details, schedule order, service window, and navigation.
- Primary Pilot and Copilot visibility.
- Assigned drone and LMV visibility.
- Accept, start, complete, and report-problem actions.
- Actual-acreage capture.
- Foreground location capture for accepted/in-progress work.
- Offline assignment cache and durable action queue.
- Conflict visibility and controlled retry.
- Localization, accessibility, and low-end Android-device support.
- Staging, internal testing, Play signing, gradual production release, and
  operational monitoring.

### 2.2 Operations application release slices

The complete client meeting list must determine the final slice order. The
provisional sequence is:

1. shared employee authentication, profile and safe notifications;
2. Sales customer lookup, customer registration and lead intake;
3. Fleet assignment oversight, crew-selection exceptions and day schedule;
4. operational alerts, resource availability and issue response;
5. Admin user/role controls and approved master-data tasks; and
6. later approved billing, reporting and business workflows.

Every slice needs a role-capability matrix. A menu item being visible in the
website is not evidence that it belongs in every mobile role.

### 2.3 Explicitly deferred until separately approved

- Fleet scheduling or resource reassignment from the Pilot Field application,
  except the narrowly defined Primary-Pilot Copilot-selection action.
- Farmer or Business access inside either employee application.
- Billing approval and settlement.
- Raw drone telemetry processing.
- Route optimization.
- Permanent background location tracking.
- Offline map packages.
- Photo/video evidence until storage and retention rules are approved.
- Push notifications until the provider decision is approved.
- Firebase Authentication or an accidental Firebase dependency.
- iOS release; the architecture should remain portable to iOS later.

### 2.4 Required requirement artefacts before coding resumes

The client meeting must be converted into all of the following:

- a numbered requirement register with source, owner, priority and acceptance;
- a role-capability matrix for web, Pilot Field and Operations applications;
- state diagrams for every changed workflow;
- a web/mobile parity matrix identifying shared server logic and client UIs;
- an approved two-app boundary and first-release role list;
- a Copilot-selection decision record;
- Coin-inspired wireframes/design tokens approved as RFLY branding; and
- the safe Stitch/Figma workflow in
  [RFLY_MOBILE_UI_DESIGN_BRIEF.md](RFLY_MOBILE_UI_DESIGN_BRIEF.md); and
- an updated dependency-ordered microtask workbook.

Unresolved requirements must be explicit placeholders. They must not be filled
by copying current UI behaviour or guessing from the reference application.

### 2.5 Client-change intake format

Record every remaining meeting request before estimating or implementing it.
One row may describe only one independently testable behaviour.

| Field | What to record |
|---|---|
| Requirement ID | Stable identifier such as `CM-2026-08-12-01` |
| Exact client request | The closest available wording from the meeting, message or document |
| Business purpose | The operational problem the client expects it to solve |
| Actors | Every role that creates, views, approves, changes or receives the result |
| Current behaviour | What staging currently does, supported by route/UI/test evidence |
| Target workflow | Ordered happy path plus exception and cancellation paths |
| Authority | Who may initiate, approve, override and close the workflow |
| Data/state impact | Records, states, history, notifications and retention affected |
| Client surfaces | Web, Pilot Field app, Operations app or more than one |
| Offline requirement | Whether the action must work offline and how conflicts are resolved |
| Priority/release | Must-have, later increment or explicitly deferred |
| Open decisions | Questions that must be answered instead of guessed |
| Acceptance evidence | Tests and staging behaviour that prove completion |

After capture, classify each requirement as one of:

- **server/domain first:** changes data, authority, state, conflicts, audit or
  synchronization;
- **client parity:** server capability exists but one or more approved clients
  need a screen and acceptance coverage;
- **presentation only:** layout, navigation or visual-system change with no
  business-rule effect; or
- **future/deferred:** recorded but excluded from the current release.

Pilot-selected Copilot is `server/domain first`, followed by web reference,
Pilot Field implementation and Fleet/Admin exception handling in the Operations
app. It is not a presentation-only mobile task.

## 3. Existing platform baseline

The existing Node.js platform already provides useful Pilot behaviour:

- an authenticated Pilot/Copilot assignment query;
- server-enforced assignment state transitions;
- `SCHEDULED -> PILOT_ACCEPTED -> IN_PROGRESS -> COMPLETED`;
- Pilot/Copilot, drone, and LMV eligibility and conflict checks;
- daily service windows and sequence enforcement;
- assignment acceptance, start, completion, issue/decommission, and location
  endpoints;
- resource release after completion;
- role authorization and audit logging; and
- a browser Pilot dashboard with a limited IndexedDB action queue.

These services and repository rules are the baseline to reuse. The mobile
implementation must not copy or fork the assignment rules into a second
business-logic system. The browser dashboard is a behavioural reference, not a
screen to embed in Android. Its queue is not sufficient evidence for a native,
durable offline implementation.

The current scheduler chooses both Pilot roles before creating an ordinary new
assignment. That creation rule conflicts with the revised client requirement.
Do not conceal the difference in the mobile UI. The domain workflow, database
state, auto-assignment policy, web scheduling UI and tests must change together
before the Pilot selection screen is implemented.

## 4. Operating rules and revised Copilot formation

Preserve these post-formation safety rules as server-enforced contracts:

- Both the Primary Pilot and Copilot can see their shared assignment.
- Either assigned crew member may perform the permitted mission action.
- Each action records which person performed it.
- One person's successful action updates the shared state for both crew
  members.
- Jobs are started in `dailySequence` order.
- A crew/drone/LMV unit cannot have two simultaneous in-progress jobs.
- Actual acreage is required for completion.
- Completion releases the drone and LMV without waiting for billing.
- Fleet Manager/Admin control initial scheduling, resource reservation,
  exception handling and reassignment. The assigned Primary Pilot controls only
  the approved Copilot-selection step.
- The mobile application never bypasses service-area or resource validation.
- Location is collected only when operationally justified and never copied to
  ordinary audit logs.
- The server remains authoritative when an offline device and Fleet disagree.

Any change to these rules requires an explicit product decision and coordinated
changes to the web application, server, mobile application, tests, and
documentation.

### 4.1 Target Copilot-selection workflow

The recommended target is a two-stage assignment rather than allowing the app
to overwrite `copilotId` directly:

1. Fleet/manual or automatic scheduling selects the Primary Pilot, Drone, LMV,
   operating centre and service window.
2. The server creates a revision-protected provisional assignment with a
   dedicated `PENDING_COPILOT_SELECTION` crew-formation state. It reserves the
   selected resources but cannot be accepted or started.
3. Only the assigned Primary Pilot may request eligible Copilot candidates.
4. The server returns a minimal candidate DTO from the same operating centre
   after checking active role, archive state, licence/compliance, service-window
   conflicts, daily limits and any approved pairing restrictions.
5. The Primary Pilot submits one candidate with expected assignment revision
   and unique action ID.
6. Inside one serialized transaction, the server rechecks actor, assignment,
   candidate and conflicts, records the Copilot, advances crew formation to
   `READY`, increments revision, writes coordinate/credential-free audit and
   history, and creates the approved notification/follow-up.
7. The selected Copilot then sees the shared assignment. Neither crew member
   may bypass sequence, resource or mission-state rules.
8. If selection expires, conflicts, or has no candidate, the assignment enters
   a visible Fleet exception queue; it is never silently dropped.
9. Fleet/Admin may override or replace the selection only through an audited,
   reason-required path and only before mission start unless an emergency
   workflow is separately approved.

Do not use Lead lifecycle status alone for crew formation. Keep mission state
and crew-formation state explicit so a provisional reservation cannot be
mistaken for an executable job. Existing legacy nullable-Copilot rows require a
reviewed additive migration/backfill strategy.

### 4.2 Copilot decisions still required from the client

- Does the selected Copilot have to accept the nomination before `READY`?
- How long may the Primary Pilot take to choose?
- May the Primary Pilot choose only within the same operating centre?
- Is Fleet/Admin approval required after selection, or only for overrides?
- Can a preferred crew pairing be saved, and who owns it?
- What happens when the Primary Pilot does not select anyone?
- Can the Copilot decline, and how many replacements are permitted?
- At what point are Drone and LMV reservations allowed to expire?
- May Copilot change after acceptance, and what is the emergency process?

The maintainer approved conservative v1 answers for these decisions in
`MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md`. Future client revisions must be
recorded as new decisions and must not silently change the implemented v1
state machine.

---

# Part I — Existing Node.js application preparation

The detailed `MOB-BE`, `MOB-APP`, QA and release sections below remain source
material for the Pilot Field track. Execute the replacement D00/W00/S00/P00/
P10/O00/O10/Q00 packages instead. Shared infrastructure must serve both apps
through one reviewed implementation rather than parallel authentication stacks.

The Operations application needs its own screen/module decomposition after the
role-capability and web/mobile parity matrices are approved. Do not mechanically
copy every web route into mobile tasks.

## MOB-BE-00 — Freeze and test the current Pilot contract

### Work

- Inventory every current Pilot route, service, repository method, database
  field, state transition, and authorization rule.
- Add focused regression tests for Primary Pilot and Copilot behaviour.
- Record the safe data that a mobile client actually requires.
- Identify browser-specific assumptions, including cookies, CSRF, IndexedDB,
  navigation, and geolocation.

### Acceptance

- Existing web Pilot behaviour is covered by regression tests.
- No mobile work weakens web authentication or assignment policy.
- Product rules in section 4 are represented in server tests.

## MOB-BE-01 — Introduce a versioned mobile API

Create a stable mobile contract, initially under:

```text
/api/mobile/v1
```

Proposed surface:

```text
POST /api/mobile/v1/auth/login
POST /api/mobile/v1/auth/logout
POST /api/mobile/v1/auth/logout-all
GET  /api/mobile/v1/me

GET  /api/mobile/v1/bootstrap
GET  /api/mobile/v1/assignments
GET  /api/mobile/v1/assignments/:id

POST /api/mobile/v1/assignments/:id/accept
POST /api/mobile/v1/assignments/:id/start
POST /api/mobile/v1/assignments/:id/complete
POST /api/mobile/v1/assignments/:id/report-issue
POST /api/mobile/v1/assignments/:id/location

GET  /api/mobile/v1/sync/changes
POST /api/mobile/v1/sync/actions
```

Controllers must call the existing service and repository layers. Controllers
and routes must not access Prisma directly.

### Acceptance

- Responses are documented and validated.
- Machine-readable error codes are stable.
- Web response changes cannot accidentally redefine the mobile API.
- `/v1` remains backward compatible throughout the first release lifecycle.

## MOB-BE-02 — Add native mobile authentication

The browser currently uses an opaque server session in secure cookies with CSRF
protection. Native Android requires an explicit non-cookie client contract.

Use an opaque mobile bearer session:

- Generate a cryptographically random token on successful login.
- Store only its hash on the server.
- Return the raw token only once.
- Store the token on Android only through secure platform storage.
- Send it through the `Authorization` header.
- Keep browser cookie sessions unchanged.
- Revalidate active status, archived status, role, authentication version,
  idle expiry, and absolute expiry on every protected request.
- Support one-device logout and logout-all.
- Revoke mobile sessions after password or identity changes.

Do not introduce long-lived stateless JWTs merely for convenience.

### Session metadata

- user ID;
- client type (`ANDROID`);
- installation ID;
- safe device label, if supplied;
- application version;
- created, last-used, idle-expiry, and absolute-expiry times; and
- revocation time and reason.

### Acceptance

- A stolen, expired, revoked, disabled, or wrong-role session is rejected.
- Raw tokens, password values, and hashes never enter logs or AuditLog.
- Web and mobile sessions can be revoked independently and together.

## MOB-BE-03 — Register and revoke installations

Create a privacy-minimized mobile-installation identity.

Store only:

- server-generated installation ID;
- owning user;
- platform;
- app version;
- first/last seen timestamps; and
- active/revoked state.

Do not collect IMEI, hardware serial numbers, advertising identifiers, or other
unnecessary permanent identifiers.

An approved Admin operation should eventually revoke a lost installation
without deleting the Pilot account.

## MOB-BE-04 — Define the mobile bootstrap contract

After login, one bootstrap request should return:

- safe Pilot profile;
- operating centre;
- current server time and operating timezone;
- bounded current/upcoming assignment window;
- feature flags;
- API version;
- minimum and recommended app versions;
- initial synchronization cursor; and
- safe mobile policy values.

The response must not expose unrelated users, customer histories, database
details, secrets, or privileged configuration.

## MOB-BE-05 — Define the mobile assignment DTO

Return only the operationally necessary assignment data:

- assignment and lead identifiers;
- assignment revision;
- status and daily sequence;
- service-window start/end;
- farmer display name and operational contact number;
- farm address, full Plus Code, latitude, and longitude;
- crop, expected acreage, and actual acreage;
- Primary Pilot and Copilot display data;
- drone code/serial;
- LMV registration/label;
- operating centre;
- safe operational notes;
- last server-update time; and
- server-calculated `allowedActions`.

The application uses `allowedActions` to render controls, but the server must
authorize and validate the action again.

## MOB-BE-06 — Add assignment revisioning

Offline actions can arrive after Fleet changes an assignment. Add a monotonic
assignment revision or equivalent optimistic-concurrency value.

Each mutation supplies:

- assignment ID;
- expected revision;
- unique client action ID;
- installation ID obtained from authentication context;
- capture time;
- action type; and
- action payload.

Reject or reconcile stale actions after cancellation, reassignment,
rescheduling, resource-state changes, earlier crew actions, or sequence changes.
Return the current safe assignment state and a machine-readable conflict code.

## MOB-BE-07 — Make every mobile mutation idempotent

Persist a mobile-action receipt containing:

- unique client action ID;
- installation, user, and assignment IDs;
- action type;
- received time;
- safe outcome code; and
- resulting assignment revision.

A retry of the same action returns the original result. It must not duplicate:

- completion;
- acreage changes;
- resource release;
- issue reports;
- location samples; or
- audit events.

## MOB-BE-08 — Implement ordered batch action synchronization

Allow a device to upload queued actions in their original order, for example:

```text
ACCEPT -> START -> LOCATION -> COMPLETE
```

Return one outcome per action:

- `APPLIED`;
- `ALREADY_APPLIED`;
- `CONFLICT`;
- `REJECTED`; or
- `RETRY_LATER`.

Do not silently apply a later dependent action after an earlier action fails.
An already-applied idempotent action may allow processing to continue.

## MOB-BE-09 — Implement incremental server-to-device sync

Provide cursor-based changes instead of returning all history on every refresh.
The response should contain:

- new or changed assignments;
- assignments removed from the user's access;
- cancellations and reschedules;
- server time;
- next cursor; and
- a full-resynchronization flag when necessary.

The server remains the source of truth. The Android database is a bounded
offline working copy.

## MOB-BE-10 — Harden location capture

Validate:

- authenticated crew membership;
- active assignment state;
- latitude/longitude bounds;
- capture time;
- accuracy;
- stale or implausibly future readings;
- configured submission interval; and
- assignment completion/cancellation.

Privacy rules:

- Start with foreground capture only.
- Denied permission must not make unrelated screens unusable.
- Exact coordinates do not enter ordinary AuditLog or general application logs.
- Retention and access policy must be approved before retaining a route history.
- Stop capture after completion, cancellation, reassignment, logout, or session
  revocation.

## MOB-BE-11 — Replace broad decommissioning with issue reporting

The Pilot UI should submit an operational problem:

- assignment;
- asset category (`DRONE`, `LMV`, or `SAFETY`);
- controlled issue type;
- required bounded reason;
- capture time; and
- optional evidence reference only after evidence storage is approved.

Server policy determines whether the asset becomes flagged, in maintenance, or
out of service. A Pilot cannot directly rewrite fleet master data.

## MOB-BE-12 — Finalize completion behaviour

Completion requires:

- an in-progress assignment;
- the authenticated actor in its crew;
- matching revision;
- a unique action ID;
- valid precise actual acreage;
- satisfied daily-order rules; and
- optional bounded completion notes.

Completion must atomically:

- move the lead to `COMPLETED`;
- save the actor and completion time;
- preserve actual acreage precisely;
- release drone and LMV;
- increment assignment revision;
- write one coordinate-free audit event; and
- return the next scheduled job.

It must not calculate an invoice or payment.

## MOB-BE-13 — Add mobile API abuse and privacy controls

Test and enforce:

- another crew's assignment is inaccessible;
- assignment-ID substitution fails;
- revoked installation/session fails;
- replayed actions remain idempotent;
- stale revision returns a conflict;
- inactive work rejects location;
- payload sizes and field lengths are bounded;
- login, sync, and location requests are rate-controlled;
- no credentials, full phones, or exact coordinates leak into logs; and
- deactivated users cannot retain server access.

## MOB-BE-14 — Add application/API compatibility policy

The server publishes:

- current API version;
- minimum supported app version;
- recommended app version;
- maintenance state; and
- optional feature-disable flags.

Backend releases must remain compatible with installed supported mobile
versions. An upgrade-required response is reserved for incompatible or critical
security situations.

## MOB-BE-15 — Backend acceptance gate

Do not declare backend preparation complete until tests prove:

- login, expiry, logout, and installation revocation;
- Primary Pilot/Copilot access and isolation;
- minimal assignment DTOs;
- ordered state transitions;
- idempotent success and response-loss retry;
- stale-revision conflict behaviour;
- ordered batch replay;
- cancellation/reschedule/reassignment conflicts;
- location restrictions;
- issue reporting;
- completion and resource release;
- safe audit/log behaviour; and
- continued web-client compatibility.

---

# Part II — Android application development

## MOB-APP-00 — Create the application workspace

Add a separately testable workspace:

```text
backend/
frontend/
pilot-mobile/
```

Recommended foundation:

- React Native with Expo development builds;
- TypeScript;
- Expo Router;
- a maintained server-state/query library;
- SQLite for structured offline data;
- Android secure storage for credentials and encryption keys;
- schema-validated API and form inputs; and
- localization from the first screen.

Do not build a WebView wrapper around the web application.

## MOB-APP-01 — Separate application environments

Maintain local, staging, and production application identities, for example:

```text
com.rfly.pilot.dev
com.rfly.pilot.staging
com.rfly.pilot
```

Each environment has:

- a distinct display name/visual indicator;
- a fixed approved API URL;
- isolated installation and session data; and
- no secrets embedded in source or public build configuration.

Production must use HTTPS. A build must never allow the Pilot to type an
arbitrary production API URL.

## MOB-APP-02 — Prepare Android tooling

Install and document:

- compatible Node.js and package manager;
- Android Studio;
- Android SDK and emulator;
- supported JDK;
- Expo/EAS tooling;
- USB debugging and Logcat; and
- at least one physical Android field-test phone.

VS Code/Codex may remain the primary editor. Android Studio is the SDK,
emulator, native debugging, Gradle, profiling, and release-build tool.

## MOB-APP-03 — Enforce mobile layers

```text
Screens/components
        |
Application/use-case services
        |
Repositories
      /   \
 SQLite   Mobile API
```

Screens must not directly construct API URLs, store tokens, write SQL, or
implement assignment authorization/state machines.

## MOB-APP-04 — Define bounded local storage

Store only:

- cached safe profile;
- bounded current/upcoming assignments;
- assignment revisions;
- synchronization cursor;
- pending actions;
- action outcomes/conflicts; and
- safe mobile configuration.

Do not retain passwords, unrelated assignments, complete customer histories,
provider secrets, privileged configuration, or unnecessary financial data.

Protect sensitive local values with a key held by Android secure storage.
Purge operational cache on approved expiry, logout, revocation, or user change;
never discard unsynchronized actions without an explicit safe resolution.

## MOB-APP-05 — Build authentication and session recovery

Screens/states:

- Pilot login;
- secure session restoration;
- expired session;
- revoked device;
- disabled account;
- required-upgrade state;
- logout; and
- logout-all.

Cached assignments may remain visible offline after a previously valid login
within approved policy. Synchronization resumes only after the server accepts
the session. Offline work must not be lost merely because reauthentication is
required.

## MOB-APP-06 — Bootstrap and initial synchronization

After login:

1. call bootstrap;
2. validate the response;
3. persist it transactionally;
4. render from SQLite;
5. fetch incremental changes; and
6. display the last successful sync time.

## MOB-APP-07 — Create minimal navigation

First release navigation:

1. Today
2. Upcoming
3. Sync status
4. Profile/help

Do not reproduce staff administration screens.

## MOB-APP-08 — Build the daily mission queue

Display server-controlled order with:

- sequence number;
- service window;
- farmer and farm;
- crop and expected acreage;
- crew, drone, and LMV;
- mission status; and
- synchronization state.

Visually distinguish scheduled, accepted, in-progress, completed, cancelled,
rescheduled, pending-local, and conflicted work. Keep the active mission
prominent.

## MOB-APP-09 — Build mission details and navigation

Show:

- operational contact information;
- address and full Plus Code;
- coordinates;
- navigation action;
- schedule/sequence;
- acreage and crop;
- crew;
- drone and LMV;
- safe notes;
- last synchronization time; and
- server-permitted next action.

Coordinates are the authoritative navigation destination. The application may
offer installed navigation applications. An embedded map may use a properly
licensed MapLibre/OpenStreetMap configuration. Google Maps is not required just
to launch navigation.

## MOB-APP-10 — Build mission actions

```text
SCHEDULED      -> Accept
PILOT_ACCEPTED -> Start
IN_PROGRESS    -> Complete or Report problem
```

For every action:

1. validate basic input locally;
2. show the affected assignment;
3. prevent accidental duplicate taps;
4. generate one unique action ID;
5. save the action locally before attempting transmission;
6. submit when possible; and
7. show pending, applied, or conflict status.

Local UI state is never proof that the server applied an action.

## MOB-APP-11 — Build completion capture

- Require precise actual acreage.
- Permit a bounded optional note.
- Show whether a current location is available.
- Confirm completion explicitly.
- Save locally before transmitting.
- Present the authoritative server result.
- Open the next job after successful synchronization.

## MOB-APP-12 — Build equipment/safety issue reporting

Provide controlled categories, required description, confirmation, and sync
status. Label the operation **Report issue**, not **Decommission asset**.

## MOB-APP-13 — Implement the offline-first repository

All mission screens read from SQLite. Network responses update SQLite first,
then reactive views update.

Actions must survive:

- application restart;
- phone restart;
- short and extended network loss;
- switching Wi-Fi/mobile data; and
- temporary backend unavailability.

Queue writes in capture order, apply exponential backoff with limits, and avoid
battery-intensive polling.

## MOB-APP-14 — Implement conflict resolution

Never silently remove a rejected action. Explain safe outcomes:

- Fleet rescheduled the job;
- another crew now owns it;
- the job was cancelled;
- an earlier job must be completed;
- the action was already recorded;
- the session requires sign-in;
- the asset is no longer operational; or
- Fleet Manager assistance is required.

Refresh the authoritative assignment while retaining a safe local conflict
record until acknowledged.

## MOB-APP-15 — Build the synchronization centre

Display:

- online/offline state;
- last successful sync;
- pending actions;
- conflicts;
- manual retry;
- application version;
- environment; and
- safe server-health state.

Never display “synchronized” before server confirmation.

## MOB-APP-16 — Add foreground location behaviour

- Ask permission in context when a mission needs it.
- Explain why it is requested.
- Support approximate/denied permission gracefully.
- Avoid continual capture outside an active assignment.
- Stop immediately when the operational justification ends.
- Show a clear location/sync state without exposing raw logs.

## MOB-APP-17 — Add localization and field accessibility

- Use translation keys for every visible string.
- Add client-approved languages.
- Use large touch targets and outdoor-readable contrast.
- Do not rely on colour alone.
- Support larger system text.
- Provide clear confirmations and error recovery.
- Test small screens and low-cost devices.

## MOB-APP-18 — Notification boundary

First release uses existing approved channels plus in-app refresh/manual sync.
Do not reintroduce Firebase silently for push notifications. Any push provider
requires a separate approved architecture, privacy, credentials, and delivery
decision.

---

# Part III — Verification and acceptance

## MOB-QA-00 — Automated tests

- Type and lint checks.
- Application/use-case unit tests.
- Repository and local database tests.
- Local database migration tests.
- Offline queue ordering, durability, and size-limit tests.
- API contract tests generated or checked against the server contract.
- Authentication and revocation tests.
- Conflict-state rendering tests.
- Localization completeness checks.
- Component interaction and accessibility tests.
- Android debug and release build checks.

## MOB-QA-01 — End-to-end flows

Automate against an isolated staging database:

1. login and bootstrap;
2. receive assignments as Primary Pilot and Copilot;
3. accept, start, and complete;
4. report an issue;
5. synchronize offline actions;
6. receive a reschedule/cancellation;
7. revoke the installation;
8. logout and logout-all; and
9. reject access to another crew's assignment.

## MOB-QA-02 — Offline failure matrix

Verify:

- network disabled before Accept;
- response lost after server applies Start or Complete;
- application/phone restart with pending actions;
- session expiry while offline;
- Fleet cancellation, reschedule, or reassignment while offline;
- Copilot acts before Primary Pilot synchronizes;
- queue limit reached;
- incorrect device clock;
- duplicate action submission; and
- backend unavailable during a working day.

Expected outcomes must be deterministic and visible. No action may disappear
without an applied receipt or user-visible terminal conflict.

## MOB-QA-03 — Device matrix

- Low-memory/low-cost Android phone.
- Current representative Android phone.
- Oldest supported Android version.
- Small screen and large system font.
- Weak/slow mobile data.
- GPS denied and approximate-only modes.
- Battery saver.
- Background/foreground transitions.
- Android process termination.
- Supported application languages.

## MOB-QA-04 — Security and privacy review

- Token remains in secure storage.
- Password is never persisted.
- No production secret exists in the application package.
- TLS failures are not bypassed.
- Revoked devices lose server access.
- Mobile role cannot access Admin/Fleet/Sales endpoints.
- Cache retention and purge behave as approved.
- Logs contain no credentials, full phone numbers, or exact coordinates.
- Screenshot/background-preview policy is reviewed for mission data.
- Requested Android permissions are minimal and justified.

## MOB-QA-05 — Controlled field pilot

1. Use an approved small Pilot group.
2. Begin with staging and controlled assignments.
3. Run at least one complete operational day.
4. Measure login, sync, GPS, battery, and conflict behaviour.
5. Confirm Fleet observes all actions correctly.
6. Confirm Primary Pilot/Copilot interactions.
7. Record user confusion and support incidents.
8. Fix release-blocking findings before production rollout.

---

# Part IV — CI/CD and Google Play release

## MOB-REL-00 — Branch and environment flow

```text
dev -> reviewed promotion -> staging -> accepted promotion -> main
```

- `dev`: mobile CI and developer builds.
- `staging`: internal Android build connected only to staging API/data.
- `main`: approved production AAB connected only to production HTTPS API.

Mobile and backend changes that form one contract must be tested and promoted
together without breaking the currently supported installed version.

## MOB-REL-01 — CI gates

- Reproducible dependency install.
- Type checking and linting.
- Unit, repository, component, and API-contract tests.
- Secret and dependency scanning.
- Android debug/release build verification.
- Unique version-code enforcement.
- Artifact checksum, provenance, and retention.
- Trigger affected backend gates for shared API changes.

## MOB-REL-02 — Company ownership and signing

- Play Console belongs to the company/client, not an individual developer.
- Fix the permanent package name before first upload.
- Enable MFA and at least two company-controlled administrators.
- Enrol in Play App Signing.
- Protect and back up upload-key recovery information.
- Keep upload credentials only in approved CI secret storage.
- Never commit signing keys or passwords.

## MOB-REL-03 — Artifacts and versioning

- APK: controlled internal/direct installation where approved.
- AAB: Google Play testing and production.
- Increment Android `versionCode` for every uploaded release.
- Record semantic version, source commit, environment, build time, and API
  compatibility version.

## MOB-REL-04 — Play compliance

Prepare:

- privacy policy;
- Data Safety declaration;
- account/data-deletion procedure where applicable;
- location and permission justification;
- content rating and target audience;
- support contact;
- store description and screenshots;
- reviewer instructions and controlled test credentials;
- current target API compliance; and
- supported-device declaration.

Recheck Play requirements immediately before release because target API and
testing rules change.

## MOB-REL-05 — Controlled rollout

```text
Internal testing
-> Closed Pilot testing
-> Production approval
-> 5-10% rollout
-> Monitor
-> 25%
-> 50%
-> 100%
```

Do not distribute the first production build to every Pilot at once.

## MOB-REL-06 — Monitoring

Monitor safe aggregate signals for:

- login and revocation failures;
- mobile API errors/latency;
- sync backlog and conflicts;
- idempotent duplicates;
- assignment download and completion failure;
- location rejection;
- crashes/ANRs;
- app-version distribution; and
- unsupported versions.

Telemetry must not contain tokens, passwords, full phones, or exact locations.

## MOB-REL-07 — Rollback and compatibility

Maintain:

- previous compatible backend image;
- previous mobile release;
- server feature flags for risky mobile functions;
- compatibility with supported older installed applications;
- reversible/expand-contract database migrations; and
- a critical-only minimum-version block.

An Android release cannot be rolled back as instantly as a web deployment,
because older versions remain installed on devices.

---

# Part V — Production operation

## MOB-OPS-00 — Support ownership

Document who handles:

- login or lost-device problems;
- missing/wrong assignments;
- Fleet rescheduling;
- sync conflicts;
- GPS problems;
- rejected completion;
- drone/LMV/safety issues; and
- technical incidents.

Separate Admin, Fleet, and technical-support responsibilities.

## MOB-OPS-01 — Routine release process

1. Develop on `dev`.
2. Run mobile and affected backend CI.
3. Review API compatibility.
4. Promote to `staging`.
5. Publish the internal Android build.
6. Complete staging/device acceptance.
7. Promote the compatible backend to `main`.
8. Publish the production AAB.
9. Roll out gradually.
10. Monitor supported old and new app versions.

## MOB-OPS-02 — Post-release candidates

Consider only after the core application has field evidence:

- approved photo/evidence upload;
- offline maps;
- justified background location;
- approved push notifications;
- safety/chemical/battery checklists;
- signature capture;
- inventory support;
- route assistance;
- billing evidence; and
- vendor-approved telemetry integration.

---

# Part VI — Revised ordered implementation packages

| Package | Work | Exit condition |
|---|---|---|
| R0 | Complete client-meeting intake, role-capability matrix, parity matrix, Copilot decisions and RFLY/Coin-inspired design brief | Requirements have identifiers, owners, acceptance and explicit unresolved placeholders |
| D0 | Implement Copilot formation and other changed domain workflows in Node.js with migrations, authorization, audit and focused tests | Domain rules pass independently of any UI |
| W0 | Implement and acceptance-test each changed workflow in the React web application | Web is the operational reference and staging fallback |
| S0 | Generalize mobile installation/session, API transport, contracts, design tokens and CI for two apps | Shared foundation passes without granting role capabilities |
| PF1 | `MOB-BE-01` onward plus Pilot Field UI, offline, location and Copilot-selection slices | Signed Pilot Field build passes device and field acceptance |
| OP1 | Operations app authentication plus Sales/Fleet/Admin slices in approved priority | Each role sees and can perform only approved workflows |
| UX1 | Progressive web token/component migration if separately approved | No functional regression and client signs off each converted module |
| Q0 | Web, both apps, backend, offline/conflict, privacy, accessibility and device gates | Cross-client state and permission parity proven |
| REL | Separate signed, compliant, monitored Play releases and support/rollback operations | Company-owned gradual rollout for both package IDs |

Packages are sequential acceptance boundaries. Requirements/design exploration
may overlap, but functional app screens must not precede their domain and web
reference workflow. A feature is not complete merely because it exists in one
client; its parity matrix must state whether the other clients intentionally
support, defer or exclude it.

# Part VII — Definition of functional completion

The mobile suite is functional only when the shared foundation, Pilot Field
application and approved Operations slices meet their defined scope:

- A real Pilot and Copilot can install a signed build and authenticate.
- Each sees only assigned, operationally relevant work.
- Today's jobs appear in authoritative sequence with farm navigation.
- Accept, start, issue report, and complete work online.
- The same actions survive response loss, no network, app restart, and phone
  restart without duplication or silent loss.
- Fleet reschedule/cancel/reassign conflicts are safely visible.
- Actual acreage and completion update the web platform and release resources.
- Revoked sessions/devices lose access.
- Production uses HTTPS and contains no embedded secrets.
- Automated mobile/backend gates pass.
- Physical-device and field-pilot acceptance is recorded.
- The Play release is company-owned, signed, compliant, gradual, and monitored.
- A documented support and rollback procedure exists.
- Admin/Fleet/Sales mobile capabilities match the approved role matrix and
  cannot cross role boundaries.
- A business action performed through web or either app produces one shared
  server state visible to the other applicable clients after refresh/sync.
- The Primary Pilot can select only an eligible Copilot through the audited,
  revision-safe server workflow, with Fleet fallback for failure.
- Website-only, Pilot-only and Operations-only capabilities are explicitly
  identified rather than silently missing.

# Part VIII — Decisions required before activation

These do not block early backend planning, but they block the corresponding
release capability:

- final company-owned Play Console account and package name;
- production HTTPS domain/API endpoint;
- minimum supported Android version/device profile;
- approved mobile session idle/absolute lifetime;
- exact customer-contact exposure policy for Pilots;
- exact location capture frequency and retention;
- approved Pilot languages;
- issue categories and Fleet escalation ownership;
- supported offline retention period;
- privacy policy and Data Safety owner;
- mobile monitoring/crash provider;
- whether/when push notifications or evidence uploads are approved;
- complete client meeting requirement list and priority;
- Operations app first-release roles and modules;
- answers to every Copilot-selection decision in section 4.2;
- whether Coin-inspired styling applies only to mobile or also to the web
  frontend; and
- approved RFLY wireframes, branding tokens and accessibility targets.

Until those values are supplied, implement configurable safe defaults and keep
provider-dependent functionality disabled.

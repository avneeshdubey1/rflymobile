# Google Stitch Mobile Design Handoff (V1 Scratch)

**Status:** copy/paste design prompt and acceptance contract
**Audience:** Google Stitch or another design-generation agent
**Scope:** Initial from-scratch design generation for two separate Android applications
**Authority:** design only; this file does not authorize application, API, database, deployment or production-data changes

## 1. How to use this handoff

Paste the complete contents of this document into a **brand new** Stitch chat. Supply only synthetic data. Do not upload the repository, source code, live screenshots, credentials, customer records, staff records, exact coordinates, Plus Codes, server addresses or API tokens.

Stitch must produce a reviewed design specification and image export. It must not be asked to generate production React, HTML, React Native, backend or database code. Any generated code is disposable design evidence and must not be imported into the application repository.

The expected output is two visibly related but **strictly separately packaged** design systems:

1. **RFLY Pilot Field** for active Pilot accounts working outdoors.
2. **RFLY Operations** for Admin, Fleet Manager and Sales accounts.

Do not combine the two applications into one navigation tree or one flat folder. Keep their screens completely separated.

## 2. Product model Stitch must preserve

Both applications use the same server and PostgreSQL database, but they have different security boundaries, capabilities, navigation and screen priorities.

### 2.1 Pilot Field
- Only active `PILOT` accounts may sign in.
- Primary Pilot and Copilot are assignment roles, not account roles.
- The app shows only work assigned to the signed-in Pilot.
- Fleet scheduling initially reserves a Primary Pilot, Drone and LMV.
- When required, only the assigned Primary Pilot selects an eligible Copilot.
- Copilot selection makes the crew `READY`; it does not accept or start work.
- An assigned crew member explicitly accepts, explicitly starts and explicitly completes work according to server-permitted actions.
- Completion requires a positive actual acreage.
- Operational issues use a controlled category and a bounded note.
- Offline actions are queued and reconciled with the server; the client never overwrites server state.

### 2.2 RFLY Operations
- `ADMIN`, `FLEET_MANAGER` and `SALES` share one separately packaged app.
- Navigation and controls come from server capabilities, not from visual role assumptions.
- Sales can search/register customers and create leads when authorized.
- Fleet/Admin can view the bounded schedule, exception queues and perform the exposed reason-required Copilot override.
- The current mobile API does not provide full drag/drop scheduling, arbitrary resource reassignment or complete Admin master maintenance. Do not design those controls as functional v1 actions.

## 3. Mandatory exclusions

Do not show or imply any of the following:
- Firebase authentication, Firebase OTP or provider-owned identity proof;
- Farmer or Business access inside either employee application;
- client-side database editing or direct PostgreSQL access;
- automatic mission start caused by opening a screen;
- client-authoritative conflict resolution or an “overwrite server” button;
- arbitrary Copilot names or manual Copilot ID entry;
- Pilot ratings, rankings, callsigns, flight hours or equipment preferences;
- live aircraft telemetry, battery percentage, signal, speed or altitude;
- background location tracking or route-history recording;
- chat, billing, commission or payment screens;
- broad Admin controls not explicitly listed in this handoff;
- real people, real farms, real phone numbers or real coordinates;
- generic Forgot Password flows (no mobile recovery endpoint exists for v1).

The current backend advertises foreground and background location as disabled. Design navigation to an assigned farm as an external map action using a safe address/Plus Code/coordinate already supplied for that assignment. Do not design a live-tracking tab.

## 4. Approved visual direction

Create an original RFLY visual system inspired by these interaction qualities:
- restrained navy, neutral and safety-orange palette;
- calm information hierarchy;
- compact summaries followed by progressive detail;
- readable numeric and status information;
- large field-safe touch targets of at least 48 dp;
- high contrast in sunlight;
- layouts that tolerate longer translated strings and large text;
- explicit success, warning, blocked, offline and synchronization states;
- minimal animation and no decorative motion that blocks field operation.

Provide light mode first. Dark mode is optional and must not block the v1 handoff.

## 5. Required shared design deliverables

Produce these standalone markdown artefacts before generating individual screens. DO NOT combine them into a single file:

1. `DESIGN.md` containing colour, typography, spacing, radius, elevation, icon, focus, disabled and status tokens.
2. `COMPONENTS.md` defining buttons, fields, cards, status chips, banners, confirmation sheets, empty states, skeletons and offline indicators.
3. `PILOT_NAVIGATION.md` and `OPERATIONS_NAVIGATION.md` as two separate files.
4. `STATE_MATRIX.md` listing every screen and all required states.
5. `ACCESSIBILITY.md` covering contrast, 48 dp targets, dynamic text, screen-reader labels, focus order and error announcements.
6. `CONTENT_RULES.md` defining concise field wording and localization-safe layouts.
7. A valid `screen.png` for every state accepted for implementation.
8. A companion `screen-spec.md` beside each screen image.

Every `screen-spec.md` must contain:
- application: Pilot Field or RFLY Operations;
- screen name and purpose;
- authorized actor/capability;
- entry route and exit routes;
- displayed data fields;
- controls and the exact condition that exposes each control;
- loading, empty, offline, validation, unauthorized, conflict, retry and success behaviour;
- accessibility labels and focus order;
- values that are synthetic visual examples only;
- deferred controls that must not be implemented.

## 6. Pilot Field application

Use three top-level destinations only:
1. **Work** — Today and Upcoming views.
2. **Sync** — pending, retrying, conflict and failed action evidence.
3. **Profile** — safe profile, language, session/security and sign-out.

Use stack/transactional screens for assignment detail, Copilot selection, mission actions, issue reporting and completion. Do not show bottom navigation inside a focused confirmation or form when it risks accidental navigation.

### Pilot Field screen inventory (Design each with the required states):
- **PF-01 Login:** Email and password fields. Loading, invalid credentials, network unavailable, rate limited, disabled mobile API, mandatory upgrade, generic server failure. (NO Forgot Password control in v1).
- **PF-02 Startup:** Secure session restoration. Revoked, expired, upgrade-required outcomes. Initialization failure with a safe retry path.
- **PF-03 Work list:** Today/Upcoming segmentation. Server sequence, service window, farm display address, crop, acreage, Drone, LMV and crew readiness. Loading, empty, cached-offline, partial-sync indicators.
- **PF-04 Assignment detail:** Farmer display name, operational contact action, farm display address, external navigation action, crop, expected/actual acreage, service window, daily sequence. Primary/Copilot, Drone and LMV summary. Next server-permitted actions only.
- **PF-05 Accept assignment:** Explicit confirmation from a ready `SCHEDULED` assignment. Queued offline, applied, conflict, retry-later outcomes. Acceptance does not start work.
- **PF-06 Eligible Copilot selection:** Shown only when `SELECT_COPILOT` is permitted. Loading, candidate list (display name and employee code only), no candidates, offline unavailable, selection conflict states.
- **PF-07 Copilot confirmation:** Confirm is revision guarded. Success returns to refreshed detail in `READY` state.
- **PF-08 Start mission:** Separate explicit confirmation available only after acceptance. Applied/queued/conflict/rejected/retry states.
- **PF-09 Active mission:** Static operational summary only. Report Issue and Complete only when server permitted. No fabricated telemetry or active map tracking.
- **PF-10 Report issue:** Controlled category selector (Drone malfunction, safety hazard, weather blocker, customer blocker, other). Coordinate-free note (1-500 chars). Validation, queued, applied, conflict, retry.
- **PF-11 Complete mission:** Positive actual acreage entry with decimal-safe validation. Explicit confirmation. Applied, queued, conflict, retry.
- **PF-12 Sync status:** Ordered pending actions. Retrying, conflict, rejected/manual-review, applied receipt history.
- **PF-13 Profile and security:** Safe profile, employee code, preferred language, operating centre. Logout, logout-all, lost-device journeys.
- **PF-14 Upgrade required:** Blocking screen with supported-version explanation.

## 7. RFLY Operations application

Design this as a separate application entirely. Top-level destinations are capability driven:
- **Home** — role-specific queues.
- **Customers** — Sales/Admin write, Fleet read-only.
- **Schedule** — Fleet/Admin only.
- **Exceptions** — Fleet/Admin only.
- **Profile** — shared session/security.

### RFLY Operations screen inventory:
1. **OP-01 Operations login/startup/upgrade:** Similar states to PF but for Ops.
2. **OP-02 Operations Home:** Capability-driven home for Sales, Fleet and Admin.
3. **OP-03 Customer Search:** Customer search and exact-phone lookup.
4. **OP-04 Customer Registration:** Customer registration for authorized Sales/Admin.
5. **OP-05 Lead Intake:** Customer-linked lead intake with map-pin or Plus-Code resolution concept (no manual latitude/longitude typing).
6. **OP-06 Lead Outcome:** Accepted, needs manual scheduling, or out of area.
7. **OP-07 Daily Fleet Schedule:** Bounded Fleet schedule list/day view (do not imply unsupported drag/drop).
8. **OP-08 Exceptions:** Fleet exception list and detail.
9. **OP-09 Copilot Override:** Reason-required Copilot override with conflict refresh.
10. **OP-10 Profile:** Shared profile, logout, logout-all and installation management.

## 8. Stitch completion checklist

The output is rejected unless all statements are true:
- Pilot Field and RFLY Operations are generated in strictly separate top-level folders.
- The shared design deliverables (`DESIGN.md`, `COMPONENTS.md`, etc.) are generated as separate files.
- No generated code is presented as production-ready code.
- Every exported PNG is a valid image.
- No real or sensitive data is present.
- No fabricated telemetry, rating, forgot password flow, or live tracking is present.
- The Pilot flow strictly preserves: Select Copilot → Ready → Accept → Start → Complete.
- Every state-changing action includes offline and server-conflict states.
- Pilot Fleet and Map tabs are absent.
- Deferred features are visibly labelled deferred.

## 9. Execution instruction for Stitch

Treat everything above as a binding design contract. First, return a proposed file/screen inventory and list any contradiction you detect.

Generate the Pilot Field package first. **DO NOT generate the Operations package until the Pilot package passes the completion checklist.** Deliver valid screen images and detailed screen specifications that a React Native engineer can implement without inventing data, permissions, state transitions or navigation.

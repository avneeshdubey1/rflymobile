# Google Stitch Handoff — RFLY Non-Pilot Mobile Application

**Status:** design-generation handoff; no generated code is production code
**Recorded:** August 20, 2026
**Supersedes for this app:** the Operations-only portion of
`STITCH_MOBILE_REDESIGN_HANDOFF.md`
**Does not replace:** the separate RFLY Pilot application

## 1. Instruction to Google Stitch

Design one mobile application for every supported user except Pilots. The app
must support five server-authorized workspaces:

1. Admin
2. Sales employee
3. Fleet Manager
4. Farmer/customer
5. Business/B2B customer

This is not five unrelated visual concepts. It is one coherent application and
design system whose navigation, data, and actions change according to the
authenticated role and server-returned capabilities. A user must never obtain
another role by changing a tab, route, or local setting.

Use the current **RFLY Pilot** mobile app as the visual reference. Match its
navy/safety-orange palette, typography, cards, banners, status chips, rounded
controls, high-contrast field styling, and minimum 48 dp touch targets. The
result should look like the companion app from the same product family.

The deliverable must be an **interactive prototype**, not a collection of
static screens with button-shaped decoration. Every visible enabled control
must have a defined interaction and a connected result screen, modal, sheet,
expanded state, validation state, or confirmation state. If an action is not
implemented by the existing product, omit it or visibly label it unavailable;
do not create a dead button.

Do not generate production React Native code. Produce design screens,
component variants, connected flows, and implementation notes that engineers
can reproduce in the repository-native Expo/React Native client.

## 2. Product boundary

The existing Node.js/Express API and PostgreSQL database remain authoritative.
The app never connects directly to PostgreSQL. It cannot decide permissions,
assignment eligibility, geofence results, customer ownership, or workflow
state locally.

The Pilot application remains separate. Do not place Pilot mission controls,
Pilot availability, Copilot selection, mission start/completion, or Pilot
location submission in this app. Admin/Fleet may view the latest authorized
Pilot location, but they do not capture Pilot location from this app.

The website remains the functional reference. This design should adapt its
current supported capabilities to a high-quality mobile experience rather
than placing desktop tables inside a narrow viewport.

## 3. Binding visual system

### Colours

| Token | Value | Usage |
|---|---|---|
| Primary navy | `#1A2B44` | Headers, key text, secondary actions, card accent |
| Safety orange | `#FF6B00` | Primary actions, selected/high-priority emphasis |
| App background | `#F8F9FA` | Page canvas |
| Surface | `#FFFFFF` | Cards, sheets, fields |
| Primary text | `#121212` | Main text |
| Secondary text | `#5F6368` | Supporting copy |
| Disabled | `#E0E0E0` | Disabled controls and borders |
| Success | `#2E7D32` | Completed, active, available |
| Warning | `#ED6C02` | Review, waiting, maintenance |
| Error | `#D32F2F` | Rejected, failed, destructive confirmation |
| Offline | `#757575` | Offline/cached/unavailable states |

### Layout and typography

- Heading: 24 dp, bold; hero/page headings may use 30–34 dp.
- Subheading: 18 dp, medium or semibold.
- Body: 16 dp.
- Caption: 14 dp.
- Spacing scale: 4, 8, 16, 24, 32 dp.
- Radius scale: 4, 8, 24 dp.
- Every touch target is at least 48 × 48 dp.
- Cards use white surfaces, 8 dp radius, subtle elevation, and a 4 dp navy
  left accent when appropriate.
- Primary actions are filled safety orange with white text and pill-shaped
  corners. Secondary actions are white/transparent with navy outline.
- Destructive actions use red outline until the final confirmation.
- Design light mode first. Dark mode is not required for the first release.
- Support long translated labels, larger text, and sunlight readability.

## 4. Mandatory interactive component library

Create components with real prototype variants and transitions:

- primary, secondary, destructive, icon, floating, and text buttons;
- pressed, focused, loading, disabled, success, and failure button states;
- text, phone, number, search, password, date/time, select, textarea, map-pin,
  and Plus Code fields;
- fields with focus, helper text, validation, server error, and read-only state;
- animated toggle switch with available/on and offline/off states;
- filter chips, status chips, counters, badges, segmented controls, and tabs;
- cards that expand or open detail screens when tapped;
- list rows with chevrons, contextual overflow actions, and selection states;
- bottom sheets, confirmation sheets, date/time pickers, and reason dialogs;
- toast/snackbar, inline banner, empty state, skeleton, retry, and pull-to-refresh;
- bottom navigation, top app bar, back navigation, role badge, and overflow menu;
- accessible calendar day/week cells and draggable schedule cards with a
  non-drag “Move assignment” fallback;
- map preview, explicit “Load map” consent action, current-location marker, and
  external-navigation action;
- pagination/infinite-scroll loading and end-of-list state.

No control may exist only for appearance. Connect every enabled control in the
prototype. For form submissions, demonstrate validation, loading, success, and
server-rejection paths. For mutations, include an explicit confirmation where
the result affects people, fleet, service areas, schedules, or accounts.

## 5. Authentication and common journeys

The initial entry offers three explicit paths:

- **Employee sign in** — Admin, Sales, Fleet Manager; work email and password.
- **Farmer sign in** — phone-linked OTP challenge.
- **Business sign in** — staff-provisioned Business account.

Never show a role picker after authentication. The server response determines
the workspace. Include these common screens:

| ID | Screen | Required interactive states |
|---|---|---|
| SH-01 | Splash and secure startup | restoring, expired, revoked, offline, upgrade required, retry |
| SH-02 | Sign-in gateway | three login paths; back and help interactions |
| SH-03 | Employee login | focus, show/hide password, loading, generic failure, rate limit, network error |
| SH-04 | Farmer phone login | canonical phone entry, OTP request, 30-second resend timer, expiry, wrong code, retry |
| SH-05 | Business login | loading, generic failure, recovery entry only when supported |
| SH-06 | Notification centre | unread/read, filters, detail, empty, permission prompt |
| SH-07 | Profile and security | safe profile, language, logout, logout-all, session/device list |
| SH-08 | Offline and synchronization | cached-read notice, pending action, retry, conflict, no-connection state |
| SH-09 | Access denied/not found | safe explanation and return action |
| SH-10 | Mandatory upgrade | blocking explanation and store action |

## 6. Role-aware navigation

Use no more than five persistent bottom-navigation destinations. Put less-used
Admin functions under a clear **More** destination. Keep destination order
stable within each role.

### Admin

1. Home
2. Operations
3. Customers
4. Team
5. More

### Sales

1. Home
2. Customers
3. New Lead
4. Notifications
5. Profile

### Fleet Manager

1. Schedule
2. Exceptions
3. Fleet
4. Live GPS
5. Profile

### Farmer/customer

1. Services
2. Request
3. Status
4. Notifications
5. Profile

### Business/B2B customer

1. Overview
2. Requests
3. Notifications
4. Profile

## 7. Admin workspace

Design these screens and connect their flows:

| ID | Screen | Principal interactions |
|---|---|---|
| AD-01 | Admin Home | operational metrics, review queues, recent alerts; metric cards open filtered lists |
| AD-02 | Fleet Overview | active/available/maintenance counts; drill into Drone, LMV, and Pilot lists |
| AD-03 | Feasible Regions | list/map toggle, add centre by map pin, Plus Code/address, radius preview, confirm/remove |
| AD-04 | Customer Search | search by name/phone/location/status; filters, pagination, customer detail |
| AD-05 | Customer Registration | normalized phone, identity fields, farm/location details, validation, duplicate resolution |
| AD-06 | Staff-assisted Lead Intake | customer phone lookup/autofill, farm and crop details, map pin/Plus Code, geofence result |
| AD-07 | Lead Outcome | accepted, out-of-area decline, or manual-scheduling result with next action |
| AD-08 | Assignment List | date/status/centre filters, ordered jobs, assignment detail |
| AD-09 | Assignment Detail | customer summary, crew, Drone, LMV, window, sequence, history; authorized actions only |
| AD-10 | Auto-assignment Policy | enabled switch, working hours, duration, turnaround, limits, revision/conflict confirmation |
| AD-11 | Drone Management | list/detail/add/edit/centre transfer/status/maintenance; active-mission guard |
| AD-12 | LMV Management | list/detail/add/edit/centre transfer/status/maintenance; active-mission guard |
| AD-13 | Pilot Management | profile, centre, availability, compliance summary; no direct mission-state bypass |
| AD-14 | Team Management | add employee, role, centre, enable/disable, reset password, delete only when permitted |
| AD-15 | Lead Timeline | append-only lifecycle and safe audit events; filters and expandable event detail |
| AD-16 | Live Pilot GPS | active mission selector, latest update, explicit map load, stale/no-sample state |
| AD-17 | Admin Profile | own account, password change, language, sessions and logout |

Admin is the highest application role, but designs must not expose secrets,
password hashes, raw SQL, exact audit-log GPS, or audit rewrite controls.

## 8. Sales workspace

| ID | Screen | Principal interactions |
|---|---|---|
| SA-01 | Sales Home | customer/lead shortcuts, drafts or follow-up counters, recent safe activity |
| SA-02 | Customer Search | debounced search, exact phone lookup, filters, customer detail |
| SA-03 | Customer Registration | phone normalization, duplicate warning, controlled creation and success |
| SA-04 | Customer Detail | safe contact/farm profile and “Create lead for this customer” action |
| SA-05 | New Lead | phone-first autofill, crop/acreage, preferred window, map pin/Plus Code, notes |
| SA-06 | Geofence Result | in-area accepted or contact-only out-of-area decline; no appeal action |
| SA-07 | Lead Confirmation | created ID/status, manual-scheduling state, return/customer-detail actions |
| SA-08 | Sales Profile | safe account, language, sessions and logout |

Sales cannot schedule fleet, manipulate policy, manage employees, or view live
Pilot GPS. Do not add CRM, payment, or commission screens unless their backend
workflow is separately approved and implemented.

## 9. Fleet Manager workspace

| ID | Screen | Principal interactions |
|---|---|---|
| FL-01 | Day Schedule | selected date, ordered jobs, crew/resource summary, pull refresh |
| FL-02 | Week Calendar | day/week toggle, job cards, tap detail, accessible next/previous/today |
| FL-03 | Schedule or Move Job | Primary/Copilot/Drone/LMV, service window, sequence, reason, conflict preview |
| FL-04 | Schedule Interaction | drag/resize preview, valid/invalid target feedback, confirm or cancel |
| FL-05 | Manual Queue | unscheduled requests, reason code, filters, schedule action |
| FL-06 | Exceptions | pending Copilot, overlap, unavailable resource, weather/manual-review states |
| FL-07 | Copilot Override | eligible candidates, required reason, revision conflict and refreshed result |
| FL-08 | Pilots | centre, account/availability state, compliance summary, authorized centre change |
| FL-09 | Drones | availability/service state, centre, maintenance transitions and detail |
| FL-10 | LMVs | availability/service state, centre, maintenance transitions and detail |
| FL-11 | Live Pilot GPS | accepted/in-progress missions only, last update, stale/no sample, explicit map load |
| FL-12 | Fleet Profile | safe account, language, sessions and logout |

The calendar must behave, not merely look like Google Calendar. Connect a job
tap to detail, a valid move to a confirmation, an invalid overlap to a blocked
state, and a successful move to the updated calendar. Also supply keyboard and
screen-reader-friendly “Move assignment” controls instead of requiring drag.
Do not invent automatic route optimization.

## 10. Farmer/customer workspace

| ID | Screen | Principal interactions |
|---|---|---|
| CU-01 | Services | active/past segmented list, service card detail, empty and cached states |
| CU-02 | Request Service | acreage, approved crop selection, soil/crop age where supported, spray purpose |
| CU-03 | Farm Location | saved location, map pin, Plus Code/address; no latitude/longitude typing |
| CU-04 | Preferred Date/Time | date, Morning/Afternoon/Evening, validation and summary |
| CU-05 | Request Review | complete summary, edit section, submit confirmation and loading |
| CU-06 | Request Result | accepted for review or strict out-of-area decline; no appeal button |
| CU-07 | Request Status | lifecycle status, service window, safe assignment progress, timeline |
| CU-08 | Farmer Profile | linked phone, preferred language, safe farm details, logout |

Farmer access shows only the explicitly linked customer’s requests. It never
shows other customers, staff tools, fleet controls, internal notes, audit logs,
or raw assignment data.

## 11. Business/B2B customer workspace

| ID | Screen | Principal interactions |
|---|---|---|
| B2-01 | Business Overview | organization identity, linked active/completed request counts and recent activity |
| B2-02 | Linked Requests | filters, status chips, request cards and request detail |
| B2-03 | New Request | only if the running backend explicitly grants this capability; otherwise omit |
| B2-04 | Request Detail | linked farm/job data, status and approved customer-visible timeline |
| B2-05 | Notifications | request/service updates, read/unread and empty state |
| B2-06 | Business Profile | organization, contact, GST/address display when present, membership and logout |

Business accounts represent a company/farm group and see only explicitly
linked jobs and customer-visible records. Do not fabricate commission,
invoicing, settlement, payment, tax, or downloadable invoice actions. Those
workflows are not production-ready merely because an old website placeholder
mentions them.

## 12. Required interaction prototypes

Stitch must connect and demonstrate at least these end-to-end journeys:

1. Employee login → role-resolved Admin Home → Customer Search → Detail.
2. Sales login → exact-phone lookup → existing-customer autofill → New Lead →
   location → geofence result → confirmation.
3. Sales customer registration → duplicate warning → corrected submission →
   customer detail.
4. Fleet Schedule → job detail → move/reschedule → overlap rejection → corrected
   time → confirmation → updated calendar.
5. Fleet Exceptions → pending Copilot → eligible candidate → reasoned override
   → revision conflict → refresh → success.
6. Fleet Live GPS → mission selection → waiting for sample → latest position →
   explicit map load.
7. Admin Team → add employee → field validation → success → employee detail.
8. Admin Feasible Regions → map pin/Plus Code → radius preview → confirmation.
9. Farmer phone login → OTP → Services → Request → location → review → result.
10. Business login → linked request list → request detail → notification.
11. Session expiry during a form → safe reauthentication → preserved draft when
    policy permits.
12. Network loss during a mutation → visible pending/retry state; never pretend
    the server accepted it.

## 13. State matrix requirement

For every screen, create variants for all applicable states:

- loading/skeleton;
- empty;
- populated;
- refreshing;
- validation error;
- server rejection;
- unauthorized/role denied;
- offline/cached;
- pending synchronization;
- stale revision/conflict;
- success;
- disabled/read-only;
- long translated text and large-font layout.

Do not hide failure states in annotations only. Generate representative visual
screens for the important failures and connect retry, refresh, edit, cancel,
and return actions.

## 14. Privacy, safety, and content restrictions

- Use synthetic names, numbers, addresses, IDs, coordinates, and business data.
- Never place real credentials, customer records, tokens, keys, or server
  addresses in the design.
- Do not display exact GPS in logs, notifications, analytics, or audit history.
- Live GPS shows one latest operational location only; no route history.
- Maps load only after an explicit action because the provider receives the
  selected coordinates.
- Out-of-area requests are declined without an appeal flow.
- Do not invent raw Drone telemetry, battery/signal/altitude/speed dashboards,
  Bhumeet APIs, ratings, callsigns, or route optimization.
- Do not include billing, payments, commissions, GST invoices, or settlement
  actions until those backend workflows are approved.
- Every destructive action needs an explanation and confirmation.
- Every mutation must account for server rejection and stale data.

## 15. Stitch output package

Deliver:

1. A shared design-system page with all component variants.
2. A role/navigation map showing the five workspaces and shared authentication.
3. Named screens using the IDs in this document.
4. Connected interactive prototypes for all journeys in section 12.
5. A state matrix mapping each screen to its variants.
6. Short developer notes for every screen: visible data, controls, entry/exit,
   authorization, validation, loading, empty, offline, conflict, and success.
7. Mobile portrait layouts first; add tablet/adaptive variants for dense Admin
   and Fleet schedule views.
8. Accessibility annotations: screen-reader labels, focus order, contrast,
   minimum touch targets, and non-drag fallbacks.

## 16. Rejection checklist

Reject and regenerate the Stitch output if any statement is false:

- It visually belongs to the same family as the RFLY Pilot app.
- Pilot mission controls are absent from this app.
- Each role sees only its authorized navigation.
- Every enabled visible button has a connected interaction.
- Forms demonstrate validation, loading, failure, and success.
- Calendar interactions show valid, invalid, confirm, and updated states.
- Customer location uses map pin/Plus Code rather than manual coordinates.
- Live GPS is latest-location-only and Admin/Fleet-only.
- Farmer and Business data are explicitly isolated.
- No unfinished billing, commission, telemetry, or route-optimization feature is fabricated.
- No sensitive or real data appears.
- Generated output is treated as design evidence, not production source code.

## 17. Recommended generation order

1. Generate the shared component system.
2. Generate common authentication and profile screens.
3. Generate Sales and Farmer journeys because they establish customer intake.
4. Generate Fleet scheduling, exception, assets, and GPS journeys.
5. Generate Admin aggregation and management journeys.
6. Generate Business linked-request journeys.
7. Connect all flows and produce the state/accessibility matrices.

Before generating screens, Stitch should first return the proposed screen list,
navigation map, and any contradiction it detects in this handoff. Do not remove
a required state merely to reduce the screen count.

# Google Stitch Revision Handoff — RFLY Operations Companion

**Status:** corrective design request; generated code is not production code  
**Reviewed export:** `stitch_rfly_operations_companion.zip`, August 20, 2026  
**Authoritative parent brief:** `STITCH_NON_PILOT_MOBILE_APP_HANDOFF.md`

## 1. Revision decision

Keep the current visual foundation:

- navy, safety-orange, white and light-grey palette;
- readable typography and high contrast;
- large rounded controls and minimum 48 dp touch targets;
- white cards with restrained borders and clear status chips;
- mobile-first layout and explicit map-loading pattern.

Do not treat the supplied HTML as production React Native code. The next
Stitch output must be a corrected, connected design specification. It must not
invent product capabilities merely to make a dashboard look populated.

The current package contains only 18 functional screen concepts against the
61 named screens in the approved handoff. It is a partial visual sample, not a
whole-application design.

## 2. Product identity and locale corrections

This is an Indian agricultural Drone-as-a-Service operations product, not an
airline, airport, aerial-survey, military command, or generic aviation system.

Replace all inappropriate concepts, including:

- aircraft, airline routes, airport codes, captains, flights and landing
  clearance;
- A320s, perimeter inspection, thermal anomaly detection, aerial survey and
  crop-health-analysis missions that are not approved spraying services;
- US names, `+1` phone formats, Midwest regions, US states, miles, mph and EST;
- generic labels such as “Aviation Command Center” and “Secure Operations
  Network”.

Use synthetic Indian examples only:

- canonical `+91` phone presentation;
- acres and kilometres;
- Asia/Kolkata local time in user-facing schedules;
- synthetic villages, districts, operating centres, approved crops and
  agricultural spraying requests;
- neutral resource identifiers for Drones and LMVs.

Do not redesign or finalize the company logo without approval. Use a neutral
RFLY Operations wordmark and the existing product-family visual direction.

## 3. Remove fabricated capabilities

Remove every reference to:

- revenue, contracts, renewals, enterprise plans, deals and proposals;
- billing, payments, commissions, GST invoices and settlement;
- firmware deployment, raw Drone telemetry and telemetry synchronization;
- battery-range isochrones, route optimization and customer-demand heatmaps;
- automatic altitude recommendations, live weather decisions and aviation
  warnings;
- “Best Fit” or AI recommendations based on proximity, battery health or Pilot
  hours;
- out-of-area jobs entering a manual queue or being scheduled.

The current backend does not authorize these workflows. Do not show them as
cards, alerts, actions, placeholder buttons, or future-looking metrics.

## 4. Correct role-aware navigation

Do not reuse `Fleet / Tasks / Map / Alerts / Settings` across roles. Use these
exact role-specific destinations and keep their order stable:

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

Authentication has no role picker. The server-returned role and capabilities
select the workspace.

## 5. Correct the existing screen concepts

### Authentication

- Splash must show restoring, expired, revoked, offline, retry and mandatory
  upgrade variants; do not hardcode a fictitious released version.
- Employee login must show idle, focused, loading, generic failure, rate limit,
  network failure and success routing.
- Farmer login must use canonical Indian phone entry, a request-code state, a
  separate OTP entry state, 30-second resend cooldown, expiry, wrong-code,
  delivery-failure and retry states.
- Create the missing Business login.

### Admin Home

Use supported operational indicators only, such as accepted requests, manual
scheduling queue, active assignments, fleet availability and visible
operational exceptions. Metric cards must open the corresponding filtered
list. Remove revenue, enterprise plans, firmware, weather and telemetry.

### Customer Registration and Search

- Use farmer/customer language, not “regional database” or generic client CRM.
- Normalize `+91` phones and show duplicate resolution.
- Use farm location, not “precise drop location”.
- Location accepts saved location, address or Plus Code and an explicit map
  pin; never ask users to type latitude/longitude.
- Replace unrelated embedded product screenshots with a neutral synthetic map.
- Search supports name, canonical phone, location and status with loading,
  empty, pagination and failure states.
- Do not show contract-renewal, enterprise-plan or active-fleet CRM statuses.

### Lead Intake and Geofence

- Begin with exact phone lookup and existing-customer autofill.
- Collect approved crop, acreage, preferred window, location and notes.
- Show explicit map consent and Plus Code entry.
- Create separate server-result screens for in-area accepted, manual scheduling
  and contact-only out-of-area decline.
- An out-of-area request can never be appealed or scheduled.

### Fleet Schedule and Exceptions

- Every assignment summary shows Primary Pilot, Copilot, Drone, LMV, operating
  centre, customer/farm, service window, sequence and safe status.
- Use request/assignment/mission terminology rather than commercial flights.
- Day and week views must connect job tap, move action, conflict preview,
  confirmation, server rejection and updated-calendar states.
- Provide a visible “Move assignment” action; drag/swipe cannot be the only
  method.
- Manual queue reasons must come from server-supported scheduling failures.
- Exceptions include pending Copilot, overlap, unavailable resource, inactive
  account, compliance failure, stale revision and explicit Fleet follow-up.
- Do not create fake weather or airport exceptions.

### Fleet and Team Management

- Separate Drone, LMV and Pilot list/detail designs.
- Drone, LMV and Pilot centre transfers require confirmation and show an active
  assignment conflict when blocked.
- Pilot detail includes operating centre, account status, declared
  availability and compliance summary.
- Show only one Admin. The Admin account cannot be disabled or deleted.
- Employee creation requires role and an operating centre where required.
- Reset, disable, enable and permitted delete actions need confirmation,
  loading, server rejection and success states.

### Auto-assignment Policy

- Display the configured operating timezone and local times; do not label user
  fields as UTC.
- Do not hardcode duration, turnaround or operational limits as product rules.
- Show values loaded from configuration.
- Include validation, unsaved changes, revision conflict, refresh, confirmation,
  successful update and server-rejection variants.

### Live Pilot GPS

- Available only to Admin and Fleet for accepted/in-progress assignments.
- Show one latest authorized Pilot location, timestamp and freshness state.
- Include waiting-for-first-sample, stale, offline, ended and unavailable
  variants.
- Retain explicit “Load map” consent.
- Call it latest Pilot location, not raw/live Drone telemetry.
- Never show route history or exact coordinates in alerts, logs or audit views.

## 6. Missing screens that must be generated

Generate all missing IDs from `STITCH_NON_PILOT_MOBILE_APP_HANDOFF.md`, with
special priority on:

- SH-05 through SH-10: Business login, notifications, profile/security,
  offline/sync, access denied and mandatory upgrade;
- AD-07 through AD-09 and AD-11 through AD-17: lead result, assignments,
  Drone/LMV/Pilot management, lead timeline, GPS and Admin profile;
- SA-04 and SA-06 through SA-08: customer detail, geofence result,
  confirmation and Sales profile;
- FL-03, FL-04, FL-07 through FL-10 and FL-12: scheduling interactions,
  Copilot override, asset/Pilot views and Fleet profile;
- CU-01 through CU-08: the complete Farmer/customer workspace;
- B2-01 through B2-06: the complete Business/B2B workspace.

Do not merely list these screens in a text map. Export a viewable screen for
each important populated and failure state and connect the primary journeys.

## 7. Decision on Stitch's proposed enhancements

### 7.1 Adaptive data density — ACCEPT WITH LIMITS

Use collapsible summaries for dense Admin/Fleet screens. A swipe may open a
quick-action sheet, but must have a visible accessible alternative. Reassign,
move, disable, maintenance and exception actions must still show eligibility,
revision, reason and confirmation; never execute a destructive mutation from
one swipe.

### 7.2 Geofence and mission visualizers — PARTIAL ACCEPT

Accept an on-demand mini-map, centre-radius preview and farm/assignment map
context. Reject battery-range isochrones and demand heatmaps. They require
unapproved telemetry, routing, analytics and privacy decisions.

### 7.3 Predictive “Smart Suggestions” — DEFER

Do not design or claim this feature now. Assignment remains a deterministic,
server-enforced and auditable policy with a visible manual queue. Proximity,
battery-health and Pilot-hours inputs are not approved reliable decision data.

### 7.4 Guided Farmer onboarding — ACCEPT

Design the request as a clear step flow:

1. Service/crop details
2. Farm location
3. Preferred date/window
4. Review
5. Server result

Allow back/edit without losing entered data. Show progress, field validation,
duplicate/saved-location handling, geofence result, offline draft and session
expiry. Server validation remains authoritative.

### 7.5 Offline and synchronization states — ACCEPT WITH SAFETY RULES

Create high-fidelity offline, cached, pending, retry, conflict and restored
states. Do not imply success before the server confirms it. Low-risk drafts may
be preserved locally. Account, fleet, geofence, assignment, policy and other
high-impact mutations must fail visibly or require explicit retry; they must
not be silently queued and replayed.

This non-Pilot application must not show Pilot offline-mission controls. Those
belong to the separate Pilot application.

## 8. Required connected prototype journeys

Connect and demonstrate all twelve journeys in section 12 of the parent
handoff. At minimum, the revised review package must visibly demonstrate:

1. Employee login to server-resolved Admin, Sales and Fleet navigation.
2. Sales exact-phone lookup through lead submission and geofence result.
3. Customer duplicate detection and corrected registration.
4. Fleet move/reschedule with overlap rejection and successful retry.
5. Pending Copilot exception with eligible override and stale-revision result.
6. Latest Pilot location with consent, waiting and stale states.
7. Admin employee creation and protected-Admin behaviour.
8. Feasible-region map/Plus Code creation and confirmation.
9. Complete Farmer OTP and guided request journey.
10. Business login to isolated linked request detail.
11. Session expiry with permitted draft recovery.
12. Network loss that never falsely reports a mutation as accepted.

## 9. Delivery requirements

Return:

1. one role/navigation map;
2. the shared component library with interactive states;
3. viewable screen exports named with the approved IDs;
4. connected prototypes for the required journeys;
5. a screen/state matrix;
6. accessibility notes and non-gesture alternatives;
7. mobile portrait layouts plus adaptive Admin/Fleet schedule examples;
8. synthetic content only.

Before generating screens, first respond with the corrected screen inventory,
the role navigation map and any unresolved contradiction. Do not reduce scope
by combining unrelated roles or replacing required visual states with notes.


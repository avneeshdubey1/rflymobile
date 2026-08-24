# RFLY Mobile UI Design Brief

**Status:** draft design workflow; not approved for implementation
**Prepared:** August 12, 2026
**Applies to:** Pilot Field Android application, RFLY Operations Android
application, and any separately approved progressive web visual refresh

## 1. Purpose

Use Google Stitch to explore and review an original RFLY mobile design system,
screen hierarchy and clickable workflows before production UI implementation.
Stitch is a design and prototyping aid. Its generated frontend code is not an
approved source-code contribution and must not be pasted into this repository.

The production clients remain reviewed React Native/Expo applications that use
the versioned Node.js API. Authorization, validation, state transitions, audit,
conflict checks and offline reconciliation remain server-owned.

## 2. Design prerequisites

Final UI work depends on these R00 artefacts:

- complete client-meeting requirement register;
- role-capability matrix;
- web/mobile parity matrix;
- approved two-application boundary;
- approved Copilot-selection state machine; and
- decision on whether the current web UI is also in the visual-redesign scope.

Screens created before those artefacts are exploratory. They must not be used
as evidence that a workflow or permission has been approved.

## 3. Safe use of Google Stitch

Stitch may be used for:

- original visual directions and component variants;
- mobile navigation and information hierarchy;
- screen-state exploration;
- clickable prototypes for client review;
- exporting an approved design to Figma for refinement; and
- producing a `DESIGN.md`-style description of approved design rules.

Do not upload or paste:

- real farmer, employee, client or company records;
- phone numbers, email addresses, exact coordinates or Plus Codes;
- passwords, tokens, keys, cookies or OTP values;
- production/staging IP addresses, internal paths or deployment secrets;
- screenshots containing live data; or
- proprietary Zerodha assets, logos, copy or exact screen reproductions.

Use invented names, masked phones, generic maps and clearly synthetic data.

## 4. Visual direction

The client's Coin reference is interpreted as a request for interaction
qualities, not a request to clone another product:

- calm and restrained colour use;
- strong typography and readable numeric/status information;
- compact summaries followed by progressive detail;
- list-first navigation and predictable bottom navigation;
- clear success, warning, blocked, offline and synchronization states;
- large field-safe touch targets;
- minimal visual noise; and
- original RFLY branding suitable for sunlight, low-end devices and multiple
  supported languages.

The Pilot Field application should prioritize the next safe action. The
Operations application should prioritize role-specific queues and exceptions.

## 5. Required design deliverables

Before development accepts a screen, retain reviewed exports for:

1. an original RFLY colour, typography, spacing, radius, elevation, icon and
   status-token system;
2. a navigation map for each application;
3. one component inventory shared where practical across both applications;
4. every screen's loading, empty, populated, validation, unauthorized,
   conflict, offline and retry states;
5. a clickable primary journey and exception journey for each capability;
6. accessibility notes for contrast, dynamic text, touch size and screen-reader
   labels;
7. English plus one representative longer translated-string layout check; and
8. a client decision record marking each screen `APPROVED`, `REVISE` or
   `DEFERRED`.

## 6. Provisional screen inventory

This inventory is not final until R00 is approved.

### 6.1 Pilot Field

- Employee login and session recovery.
- Today/upcoming work list.
- Assignment awaiting Copilot selection.
- Eligible Copilot selection and confirmation.
- No-eligible-Copilot/Fleet-follow-up state.
- Assignment detail with farmer contact, farm navigation, drone and LMV.
- Accept, start, report issue and complete flows.
- Actual-acreage entry.
- Offline queue, synchronization result and conflict resolution.
- Profile, language, security and sign-out.

### 6.2 RFLY Operations

- Employee login and role-aware home.
- Sales customer search, registration and lead intake.
- Fleet day schedule and assignment details.
- Copilot-selection exception and reasoned override.
- Drone/LMV/Pilot availability and operational alerts.
- Approved Admin user and master-data actions.
- Profile, language, security and sign-out.

Do not design Farmer or Business access into the employee Operations app unless
the client explicitly approves that boundary.

## 7. Stitch workflow

1. Finish R00 requirements and role matrices.
2. Prepare sanitized product context and synthetic example content.
3. Generate the design system and navigation before individual screens.
4. Generate one complete workflow at a time, including failure and offline
   states; do not generate the whole platform in one prompt.
5. Link the screens into a clickable prototype.
6. Review the prototype with Operations, an actual Pilot representative,
   engineering and the client.
7. Record decisions and revise the prototype.
8. Export approved designs/rules to Figma or `DESIGN.md` for handoff.
9. Translate approved designs into repository-native components manually,
   with tests and API contracts. Do not import generated application code.

## 8. Initial Stitch project prompt

Use this only after replacing the bracketed decisions from R00:

```text
Design an original Android mobile design system and clickable prototype for
RFLY Drone as a Service. Do not copy Zerodha Coin branding, assets, wording or
exact screens. Take inspiration only from calm, information-led hierarchy,
restrained color, compact summaries and progressive disclosure.

There are two separately packaged employee applications sharing one backend:

1. Pilot Field: for Primary Pilots and Copilots working outdoors with low or
intermittent connectivity. The most important screen is Today's Work and the
most important action is the next server-permitted mission step.
2. RFLY Operations: for [APPROVED ROLES]. It presents only role-authorized
queues and actions for [APPROVED FIRST-RELEASE CAPABILITIES].

Use original RFLY branding, accessible contrast, large touch targets, readable
text in sunlight, clear status chips and layouts resilient to translated text.
Use only synthetic people, phones, farms, locations and resource identifiers.

For the Pilot workflow, show a provisional assignment where the assigned
Primary Pilot must select one eligible Copilot before the assignment becomes
ready. Include loading, no eligible candidate, stale/conflict, offline,
successful selection and Fleet follow-up states. Do not show direct database
editing or any way to bypass server eligibility.

First generate:
- design tokens and reusable components;
- navigation map for both apps;
- low-fidelity workflow screens; and
- a state inventory for every screen.

Do not generate production backend logic or assume permissions not listed in
the supplied role-capability matrix.
```

## 9. Development acceptance boundary

A Stitch design is ready for implementation only when:

- the underlying requirement and server state machine are approved;
- every control maps to a named API capability and authorized role;
- empty/error/offline/conflict states exist;
- no sensitive or real data is embedded;
- the client has approved the original RFLY visual direction; and
- engineering has converted the design into component-level acceptance
  criteria.

Design approval does not authorize schema, API, production-data, deployment or
Play release work.

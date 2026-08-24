# RFLY One-ness Program — Master Implementation Plan

**Status:** planning document; no code, schema, deployment, or data change is authorized by this document alone  
**Created:** August 21, 2026 · **Revised:** August 23, 2026  
**Planner:** Antigravity acting as planning agent  
**Repository:** `Waz00-m/RFLY`

> **Worker models:** Flash 3.6 · Terra 5.6 · GPT 5.5  
> **Model reasoning modes, task sizing rules, and per-phase assignments** are in [`MODEL_ASSIGNMENT.md`](MODEL_ASSIGNMENT.md).  
> Every microtask below is sized to be Flash 3.6-safe (max 2 files, binary success criterion).  
> Higher-end models receive consecutive bundles of Flash-safe tasks.

**Source revision at planning:** staging HEAD `19f6e6b`, main `1731515`  
**Authoritative entry point:** `docs/plan/AGENTS.md`

---

## August 23 Priority Revision

A meeting on August 23, 2026 shifted the delivery priority. The following changes apply.

**Client-master hotfix is closed.** The web/client-master hotfix is declared complete as of August 23, 2026.
The production import is done. Do not rerun the importer as part of any subsequent mobile work.
See `CURRENT_ENGINEERING_STATE.md` § Client-master hotfix checkpoint.

**A new highest-priority track has been added — the Capacitor WebView Fast-Track.**
This is a **separate entity** from the One-ness Plan. It is not part of the PF, OC, OM, or WEB series.
Canonical document: [`CAPACITOR_WEBVIEW_FASTTRACK.md`](CAPACITOR_WEBVIEW_FASTTRACK.md)

Wrap the existing Vite/React SPA in a Capacitor Android shell to produce an installable APK
for non-Pilot staff with zero backend changes and zero new screens. This is Phase 0 —
get something in staff hands immediately. The native Operations Companion is Phase 1 and
runs in parallel.

### Current execution priority (highest first)

| Priority | Track | Document | Status |
|---|---|---|---|
| 1 — HIGHEST | Capacitor WebView APK (Phase 0) | `CAPACITOR_WEBVIEW_FASTTRACK.md` | Ready to start — awaiting maintainer approval |
| 2 | Pilot Field repair | PF-series in this doc | Ongoing |
| 3 | Nicks-and-nacks promotion | NN-series in this doc | In QA testing; blocked on sign-off |
| 4 | Native Operations Companion (Phase 1) | `NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md` + OC/OM-series | Starts in parallel with Phase 0 |
| 5 | Web SPA color palette + alignment | DS/WEB-series in this doc | Deferred; unblocked but lower priority |
| 6 | Baseline documentation | ON-series in this doc | Background; ongoing |

---

## Purpose of this document

This is the canonical planning artifact for the RFLY **One-ness Program** — the effort to make the web SPA, RFLY Pilot Field Android app, and the planned RFLY Operations Companion app feel and behave as clients of one coherent operational platform.

"One-ness" is **not** feature parity for its own sake. It means:

- one identity and session policy per client type;
- one server-enforced role/capability model;
- one vocabulary for statuses, errors, resources, and actions;
- one set of state machines and scheduling rules;
- one source of truth for assignments, customers, fleet, and audit history;
- intentional parity where two surfaces perform the same job;
- explicit, documented divergence where field/mobile constraints require it;
- a recognizable shared visual system and interaction language; and
- no duplicate client-side business logic that can disagree with the server.

This plan is an **input to coding agents**. Each agent must read this document, the files it references, and verify the current source before writing any code. Planning statements are not proof that a feature works.

---

## Reading order for coding agents

Before acting on any package in this plan, read the following in order:

1. `docs/plan/AGENTS.md` — safety rules, engineering invariants, decision hierarchy
2. `docs/plan/CURRENT_ENGINEERING_STATE.md` — exact implemented/deployed state
3. `docs/plan/CONTEXT.md` — operating model and product rationale
4. `docs/plan/production_hardening.md` — security, privacy, and deployment gates
5. `docs/plan/current_placeholders.md` — all disabled/deferred capabilities
6. `docs/plan/MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md` — approved two-app boundary and R00 requirements
7. `docs/plan/PILOT_MOBILE_API_CONTRACT.md` — privacy boundary, error envelope, session policy
8. `docs/plan/GEMINI_PILOT_MOBILE_REBUILD_HANDOFF.md` — ordered Pilot Field repair workbook
9. `docs/plan/STITCH_NON_PILOT_MOBILE_APP_HANDOFF.md` — Operations Companion design scope
10. `docs/plan/STITCH_NON_PILOT_REVISION_HANDOFF.md` — corrections to Operations Companion design
11. `docs/plan/AUTO_ASSIGNMENT_POLICY_IMPLEMENTATION_PLAN.md` — scheduling policy state
12. Live source areas listed in `one-ness planning.md` Section 2

---

## Part 1 — Verified Baseline

### 1.1 Branch and SHA state (at planning time)

| Branch | Head SHA | Deployed stack | Status |
|---|---|---|---|
| `staging` | `19f6e6b` | `rfly-onprem-staging` port 8089 | Actively deployed; CI passes |
| `main` | `1731515` | `rfly-onprem-demo` port 8088 | Live production; client data present |
| `dev` | unknown at planning | n/a | Normal work-in-progress branch |

> [!CAUTION]
> `main` contains live client operational data. No code push, seed, wipe, import, or bootstrap may touch it without the exact procedure in `docs/MIGRATION_ON_MAIN.md` and an explicit maintainer instruction.

### 1.2 Current test state (staging, `19f6e6b`)

| Gate | Count | State |
|---|---|---|
| Backend test suite | 160/160 | passing |
| Pilot mobile typecheck | pass | passing |
| Pilot mobile unit tests | 18/18 | passing |
| Expo Doctor | 21/21 | passing |
| Migration harness | 29 migrations / 61 checks | passing |
| Container stack gate | healthy | passing |
| Real-browser audit | 6/6 | passing |
| Pointer drag/resize (AA-10/AA-11) | EXPLICIT GAP | not closed |
| Production farmer import | NOT PERFORMED | pending |

### 1.3 Known open gaps entering this program

1. `AA-10` / `AA-11` pointer drag/resize acceptance — not closed; resume from `AUTO_ASSIGNMENT_POLICY_IMPLEMENTATION_PLAN.md`.
2. Production farmer import — separate guarded operator procedure; not part of this program.
3. Drone import — separate reviewed operation after farmer migration.
4. Two active Admin rows observed in staging — resolve through account-management path, not raw SQL.

---

## Part 2 — Surface Inventory

### 2.1 Web SPA (current)

| Area | Implementation status |
|---|---|
| Admin, Fleet, Sales, Pilot, Farmer, Business roles | Deployed on `main`; production reference |
| Assignment scheduling (manual + auto) | Advanced; AA-10/AA-11 gap |
| Customer/farmer intake | Phase 1 deployed |
| Pilot workspace | Deployed; parity gaps documented in Section 3 |
| Farmer portal (web) | Implemented locally (CX-01–CX-03, PORTAL-01–07) |
| Business portal (web) | Implemented locally |
| Billing evidence workflow | NOT IMPLEMENTED — placeholder |
| Raw telemetry | INTENTIONALLY DISABLED |
| Firebase Authentication | RETIRED from source |
| Live OTP delivery | NO PROVIDER SELECTED — test/CLI adapter only |

### 2.2 RFLY Pilot Field Android app (`pilot-mobile/`)

| Area | Implementation status |
|---|---|
| Employee Pilot login + mobile session | working on staging |
| Capability/bootstrap loading | implemented (`8672cba` fixes `pilotAvailabilityState`) |
| Assignment list (Today/Upcoming) | prototype; known defects (Section 5.3) |
| Assignment detail | prototype; known defects |
| Copilot formation flow | prototype; known defects |
| Mission actions (accept/start/complete/issue) | prototype; known defects |
| AVAILABLE/OFFLINE pilot state | implemented |
| Foreground-only location | implemented locally; production-gated |
| Encrypted SQLite cache | prototype; not user-scoped — DEFECT |
| Durable queued mutations + sync receipts | prototype; known defects |
| Sync state/error UI | prototype |
| Profile + logout (data purge) | prototype |
| Automated tests | 18/18 passing |
| Expo Go vs native build | Using Expo Go; native build required before release |
| Background tracking | INTENTIONALLY DISABLED |

### 2.3 RFLY Operations Companion (planned second app)

| Area | Implementation status |
|---|---|
| App package / source directory | DOES NOT EXIST in repository |
| Stitch design export | Visual/design evidence only — not production code |
| Backend Operations mobile routes | Partially exists; exact inventory required (see Part 5) |
| Admin, Fleet, Sales workspace | Design only; no native implementation |
| Farmer OTP login (mobile) | OTP-01 implemented server-side; mobile client not built |
| Business login (mobile) | Design only; not built |

---

## Part 3 — Pilot Parity Matrix

This matrix classifies every Pilot-relevant capability per the schema defined in `one-ness planning.md` Section 8.

Classifications:
- **Shared and equivalent** — Same server rule and outcome; presentation may differ.
- **Mobile field-first** — Required in Pilot Field; web may provide fallback/read-only.
- **Web fallback** — Present on web for continuity but not a primary field workflow.
- **Deliberately excluded** — Unsafe, irrelevant, or too privileged for Pilot Field.
- **Missing defect** — Approved capability absent or inconsistent on one surface.
- **Pending client decision** — Cannot safely implement until policy is confirmed.

| Capability | Server | Web SPA | Pilot Field | Classification | Gap / Notes |
|---|---|---|---|---|---|
| Employee login | Shared | Required | Required | Shared and equivalent | None |
| Logout | Shared | Required | Required | Shared and equivalent | None |
| Logout-all / session revocation | Shared | Required | Required | Shared and equivalent | Verify revocation clears local data |
| Installation revocation | Mobile only | N/A | Required | Mobile field-first | Web: no concept needed |
| Session expiry handling | Shared | Covered | Incomplete (expired vs revoked paths) | Missing defect | GM-02 |
| Mandatory upgrade gate | Mobile only | N/A | Partially — static text only | Mobile field-first | GM-02 |
| Pilot profile / operating centre | Shared | Covered | Empty placeholder | Missing defect | GM-09 |
| Operational availability (AVAILABLE/OFFLINE) | Server-owned | Web: fallback set | Mobile: primary toggle | Mobile field-first | Server-authoritative; none |
| Assigned work list (Today/Upcoming) | Shared DTO | Required | Prototype — ordering/state issues | Shared and equivalent | GM-06 |
| Assignment detail (crew, window, farm, drone, LMV) | Shared DTO | Required | Prototype — not all fields | Shared and equivalent | GM-06 |
| Copilot selection (Primary Pilot only) | Server transactional | Fleet/Admin fallback | Primary flow (prototype) | Mobile field-first | GM-07 — revision/conflict incomplete |
| Copilot override (Fleet/Admin) | Server | Required | Deliberately excluded | Intentional divergence | None |
| Accept assignment | Server state machine | Required | Prototype — ACCEPT not always rendered | Missing defect — CRITICAL | GM-08, GM-06 |
| Start mission | Server | Required | Prototype — AUTO-STARTS ON MOUNT | Missing defect — CRITICAL | GM-08 / mission-active.tsx |
| Complete mission (actual acreage) | Server | Required | Prototype — no decimal validation | Missing defect | GM-08 |
| Issue / decommission reporting | Server | Required | Prototype — hardcoded categories | Missing defect | GM-08 |
| Cancel / reassignment / tombstone handling | Server | Required | NOT IMPLEMENTED | Missing defect | GM-04, GM-06 |
| Foreground mission location submit | Mobile only | N/A (Fleet/Admin view) | Implemented; production-gated | Mobile field-first | Production gate open |
| Farmer contact (phone call intent) | N/A | Available | Prototype — safety states absent | Mobile field-first | GM-06 |
| Farm location / OpenStreetMap link | Assignment DTO | Available | Implemented | Shared and equivalent | None |
| Plus Code display | Assignment DTO | Available | Implemented | Shared and equivalent | None |
| Durable offline mutation queue | Mobile only | N/A | Prototype — fire-and-forget, drops evidence | Mobile field-first | GM-04 — CRITICAL |
| Conflict / stale revision handling | Server | Real-time | Prototype — conflicts deleted | Missing defect | GM-04 |
| Encrypted user-scoped cache | Mobile only | N/A | Prototype — plaintext, not user-scoped | Missing defect | GM-03 — CRITICAL |
| Cache purge on identity change | Mobile only | N/A | NOT IMPLEMENTED | Missing defect | GM-03 |
| Notifications | Provider not selected | Partial | Not implemented | Pending client decision | DEC-06 |
| Chat / operational support | Policy open | Policy open | Deliberately excluded (v1) | Intentional divergence | None |
| Language / localization | i18n system | Active | Placeholder | Missing defect | GM-05 |
| Offline / stale data indication | N/A | N/A | Prototype — incomplete states | Missing defect | GM-06 |
| Accessibility / screen reader | N/A | Partial | Not implemented | Missing defect | GM-05 |
| Audit events for every mutation | Server | Covered | Covered by server | Shared and equivalent | None |
| Server authorization for every mutation | Server | Covered | Covered by server | Shared and equivalent | None |

---

## Part 4 — Operations Companion Role Matrix

`R` = read, `A` = act, `O` = override with reason, `-` = intentionally unavailable.

### 4.1 Employee roles (Admin / Fleet / Sales)

| Capability | Admin | Fleet | Sales | Notes |
|---|---|---|---|---|
| Employee login / session | A | A | A | Shared employee session policy |
| Logout / logout-all | A | A | A | All roles |
| Assignment list (read) | R | R | - | Admin/Fleet only |
| Assignment detail (read) | R | R | - | Customer summary; crew, drone, LMV, window |
| Scheduling / reschedule | O | A | - | Fleet primary; Admin override |
| Copilot override | O | O | - | Reason required; mission not started |
| Live Pilot GPS view | R | R | - | Latest sample only; accepted/in-progress |
| Manual queue / exceptions | R | A | - | |
| Auto-assignment policy | O | - | - | Admin only |
| Customer search / detail | R/A | R | A | Sales primary |
| Customer registration | A | - | A | |
| Lead intake (phone-first) | A | - | A | Sales primary; Admin oversight |
| Geofence decision | Server only | Server only | Server only | Never client-side |
| Drone management | A | A (bounded) | - | |
| LMV management | A | A (bounded) | - | |
| Pilot management | A | A (bounded) | - | Centre change only when no active assignment |
| Team / employee management | A | - | - | Admin only |
| Billing / invoice | NOT IMPLEMENTED | NOT IMPLEMENTED | NOT IMPLEMENTED | Placeholder |
| Raw telemetry | DISABLED | DISABLED | DISABLED | Production gate open |

### 4.2 Customer roles (Farmer / Business)

| Capability | Farmer | Business | Notes |
|---|---|---|---|
| Phone OTP login | A | - | Application-owned; no provider selected |
| Business login | - | A | Staff-provisioned identity |
| View own linked requests | R | - | Farmer: `Customer.farmerUserId` filter |
| View linked business requests | - | R | `BusinessOrganization` + `BusinessMembership` |
| Request new service (guided wizard) | A | A (if capability granted) | Geofence server-validated |
| View request status / timeline | R | R | Customer-visible events only |
| Staff tools, fleet, audit | - | - | NEVER EXPOSED |
| Billing / invoice | NOT IMPLEMENTED | NOT IMPLEMENTED | Placeholder |

---

## Part 5 — Contract-Gap Register

### 5.1 Existing Pilot Field mobile API routes (implemented, staging)

```
POST   /api/mobile/v1/pilot/auth/login
POST   /api/mobile/v1/auth/logout
POST   /api/mobile/v1/auth/logout-all
DELETE /api/mobile/v1/installations/:installationId
GET    /api/mobile/v1/pilot/bootstrap
PUT    /api/mobile/v1/pilot/availability
GET    /api/mobile/v1/pilot/assignments
GET    /api/mobile/v1/pilot/changes
POST   /api/mobile/v1/pilot/sync
GET    /api/mobile/v1/pilot/assignments/:assignmentId
GET    /api/mobile/v1/pilot/assignments/:assignmentId/eligible-copilots
POST   /api/mobile/v1/pilot/assignments/:assignmentId/copilot
POST   /api/mobile/v1/pilot/assignments/:assignmentId/actions
POST   /api/mobile/v1/pilot/assignments/:assignmentId/location
```

Strict DTO source: `backend/contracts/mobile/v1/mobile-api.schema.json`.

### 5.2 Operations routes (must be verified against source before implementation)

A coding agent must inspect `backend/routes/mobileV1Routes.js` and `backend/controllers/mobileV1Controller.js` and produce the exact implemented vs. needed gap register before OC-01 begins.

| Route (expected) | Status | Notes |
|---|---|---|
| `POST /api/mobile/v1/ops/auth/login` | Verify | Employee login for Admin/Fleet/Sales |
| `GET /api/mobile/v1/ops/bootstrap` | Verify | Role-aware capabilities |
| `GET /api/mobile/v1/ops/assignments` | Verify | Fleet/Admin read view |
| Sales customer/lead routes | Verify | Phone-first intake |
| Fleet scheduling routes | Verify | Move/reschedule/exception |

### 5.3 Pilot Field contracts to revise (known defects)

| Area | Current defect | Required fix |
|---|---|---|
| Login response nesting | Token nesting defect corrected locally | Verify `response.data.session.accessToken` in all clients; regression test in place |
| Bootstrap | `pilotAvailabilityState` missing (fixed `8672cba`) | Regression test in place |
| Assignment DTO | Broad Prisma `include` graph exposed | Strict DTO allow-list; enforce in all routes |
| Sync engine | Fire-and-forget; no locking; drops conflict evidence | GM-04 full repair |
| Session state | No distinction expired/revoked/offline-with-cache | GM-02 full repair |

### 5.4 New contracts required for Operations Companion

| Contract | Scope | Notes |
|---|---|---|
| Operations employee bootstrap | Admin/Fleet/Sales role-aware capabilities | Mirror Pilot bootstrap pattern |
| Operations Farmer OTP login | Phone challenge + OTP verify | OTP-01 server-side exists; mobile client not built |
| Operations Farmer bootstrap | Farmer-scoped capabilities | Strict DTO; no staff data |
| Operations Business login + bootstrap | Staff-provisioned identity | Strict DTO |
| Operations Sales lead intake | Phone-first; geofence result | Mobile DTO needed |
| Operations Fleet assignment list/detail | Bounded read-only view | Subset of web payload |
| Operations Fleet Copilot override | Reason required; revision-checked | Mobile DTO needed |
| Operations Fleet Live GPS view | Latest sample only; Admin/Fleet | Mobile DTO needed |
| Operations Admin bounded views | Assignment list, team read | Progressive; not all Admin web power |

---

## Part 6 — Shared Design System Plan

### 6.1 Visual tokens (binding across both mobile apps)

| Token | Value | Usage |
|---|---|---|
| Primary navy | `#1A2B44` | Headers, key text, secondary actions, card accent |
| Safety orange | `#FF6B00` | Primary actions, selected/high-priority emphasis |
| App background | `#F8F9FA` | Page canvas |
| Surface | `#FFFFFF` | Cards, sheets, fields |
| Primary text | `#121212` | Main text |
| Secondary text | `#5F6368` | Supporting copy |
| Disabled | `#E0E0E0` | Disabled controls |
| Success | `#2E7D32` | Completed, active, available |
| Warning | `#ED6C02` | Review, waiting, maintenance |
| Error | `#D32F2F` | Rejected, failed, destructive |
| Offline | `#757575` | Offline/cached/unavailable |

Typography: 24dp bold headings; 18dp subheadings; 16dp body; 14dp captions.  
Touch targets: minimum 48×48dp.  
Spacing: 4/8/16/24/32dp scale.  
Radius: 4/8/24dp scale.

### 6.2 Shared status glossary (server-canonical terms)

| Canonical term | Meaning | Do NOT use |
|---|---|---|
| `PENDING_COPILOT_SELECTION` | Assignment created; awaiting Copilot selection | "Pending", "Incomplete" |
| `READY` | Crew formation complete; may be accepted | "Assigned", "Confirmed" |
| `SCHEDULED` | Accepted and scheduled | "Booked" |
| `PILOT_ACCEPTED` | Crew has accepted | "Active" (alone) |
| `IN_PROGRESS` | Mission started | "Flying", "Active" |
| `COMPLETED` | Mission completed; fleet released | "Done", "Finished" |
| `CANCELLED` | Cancelled by authorized actor | "Removed" |
| `AVAILABLE` | Pilot declared available | "Online" |
| `OFFLINE` | Pilot declared unavailable | "Inactive" |
| `ALREADY_APPLIED` | Idempotent replay — not an error | Do not alarm user |
| `CONFLICT` | Stale revision; refresh required | "Error" |
| `REJECTED` | Server refused mutation; manual review needed | "Failed" |

### 6.3 Shared components (both mobile apps)

- Primary, secondary, destructive, icon, text buttons with pressed/loading/disabled/success states
- Status chips using canonical glossary colours
- Assignment cards (Today/Upcoming ordering)
- Bottom sheet / confirmation sheet for all destructive actions
- Toast/snackbar (success, warning, error, offline)
- Empty state, skeleton loader, retry banner
- Sync state indicator (pending, retrying, conflict, applied)
- Offline notice banner
- Mandatory upgrade blocking screen
- Explicit "Load map" consent action (never auto-load)
- Plus Code display component

### 6.4 Localization rules

- Every user-facing string uses the i18n system. No hardcoded English in farmer-facing components.
- Indian locale: `+91` phone; acres and kilometres; `Asia/Kolkata` timestamps.
- Client has not yet approved translations — see placeholder register (Language review row).

### 6.5 Accessibility baseline

- Minimum 48×48dp touch targets.
- Screen reader labels on all interactive elements.
- Non-drag alternatives for all drag interactions (Fleet calendar).
- Sufficient contrast for field/sunlight readability.
- Dynamic text support.

---

## Part 7 — Offline Plan

### 7.1 What may be read offline

| Data | Offline read | Notes |
|---|---|---|
| Bounded assignment working set | Yes | Encrypted user-scoped cache |
| Profile + operating centre | Yes | Session cache |
| Sync status / pending queue | Yes | Durable local record |
| Farmer contact + farm location | Yes (encrypted) | Purge 24h after terminal state (dev); production duration requires approval |

### 7.2 What may be queued offline

| Action | Queueable | Requirement |
|---|---|---|
| Mission accept | Yes | `clientActionId` + `expectedRevision` |
| Mission start | Yes | Same |
| Issue report | Yes | Same |
| Mission complete (with acreage) | Yes | Same |
| Copilot selection | Yes | Same |
| Pilot availability toggle | Yes | Same |
| Location submission | No | Ephemeral; not queued |

### 7.3 What must be online

| Action | Online required | Reason |
|---|---|---|
| Login / session creation | Yes | Cannot mint session offline |
| Bootstrap / capability refresh | Yes | Server authoritative |
| Sync queue flush | Yes | Server must confirm |
| Copilot candidate fetch | Yes | Real-time eligibility |

### 7.4 Conflict behaviour

- Conflict = assignment revision changed on server since last sync.
- Client must refresh authoritative state and show a human-readable explanation.
- Client must never overwrite server state locally.
- Conflict evidence (queued action + server response) must be retained until resolved or purged.

### 7.5 Encryption and purge

- Assignment, farmer contact, and farm coordinates: approved encrypted native cache (not plaintext SQLite JSON).
- Cache scoped by user + installation — second Pilot must not read first Pilot's data.
- Purge triggers: logout, session revocation, installation revocation, identity mismatch, mandatory upgrade.
- Terminal-assignment cache retention: 24 hours (development default); production duration requires Operations/Privacy approval.

---

## Part 8 — Ordered Microtasks

Each agent must complete and evidence one package before starting the next. The R00 dependency graph in `MOBILE_R00_REQUIREMENTS_AND_ARCHITECTURE.md` is authoritative; this ordering follows it.

### Phase 0 — Baseline freeze and shared glossary (read-only / documentation only)

> Tasks marked **Flash** = Flash 3.6 solo. **Terra** = Terra 5.6 solo or bundle. **GPT** = GPT 5.5 solo or bundle. See `MODEL_ASSIGNMENT.md` for full assignment table and Flash task spec template.

| ID | Task | Prerequisites | Scope | Definition of done |
|---|---|---|---|---|
| ON-00 | Record exact branch/SHA, test results, deployed state | None | Documentation | Written baseline with every failure identified; no source change |
| ON-01 | Produce authoritative role/capability/status glossary | ON-00 | `docs/plan/one-ness program/glossary.md` | Matches canonical server enums; no invented terms |
| ON-02 | Produce confirmed Pilot parity matrix | ON-00 | Documentation | Every capability classified; no "visual similarity = parity" |
| ON-03 | Inventory exact Operations mobile routes that already exist | ON-00 | Read-only source inspection | Exact route list vs Section 5.2; gaps documented |

---

### Phase 0.5 — Web design system and color palette (DS-series)

The web SPA currently does not use the navy/safety-orange design system defined in Part 6. This phase applies the shared design tokens to the web frontend. It is a **prerequisite to WEB-00 and WEB-01** and must be done before any web Pilot/role workspace parity work begins.

> [!IMPORTANT]
> This phase changes visual styling only. It must not change any backend logic, authorization, state machines, or API contracts. Each DS task is Flash 3.6-safe — one area of the frontend at a time.

| ID | Task | Prerequisites | Key files | Definition of done |
|---|---|---|---|---|
| DS-00 | Create shared design token file | ON-01 glossary complete | `frontend/src/styles/tokens.css` (or equivalent; verify existing convention first) | Token file created with all Part 6 token values; imported by global stylesheet; frontend builds |
| DS-01 | Apply palette to global layout and navigation | DS-00 | Global CSS / layout component | Nav bar, sidebar, page background use navy/orange tokens; no hardcoded hex outside token file |
| DS-02 | Apply palette to button components | DS-00 | Button component(s) | Primary = safety orange; secondary = navy outline; destructive = red outline; disabled = `#E0E0E0`; frontend lint passes |
| DS-03 | Apply palette to status chip components | DS-00, ON-01 | Status chip / badge component(s) | Each canonical status maps to correct token colour (Section 6.2); no invented colours |
| DS-04 | Apply palette to web Pilot workspace | DS-01–DS-03 | Pilot role views | Cards, action buttons, availability toggle use token values; no regressions in Pilot view |
| DS-05 | Apply palette to web Fleet/Admin workspace | DS-01–DS-03 | Fleet/Admin role views | Schedule, management, assignment views use token values |
| DS-06 | Apply palette to web Sales/Farmer/Business workspace | DS-01–DS-03 | Sales, Farmer, Business role views | Lead intake forms, portal views use token values |
| DS-07 | Frontend build and visual regression check | DS-04–DS-06 | CI frontend gate | `npm run build` (or equivalent) passes; frontend lint clean; no unintended layout breaks |

---

### Phase 1 — Pilot Field repair

Maps to GEMINI rebuild workbook packages GM-00 through GM-12.

| ID | Maps to | Task | Prerequisites | Key files | Definition of done |
|---|---|---|---|---|---|
| PF-00 | GM-00 | Baseline and input validation | ON-00 | `pilot-mobile/` | Written baseline; no hidden source change |
| PF-01 | GM-01 | Contract + configuration foundation | PF-00 | `src/config/`, `src/contracts/`, `src/api/` | Malformed fixtures fail closed; valid fixtures pass |
| PF-02 | GM-02 | Auth + capability bootstrap | PF-01 | `src/auth/`, `src/store/authStore.ts` | Physical Pilot login works; Admin/Sales/Fleet rejected; token not in logs |
| PF-03 | GM-03 | Encrypted user-scoped storage | PF-02 | `src/storage/` | Second Pilot cannot read first Pilot's cache; migration tests pass |
| PF-04 | GM-04 | Durable synchronization engine | PF-03 | `src/sync/` | Airplane-mode + process-restart prove no duplicate action; conflict evidence retained |
| PF-05 | GM-05 | Navigation + design system | PF-02 | `src/design-system/`, `app/(tabs)/` | Work/Sync/Profile tabs only; no Fleet/Map; 48dp targets |
| PF-06 | GM-06 | Work list + assignment detail | PF-03, PF-05 | `src/features/work/` | No broad server object cached; ACCEPT visible when allowed; START absent until allowed |
| PF-07 | GM-07 | Copilot formation | PF-06, PF-04 | `src/features/copilot/` | Stale candidate rejected safely; success shows server-confirmed READY |
| PF-08 | GM-08 | Mission actions + issues | PF-06, PF-04 | `src/features/mission/`, `src/features/issues/` | No auto-start on mount; decimal acreage validation; allowed-actions govern all mutations |
| PF-09 | GM-09 | Sync status + profile + security | PF-04, PF-05 | `src/features/profile/`, `src/features/sync-status/` | Field user understands sync state without technical/sensitive data |
| PF-10 | GM-10 | Automated tests + CI | PF-01–PF-09 | Tests + `.github/workflows/ci.yml` | CI fails on login-token-path, auto-start-on-mount, or route-contract regression |
| PF-11 | GM-11 | Physical-device acceptance | PF-10 | Physical Android device | 12 acceptance scenarios evidenced with synthetic data; no token/coordinate in logs |
| PF-12 | GM-12 | Release readiness report (not release) | PF-11 | `docs/plan/one-ness program/pilot-release-readiness.md` | Remaining placeholders listed; no APK published from anonymous package ID |

---

### Nicks and nacks intake (NN-series) — pending colleague's zip

A colleague has implemented client-reported defects and changes in the **registration and lead module** on the web. Her work has been shared as pasted code in a document; a zip file is expected. This series handles structured intake, review, and integration of that work.

> [!CAUTION]
> Do not integrate code pasted from a document directly into the repository. Wait for the zip. All changes must be reviewed against the current source before merging — the colleague's implementation may diverge from the current branch state or conflict with the canonical parity matrix.

| ID | Task | Prerequisites | Assigned to | Definition of done |
|---|---|---|---|---|
| NN-00 | Receive and unzip colleague's work | Zip received | Maintainer / human | ✅ DONE — zip extracted to `_nn_review/frontend/` |
| NN-01 | Diff colleague's changes against current `staging` source | NN-00 | GPT 5.5 | ✅ DONE — key finding: `FarmerLogin.jsx` in zip re-introduces Firebase (retired); safe UX cherry-picks identified |
| NN-02 | Classify each change | NN-01 | GPT 5.5 | ✅ DONE — Firebase path rejected; digit-validation UX applied to application-owned OTP flow |
| NN-03–NN-N | Hotfix applied to registration and lead module | NN-02 | Terra 5.6 | 🧪 **IN TESTING** — QA team testing locally; bug reports pending; no commit/push yet |
| NN-BUG | Bug-report loop — apply QA-reported fixes | NN-03+ | Flash 3.6 per bug | Each reported bug → one Flash task; same local-only hotfix prompt format; re-verify lint + dev server after each fix |
| NN-LAST | Regression test + promote to `dev` branch | All NN-BUG closed | Terra 5.6 | Backend tests pass; frontend lint/build passes; reviewed PR to `dev` → `staging` → `main` via normal flow |

> Conflicting or ambiguous changes from the colleague's work must be surfaced to the maintainer for a decision — they must not be silently discarded or merged over the canonical source.

---

### Phase 2 — Operations Companion backend contracts

| ID | Task | Prerequisites | Definition of done |
|---|---|---|---|
| OC-00 | Audit existing Operations mobile routes vs plan | ON-03 | Exact implemented vs needed gap register |
| OC-01 | Operations employee session + bootstrap DTO | OC-00, PF-02 | Admin/Fleet/Sales bootstrap; strict DTO; no broad Prisma |
| OC-02 | Operations Farmer OTP login + bootstrap DTO | OC-00 | Farmer session; strict DTO; no staff data |
| OC-03 | Operations Business login + bootstrap DTO | OC-00 | Business session; organization-filtered DTO |
| OC-04 | Sales mobile lead intake contract | OC-01 | Phone-first lookup, geofence result, lead creation — mobile DTO only |
| OC-05 | Fleet mobile assignment + exception contracts | OC-01 | Fleet assignment list, detail, Copilot override, exception queue — mobile DTOs |
| OC-06 | Fleet mobile Live GPS contract | OC-01 | Latest sample only; Admin/Fleet; coordinate-free confirmation |
| OC-07 | Farmer service request contract (guided wizard) | OC-02 | Acreage, crop, location, preferred window, geofence result |
| OC-08 | Contract tests for all Operations routes | OC-01–OC-07 | Role-negative tests pass; no broad payload escapes |

### Phase 3 — Operations Companion mobile client

| ID | Task | Prerequisites | Definition of done |
|---|---|---|---|
| OM-00 | Scaffold `ops-mobile/` Expo project | OC-01 | Separate package; distinct navigation; no Pilot Field routes |
| OM-01 | Shared design-system + contract primitives | PF-05, OM-00 | Tokens/components reused where practical; not copied wholesale |
| OM-02 | Authentication journeys (Employee / Farmer OTP / Business) | OC-01–OC-03, OM-01 | Three login paths; role-resolved workspace; no role picker after auth |
| OM-03 | Sales workspace (customer search, registration, lead intake) | OC-04, OM-02 | Guided wizard; geofence result; no appeal; phone-first |
| OM-04 | Fleet workspace (schedule, exceptions, Copilot override, Live GPS) | OC-05, OC-06, OM-02 | Non-drag move alternative; explicit map consent; latest-location-only |
| OM-05 | Farmer workspace (services, request wizard, status) | OC-07, OC-02, OM-02 | Only linked requests; guided step flow |
| OM-06 | Admin bounded workspace (assignment overview, team, fleet) | OC-01, OM-02 | Progressive; no secrets/hashes/raw SQL; Admin-only protection |
| OM-07 | Business workspace (linked requests, notifications) | OC-03, OM-02 | Organization isolation; no staff tools |
| OM-08 | Sync, offline, profile, security journeys | All above | Pending/retry/conflict/restored states; purge on logout/revoke |
| OM-09 | Automated tests + CI gate | OM-01–OM-08 | Contract, role-negative, offline, navigation tests; does not weaken Pilot Field CI |
| OM-10 | Physical-device acceptance + release readiness report | OM-09 | Synthetic data; package ID / Play ownership placeholders documented |

### Phase 4 — Web SPA alignment (after mobile contracts stable)

| ID | Task | Prerequisites | Definition of done |
|---|---|---|---|
| WEB-00 | Align web status chips and terminology to shared glossary | DS-03, ON-01 | Canonical terms throughout; no legacy/invented labels |
| WEB-01 | Implement web Pilot workspace parity defects (from Part 3) | DS-04, ON-02 | Web Pilot views match server capability model; regression tests pass |
| WEB-02 | Close AA-10/AA-11 pointer drag/resize gap | AA plan | Browser acceptance passes |
| WEB-03 | Align web Farmer/Business portal to OC-07 contract | DS-06, OC-07 stable | Portal reads server-filtered DTO; isolation tests pass |
| WEB-04 | Cross-client regression — same staging revision and dataset | PF-11, OM-10, DS-07 | Web, Pilot Field, Operations Companion tested against same staging SHA and data |

---

## Part 9 — Test Strategy

| Layer | Scope | Gate |
|---|---|---|
| Backend unit | Repository, service, state machine, DTO allow-list | `npm test` in backend |
| Backend contract | All mobile v1 routes; role-negative; malformed fixtures | CI gate; must pass before any route PR |
| Role-negative | Every mobile endpoint returns 403 for wrong role | CI gate |
| Offline / retry | Queue persistence, ordering, retry UUID reuse, process restart | GM-04 / OM-08 |
| Browser E2E | Scheduling, role views, terminal filtering | Staging gate |
| Android native | Encrypted storage, device restart, second-user isolation | Physical device; native build |
| Container stack | Isolated Compose stack migrates, starts healthy | CI staging gate |
| Regression | Auto-start-on-mount, login-token-path, broad DTO reintroduction | Permanent CI gate |

---

## Part 10 — Release Strategy

### Pilot Field Android

1. **Local verification** — PF-10 CI passes; PF-11 physical-device evidence collected.
2. **`dev` → `staging` PR** — reviewed; tests pass.
3. **Staging APK** — CI produces arm64 staging APK on office runner; internal signing; VPN-only staging URL.
4. **Staging acceptance** — maintainer installs on physical device; all 12 PF-11 scenarios pass.
5. **Production API activation** — blocked until session lifetime, revocation, and all placeholder gates approved (see `current_placeholders.md`).
6. **Signed release APK** — blocked until permanent package ID, company Play ownership, and signing identity approved.
7. **Rollback** — staging: reinstall previous artifact. Production: `main` revert PR; no data mutation.

### Operations Companion

1. Same `dev` → `staging` → `main` flow.
2. OTP delivery blocked until provider selected and sandbox evidence exists.
3. Farmer/Business portals blocked until staging privacy review complete.
4. Store release blocked until package ID, Play Console ownership, privacy policy, signed identity approved.

### Web SPA alignment

- Normal `dev` → `staging` → `main` flow via `workflow_run` after CI passes.
- No seed, wipe, or import on any code push.

---

## Part 11 — Decision Register

Every item below is an unresolved client or policy decision. A coding agent must not invent answers. Use safe placeholders until an explicit decision is supplied.

| ID | Question | Blocks |
|---|---|---|
| DEC-01 | Which Pilot web capabilities must remain as fallback after mobile rollout? | WEB-01 |
| DEC-02 | Is Pilot Field mandatory for every Pilot or optional during transition? | Rollout planning |
| DEC-03 | Which non-Pilot roles are in the first Operations Companion release? | OM-03–OM-07 scope |
| DEC-04 | Does "all-in-one login" require account-type chooser, identifier detection, or separate entry? | OM-02 |
| DEC-05 | Approved mobile session lifetime and maximum active installations per Pilot | PF-02, OC-01 |
| DEC-06 | Notification provider, channel, and approved notification events | All mobile releases |
| DEC-07 | Exact mission states for "waiting for spare", travel, spraying, pause/resume, exceptions | PF-08, OC-05 |
| DEC-08 | Live-location notice, consent wording, sampling cadence, supervisor visibility | PF-11, OM-10 |
| DEC-09 | Which customer actions (if any) must work offline in Operations Companion? | OM-05, OM-08 |
| DEC-10 | Languages and client-reviewed wording required at launch | PF-05, OM-01 |
| DEC-11 | Which client feedback items block next demonstration vs. later release? | Prioritization |
| DEC-12 | Domain, TLS, signing identity, Play account, privacy policy, support contact, release owner | All production releases |
| DEC-13 | Permanent Android package IDs for both apps | PF-12, OM-10 |
| DEC-14 | OTP delivery provider (WhatsApp-first; SMS fallback) — Meta is a candidate, not confirmed | OC-02, OM-02 |
| DEC-15 | Production mobile session lifetime, revocation procedure, lost-device support | Production mobile activation |
| DEC-16 | Production farmer import on `main` (separate from this program) | `docs/MIGRATION_ON_MAIN.md` |

---

## Part 12 — Traceability

### Recommended sequence (one-ness planning.md Section 15) → plan packages

| Recommended step | Plan packages |
|---|---|
| 0. Apply shared color palette to web SPA | DS-00–DS-07 |
| 1. Freeze and test current baseline | ON-00 |
| 2. Build authoritative glossary | ON-01 |
| 3. Pilot parity and divergence decisions | ON-02, Part 3 |
| 4. Repair shared backend contract defects | PF-01, OC-00 |
| 5. Align Pilot Field to parity matrix | PF-02–PF-09 |
| 6. Extract/reuse mobile design-system primitives | PF-05, OM-01 |
| 7. Operations mobile API inventory and contracts | OC-01–OC-08 |
| 8. Operations authentication/bootstrap + role shells | OM-00–OM-02 |
| 9. Implement role workspaces in dependency order | OM-03–OM-07 |
| 10. Add offline only to approved workflows | PF-04, OM-08 |
| 11. Close client feedback items with evidence | Part 13 |
| 12. Validate both apps and web against same staging revision | WEB-04 |
| 13. Prepare (not assume) production activation and store release | PF-12, OM-10 |

### R00 dependency graph → plan packages

| R00 node | Plan package(s) |
|---|---|
| `D00` schema/repository primitives | Verify current state; repairs in OC-01+ |
| `W00` web Copilot formation + Fleet exception | WEB-01 |
| `S00` shared session/install/capability foundation | PF-02, OC-01 |
| `P00` Pilot work DTOs and crew formation API | PF-01, PF-06, PF-07 |
| `P10` mission mutation, issue, sync, location | PF-04, PF-08 |
| `O00` Operations Sales slice | OC-04, OM-03 |
| `O10` Operations Fleet exception slice | OC-05, OM-04 |
| `Q00` cross-client regression | WEB-04 |
| `A00` Pilot Field implementation/release | PF-10–PF-12 |
| `B00` Operations implementation/release | OM-09–OM-10 |

---

## Part 13 — Client Feedback / "Nicks and Nacks" Register

The client's newest defect/change list has **not yet been supplied**. When the maintainer provides the list, each item must be added here in the structured format below. Do not silently mix a defect, UI preference, new policy, and new feature into one task.

Per-item format:

```
ID:
Original client wording:
Affected role and surface:
Current observed behaviour:
Expected behaviour:
Classification: defect / parity / UX / policy / new capability
Backend contract impact:
Data or migration impact:
Security/privacy impact:
Acceptance test:
Priority and dependency:
Unresolved question:
```

---

## Safety reminders for all coding agents

1. Do not write, generate, patch, delete, move, commit, merge, push, deploy, migrate, seed, or mutate anything until assigned a specific numbered package.
2. Verify the current source first. This document is a map, not proof that a feature works.
3. Never touch `main` branch or production data during any package in this program.
4. Never paste Stitch HTML into production source. Stitch exports are visual evidence only.
5. Never revive Firebase Authentication, Bhumeet mocks, raw SQL utilities, or archived one-off scripts.
6. Report disagreements between source, tests, and planning documents rather than choosing the most convenient version.
7. Record every decision that changes customer data, money, privacy, retention, or production topology before implementing it.
8. Do not claim "fully working" or "production-ready" because a screen renders or a test passes locally.

---

*End of RFLY One-ness Program Master Implementation Plan*  
*Next step: Maintainer supplies client feedback list → populate Part 13 → coding agent begins ON-00.*

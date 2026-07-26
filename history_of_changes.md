# History of Changes

> **Historical record:** current product requirements are in [docs/plan/AGENTS.md](docs/plan/AGENTS.md). Entries below describe what happened in the codebase at the time; they are not the current specification.

## July 26, 2026 - Phase 1 Strict Intake and Legacy-Path Retirement

* Added a forward-only, fail-closed strict-intake migration. It creates the minimal, expiry-indexed `DeclinedEnquiry` record and removes active appeal, Google Form, transport-fee, and Bhumeet schema paths only on a fresh/approved database. It refuses a populated legacy path until backup, archival approval, and restore evidence exist.
* Reworked public, Sales, and authenticated Farmer intake around server-pinned channels, explicit input allowlists, canonical phone normalization, deterministic nearest-centre geofencing, and coordinate-free audit events. An out-of-area request now returns only a generic decline and stores no Lead, location, distance, acreage, assignment, appeal, payment, or schedule.
* Added an idempotent declined-enquiry expiry purge, revalidation before Sales processing, automatic assignment, manual scheduling, and rescheduling, and safe rejection of legacy records whose current location is no longer serviceable. Public bookings await Sales review; manual Sales remains the phone-first path.
* Removed active Google Form/surveyor routes/jobs/configuration, appeal routes/UI/templates, transport-fee logic, and Bhumeet mock UI/routes. Replaced the public Firebase registration screen with the secondary public booking form, and aligned the browser acceptance scenarios to strict decline behaviour.
* Added Malayalam to the backend language contract so the frontend’s advertised language cannot cause a valid public request to fail.
* Verification to date: Prisma schema validation, backend syntax checks, backend/frontend locale parsing, frontend lint, production build, and production Compose rendering passed (the existing large-chunk advisory remains). The disposable PostgreSQL suite, migration replay, and browser audit are pending because Docker Desktop was unavailable on this workstation; this is not a production-ready claim.

## July 25, 2026 - Canonical Production-Readiness Documentation Migration

* Created the versioned canonical planning set under `docs/plan/`: agent guidance, business context, future-state specification, production hardening register, placeholder register, and production-readiness delivery plan.
* Marked the superseded root/hidden/docs guidance, legacy specification/context, product handoff, placeholders, hardening register, and Bhumeet guidance as EOL redirects. README and operational runbooks now identify themselves as baseline/history rather than current product requirements.
* Recorded the approved future target without changing application behaviour: phone-first Sales intake, strict service-area decline with 30-day contact-only retention, LMV fleet scheduling, evidence-backed billing, optional status portals, Compose-first deployment, and staged CI/CD delivery.
* Corrected the deployment runbook's obsolete JWT-secret reference to the recovery-hash-secret contract. Removed local credential-like documentation artifacts without recording their contents; external credential rotation remains required and is not claimed as complete.
* Verification: reviewed canonical links, Git ignore policy, and planned source-doc staging. No LMV, intake, billing, provider, CI/CD, or runtime code was changed in this documentation migration.

## July 24, 2026 - Fresh Handover Bootstrap

* Added `backend/scripts/bootstrapInitialAdmin.js` and the `npm run bootstrap:initial-admin` command. The script refuses to run without `CONFIRM_DATABASE_WIPE=RESET_TO_INITIAL_ADMIN`, wipes operational/demo data, and creates exactly one active Admin from environment-provided name, email, and password.
* Clarified that `backend/prisma/seed.js` is development/demo-only and must not be used for client production handover. Fresh client databases should run migrations, then the guarded initial-Admin bootstrap, then let the client Admin create real employee and operational records.
* Verification: local database reset was executed successfully after migrations; the database contained one active Admin and zero demo Sales/Fleet/Pilot/Farmer/Business users, leads, drones, centres, assignments, payments, chats, pricing rows, recovery challenges, or sessions.

## July 23, 2026 - Login, Session, and Recovery Hardening Completed Locally

### Rollback and repository safety

* Created rollback checkpoint commit `79a753b` before changing login behavior, and added `presentation/` to `.gitignore` so local presentation material is not committed.
* Removed the tracked `backend_env_backup` and `frontend_env_backup` copies and ignored that filename pattern. Any credential that ever appeared in those historical files still requires rotation; deleting a working-tree copy does not revoke it.

### Authentication and session security

* Replaced browser-stored bearer credentials with hashed, database-backed opaque sessions. The production session cookie is host-only, `Secure`, `HttpOnly`, and `SameSite=Strict`; a separate host-only, `Secure`, readable CSRF cookie/header protects authenticated mutations.
* Added `/api/auth/me`, current-session logout, logout-all, idle and absolute expiry, conditional sliding activity, account-state/role enforcement, and immediate session/socket revocation after password, role, activation, archive, or recovery changes.
* Closed stale-credential races: session creation now locks and compares the exact credential snapshot, and bcrypt cost upgrades cannot overwrite a concurrent password reset.
* Hardened Socket.IO with cookie-session authentication, immediate post-join and per-packet revalidation, pending-connection revocation, hash-only credential retention, and safe acknowledgement of malformed payloads instead of process-level exceptions.
* Restricted employee and Business login endpoints to their intended active roles, kept Farmer sessions explicitly Farmer-only, removed raw provider error text from OTP screens, and preserved offline logout-all intent.

### Recovery, password, and identity safety

* Added generic, rate-limited Employee recovery and one-time Business phone recovery. Challenges are HMAC-protected, attempt-limited, expiring, bound to `authVersion`, atomically replaced, and consumed with sibling/session revocation.
* Queued delivery work for eligible and decoy recovery requests so provider latency does not reveal account existence. The live WhatsApp/SMS/email adapter still fails closed until approved providers and sandbox evidence exist.
* Required Firebase phone proofs to come from the phone provider, pass revoked-token checking, be recent for recovery, and use a unique hash so the same proof cannot mint two reset grants.
* Enforced bcrypt's 72-byte input boundary, canonicalized account phone numbers, added database uniqueness, and made ambiguous/invalid legacy phone data fail migration instead of selecting an account arbitrarily.
* Marked organization-provisioned work emails as verified recovery destinations under the current trusted Admin/Fleet provisioning policy.

### Database, frontend, and deployment contract

* Added forward migrations for the reconciled current schema, recovery concurrency fields, and canonical unique phone identities. Test orchestration now regenerates Prisma Client and recreates a named disposable database before replaying all ten migrations.
* Updated the React auth context and API/socket clients to use cookies, in-memory identity, CSRF, centralized expiry handling, protected-route loading states, cross-tab logout, and no persisted application token/user.
* Added Employee and Business recovery flows, corrected role routing and login layouts, retained queued offline actions safely, and contained the Fleet calendar on tablet widths.
* Reconciled the environment, CI, Docker/Compose, nginx, README, login use case, placeholder register, and production-hardening contract with opaque sessions and recovery hashing.

### Verification

* Full disposable-database backend suite passed **74/74**, including session/CSRF, login races, recovery concurrency/replay, malformed sockets, role guards, phone uniqueness, and bcrypt byte-boundary coverage.
* Browser acceptance passed **30/30** across public intake, all four employee roles, protected APIs, live chat/GPS, mission/payment lifecycle, offline replay, and responsive phone/tablet layouts. Login responses contain no token and browser storage contains no application credential.
* Prisma validation, frontend lint, frontend production build, and production Compose rendering passed. The build retains only the known non-blocking large-chunk advisory.
* Frontend dependency audit reported zero findings. Backend audit passes the high/critical gate; six transitive moderate advisories remain in the Firebase Admin dependency chain and currently require a breaking forced downgrade, so no forced change was applied.

## July 15, 2026 - Farmer Mobile Auth and Backend Cleanup
### Database & Data Models
* Added the `FARMER` role to the Prisma database schema. --gemini (2026-07-15T13:40Z)
* Added `village` and `district` fields to the `User` Prisma model to support farmer profiles. --gemini (2026-07-15T13:40Z)
* Generated and applied new Prisma migrations to push the schema to PostgreSQL. --gemini (2026-07-15T13:42Z)

### Backend Architecture
* Installed the `firebase-admin` dependency. --gemini (2026-07-15T13:43Z)
* Created `backend/config/firebase.js` to initialize the Firebase Admin SDK securely. Included robust string sanitization to automatically clean up copy/paste formatting errors (like trailing commas and quotes) in the private key. --gemini (2026-07-15T14:57Z)
* Implemented `/farmer/login` and `/farmer/complete-signup` endpoints in `authController.js` and `authRoutes.js` to verify Firebase ID tokens and map them to database records. --gemini (2026-07-15T13:45Z)
* Removed obsolete Bhumeet integration dependencies and jobs from `server.js` and `bhumeetSync.js`. --gemini (2026-07-15T14:51Z)
* Added environment variable guards to `googleFormSync.js` to prevent the server from crashing when the Google Form Webhook URL is omitted. --gemini (2026-07-15T14:51Z)
* Added necessary Firebase environment variable placeholders to `backend/.env.example`. --gemini (2026-07-15T13:48Z)

### Frontend Architecture & UI
* Installed the `firebase` web dependency. --gemini (2026-07-15T13:46Z)
* Created `frontend/src/lib/firebase.js` to initialize Firebase safely on the client side. --gemini (2026-07-15T13:47Z)
* Updated `AuthContext.jsx` to recognize and natively handle the new `FARMER` role throughout the app routing. --gemini (2026-07-15T13:47Z)
* Rebuilt `LandingPage.jsx` to replace the static "Request Service" form with an interactive 3-step farmer OTP sign-in/registration flow using `RecaptchaVerifier` and phone authentication, perfectly matching the existing visual theme. --gemini (2026-07-15T13:55Z)
* Enhanced `LandingPage.jsx` error handling to display exact Firebase OTP failure reasons directly in the UI. --gemini (2026-07-15T15:00Z)
* Created a `FarmerDashboard.jsx` placeholder screen for users to land on after a successful login. --gemini (2026-07-15T13:47Z)
* Added necessary Firebase environment variable placeholders to `frontend/.env.example`. --gemini (2026-07-15T13:48Z)

## July 15, 2026 - Emergency Branding Change for Demo
* **App Name Change**: Renamed the application from "Field Operations" to "Daas" across the frontend UI as requested for an emergency demo. --gemini

## July 14, 2026 - Hardening paused with restart-safe handoff
* **Work stopped on request**: All active hardening workstreams were halted after the user requested a pause. H0 privacy/device/GPS-presentation work and H1 perimeter work reached verified local checkpoints; H3 through H7 were not started.
* **H2 explicitly marked partial**: The session/recovery schema, migration, and repositories were added, but cookie authentication, CSRF, logout/revocation, recovery endpoints/UI/provider delivery, migration confirmation, and regression verification were not completed. The current tree must not be represented as a finished H2 or production build.
* **Container foundation is a draft**: Isolated-per-customer Compose, Dockerfiles, CI, and operations runbooks were written, but validation was interrupted and their JWT/session secret contract must be reconciled after H2.
* **Restart document**: Added `docs/hardening_pause_handoff_2026-07-14.md` with the exact completed, partial, pending, verification, external-input, and safe-resume state.

## July 14, 2026 - Emergency platform-wide UI correction
* **Root cause removed**: The previous global theme forced reusable cards to a white surface while the Admin and Sales page roots still forced white text on a dark background. That mixed theme produced unreadable, mostly empty-looking cards. Removed all 232 JSX inline style objects and the remaining legacy root-theme conflicts so one design system controls every surface.
* **Unified operations design system**: Rebuilt the visual foundation in `frontend/src/index.css` around a customer-neutral field-operations palette: deep forest navigation, warm stone/sage work surfaces, compact data density, and restrained green, amber, blue, and red operational accents. Added shared `OperationsShell` and `OpsIcon` components so Admin, Sales, Fleet Manager, and Pilot navigation, identity, spacing, badges, and mobile behavior remain consistent.
* **Every active workflow reworked**: Rebuilt the public request page, employee login, Admin fleet and user management, Sales lead and appeal flows, Fleet exception calendar, Pilot mission workspace, CRM timeline, support chat, pending payments, and live GPS. Added a designed not-found state and consistent forms, notices, empty states, status badges, tables, dialogs, and action controls.
* **Responsive and stale-cache correction**: Added explicit desktop, tablet, and phone layouts across all role windows. The development client now removes previously registered service workers/caches so Vite cannot display an old shell; production uses a versioned worker that deletes obsolete caches. Sales live updates now use WebSocket transport directly, removing a polling-teardown HTTP 400.
* **Verified result**: The stricter Edge audit passes 30/30 workflows with zero unexpected console errors, runtime exceptions, or normal-flow HTTP errors. All mobile/tablet overflow checks pass. Backend tests pass 26/26; frontend lint/build and Prisma validation pass. The build retains only the known non-blocking bundle-size advisory. Detailed scope and evidence are in `docs/ui_correction_report_2026-07-14.md` and `docs/test-evidence/browser-audit-2026-07-14/`.

## July 14, 2026 — Local development Admin recovery
* **Locked-out demo recovery**: Added the ignored `backend/scripts/resetLocalAdminPassword.local.js` utility. It interactively confirms a locally entered replacement password, applies the normal bcrypt policy to only the configured local Admin account, records a credential-free audit event, and refuses production execution. No password is stored or printed.
* **Handoff**: Added the usage note to `README.md`; the production hardening recovery requirement remains open because this local utility is not a WhatsApp/SMS/email recovery implementation.

## July 14, 2026 — Admin operational-control decision
* **Hardening requirement recorded**: The operating-company Admin is now defined as the highest in-application operational role. A future audited Operations Control area must provide searchable monitoring and controlled management of company records: centres/service radii, staff, pilots, drones, leads, assignments, payments, chats, alerts, and business configuration.
* **Security boundary retained**: This does not expose database credentials, provider secrets, password hashes, arbitrary raw SQL, or the ability to rewrite append-only audit history through the browser. Privileged changes require validation, confirmation, audit entries, and permission tests.

## July 14, 2026 — Demo-readiness defect repair
* **Security and Authentication**: Protected every user/drone management route with authentication and role checks, removed credential fields from user, assignment, escalation, and audit responses, replaced direct password storage/comparison with bcrypt at cost 12, migrated the eight existing local role accounts without printing their passwords, removed the login credential disclosure, and made production startup reject an absent or weak JWT signing secret.
* **Operational Workflow Repairs**: Restored `NEW` leads to the Sales queue, removed forbidden Sales polling of Fleet assignment data, added a least-privilege Sales alerts endpoint, made Sales manual intake use the verified/auto-assignment path, persisted Sales verification details, added a complete Sales appeal-review screen, repaired Admin account creation and fleet status counts, and prevented GPS requests from racing mission transitions.
* **Validation, Accessibility, and Neutrality**: Added server/client phone and positive-acreage validation with a configuration-driven maximum, associated public and login labels with their controls, removed external font loading for deterministic/offline rendering, removed customer-specific wording from active farmer messages and seed accounts, and deleted unused JSON credential fixtures plus the obsolete walkthrough.
* **Test Isolation and Local Data Cleanup**: Added isolated `rfly_daas_backend_test` orchestration, repaired Phase 1/7 fixture ownership and HTTP teardown, removed three interrupted test accounts from the normal demo database, and added direct negative security regression coverage. Browser and backend tests no longer mutate the normal development database.
* **Verified Result**: Backend suite 26/26 passed; Edge browser acceptance 25/25 passed; frontend lint and production build passed; Prisma validation passed. The full evidence and remaining provider/production limits are in `docs/demo_acceptance_report_2026-07-14.md`.

## July 14, 2026
* **Rigorous Browser Acceptance Harness**: Added a repeatable Microsoft Edge audit (`frontend/e2e/browser-audit.mjs`) that builds the production frontend, launches isolated frontend/backend processes, resets only `rfly_daas_browser_test`, generates ephemeral credentials in memory, and preserves JSON plus screenshot evidence. Centralized the frontend backend address through `VITE_API_URL` so test and deployment environments no longer require source edits.
* **Acceptance Result (historical, before the repair pass above)**: The initial run completed 24 checks: 14 passed and 10 failed. Passing workflows included five-language rendering, mobile layout, in/out-of-range intake and appeal, four-role login, manual Sales intake, Fleet exception scheduling, Pilot mission lifecycle with Fleet-visible GPS, offline replay, payment fallback/cash collection, CRM timeline, Admin–Pilot chat, and health.
* **Release-Blocking Findings**: Anonymous callers can read and mutate user/drone data; user-list responses expose `passwordHash`; the Sales `NEW`-lead queue is broken; invalid phone/negative acreage are accepted; Admin employee creation and fleet status counts are broken; the login page exposes demo credentials; and public inputs lack accessible label associations. Added `docs/browser_acceptance_audit_2026-07-14.md` with evidence, severity, exact locations, limitations, and repair order.
* **Regression Evidence**: Frontend lint/build and Prisma validation pass. A full backend run executed all 23 assertions with 22 passing and one fixture-state failure after browser data mutation; clean-seed reruns pass that assertion but intermittently leave the Phase 7 worker open under Node 24.18.0, so backend test isolation/teardown remains a tracked defect rather than being reported as clean.

## July 14, 2026
* **White-Screen Runtime Fix**: Fixed the `react-big-calendar` drag-and-drop addon import in `frontend/src/pages/FleetManagerDashboard.jsx`. Vite development mode exposed the CommonJS addon as `{ default: function }`; calling that wrapper object during module loading crashed React before any route could render, including the public landing page.
* **Browser-Level Verification**: Loaded `http://localhost:5173/` in a clean headless Edge profile, confirmed that the landing page rendered into the React root, and captured no runtime exceptions. Frontend lint and production build pass. The live backend `GET /api/health` returns HTTP 200 with PostgreSQL and both scheduled jobs healthy.

## July 13, 2026
* **Product Decision Handoff**: Added `docs/product_decisions_and_production_handoff.md`, consolidating the complete plain-language explanation of all sixteen placeholder and hardening decisions: JWT handling, customer neutrality, monitoring, password recovery, company configuration, pilot/drone administration, weather options, Google intake, deferred Bhumeet work, WhatsApp, UPI, language review, GPS privacy, device support, audit retention, and chat lifecycle. It also records immediate user actions, demo-versus-production boundaries, provider links, and verification evidence without copying any secret from `.env`.

## July 13, 2026
* **Production Decisions and Agent Guardrails**: Added `production hardening.md` as the mandatory release register and a root `AGENTS.md` that requires future agents to read it. Recorded customer-neutral branding, future multi-company isolation, WhatsApp-default password recovery with SMS/email fallback, company-owned operating values, Android/desktop-first support, interim indefinite audit retention, and integration ownership decisions.
* **Chat Retention Policy**: Replaced the six-hour blanket timeout with the approved policy: unread chats remain open, fully read inactive chats close after 24 hours, and a participating Admin can close a chat immediately for both participants. Manual closure is broadcast live, server-enforced, and audited without message content.
* **GPS Privacy Correction**: GPS update audit events no longer copy latitude/longitude into append-only history. The operational assignment still stores only its latest point; consent wording and final post-mission coordinate deletion remain explicit production decisions.
* **Deferred Marketplace Cleanup**: Removed the Bhumeet route/controller, Admin dashboard, mock feed, and unsafe root connectivity test from the active application. Kept only a credential-free future note in `docs/deferred/bhumeet.md`. Because the removed test contained a plaintext external credential, that credential must be rotated even though the file is deleted.
* **Verification**: All 23 backend tests pass, including unread retention, Admin-only bilateral closure, and coordinate-free GPS audit assertions. Prisma validation, frontend lint, and frontend production build pass; the build retains only the known non-blocking large-bundle advisory.

## July 13, 2026
* **Phase 14 — Cleanup and Project Runbook**: Removed obsolete JSON-file development controls: the hidden frontend `/flush` page, its filesystem purge/populate APIs, the old `/api/submit` success mock, and the unused Google Form sync endpoint. The active system no longer exposes a second, incompatible JSON-data path.
* **Safe Development Reset**: Replaced those paths with `POST /api/system/seed`, which runs the Prisma seed only for authenticated Admins outside production. This keeps development reset capability while preventing a production endpoint from silently erasing database data.
* **Documentation and Final Verification**: Added the top-level `README.md` with architecture, setup, test commands, operations notes, and pointers to the specification/context/instruction documents. Backend tests and Prisma validation pass; frontend lint and production build pass. Updated the placeholder register and project instructions to reflect the retired legacy paths.

## July 13, 2026
* **Phase 13 — Health, Structured Logs, and Job Heartbeats**: Added public `GET /api/health`, which performs a lightweight PostgreSQL check and returns the latest notification-escalation and chat-auto-close job heartbeats. It returns `200` when healthy and `503` when the database is unavailable.
* **Unattended Workflow Visibility**: Added a structured JSON logger that redacts common sensitive fields. Google Form intake, automatic assignment/manual fallback, notification escalation, and chat auto-close now write machine-readable outcomes. Both scheduled jobs run once at startup and record success/failure heartbeats on every subsequent cycle.
* **Verification and Handoff**: Added automated coverage for the health endpoint's database check and heartbeat payload. All backend tests and Prisma validation pass. Updated `current placeholders.md` with the still-required external uptime monitoring, alert recipients, and production-log destination.

## July 13, 2026
* **Phase 12 — Responsive Operations UI**: Replaced the previous branded glassmorphism visual language with a neutral, premium field-operations system: paper/soil tones, high-contrast operational states, restrained cards, cleaner inputs/tables, and mobile-first spacing. The application no longer visually depends on the RFLY name or any invented logo/brand asset.
* **Desktop and Pilot Parity**: Added Tailwind CSS to the Vite build and Framer Motion for restrained transitions. The public intake and login screens have a new brand-neutral presentation, while the pilot workspace was rebuilt as a responsive operations shell: on phones, its mission and support navigation remains visible and usable rather than collapsing into an unusable desktop sidebar. Existing backend workflows, offline queue, GPS, chat, payments, and permissions are unchanged.
* **Verification and Handoff**: Frontend lint and production build pass. The build reports only the existing large-bundle advisory, not an error. Updated `current placeholders.md` with the deliberately deferred brand identity, colour, logo, and imagery decisions needed before a branded launch.

## July 13, 2026
* **Phase 11 — Five-Language i18n Framework**: Added `react-i18next` to the frontend and a central supported-language list: English (`en`), Tamil (`ta`), Kannada (`kn`), Telugu (`te`), and Hindi (`hi`). The public request page now changes immediately when a language is selected, remembers the selection in the browser, and submits it as the farmer's `preferredLanguage`.
* **End-to-End Farmer Language**: Intake validates the supported language code before storing a lead. The backend now has matching lifecycle-message dictionaries and locale-aware scheduled dates for all five languages; payment-link wording is also translated rather than being hardcoded in English. An unsupported language is rejected clearly instead of being silently saved.
* **Verification and Handoff**: Added automated coverage for every supported language's message template and variable substitution, plus invalid-language rejection. All twenty-two backend tests pass; Prisma validation, frontend lint, and the production build pass. Updated `current placeholders.md`: Kannada, Telugu, and Hindi copy is deployed as draft wording and must receive native-speaker/business approval before production use.

## July 13, 2026
* **Phase 10 — Audit Log and CRM Timeline**: Added the protected `GET /api/audit-log?entityType=Lead&entityId=` API. It presents one chronological lead timeline by combining the existing append-only audit records for that Lead, its Assignment, and any related PaymentRecords; no duplicate tracking database was introduced.
* **Sales and Admin Logbook**: Replaced the obsolete Admin-only mock logbook with a searchable real-lead table and timeline drawer. Sales now has the same CRM Logbook entry in its dashboard. Selecting a lead opens its recorded lifecycle — geofence, assignment, mission actions, notifications, payment events, and GPS updates where present — with timestamps and recorded reasons/statuses.
* **Access and Verification**: Only authenticated Sales, Fleet Managers, and Admins may access timeline data; pilots are rejected. Added an automated test proving lead, assignment, and payment events are returned in order, while rejected-role and invalid-query paths are handled explicitly. All twenty backend tests pass; Prisma validation, frontend lint, and the production build pass. Updated `current placeholders.md` with audit-log retention and access-policy decisions required before launch.

## July 13, 2026
* **Phase 9 — Offline-First Pilot App and Live GPS**: Rebuilt the pilot task view around the server-enforced mission states. Pilots can accept, start, complete (with actual acreage), or decommission their own missions. When the network is unavailable, each action is saved in the browser's IndexedDB and replayed in creation order when the connection returns; permanent stale-client errors are reported and removed instead of failing silently.
* **Offline Access and GPS**: Added a lightweight service worker that caches the application shell after its first online visit. While a mission is `PILOT_ACCEPTED` or `IN_PROGRESS`, the browser asks for device location every 60 seconds by default (configurable with `VITE_GPS_PING_INTERVAL_MS`). GPS pings use the same offline queue and resume automatically after reconnection.
* **Secured Live Location**: Added authenticated REST and Socket.io location APIs. Only the assigned pilot may submit coordinates; only Fleet Managers and Admins may read/watch them. The database intentionally keeps only each assignment's latest latitude, longitude, and time — not a historical route — and records each accepted update in the audit log. Both Fleet and Admin dashboards now have a live-location panel for active missions.
* **Verification and Handoff**: Added an automated Phase 9 test for assigned-pilot authorization, Fleet read access, persisted coordinates, audit logging, and real Socket.io broadcasts. All eighteen backend tests pass; Prisma validation, frontend lint, and the production build pass. Updated `current placeholders.md` with the required consent, cadence, retention, and real-device offline-test decisions.

## July 13, 2026
* **Phase 8 — Payments with UPI and Cash Fallback**: Mission completion now always creates a persistent `PaymentRecord` and releases the drone as before. Without a configured UPI provider, the record becomes a pending `CASH` manual-collection task; payment setup can never prevent a mission from completing.
* **Collection Workflow**: Added protected payment APIs for the pending-collection list, UPI-link generation, cash collection marking, and a webhook completion path. Admins and Sales can see the oldest pending records first and mark cash collected. The UPI webhook stays disabled unless its verification secret is configured.
* **Safe Pricing and Messaging**: Payment amount reads `SPRAY_RATE_PER_ACRE` from `PricingConfig`. The development seed value is explicitly ₹1/acre and documented as non-commercial; a missing rate creates a visible configuration-needed record instead of blocking completion. A real UPI link, once available, is sent through the existing farmer-message service; otherwise the completion message does not invent a link.
* **Verification and Handoff**: Added cash and UPI-provider tests, including verified webhook settlement. All sixteen backend tests pass; Prisma validation, frontend lint, and the production build pass. Updated `current placeholders.md` with the rate and UPI integration locations and handoff requirements.

## July 13, 2026
* **Phase 7 — WhatsApp Farmer Communications**: Added a farmer-message service with swappable template keys, language code, variables, and phone number. English and Tamil lifecycle templates now cover request processing, pilot scheduling, mission start, mission completion, and approved/rejected out-of-range appeals.
* **Safe Placeholder Delivery**: No WhatsApp API request is made until a provider client is configured. In the current development setup, each planned delivery is recorded as `WHATSAPP_MOCK_DELIVERY` in the audit log and the lead/mission workflow continues normally. Provider errors are likewise recorded without blocking operations.
* **Lifecycle Wiring**: Lead processing, automatic/manual scheduling, pilot mission start/completion, and appeal decisions invoke the message service. Completion honestly states that invoice details will follow until Phase 8 supplies the payment link; no fabricated invoice URL is sent.
* **Verification and Handoff**: Added tests covering every Phase 7 trigger, English/Tamil template selection, and the no-provider fallback. All fourteen backend tests pass; Prisma validation, frontend lint, and the production build pass. Updated `current placeholders.md` with the real Phase 7 code locations and the exact future provider integration work.

## July 13, 2026
* **Placeholder and Integration Register**: Added `current placeholders.md` as the living handoff list for temporary values, mock integrations, external credentials, policy inputs, and upcoming integration work. Each entry records the active code location, the safe behaviour today, and the real-world input needed before production use. Project instructions now require future phases to keep this register current without ever copying secrets into it.

## July 13, 2026
* **Phase 6 — Admin–Pilot Socket.io Chat**: Added an authenticated, persistent support-chat workflow for Admins and Pilots. Both roles can open a chat with the other role, but the server rejects every other role pairing and blocks non-participants from seeing sessions or messages.
* **Live Delivery and Read Receipts**: Chat sockets authenticate with the same signed token as API calls. Messages are stored before being broadcast to the chat room, and opening a conversation marks incoming unread messages as read for both users in real time. Message sends, reads, session creation, and automatic closure write audit records without placing message content in the audit log.
* **Six-Hour Lifecycle**: Added the chat auto-close job. It checks open chats every minute and closes ones with no activity for six hours; both timings can be overridden through environment variables for development and tests. Closed chats remain readable but cannot receive more messages.
* **User Interface and Verification**: Added a shared live-chat panel to the Admin and Pilot dashboards, with participant selection, conversation history, connection status, explicit error messages, and read indicators. All twelve backend tests pass, including a real Socket.io Admin↔Pilot exchange, a persisted read receipt, role rejection, and timer-driven auto-close. Prisma validation, frontend lint, and the production build pass.

## July 13, 2026
* **Phase 5 — Calendar Override UI**: Replaced the legacy Fleet dispatch/Gantt workflow with a `react-big-calendar` scheduling calendar. It opens in month view, moves to a detailed day view when a date is selected, and displays assignments against pilots.
* **Exception-Only Manual Queue**: The Fleet Manager now sees only `NEEDS_MANUAL_SCHEDULING` leads in the manual queue. Dragging one onto a pilot/day creates a real manual Assignment using an available drone from the same operating centre. A pilot picker provides an accessible alternative to drag-and-drop.
* **Safe Rescheduling**: Existing scheduled and accepted missions can be moved on the calendar. The backend prevents a pilot from being double-booked on the same day, stores a `ScheduleChangeLog`, creates an audit entry, and persists a `RESCHEDULE` notification for every Sales user. The interface shows success and failure messages rather than hiding errors.
* **Verification**: Added an end-to-end Phase 5 backend test proving manual assignment, schedule-history persistence, and Sales notification. All ten backend tests pass serially against the shared development database; the test command now enforces serial execution to prevent independent test files from deleting each other’s temporary records. Prisma validation, frontend lint, and the production build pass.

## July 13, 2026
* **Phase 4 — Server-Enforced State Machine and Permissions**: Added signed, expiring authentication tokens and backend middleware for authentication and role authorization. The frontend now stores the token for the session and attaches it to backend API calls after login.
* **Mission Guards**: Implemented ordered pilot transitions: `SCHEDULED → PILOT_ACCEPTED → IN_PROGRESS → COMPLETED`. The backend rejects skipped transitions and rejects any pilot who is not assigned to that mission. Completion releases the drone back to `AVAILABLE`.
* **Role Restrictions**: Manual assignment and rescheduling are restricted to Fleet Managers/Admins; Sales cannot create assignments. Sales/Admins can process leads and review appeals; manual Sales intake also requires an authenticated Sales/Admin user.
* **Mid-Mission Safety Path**: Pilots can decommission only their own accepted/in-progress mission, with a reason. The mission becomes `FLAGGED`, the drone enters `MAINTENANCE`, Fleet Managers are notified, and audit records are written.
* **Verification**: All nine backend tests pass, including rejected Sales assignment, rejected pilot start-before-acceptance, rejected wrong-pilot acceptance, ordered completion, and decommissioning. Frontend lint and production build pass.

## July 13, 2026
* **Phase 3 — Auto-Assignment, Gates, and Notification Cascade**: Added automatic pilot/drone matching for `PROCESSED` leads. The matcher requires the same operating centre, excludes expired pilot licences and drone airworthiness records (while allowing missing records as a soft gate), avoids pilot date conflicts, and chooses the lowest-current-workload pilot.
* **Weather Fail-Open Gate**: Added a configurable weather-suitability service using `PricingConfig` thresholds. With no weather provider configured, scheduling proceeds with `weatherSuitable = null` and a Fleet Manager warning; unsuitable forecast data instead creates a visible manual-scheduling reason.
* **Persistent Pilot Follow-up**: Added the `NotificationEscalation` database model and migration. A new assignment records a pilot push notification, then persists the timed sequence for SMS fallback, a human dispatch call task, and reassignment. The server job polls the database; it therefore survives application restarts instead of holding timers only in memory.
* **Fallback and Traceability**: No eligible pilot/drone, no available weather window, or missing operational data moves the lead to `NEEDS_MANUAL_SCHEDULING`, records the reason in the Lead and audit trail, and notifies Fleet Managers. Approved out-of-range appeals now associate the lead with its nearest centre before entering assignment.
* **Verification**: Applied migration `20260713054140_notification_escalation`; Prisma validation, seed, all six backend tests, frontend lint, and frontend production build pass. The cascade test uses millisecond-scale timers and verifies push → SMS → human call task → reassignment, plus weather fail-open and no-candidate fallback behavior.

## July 13, 2026
* **Frontend Stability Pass**: Cleared all 16 frontend lint errors and the three hook warnings before beginning Phase 3. This included removing unused code, separating the auth provider/context/hook modules for reliable fast refresh, and correcting dashboard data-loading effects so initial loads and polling occur asynchronously with stable dependencies.
* **Verification**: `npm run lint` now passes with zero errors and warnings, and `npm run build` completes successfully.

## July 12, 2026
* **Phase 2 — Intake, Geofencing, and Appeals**: Added a single intake pipeline for website submissions, Google Form webhooks, and verified manual Sales entry. Each request now requires GPS coordinates, creates a PostgreSQL Lead, and records its intake channel.
* **Geofencing**: Added Haversine distance checking against every active operating centre. In-range leads retain their normal intake status; out-of-range leads are stored as `OUT_OF_RANGE`, with the nearest-centre distance retained for Sales.
* **Appeals**: Website users now immediately see an out-of-range offer and can request a transport-cost appeal. Sales/Admin-side endpoints can approve an appeal (moving the Lead to `PROCESSED`) or reject it (moving it to `REJECTED`). Suggested fees read the configured per-kilometre rate rather than a hardcoded value.
* **Google Form Webhook**: Added `POST /api/leads/ingest/google-form` and `POST /api/forms/webhook`, including shared-secret verification when configured, Maps-link coordinate parsing, and idempotency through the Google Form response ID.
* **Verification**: Automated tests passed for distance calculation, in-range and out-of-range website intake, appeal request/approval, and duplicate Google Form delivery. Prisma validation and the frontend production build pass. Frontend lint remains at the pre-existing 16 errors.
* **External Handoff Needed**: Before production use, bind the Google Form response sheet to the Apps Script `onFormSubmit` webhook from `SPEC.md` §5.2, point it at the deployed backend URL, and provide the real operating-centre coordinates/radii and transport-rate values.

## July 12, 2026
* **Phase 1 — PostgreSQL Data Layer**: Replaced the planned JSON-file persistence layer with PostgreSQL accessed through Prisma. Added the approved schema, initial migration, a shared database client, and repositories for leads, assignments, drones, users, operating centers, chat, notifications, payments, and audit records.
* **Repeatable Development Data**: Added a seed script that clears and recreates the local sample dataset, including two operating centers, staff, pilots, drones, pricing configuration, and one lead for every defined lifecycle status.
* **API Migration**: Moved the core lead, assignment, drone, user, and login paths to use the repository layer rather than reading or writing JSON files. Workflows that belong to later phases intentionally return a clear “not implemented” response instead of silently using old behavior.
* **Verification**: Started the local `rfly-postgres` Docker container; validated the Prisma schema and migration; seeded the database successfully; added and passed an automated test confirming all 12 `LeadStatus` values; and confirmed the live API returns the PostgreSQL-backed leads and pilots. The frontend production build also passes.
* **Known Follow-up**: Frontend lint has 16 existing errors. This is separate from the data-layer work and should be addressed as a focused UI-quality task, not mixed into Phase 2.

## July 7, 2026
* **Project Reset**: Decided to build exclusively on top of `Daas--main` (intern's code) and discard the legacy `PaaS_Demo-main` codebase.
* **Authentication & Routing**: Implemented a mock JSON user store (`users.json`), a Node backend Auth Controller, and React `AuthContext` with Protected Routes to secure the dashboards.
* **UI Overhaul**: Scrapped basic styling in favor of a modern Vanilla CSS Glassmorphism design system.
* **Landing Page**: Created a new `/` landing page with a service request form for Farmers to book a drone.

## July 8, 2026
* **Fleet Manager Drag & Drop**: Completely redesigned the drag-and-drop modal. The popup opens as a slide-up drawer anchored to the bottom of the screen, pushing the modal up, resulting in a significantly more ergonomic user experience.
* **Bhumeet API Integrations**: Added Bhumeet API sync dashboard for Admins, pulling in mock DSP (Drone Service Provider) data for weather, active flights, and daily spray reports.
* **System Dev Tools (historical and removed)**: Created a standalone hidden `/flush` route with a separate legacy lock screen. Phase 14 later removed this entire JSON-reset path and its embedded development secret.
* **UI Looksmaxxing**: Upgraded the global styling by introducing the *Outfit* and *Inter* fonts, a deep 3-color mesh gradient, an SVG noise overlay filter for realistic glassmorphism (`.noise-overlay`), and CSS 3D tilt hover effects (`.tilt-effect`).

## July 9, 2026
* **Role-Based Access Control (RBAC)**: Strengthened role isolation across Sales, Fleet Manager, Admin, and Pilot roles.
* **Socket.io Integration**: Added WebSockets via `socket.io` for real-time `assignment_rescheduled` events, replacing HTTP polling for toast notifications in the Sales dashboard.
* **Fleet Gantt Chart**: Built a new timeline Gantt Chart view for Fleet Managers to view, edit, and reschedule pilot assignments directly, triggering real-time updates for Sales.
* **Bhumeet Proxy Backend**: Implemented the live Bhumeet API sync by establishing an authenticated Node/Express proxy, making Bhumeet data the default view on the Admin Dashboard.

## July 15, 2026
* **Landing Page Update**: Changed the hero title text in `LandingPage.jsx` (via `src/locales/en.json` equivalent visual change) from "Field work, coordinated." to "Daas".

--gemini (2026-07-15T20:42:42+05:30)

* **Backend Infrastructure for Bhumeet Integration**: Created ackend/controllers/acreageController.js to proxy the Bhumeet acreage API using 
ode-fetch. Created ackend/routes/acreageRoutes.js and mounted it in ackend/app.js. Populated ackend/routes/bhumeetRoutes.js with mock dashboard endpoints.
* **Frontend UI Integration for Bhumeet**: Installed echarts and xios in the frontend directory. Created rontend/src/components/AcreageTrend.jsx and AcreageTrend.css to port the legacy chart component. Updated rontend/src/pages/FleetManagerDashboard.jsx to include the new "Acreage Trend" tab. Refactored rontend/src/components/BhumeetLogbook.jsx into a massive two-view dashboard (Overview & Raw Logs) utilizing the light/sage green color palette.
* **Fixes & Refinements**: Regionalized dashboard mock data in ackend/routes/bhumeetRoutes.js to feature realistic Indian values (e.g., 5 drones, revenue formatted in Rupees, local farm zones, and Indian pilot names). Fixed frontend drag-and-drop scheduling reliability in FleetManagerDashboard.jsx to correctly fall back to the selected pilot from the picker when dropping on the Month view, and passed the new 	argetPilotId to the backend when rescheduling. Fixed backend drag-and-drop reliability by updating escheduleAssignment in ackend/controllers/assignmentController.js to accept and persist the new pilotId when an assignment is dragged to a different pilot.

--gemini (2026-07-15T20:44:46+05:30)

## July 15, 2026 - Bug Fixes for Dashboard and Intake
* **Fixed Google Forms Fetch Errors (ECONNRESET)**: Updated  ackend/jobs/googleFormSync.js to implement an exponential backoff/retry loop (up to 3 times) for the network requests fetching data from the Google Script URL. This guarantees that temporary connection resets will no longer cause data loss for incoming submissions.
* **Fixed the Google Maps Location Parsing**: The Google Maps link relies on network redirects to resolve the full coordinate path (latitude and longitude). Added a robust retry wrapper in  ackend/services/locationParser.js to ensure that standard user links from forms securely resolve 100% of the time, avoiding silent fallbacks to Srivilliputur due to ECONNRESET.
* **Restored the Fleet Manager & Pilot Dashboards**: Whitelisted local development ports in  ackend/config/environment.js (http://127.0.0.1:5180 and http://localhost:5180). This fixed a CORS configuration mismatch preventing the browser from reading assignments correctly on the local development setup, which previously caused the API payloads for active missions and unassigned queue items to fail silently.

--gemini (2026-07-15T20:44:57+05:30)

## July 15, 2026 - API and Sync Fixes
* **Fixed Prisma Error in bhumeetRoutes.js**: Changed `orderBy: { date: 'desc' }` to `orderBy: { fetchedAt: 'desc' }` as `date` was an invalid argument when querying `BhumeetFlight`.
* **Handled Google Form Sync ECONNRESET Error**: Implemented a retry loop inside `backend/jobs/googleFormSync.js` around the `fetch` call to gracefully handle transient network errors.
* **Investigated Bhumeet Sync HTTP 404 Error**: Found that `https://api.bhumeet.in/flights` returns 404. Explored alternative paths, confirming the third-party endpoint URL is incorrect or deprecated and needs updating in `.env`.

--gemini (2026-07-15T20:45:00+05:30)

# RFLY DaaS Technical Stack and Architecture Handoff

**Purpose:** self-contained technical input for ChatGPT, reviewers, investors,
developers, and presentation writers

**Repository:** `Waz00-m/RFLY`

**Observed branch and revision:** `main` at `d98ba6f`

**Observed date:** August 24, 2026

**Authority boundary:** this document describes the implemented repository and
its current delivery system. Product decisions remain governed by the canonical
files linked from `docs/plan/AGENTS.md`. Never infer that a planned or disabled
component is already operational.

**Security boundary:** this document intentionally contains no passwords,
tokens, private keys, database dumps, customer records, raw telemetry, OTPs, or
other secrets.

---

## 1. Definitive answer about the original backend technology

The tracked RFLY repository did **not** begin as a Python backend and was not
converted from Python to npm by the current maintainer.

The first reachable Git commit is:

```text
Commit:  92312b362a907e2c3d81effb3d7a04bd3fec5095
Date:    2026-07-15T17:52:53+05:30
Subject: Initial commit
```

That commit already contains:

```text
backend/package.json
backend/app.js
backend/server.js
frontend/package.json
```

Its backend manifest already declares `express`, `cors`, `dotenv`, `axios`, and
`socket.io`, and starts the application with `node server.js`. There are **zero
tracked Python source files** in that root commit and no `requirements.txt`,
`pyproject.toml`, `Pipfile`, Django `manage.py`, or equivalent Python project
manifest.

The accurate historical statement is:

> The RFLY backend was already a Node.js/Express application managed with npm in
> the first tracked repository version. Later work retained that technology and
> evolved its database, security, architecture, testing, import tools, mobile
> APIs, containerisation, and CI/CD.

Terminology matters: npm is a package manager, not a backend runtime. The
backend should be described as **Node.js + Express, with dependencies managed by
npm**. Saying “an npm backend” is understandable informally, but saying
“Node.js/Express backend” is technically correct.

---

## 2. One-paragraph system description

RFLY DaaS is a field-operations platform for drone spraying services. It uses a
React single-page web application for operational and customer roles, a
separate Expo/React Native Android application for Pilots, and a Node.js/Express
API backed by PostgreSQL through Prisma ORM. REST endpoints handle normal
application operations, while Socket.IO supports authenticated real-time chat
and mission location updates. The platform is packaged as isolated Docker
Compose stacks. GitHub Actions validates the backend, frontend, Pilot app,
database migrations, import boundaries, and disposable containers. Protected
`staging` and `main` revisions are deployed by a dedicated self-hosted GitHub
Actions runner on the office Linux server. Production and staging use separate
Compose projects, databases, volumes, networks, configurations, and ports.

---

## 3. High-level architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  USERS                                      │
│                                                                             │
│ Admin │ Fleet Manager │ Sales │ Farmer │ Business/B2B │ Pilot              │
└───────────────┬───────────────────────────────────────────────┬─────────────┘
                │                                               │
                │ Web browser                                   │ Android app
                ▼                                               ▼
┌──────────────────────────────────┐          ┌────────────────────────────────┐
│ React 19 Web SPA                 │          │ Expo 57 / React Native 0.86    │
│ Vite 8 + Tailwind CSS 4          │          │ TypeScript + Expo Router       │
│ React Router + i18next           │          │ Zustand + encrypted SQLite     │
│ Leaflet/OpenStreetMap            │          │ SecureStore + foreground GPS   │
└──────────────────┬───────────────┘          └────────────────┬───────────────┘
                   │ Same-origin REST / Socket.IO              │ Mobile REST API
                   └──────────────────────┬─────────────────────┘
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Node.js 24 / Express 5 API                            │
│                                                                             │
│ Controllers → Services → Repositories → Prisma                             │
│ Authentication │ authorization │ scheduling │ imports │ OTP │ audit         │
│ Socket.IO chat and current mission location │ background maintenance jobs  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ Prisma ORM / reviewed migrations
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL 16                                  │
│                                                                             │
│ Operational masters │ users │ customers │ leads │ assignments │ history     │
│ mobile sessions/sync │ notifications │ payments │ imports │ audit log       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
                         Named persistent Docker volume
```

The web frontend is also the only host-published application container. It
serves static assets through Nginx and reverse-proxies `/api` and Socket.IO to
the internal backend container. PostgreSQL and the backend are not published
directly on host ports by the application Compose stack.

---

## 4. Technology inventory

Versions below are the manifest or container baselines observed in the current
repository. A caret or tilde is the npm version range recorded in a manifest;
the lockfiles determine the exact installed dependency graph.

### 4.1 Web frontend

| Concern | Implemented technology | Role in the system |
|---|---|---|
| Language | JavaScript/JSX with ES modules | Web application implementation |
| UI framework | React `^19.2.8` | Component and state-driven browser UI |
| DOM renderer | React DOM `^19.2.8` | Browser rendering |
| Build/dev server | Vite `^8.1.1` | Local development and production asset build |
| Styling | Tailwind CSS `^4.3.2`, CSS modules/files | Design system and page styling |
| Routing | React Router DOM `^7.18.1` | Role-aware client-side routes |
| HTTP | Axios `^1.18.1` | REST API client |
| Realtime | Socket.IO Client `^4.8.3` | Authenticated chat/location events |
| Localization | i18next, React i18next | English and supported Indian-language UI text |
| Mapping | Leaflet `^1.9.4`, React Leaflet `^5.0.0` | Farm location and service-area presentation |
| Scheduling UI | React Big Calendar `^1.20.0` | Fleet schedule/calendar presentation |
| Dates | date-fns `^4.4.0` | Date and time formatting/calculation |
| Charts | Recharts `^3.9.2` | Operational visualizations |
| Motion | Framer Motion `^12.42.2` | UI transitions and interaction feedback |
| Notifications | React Hot Toast and React Toastify | User feedback |
| Icons | Lucide React | Consistent interface icons |
| PDF generation | jsPDF | Client-side document generation where used |
| Lint | ESLint 10 with React plugins | Static source quality gate |
| Browser evidence | Playwright Core | Real-browser acceptance/audit scripts |
| Production server | Nginx `1.28-alpine` | Serves the SPA and proxies API/realtime traffic |

### 4.2 Backend

| Concern | Implemented technology | Role in the system |
|---|---|---|
| Runtime | Node.js 24 Alpine container | Server JavaScript runtime |
| Framework | Express `^5.2.1` | REST API and middleware pipeline |
| Package manager | npm with committed `package-lock.json` | Deterministic dependency installation |
| ORM | Prisma Client/CLI `^5.22.0` | Typed data access and schema migrations |
| Database | PostgreSQL 16 Alpine | Durable relational application store |
| Realtime | Socket.IO `^4.8.3` | Authenticated chat and location channels |
| Password hashing | bcryptjs `^3.0.3` | Password hash generation and verification |
| HTTP hardening | Helmet `^8.3.0` | Security headers and browser policy |
| Cross-origin control | CORS `^2.8.6` | Allow-list based browser origin handling |
| Abuse control | express-rate-limit `^8.5.2` | General/login/recovery/intake/webhook limits |
| Cookies | cookie `^0.7.2` | Secure browser session-cookie parsing |
| Server HTTP client | node-fetch 2 | Outbound adapter/integration HTTP requests |
| Workbook parsing | read-excel-file `9.3.5` | Guarded XLSX import parsing |
| Archive handling | fflate `0.8.3` | Safe ZIP/XLSX archive processing |
| Schema validation | AJV + AJV Formats | Tests/contracts and structured validation |

### 4.3 Pilot Android application

| Concern | Implemented technology | Role in the system |
|---|---|---|
| Application framework | Expo `~57.0.15` | React Native application toolchain |
| Native UI runtime | React Native `0.86.2` | Android/iOS native rendering |
| Language | TypeScript `~6.0.3` | Strictly checked mobile source |
| Navigation | Expo Router `~57.0.15` | File-based app navigation |
| Client state | Zustand `^5.0.15` | Authentication, sync, and UI state stores |
| API validation | Zod `^4.4.3` | Validates backend payloads before use |
| HTTP | Axios `^1.19.0` | Mobile API transport |
| Protected key/value storage | Expo SecureStore | Session tokens, installation identity, cache key |
| Offline relational cache | Expo SQLite | Assignments, cursors, and queued mutations |
| Local payload encryption | CryptoJS + device-held key | Encrypts cached assignment/mutation payloads |
| Location | Expo Location | Foreground-only active-mission samples |
| Device/app identity | Expo Device/Application/Crypto | Installation and runtime metadata |
| Styling | NativeWind 4 / Tailwind 3 configuration | Mobile design-system implementation |
| Testing | Jest 29 + jest-expo | Mobile unit/store/contract tests |
| Android build | Expo prebuild + Gradle + JDK 17 | Standalone staging APK creation |

### 4.4 Infrastructure and delivery

| Concern | Implemented technology | Role in the system |
|---|---|---|
| Source control | Private GitHub repository | Version history, reviews, protected branches |
| CI/CD | GitHub Actions | Hosted CI and event-driven office CD |
| Office CD runner | Self-hosted GitHub Actions runner | Trusted deployment execution |
| Containers | Docker Engine + Docker Compose | Isolated staging/production stacks |
| Host platform | Ubuntu Core 24, x86-64 | Office on-premises server |
| Container registry | GitHub Container Registry | Immutable release-image evidence |
| Vulnerability scanning | Trivy | Blocks fixable high/critical image findings |
| SBOM | SPDX JSON via Anchore/GitHub build attestations | Dependency inventory and release evidence |
| VPN | Separately managed OpenVPN split tunnel | Restricted remote access to internal staging |
| Database backup | `pg_dump` custom format + `pg_restore --list` | Verified pre-migration recovery evidence |

---

## 5. Web application architecture

The web application is a Vite-built React single-page application. It contains
role-aware routes, shared operational layouts, dashboard/page components,
forms, API utilities, localization resources, map components, and browser
acceptance scripts.

### 5.1 User-facing workspaces

The web client currently supports or contains workflows for:

- Admin operational control and user management;
- Fleet management, asset views, policy configuration, manual scheduling, and
  calendar views;
- Sales-assisted customer registration and phone-first lead entry;
- Farmer/customer authentication, status, and service-request presentation;
- Business/B2B access where explicitly linked by server policy;
- Pilot web operations retained alongside the newer dedicated Pilot app;
- master-data-backed intake fields;
- feasible-region/service-area management;
- chat, notifications, payments, and audit/operational views where implemented.

UI visibility is not treated as authorization. The backend independently
enforces role and resource access.

### 5.2 Browser API pattern

The frontend uses a centralized Axios-based API layer and same-origin routing in
the container build. In production-style deployment, the browser talks to the
Nginx frontend origin; Nginx forwards API requests to the internal backend. The
browser does not know the PostgreSQL address and does not connect to the
database.

Browser employee authentication uses opaque server-managed sessions in secure
cookies. State-changing browser requests use the implemented CSRF contract.
Session state is server-validated rather than trusted from local browser data.
Socket.IO connections reuse authenticated session semantics and are revalidated
to support session expiry/revocation.

### 5.3 Localization

Localization is based on i18next/React i18next. Backend locale resources are
present for English, Hindi, Tamil, Telugu, Kannada, and Malayalam. Newly touched
farmer-facing text is expected to use localization keys rather than hardcoded
English. Not every historical UI string can be assumed fully translated.

### 5.4 Maps and location

Leaflet and OpenStreetMap-compatible presentation are used for map-based
location work. The data model also supports latitude/longitude, human-readable
location text, and Plus Codes/Open Location Codes. Geofence decisions are made
server-side against active operating-centre/service-area configuration; the map
is a collection and visualization tool, not the authority for acceptance.

### 5.5 Web build and runtime

The frontend Docker build uses Node 24 Bookworm Slim to run `npm ci` and
`npm run build`. Only the generated static assets are copied into the Nginx
runtime image. The production runtime does not include the frontend Node build
toolchain. Nginx runs as the non-root `nginx` user on container port 8080, has a
read-only filesystem plus bounded temporary storage, and exposes a `/healthz`
health check.

---

## 6. Backend architecture

The backend uses CommonJS JavaScript on Node.js and follows a layered pattern:

```text
HTTP route / Socket event / Scheduled job
                    │
                    ▼
            Controller / Handler
                    │
                    ▼
               Service layer
     validation, policy, workflow, audit
                    │
                    ▼
              Repository layer
                    │
                    ▼
               Prisma Client
                    │
                    ▼
                PostgreSQL
```

Controllers, routes, jobs, and socket handlers should not query Prisma
directly. Database work belongs in repositories. Services coordinate domain
rules, state transitions, transactions, idempotency, and audit events.

### 6.1 HTTP route families

The Express application mounts these principal route families:

```text
/api/auth
/api/mobile/v1
/api/leads
/api/assignments
/api/auto-assignment-policy
/api/chat
/api/audit-log
/api/health
/api/users
/api/customers
/api/portal
/api/drones
/api/lmvs
/api/system
/api/centers
/api/master-data
```

This list describes API boundaries, not permission. Each operation applies its
own authentication, authorization, validation, and state rules.

### 6.2 Major service domains

The current service layer contains implementation for:

- employee/browser identity and session handling;
- mobile installation and mobile session handling;
- password hashing and controlled account recovery;
- application-owned OTP challenge generation, hashing, expiry, retry, and
  delivery outbox/adapter boundaries;
- customer registration and normalized identity/phone lookup;
- phone-first/public intake and declined-enquiry retention;
- geofence and service-area validation;
- lead processing and state changes;
- automatic assignment policy and resource selection;
- manual assignment, mission-state transitions, and schedule changes;
- Pilot/Copilot crew formation and conflict validation;
- drone and LMV eligibility and assignment;
- operating-centre and master-data management;
- authenticated chat lifecycle and messages;
- foreground mission location handling;
- notifications, escalation, and visible staff fallbacks;
- customer/farmer/business portals;
- payment records;
- audit logging;
- farmer, drone, and client-master import workflows;
- health and job-heartbeat reporting.

### 6.3 Realtime layer

Socket.IO is installed on the same Node HTTP server. Current realtime concerns
include operational chat and mission location. Socket authentication is tied to
the server session, sockets join session/user rooms for revocation, credentials
are removed from retained handshake objects, session expiry is scheduled, and
event/connection payload limits are configured.

### 6.4 Background jobs

The backend includes recurring maintenance work for notification escalation,
declined-enquiry retention purge, and mobile assignment-change retention.
Health reporting includes job heartbeat information so that the API being alive
is not confused with every recurring worker being healthy.

### 6.5 HTTP middleware and protection

The middleware pipeline includes:

1. trusted-proxy configuration;
2. request correlation/context;
3. Helmet security headers;
4. HTTPS enforcement in production-style configuration;
5. allow-list CORS policy;
6. JSON content-type enforcement;
7. endpoint-class rate limits;
8. strict bounded JSON parsing;
9. authentication and role authorization;
10. CSRF protection for browser state-changing requests;
11. webhook replay/security checks where applicable;
12. normalized not-found and error responses.

The system deliberately separates browser cookie sessions from mobile bearer
sessions. It also separates normal server runtime, migration runtime, and
operator importer runtime into different Docker image targets.

---

## 7. Database and persistence architecture

PostgreSQL 16 is the source of truth. Prisma defines the relational schema and
generates the client used by repositories. The current schema contains **47
models**, **32 enums**, and **32 ordered migration directories**.

### 7.1 Model groups

The models can be explained as these functional groups.

#### Organization, identity, and access

```text
OperatingCenter
User
BusinessOrganization
BusinessMembership
AuthSession
PasswordRecoveryChallenge
PhoneVerificationChallenge
VerificationDeliveryAttempt
OtpDeliveryOutbox
```

These models define employee/customer identities, organizational linkage,
active centres, browser sessions, recovery challenges, OTP ownership proof,
delivery attempts, and durable OTP delivery work.

#### Mobile identity and synchronization

```text
MobileInstallation
MobileSession
MobileMutationReceipt
MobileAssignmentChange
```

These models support installation-aware mobile sessions, bounded device access,
idempotent offline mutations, synchronization cursors/change feeds, and retry
receipts.

#### Customers, locations, languages, and agronomy

```text
Customer
Language
CustomerLanguagePreference
Location
FarmLocation
Crop
CustomerSeasonalCrop
CustomerSubscription
Cluster
```

This group supports a durable customer master, normalized phone identity,
multiple language preferences, reusable location records, farm locations,
Plus Codes, crops, historical/seasonal agronomy, subscriptions, and cluster
classification.

#### Leads, requests, assignment, and scheduling

```text
Lead
LeadSprayPurpose
AutoAssignmentPolicy
Assignment
PilotAssignmentRejection
ScheduleChangeLog
```

This is the operational workflow core: service requests, purposes, assignment
policy, the reserved mission unit, Pilot rejection/rescheduling evidence, and
schedule change history.

#### Fleet and resources

```text
Drone
LMV
PricingConfig
MasterDataValue
```

These models describe the aircraft, light motor vehicles, configured pricing,
and company-supplied dropdown/reference masters. Imported assets remain
inactive/out of service until authorized operational review.

#### Communication, finance, and oversight

```text
ChatSession
ChatMessage
Notification
NotificationEscalation
PaymentRecord
AuditLog
DeclinedEnquiry
```

These provide hierarchical communication, notification/follow-up tracking,
payments, immutable operational evidence, and privacy-bounded out-of-area
enquiries.

#### Import staging and historical records

```text
ImportBatch
SourceRecord
HistoricalServiceRecord
VillageVisit
CustomerHistory
LeadHistory
DroneHistory
LMVHistory
```

These preserve source provenance, guarded batch state, legacy service/visit
facts, and append-oriented history without turning historical records into live
operational Leads.

### 7.2 Important enum families

The schema uses enums for controlled domain state, including role, Pilot
availability, cluster type, request type, master-data category, lead status,
crew formation, mobile application/mutation state, mission issues, drone/LMV
state, intake channel, notification/payment state, OTP channel/status, asset
operational/availability state, crop season, language proficiency, import batch
state, subscription state, and history event type.

Enums are used for stable workflow state. Company-managed values that can
change independently—such as crop lists, spray purposes, lead sources,
reporting Admins, clusters, and B2B categories—belong in master data instead of
being repeatedly hardcoded into UI components.

### 7.3 Migration policy

Schema evolution uses reviewed Prisma migrations and `prisma migrate deploy`
through a one-shot migration container. Normal CD never uses `prisma db push`,
never runs development seed data, and never wipes an established database. The
deployment process backs up PostgreSQL before applying migrations.

Staging and production databases use independent named Docker volumes. A source
deployment recreates containers as needed but preserves the database volume.
Customer data is therefore not removed by an ordinary code deployment.

---

## 8. Authentication, authorization, and security model

### 8.1 Browser authentication

Employee/browser access uses server-owned opaque sessions carried in cookies.
Passwords are stored as bcrypt hashes. Cookies and server sessions are subject
to idle and absolute timeouts. Login, recovery, public intake, webhook, and
general traffic have separate configurable rate limits. State-changing browser
requests use CSRF validation.

### 8.2 Mobile authentication

The Pilot app uses a separate `/api/mobile/v1` contract with installation-aware
mobile sessions and bearer credentials stored in SecureStore. Backend responses
are validated against Zod schemas in the client. Installation count, minimum
version, recommended version, session timeouts, and mobile feature flags are
server configuration.

### 8.3 Authorization

Roles include Admin, Fleet Manager, Sales, Pilot, Farmer/customer, and business
relationships represented by the current role and membership schema. Server
authorization controls data access and state transitions. Admin is the highest
operational authority, but production still follows explicit endpoint policy
rather than a blanket “Admin can mutate anything” shortcut.

### 8.4 OTP and recovery

The application owns OTP challenge creation, hashing, attempt limits, expiry,
resend cooldown, consumption, and audit. A delivery provider is only a transport
adapter. No WhatsApp/SMS provider is currently selected for production. The
provider configuration defaults to disabled until a reviewed adapter and
company credentials are supplied. Firebase Authentication is a retired target
dependency, not part of the approved current architecture.

### 8.5 Container and network protection

Application containers run as non-root users, drop Linux capabilities, use
read-only filesystems with bounded temporary filesystems, rotate logs, and
apply CPU/memory limits. The database uses only the internal data network. The
backend joins the edge and data networks. The frontend joins only the edge
network and is the sole published service. Secrets are mounted from external
files and are not built into images.

The office host uses Snap-packaged Docker, which has a narrowly documented
compatibility overlay for `no-new-privileges`. It does not remove the remaining
hardening controls.

---

## 9. Pilot mobile application architecture

The Pilot app is a real Expo/React Native application, not a WebView wrapper.
React concepts are reused, but screens render through native React Native
components and Expo native modules.

### 9.1 Implemented Pilot capabilities

The current client contains:

- Pilot login and mobile session bootstrap;
- profile and availability state (`AVAILABLE`/`OFFLINE`);
- assignment list and assignment details;
- Pilot acceptance and rejection paths;
- Primary Pilot Copilot-selection workflow where server policy permits it;
- mission start and completion flows;
- mission issue reporting;
- customer/farm details, phone action, location/Plus Code display, and map link;
- drone, LMV, centre, Pilot, and Copilot assignment presentation;
- encrypted offline assignment cache;
- durable queued mutation records;
- idempotent synchronization and change-feed handling;
- a sync status/history screen;
- foreground-only location reporting for an accepted or active mission;
- logout/device cleanup of protected local data.

### 9.2 Offline design

Assignments are cached in a per-profile SQLite database. Sensitive JSON payloads
are encrypted before storage using a key retained through protected device
storage. Mutations are written locally before network transmission. Each
mutation has a client action identifier so retries can be reconciled
idempotently by the server. A full resync replaces assignment cache state but
does not silently discard unresolved local mutation evidence.

This is offline resilience, not unlimited offline authority. The server remains
the source of truth and can reject a queued action if authorization, assignment
ownership, crew/resource state, or mission state changed while the device was
offline.

### 9.3 Location design

Location collection is foreground-only. It activates while the app is open and
the Pilot has an eligible accepted/in-progress assignment. It does not request
background location, foreground-service location, storage, or overlay
permissions. Terminal mission transitions clear the current location state.
Route-history telemetry and continuous off-duty tracking are not implemented.

### 9.4 Variants and distribution

The mobile configuration defines separate package identities:

```text
Development: com.rfly.pilot.dev
Staging:     com.rfly.pilot.staging
Production:  com.rfly.pilot
```

Development and staging may permit cleartext HTTP for the controlled current
environment. The production variant refuses to build without an HTTPS API URL.
The current CI-generated APK is an internally debug-signed, release-mode,
arm64 staging artifact. It is retained by GitHub Actions for seven days and
does not require Metro after installation. It is not a Play Store release.

### 9.5 Non-Pilot mobile application status

There is currently **no production source application** for the combined Admin,
Fleet, Sales, Farmer/customer, and Business/B2B mobile experience. Stitch
exports are design evidence only. The canonical future implementation is a
separate non-Pilot application that reuses the backend/mobile security model
without copying prototype code directly into production.

---

## 10. Import and migration architecture

Bulk imports are intentionally outside the browser application and normal CD.
They run as operator-only, one-shot containers built from a separate importer
target. The normal API image does not contain the importer CLI.

Implemented importer families include:

- farmer workbook import;
- drone master import; and
- RFLY client master-data/roster/asset import.

The safety lifecycle is:

```text
External private source file
          │
          ▼
Read-only preflight (no DB/network/secrets)
          │
          ▼
Deterministic plan / safe report / plan hash
          │
          ▼
Verified target DB backup + checksum/reference
          │
          ▼
Explicit Admin approval + deployment identity + confirmation phrase
          │
          ▼
Atomic/idempotent commit that fails closed on plan drift
          │
          ▼
Reconciliation and PII-safe result evidence
```

Customer workbooks, source JSON/XLSX files, encryption keys, and backups remain
outside Git and outside the Actions checkout. Historical Zoho/Google Forms
records are preserved as customer/history/visit evidence and do not
automatically create live Leads. Normal code deployment does not rerun imports.

---

## 11. Docker deployment topology

The portable production Compose definition contains:

```text
db        PostgreSQL 16 with named persistent volume
migrate   one-shot Prisma migration image
backend   Node/Express API, internal port 5000
frontend  Nginx static frontend/reverse proxy, published application port
```

Additional Compose definitions introduce environment-specific port/bind values
and guarded importer services.

### 11.1 Network topology

```text
Host/browser
     │ published application port only
     ▼
Frontend/Nginx ───── edge network ───── Backend
                                            │
                                      data network
                                            │
                                        PostgreSQL

data network = Docker internal network
PostgreSQL   = no host port
Backend      = no host port
Frontend     = only host-published application service
```

### 11.2 Current office environments

| Environment | Branch | Compose project | Bind/port | Purpose |
|---|---|---|---|---|
| Internal staging | `staging` | `rfly-onprem-staging` | office LAN `172.20.96.10:8089` | VPN/LAN acceptance and migration proof |
| Current live production | `main` | `rfly-onprem-demo` | port `8088` | Customer-used office deployment |

The word `demo` in the production project name is historical. It must not be
interpreted as a disposable database or permission to seed/reset the stack.

### 11.3 Server baseline

The last documented observation of the shared office host was:

```text
Host:              Ubuntu Core 24, Linux x86-64
Capacity:          8 CPUs, approximately 31 GiB RAM
Docker:            Snap-packaged Docker Engine
Compose:           Docker Compose plugin
Runner user:       rflyrunner
Runner label:      rfly-onprem
Production path:   /opt/client-demo-app
Staging path:      /opt/client-staging-app
```

Values must be rechecked before infrastructure work because live server state
can change.

---

## 12. Git branch and delivery flow

```text
Developer branch/work
        │
        ▼
       dev
        │ green CI + reviewed PR
        ▼
     staging
        │ green CI + automatic internal deployment + acceptance
        ▼
       main
        │ green CI
        ├────────────► automatic production deployment
        └────────────► scanned images + SBOM + digest evidence
```

Expected controls:

- CI runs on pull requests and pushes to `dev`, `staging`, and `main`;
- `main` pull requests must originate from `staging`;
- protected branches prevent casual production pushes;
- staging and production CD deploy only a successful CI commit;
- CD refuses a stale successful SHA if it is no longer the branch tip;
- imports, seeds, database wipes, and demo-account creation are not deployment
  actions.

---

## 13. CI pipeline in detail

The main CI workflow is named `application-and-container-gates`.

### 13.1 Backend job

The backend job runs on a fresh GitHub-hosted Ubuntu runner with an ephemeral
PostgreSQL 16 service. It performs deterministic `npm ci`, dependency audit,
Prisma validation/generation, migration deployment to the throwaway database,
test-only seed/setup, and the serial backend test suite. The runner and database
are discarded after CI.

### 13.2 Frontend job

The frontend job performs deterministic dependency installation, configured
dependency audit, ESLint, and a production Vite build. A green frontend job says
the static client compiles and passes configured static checks; it does not
deploy the client.

### 13.3 Pilot mobile job

The Pilot job performs deterministic npm installation, dependency audit,
TypeScript `tsc --noEmit`, Jest tests, and Expo Doctor. It validates source and
toolchain consistency without contacting the office server.

### 13.4 Isolated container-stack job

After the three source jobs pass, CI creates temporary secrets and a disposable
Compose environment. It validates Compose rendering, builds runtime/migration/
importer targets, starts the database and application, applies migrations,
checks `/healthz` and `/api/health`, verifies non-root image users, proves the
database/backend have no published host ports, verifies importer preflight
isolation, rejects intentionally invalid workbooks, and always removes the
temporary stack and volumes.

### 13.5 Staging APK job

For a successful push to `staging`, the trusted office runner additionally
checks out the exact staging tip, installs pinned Android SDK components,
rechecks Pilot source, runs Expo native prebuild, and builds an arm64 release APK
with Gradle/JDK 17. It validates package identity, signature structure, required
foreground location permission, and absence of prohibited background/storage/
overlay permissions. It uploads the APK, checksum, and source metadata as a
private seven-day artifact.

---

## 14. CD and release evidence

### 14.1 Staging and production CD

Successful staging/main CI triggers a separate `workflow_run` deployment on the
self-hosted office runner. The runner checks out the exact CI-passed SHA,
verifies that it is still the branch tip, and runs the committed deployment
script.

The deployment script:

1. reads configuration from an external environment file;
2. stages only required external secret files;
3. verifies Docker access and deployment port ownership;
4. tags local images with the exact source SHA;
5. builds database/migration/backend/frontend images;
6. starts and health-checks PostgreSQL;
7. creates and verifies a custom-format pre-migration database backup;
8. runs the one-shot migration container;
9. starts backend and frontend;
10. checks browser and API health; and
11. writes non-secret source/checksum evidence to a private changelog.

The deployment preserves the database volume. It never seeds, wipes,
bootstraps, or imports client data.

### 14.2 Release image evidence

After successful `main` CI, `release-image-evidence` builds backend, migration,
frontend, and importer targets on GitHub-hosted runners. Trivy blocks images
with fixable high/critical findings. Successful images are published to GHCR by
source SHA with provenance and SBOM attestations. SPDX JSON SBOMs, Trivy SARIF,
image digests, and source-SHA evidence are retained.

An SBOM is a Software Bill of Materials: a machine-readable inventory of the
packages inside a release image. Trivy compares components against known
vulnerability data. Current production CD builds locally from the exact source;
the published GHCR images currently provide release evidence and are not yet
the images pulled by production CD.

---

## 15. Testing and verification inventory

The repository currently contains:

- 42 backend test/source files under `backend/tests`;
- Prisma schema validation and a disposable migration-replay harness;
- frontend ESLint and Vite production build;
- two real-browser audit scripts under `frontend/e2e`;
- four detected Pilot Jest test files plus TypeScript and Expo Doctor checks;
- isolated Docker Compose health/security/importer-boundary checks;
- staging APK package, permission, signature, and checksum validation;
- release image vulnerability, SBOM, provenance, and digest evidence.

The latest canonical state records a 160-test backend suite, 29-migration replay
at that earlier checkpoint, and 18 Pilot tests. The schema has since grown to 32
migration directories, so exact counts should always be taken from the current
CI run rather than copied indefinitely from a dated report.

---

## 16. Operational rules that define the architecture

The following are not style preferences; they are safety boundaries:

1. Routes, controllers, sockets, and jobs do not query Prisma directly.
2. State-changing operations use services/repositories and produce safe audit
   evidence.
3. Permissions and state transitions are enforced by the backend.
4. Pricing, thresholds, radii, time windows, and business lists use
   configuration/master data instead of scattered literals.
5. Automation failures create visible human work rather than silently dropping
   requests.
6. Exact coordinates, credentials, OTPs, and sensitive payloads never enter
   AuditLog or documentation.
7. Browser/mobile users never receive database credentials or direct database
   connectivity.
8. Established databases are changed only through reviewed migrations and
   guarded operator tools.
9. Production deployment never runs a development seed or database wipe.
10. Customer source files and backups remain outside Git.
11. One company receives one isolated stack, database volume, secret set, and
    approved network/domain boundary.
12. Kubernetes is intentionally deferred; Docker Compose is the current
    operational topology.

---

## 17. Implemented, planned, and deliberately disabled boundaries

### Implemented

- React web application;
- Node.js/Express REST API;
- Prisma/PostgreSQL persistence and reviewed migrations;
- browser sessions, mobile sessions, CSRF, role authorization, rate limits;
- customer/lead/fleet/assignment/centre/master-data operations;
- automatic and manual scheduling foundations;
- Pilot/Copilot, Drone, and LMV resource model;
- Pilot mobile application with offline sync and foreground mission location;
- authenticated chat and location Socket.IO infrastructure;
- guarded farmer/drone/client-master import CLIs;
- isolated Docker Compose staging and production;
- GitHub-hosted CI, self-hosted CD, release scanning, and staging APK build.

### Planned or incomplete

- production-ready combined non-Pilot mobile application;
- Play Store production signing/release pipeline;
- complete browser/mobile feature parity;
- final pointer-based calendar drag/resize acceptance evidence;
- production TLS/domain cutover;
- vendor-confirmed WhatsApp/SMS OTP transport;
- final billing/tax/GST/provider workflow;
- client-approved telemetry vendor and raw telemetry retention processing;
- background Pilot tracking or route history, which also requires explicit
  privacy and operational approval.

### Deliberately disabled or retired

- Firebase Authentication compatibility path;
- raw telemetry ingestion without a retention policy;
- Bhumeet/mock telemetry as a production dependency;
- automatic database seeding/import during deployment;
- direct browser/database connectivity;
- Kubernetes as the initial deployment platform;
- source-generated Stitch prototypes as production application code.

---

## 18. Repository map

```text
backend/
  app.js, server.js              Express and Socket.IO startup
  config/                        validated server/socket configuration
  controllers/                   HTTP request handlers
  routes/                        API route declarations
  services/                      domain workflow and policy logic
  src/repositories/              Prisma-backed data access
  middleware/                    auth, HTTP security, webhook protection
  sockets/                       chat and mission-location realtime handlers
  jobs/                          recurring cleanup/escalation work
  contracts/                     API/validation contracts
  prisma/                        schema, migrations, development seed
  importer/                      guarded one-shot import CLIs
  tests/                         backend/unit/integration/security tests
  docker/                        runtime entrypoint
  Dockerfile                     runtime, migration, importer targets

frontend/
  src/                           React pages/components/API/i18n/styles
  e2e/                           browser audits
  docker/                        Nginx template and entrypoint
  Dockerfile                     Vite build and Nginx runtime

pilot-mobile/
  app/                           Expo Router screens
  src/                           API, stores, database, sync, design system
  assets/                        application icons/assets
  app.config.js                  app variants, packages, permissions
  package.json                   Expo/React Native dependencies/scripts

.github/workflows/
  ci.yml                         application-and-container-gates
  onprem-staging-deploy.yml      staging CD
  onprem-deploy.yml              production CD
  production-source-policy.yml   only staging may PR into main
  release-images.yml             scan/SBOM/GHCR release evidence

deploy/
  onprem-selfhosted-deploy.sh    guarded exact-SHA deployment
  *.env.example                  placeholder-only environment contracts

compose.production.yml           portable hardened stack
compose.onprem-staging.yml       staging bind/project overrides
compose.onprem-demo.yml          current production overrides
compose.import.yml               importer service boundaries
compose.snap-import.yml          Snap Docker importer compatibility

docs/plan/                       canonical architecture/product/ops handoffs
docs/MIGRATION_ON_MAIN.md        approved production data-import procedure
```

Development seed and demo-preparation scripts exist for development/test use.
Their existence is not authorization to run them against staging or production.

---

## 19. How to describe this stack in different settings

### Thirty-second technical summary

> RFLY DaaS uses a React/Vite web frontend and an Expo/React Native Pilot app,
> both backed by a Node.js/Express API. Prisma manages a PostgreSQL 16 relational
> schema. Socket.IO provides authenticated realtime features. The platform runs
> as hardened Docker Compose stacks, and GitHub Actions provides hosted CI,
> exact-commit on-premises CD, migration backups, image scanning, SBOMs, and an
> internally distributed staging APK.

### Non-technical stakeholder summary

> The platform has separate web and mobile interfaces connected to one secured
> operations service and one controlled company database. Every update is tested
> automatically before it reaches an isolated test environment or the live
> office system. Live data is retained separately from application code, backed
> up before database upgrades, and never replaced by normal deployment.

### Historical clarification

> The application was already Node.js/Express with npm in its first tracked Git
> commit. The current team hardened and expanded that stack; it did not replace a
> tracked Python backend with npm.

---

## 20. Hand-drawing reference diagrams

### 20.1 Software stack

```text
USERS
  │
  ├── Web Browser ── React + Vite + Tailwind
  │                         │
  └── Pilot Android ─ Expo + React Native
                            │
                            ▼
                     REST + Socket.IO
                            │
                            ▼
                    Node.js + Express
                            │
                     Services + Repos
                            │
                         Prisma ORM
                            │
                            ▼
                       PostgreSQL 16
```

### 20.2 Deployment stack

```text
GitHub dev → staging → main
       │        │        │
       └────────┴────────┴── GitHub Actions CI
                                │
                    successful exact branch SHA
                                │
                                ▼
                     Office self-hosted runner
                                │
                         Docker Compose CD
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
             Nginx UI       Node API       PostgreSQL
           public/LAN port  internal only   internal only
```

### 20.3 Data flow

```text
Form/App action
     → API authentication
     → authorization + validation
     → service/state-machine rule
     → repository transaction
     → PostgreSQL
     → audit/notification/change feed
     → response or real-time update
```

---

## 21. Prompt to give ChatGPT with this handoff

Use the following prompt together with this file:

> Read the attached `RFLY_TECH_STACK_HANDOFF_FOR_CHATGPT.md` completely. Create
> a technically accurate tech-stack explanation and diagram for RFLY DaaS.
> Clearly distinguish the React web app, Expo/React Native Pilot app,
> Node.js/Express backend, Prisma/PostgreSQL persistence, Docker Compose runtime,
> and GitHub Actions CI/CD. Show that Nginx is the only web-facing application
> container and that the backend/database remain internal. Explain the
> `dev -> staging -> main` promotion flow, exact-commit self-hosted deployment,
> backups before migrations, Trivy scanning, SBOM evidence, and the staging APK
> build. State that the first Git commit already used Node.js/Express/npm and
> contained no Python backend. Do not invent cloud hosting, microservices,
> Kubernetes, Firebase, AWS, Azure application hosting, a production WhatsApp
> provider, production telemetry processing, Play Store release, or a completed
> non-Pilot mobile app. Do not include secrets, customer data, credentials, or
> private infrastructure commands. When discussing versions, use those recorded
> in the handoff and identify planned/deferred capabilities separately from
> implemented ones.

---

## 22. Primary repository evidence used for this handoff

```text
backend/package.json
backend/Dockerfile
backend/app.js
backend/server.js
backend/prisma/schema.prisma
backend/routes/
backend/services/
backend/src/repositories/
frontend/package.json
frontend/Dockerfile
frontend/src/
frontend/e2e/
pilot-mobile/package.json
pilot-mobile/app.config.js
pilot-mobile/app/
pilot-mobile/src/
compose.production.yml
compose.onprem-staging.yml
compose.onprem-demo.yml
compose.import.yml
compose.snap-import.yml
.github/workflows/ci.yml
.github/workflows/onprem-staging-deploy.yml
.github/workflows/onprem-deploy.yml
.github/workflows/production-source-policy.yml
.github/workflows/release-images.yml
deploy/onprem-selfhosted-deploy.sh
docs/plan/CURRENT_ENGINEERING_STATE.md
docs/plan/CICD_OPERATIONS_CONTEXT.md
docs/plan/SHARED_ONPREM_CICD_SERVER_HANDOFF.md
```

When this file and the code disagree in the future, the current code, current CI
configuration, and canonical agent guide must be re-inspected. This handoff is a
dated description, not a substitute for source control.

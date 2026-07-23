# Production Hardening Register

**Status:** mandatory pre-production work; not a statement that the application is production-ready.  
**Last reviewed:** July 23, 2026
**Agent rule:** every agent must read this file before production, deployment, security, privacy, authentication, multi-customer, or live-integration work. Update the relevant checkbox and verification evidence in the same change. A checkbox is complete only after a test or operational verification proves it.

**Resume notice:** H2 authentication/session hardening has complete local code evidence as of July 23, 2026. Opaque cookie sessions, CSRF, credential-snapshot race rejection, account-state enforcement, atomic recovery invalidation, canonical phone identity, Firebase proof replay protection, and Socket.IO revalidation are covered. Approved live recovery providers and H3-H7 remain pending; local/CI evidence is still not production approval.

## Locked product decisions

- The product remains customer-neutral. Do not introduce R-fly or any other customer name, logo, colour system, domain, or copy unless the user explicitly approves it later.
- **Deployment model selected:** one isolated application/container stack, PostgreSQL database/volume, secret set, and domain per company. Multiple companies may eventually use the product, but their data must never share a database or volume. Shared-database multi-tenancy is not the chosen model unless a future approved architecture change replaces this decision.
- Password recovery must support WhatsApp, SMS, and email. WhatsApp is the default channel; SMS and email are fallbacks. The implementation must verify ownership of the destination and use short-lived, one-time reset tokens.
- Pricing, weather thresholds, operating centres, service radii, pilot licence data, and drone airworthiness data are owned by the operating company. The application must provide authorized Admin screens and APIs to manage them; developers must not invent production values.
- The Admin role is the operating company's highest in-application role. During hardening it must gain complete, auditable oversight and controlled management of all company business data: centres, service ranges, people, drones, leads, assignments, payments, chats, alerts, configuration, and operational monitoring. This does **not** mean exposing database credentials, provider secrets, password hashes, or arbitrary raw-SQL access in the browser; audit history must remain append-only and privileged changes must be recorded.
- Current device scope is modern Android browsers and normal desktop browsers. iOS/native packaging is deferred.
- Audit records have no automatic deletion for now and are retained indefinitely. This is an interim company decision, not a legal-compliance conclusion; access, export, redaction, storage cost, and later deletion requirements still need review.
- Chat policy: an unread chat remains open indefinitely; a chat with all messages read closes after 24 hours of inactivity; a participating Admin can close it immediately for both sides.
- Google Form, weather, WhatsApp, and UPI stay mocked/fail-open until their own sandbox credentials, contracts, and verification tests are supplied. No external integration may silently block the operational workflow.
- Farmer-language wording remains provisional until a multilingual reviewer approves it after the WhatsApp templates are selected.

## Release blockers — security and account safety

- [x] Replace the legacy JavaScript-readable bearer-token/JWT fallback with database-backed opaque sessions. Production uses `Secure`, `HttpOnly`, `SameSite=Strict`, host-only cookies; only hashed session/CSRF values are stored, and production rejects the test-only bearer path.
- [x] Replace plaintext password comparison/storage with a production password hash (Argon2id or bcrypt with an approved cost), migrate/reset existing development passwords, and never return `passwordHash` from an API or audit state.
- [ ] Implement WhatsApp-default password recovery with SMS/email fallback, verified destinations, rate limits, expiry, one-time use, audit events, and a generic response that does not reveal whether an account exists. The application-side challenge, attempt, audit, generic-response, queued-delivery boundary, auth-version binding, forced/sibling revocation, Employee UI, and recent one-time Firebase Business grant are implemented and tested. This gate remains open until approved WhatsApp/SMS/email providers deliver codes without logging them and sandbox/fallback tests pass.
- [ ] Apply authentication and role authorization to every user, drone, operating-centre, configuration, audit, payment, and system route. Add negative permission tests.
- [ ] Restrict CORS to approved deployment origins; require HTTPS; set secure headers; apply request/body limits and authentication/integration rate limits.
- [ ] Validate all public and privileged inputs and use consistent non-sensitive error responses.
- [x] Define and enforce session revocation, forced logout after password reset/change, and inactive/archived/role-change behavior. Current-session logout, logout-all, idle/absolute expiry, credential-snapshot/auth-version checks, pending and connected socket revalidation/disconnection, and atomic account/recovery mutation revocation are implemented; operational recovery-secret rotation remains part of deployment procedure.
- [ ] Run dependency, static-code, and secret scans. Resolve high/critical findings and preserve reports as release evidence.
- [ ] Rotate the external-service credential that was previously stored in the removed root integration test; deletion from the working tree does not invalidate an already exposed credential.

## Release blockers — customer isolation and configuration

- [x] Decide the deployment model: one isolated deployment/database per company was selected on July 14, 2026.
- [x] Shared-database tenant fields are not applicable to the selected model. Isolation must instead be enforced by separate Compose project names, databases/volumes, secrets, and domains, with deployment tests proving no database/backend port is exposed or shared.
- [ ] Build the Admin Operations Control area: searchable read access and controlled create/edit/deactivate/archive actions for all company business records, including leads, assignments, payment states, chats, alerts, staff, pilots, drones, centres, and configuration. Require validation, confirmation for destructive actions, audit entries, and explicit permission tests.
- [ ] Add Admin management for pilots/users: create, edit, activate/deactivate, assign centre, set phone/email/language, and manage licence expiry. The current legacy Admin form is incomplete and not production-safe.
- [ ] Add Admin management for drones: create, edit, retire, assign centre, serial/model details, status, and airworthiness expiry. Current screens list/status-manage seeded drones but cannot create a drone.
- [ ] Add Admin management for operating centres, geofence radii, pricing, discrepancy, weather, and compliance settings, with validation and audit history.
- [ ] Decide whether configuration is tenant-specific and support effective dates/versioning where changing a value must not rewrite historical jobs.

## Release blockers — GPS and privacy

- [x] Do not copy exact GPS coordinates into append-only audit logs. Verified by `backend/tests/phase9-live-location.test.js`; the audit records only assignment ID, ping time, and that a location was recorded.
- [ ] Approve and display a plain-language pilot notice before the first permission prompt. It must state purpose, collection window, cadence, viewers, retention, and a privacy contact.
- [ ] Persist consent/acknowledgement version, pilot, timestamp, and withdrawal/re-prompt state without treating browser permission alone as informed consent.
- [ ] Confirm or change the current 60-second active-mission cadence and confirm that only the assigned pilot can publish while only Fleet Managers/Admins can view.
- [ ] Decide when the latest exact coordinate is erased. Recommended starting policy: clear it at mission completion/cancellation after a short operational grace window, while retaining a coordinate-free audit event.
- [ ] Provide a privacy owner/contact, approved notice wording, data-access/correction/deletion process, and incident-response owner before real pilot tracking.
- [ ] Test permission denied, permission revoked, browser backgrounding, lost connectivity, shared devices, and logout on supported Android browsers.

## Release blockers — integrations and money

- [ ] Google Form: provide the real form/sheet owner, field mapping, Apps Script deployment, production backend URL, and `FORM_WEBHOOK_SECRET`; verify duplicate delivery and failure alerting.
- [ ] Weather: select a provider/plan, set its key through the secret store, map wind/rain/forecast time fields, define quota behavior, cache appropriately, and retain the visible Fleet fallback.
- [ ] WhatsApp: create/verify the Business account and sending number, select provider, approve five-language templates, configure webhook verification, opt-in evidence, delivery-status handling, and sandbox tests.
- [ ] SMS/email fallback: select providers/senders, configure domain/DNS where relevant, handle bounces/failures, and test reset delivery without logging codes.
- [ ] UPI: select the customer's legal merchant account/gateway, settlement account, descriptor, refund/reconciliation rules, signed webhook, idempotency, and sandbox end-to-end tests.
- [ ] Replace every seeded pricing/compliance value with company-approved values before any paid job.

## Release blockers — reliability, observability, and operations

- [ ] Choose hosting region/topology and production PostgreSQL; use controlled migrations with rollback/restore plans.
- [ ] Configure encrypted automated backups and prove a restore in a separate environment. Define RPO/RTO with the company.
- [ ] Send structured logs to an external system with access control and redaction; do not log farmer phone/address, secrets, reset codes, full payment payloads, chat content, or exact GPS.
- [ ] Monitor `/api/health`, database connectivity, job heartbeat age, error rate, authentication failures, Google intake failures, notification cascade failures, weather-provider failures, WhatsApp delivery failures, payment webhook failures, queue backlog, and disk/storage growth.
- [ ] Define alert severities, recipients, quiet hours, acknowledgements, and escalation. A health dashboard without someone being notified is not production monitoring.
- [ ] Make Socket.io production-ready for the selected topology (sticky sessions/Redis adapter if multiple instances) and test reconnect/replay behavior.
- [ ] Define incident response, maintenance windows, deployment approvals, rollback, support ownership, and status communication.

## Release blockers — quality and device acceptance

- [ ] Run backend tests, Prisma validation, frontend lint/build, and end-to-end role workflows against a production-like staging environment.
- [ ] Add browser automation for login, intake, assignment, pilot lifecycle, offline replay, chat closure/read policy, payment fallback, and Admin configuration. The local suite covers all currently implemented workflows plus phone/tablet overflow checks across every active role window; full Admin configuration screens and production-like staging execution do not yet exist.
- [ ] Test current supported Android Chrome/Firefox/Edge variants and current desktop Chrome/Firefox/Edge. Record exact versions/devices. iOS remains deferred.
- [ ] Test low bandwidth, intermittent connection, duplicate submissions, app restart, database restart, job restart, provider timeout, quota exhaustion, and webhook replay.
- [ ] Complete accessibility, localization, timezone/date, currency, and mobile-layout review.

## Inputs still required from the user/company

1. Privacy owner/contact and approval of the GPS consent/retention choices above.
2. Admin owners for pilots, drones, operating centres, pricing, weather, and compliance records.
3. Production hosting, domain, alert recipients, escalation path, backup targets, and expected user/load volumes.
4. Provider accounts and sandbox credentials for Google, weather, WhatsApp, SMS/email, and UPI—entered directly into a local/deployment secret store, never sent through chat.

## Verification log

| Date | Item | Evidence | Result |
|---|---|---|---|
| July 13, 2026 | Coordinate-free GPS auditing | `backend/tests/phase9-live-location.test.js`; full backend suite 23/23 | Passed |
| July 13, 2026 | Chat read/unread/manual-close policy | `backend/tests/phase6-chat.test.js`; full backend suite 23/23 | Passed |
| July 13, 2026 | Frontend/Prisma regression check | `npm run lint`, `npm run build`, `npx prisma validate` | Passed; build retains non-blocking large-bundle advisory |
| July 14, 2026 | Isolated Edge browser acceptance audit | `frontend/e2e/browser-audit.mjs`; `docs/browser_acceptance_audit_2026-07-14.md`; screenshot/JSON evidence in `docs/test-evidence/browser-audit-2026-07-14/` | Failed release gate: 14/24 passed. Critical unauthenticated management mutations and password-hash exposure confirmed; Sales, validation, Admin, accessibility, GPS-race, and test-teardown defects recorded. |
| July 14, 2026 | Authentication and management-route remediation | `backend/services/passwordService.js`; `backend/tests/phase14-security-regression.test.js`; isolated backend suite | Passed: bcrypt cost 12, migrated local development accounts, no credential fields in tested user/assignment responses, anonymous and wrong-role management calls rejected, production JWT configuration enforced. Password recovery remains open. |
| July 14, 2026 | Demo acceptance rerun | `docs/demo_acceptance_report_2026-07-14.md`; `docs/test-evidence/browser-audit-2026-07-14/results.json` | Passed local demo gate: Edge 25/25, backend 26/26, frontend lint/build and Prisma validation passed. Provider, privacy, tenant, recovery, and production-operations blockers remain open. |
| July 14, 2026 | Emergency platform-wide UI correction | `docs/ui_correction_report_2026-07-14.md`; `frontend/e2e/browser-audit.mjs`; screenshot/JSON evidence in `docs/test-evidence/browser-audit-2026-07-14/` | Passed revised local demo gate: Edge 30/30 with zero unexpected console/runtime/normal-flow HTTP errors, backend 26/26, frontend lint/build, and Prisma validation. Responsive browser simulation passed; recorded physical-device/cross-browser acceptance remains open. |
| July 14, 2026 | H0 privacy/device/GPS presentation and H1 perimeter checkpoint | `backend/src/repositories/auditLogRepository.js`; `backend/tests/hardening-h1-perimeter.test.js`; `frontend/public/sw.js`; `frontend/src/services/offlineActionQueue.js`; `frontend/src/components/LiveLocationPanel.jsx` | Passed at checkpoint: combined backend 39/39, H0 focus 7/7, H1 focus 10/10, Prisma validation, frontend lint/build. Exact-location map loading remains user-initiated; nearest-structure reverse geocoding requires an approved provider. |
| July 14, 2026 | Hardening pause | `docs/hardening_pause_handoff_2026-07-14.md` | H2 stopped after unverified schema/repository scaffolding; H3-H7 pending. Draft container/CI assets are not production evidence. |
| July 22, 2026 | H2 opaque-session and recovery foundation | `backend/tests/hardening-h2-auth-session-recovery.test.js`; disposable fresh-database backend suite; `backend/prisma/migrations/20260722090000_reconcile_current_schema/migration.sql` | Passed locally: backend 48/48; production cookie flags and bearer rejection, `/me`, CSRF, login eligibility, logout/admin/recovery revocation, generic recovery responses, wrong/expired/reused recovery proofs, fresh replay of all migrations, empty schema diff, and idempotent migration rerun. Live WhatsApp/SMS/email delivery remains open. |
| July 23, 2026 | H2 adversarial closeout and full local regression | `backend/tests/hardening-h2-*.test.js`; `backend/tests/hardening-firebase-phone-proof.test.js`; `backend/tests/hardening-password-byte-limit.test.js`; `frontend/e2e/browser-audit.mjs`; migrations through `20260723091000_canonical_unique_user_phone` | Passed locally: backend 74/74 on a fresh replay of all 10 migrations; browser 30/30; Prisma validation, frontend lint/build, and production Compose rendering passed. Frontend audit has zero findings; backend has no high/critical findings and retains six transitive Firebase-chain moderates without a non-breaking fix. Live recovery delivery, production-like staging, physical-device/cross-browser evidence, credential rotation, and the other unchecked release gates remain open. |

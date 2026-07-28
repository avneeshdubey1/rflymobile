# Production Hardening Register

**Status:** mandatory pre-production work; the application is not production-ready.
**Last reviewed:** July 28, 2026
**Evidence rule:** a checkbox is complete only after test, staging, or operational evidence proves it. Local tests and Compose rendering are not production approval.

## Locked product and deployment decisions

- The interface remains customer-neutral.
- Each company receives one isolated Docker Compose stack, PostgreSQL volume/database, secret set, and domain. Shared-database tenancy is not approved.
- The initial host is provider-neutral Linux infrastructure. Containers stay portable to Kubernetes, but Kubernetes operation is deferred.
- Fresh handover uses migrations plus guarded initial-Admin bootstrap only. Development seed data is never used for client handover, production-like staging, or production.
- Admin is the highest in-application role but never receives secrets, password hashes, raw SQL, or audit-log rewrite access.
- Phone Sales intake is primary; public booking is secondary; Google Form/surveyor intake is retired.
- Every channel uses strict service-area validation. Out-of-area requests become 30-day contact-only Declined Enquiries; appeals and transport-fee negotiation are retired.
- A pilot, drone, and LMV are one schedulable crew. Mission completion frees drone and LMV before billing.
- Billing is separate from mission completion. Sales approves final acreage and internal invoice drafts; Admin can oversee/correct; raw route distance is not a price.
- WhatsApp has SMS fallback and failed delivery produces a human follow-up task.
- Firebase Authentication is retired from the production target. The server owns purpose-bound OTP challenges; WhatsApp/SMS providers only deliver an approved message and report transport status.
- Raw telemetry is disabled until vendor, retention, access, encryption, deletion, and incident policy are approved.
- Audit records remain append-only and coordinate-free. Exact pilot location and raw telemetry have separate privacy policies.

## Verified local baseline

- [x] Database-backed opaque sessions, secure production cookie contract, CSRF, session revocation, auth-version checks, and Socket.io revalidation have local test evidence.
- [x] Password hashing, account-state enforcement, canonical account phone identity, recovery challenge controls, and non-sensitive recovery responses have local test evidence.
- [x] Coordinate-free GPS auditing has local test evidence.
- [x] Current local regression evidence: backend 91/91, browser audit 30/30 from the prior portal gate, Prisma validation, frontend build, production Compose rendering, and fresh disposable-database migration replay.
- [x] Guarded fresh-handover bootstrap was locally verified to leave exactly one active Admin and no demo operational data.

These results prove only the current local baseline. Phase 1 source implementation now has disposable-database migration replay, backend regression, and browser-audit evidence. The results do not replace production-like staging evidence and do not cover LMV, billing-evidence, production-delivery, or real-provider target work.

## Release blockers: security and access

- [ ] Apply authentication and role authorization, plus negative tests, to every current and new route, socket event, worker action, import, billing, evidence, LMV, and portal read.
- [ ] Finish approved WhatsApp-default recovery delivery with SMS/email fallback, provider sandbox tests, bounce/failure handling, and no code logging.
- [x] Build application-owned OTP challenges for Farmer portal authentication and Business recovery: CSPRNG 6-digit codes, dedicated-secret HMAC, constant-time verification, 5-minute expiry, one-time consumption, transactional replacement, 5-attempt cap, 30-second resend cooldown, one active challenge per recipient/purpose, safe metadata, and purpose/recipient binding. Farmer phone-link invitation remains a product/workflow gate.
- [ ] Enforce non-enumerating OTP responses and independent phone, account/purpose, IP, global, and provider-budget limits. A provider receipt must never verify an account or issue a session.
- [ ] Extend the local OTP outbox into a production durable worker with signed idempotent webhook processing, encrypted TTL-bound delivery payloads only when necessary, dead-letter review, sanitized metrics, and human follow-up that never exposes a code.
- [ ] Restrict privileged Admin recovery to an approved stronger/manual process; phone OTP alone is not sufficient Admin assurance.
- [x] Remove Firebase packages, browser/server SDKs, Firebase ID-token acceptance, environment references, and Firebase-specific tests after internal OTP browser/recovery cutover passed local security regression. Revoke any external Firebase service-account access through its owner and verify built images contain no Firebase dependency before production. Real WhatsApp/SMS provider activation remains a separate G-04 task.
- [ ] Restrict CORS to approved origins, require HTTPS, set secure headers, enforce body/request limits, and rate-limit public, login, recovery, webhook, and upload routes.
- [ ] Validate all public and privileged inputs; return consistent non-sensitive errors.
- [ ] Complete dependency, static-code, secret, and image scans; resolve high/critical findings and preserve non-secret evidence.
- [ ] Remove credential-like documentation artifacts from the workspace and rotate potentially exposed values outside the repository. Record only non-secret rotation evidence.

## Release blockers: data, money, and privacy

- [ ] Implement strict transient geofence processing and 30-day Declined Enquiry purge; prove no rejected location/distance/acreage persists.
- [ ] Remove appeal/transport-fee/Google Form/Bhumeet operational paths through tested migrations and route retirement.
- [x] Implement lightweight LMV data, scheduling conflicts, maintenance status exclusion, assignment release, and audit history with local evidence. Detailed compliance controls remain deferred until the company supplies those fields.
- [ ] Implement BillingCase, evidence, flight-leg, invoice-draft, invoice-line, and settlement state with idempotency and precise money.
- [ ] Snapshot approved price inputs and protect issued/corrected/voided invoices from silent rewrite.
- [ ] Require human acreage approval and manually approved LMV charge lines before invoice release.
- [ ] Do not enable raw telemetry upload until the company approves vendor, sample export, retention, access, encryption/key ownership, deletion, backup, and incident response.
- [ ] Approve pilot location notice, consent, cadence, viewers, retention, and deletion; record consent separately from browser permission.
- [ ] Define privacy access/correction/deletion process, contact, and incident owner.

## Release blockers: configuration and operations control

- [ ] Build audited Admin Operations Control for people, portals, customers, centres/radii, drones, LMVs, configuration, requests, assignments, billing, settlements, chats, alerts, and follow-up tasks.
- [ ] Add validated/confirmed create, edit, deactivate, archive, maintenance, and compliance workflows; company-owned values must never be developer literals.
- [ ] Build validated Excel/Zoho core-master import with dry run, canonical deduplication, reconciliation, backup/restore, and audit evidence.
- [ ] Supply approved operating centres, radii, fleet data, pricing, currency, compliance policy, tax/GST rules, and manual-LMV-fee policy.

## Release blockers: integrations and communications

- [ ] Build and test a provider-neutral OTP delivery port, disabled production-safe adapter, deterministic test adapter, local developer CLI/console adapter, validated `OTP_DELIVERY_PROVIDER` selector, and secret-file/environment configuration boundary before selecting a live provider. The CLI adapter may display OTPs only in explicit local/test mode, must fail closed in production, and must never expose OTPs through browser responses, AuditLog, persistent logs, fixtures, reports, or documentation. An API key cannot enable an adapter that has not been implemented and reviewed.
- [ ] After the client selects a provider, provision and verify its sender/account, eligibility, approved localized authentication template, opt-in wording, current rate card, budget alert, signed callbacks, and sandbox/failure paths. Meta Cloud API remains a candidate, not a live approval.
- [ ] Select a separate India-capable SMS fallback provider and complete Principal Entity, header, content-template, consent, and delivery-report requirements before live fallback. Do not treat a trial allowance as production capacity.
- [ ] Prove WhatsApp-primary to SMS fallback only occurs after a terminal delivery result or approved timeout; prove repeated provider webhooks, retries, outages, and worker restarts cannot create duplicate codes, sessions, or charges.
- [ ] Select weather provider/plan, thresholds, caching, quota behavior, and fail-open operational queue.
- [ ] Select legal UPI merchant/gateway, settlement/refund/reconciliation rules, signed idempotent webhook, and sandbox evidence.
- [ ] Select vendor/controller evidence source and provide sample exports; do not treat mock Bhumeet material as an approved integration.
- [ ] Select object storage, encryption/key ownership, retention, access, backup, and incident controls for future raw evidence.

## Release blockers: delivery and reliability

- [ ] Build immutable image publishing, SBOM, image scanning, browser checks, staging deployment, and approval-gated production promotion in GitHub Actions. The repository now has source CI, disposable Compose validation, and a GHCR release-image evidence workflow; staging deployment and approval-gated production promotion remain blocked on G-08.
- [ ] Pin deployed image digests and retain source revision, migration, health, backup, and rollback evidence per release.
- [ ] Configure encrypted automated backups and prove isolated restore. Define RPO, RTO, retention, region, and owners.
- [ ] Configure redacted central logs, metrics, health/worker-heartbeat monitoring, storage/queue monitoring, alert recipients, quiet hours, acknowledgement, and escalation.
- [ ] Operate a durable evidence worker with retry, idempotency, backlog visibility, restart recovery, and dead-letter review.
- [ ] Configure approved TLS/reverse proxy, firewall, trusted proxy hops, secrets, maintenance windows, incident response, and support ownership.
- [ ] Correct deployment documentation to use recovery-secret files and a guarded initial-Admin procedure rather than obsolete JWT-secret instructions.

## Release blockers: quality and acceptance

- [ ] Run all tests, browser workflows, and Compose checks against production-like staging.
- [ ] Test Android and desktop supported browsers, low bandwidth, offline replay, duplicate requests, app/database/worker restart, provider failure, webhook replay, uploads, queue recovery, OTP expiry/replay/purpose isolation, rate-limit abuse, and controlled WhatsApp-to-SMS fallback.
- [ ] Complete accessibility, localization, timezone/date, currency, mobile-layout, and raw-evidence access review.
- [ ] Complete client acceptance with fresh non-demo master data and named operating owners.

## Inputs required from the company

1. Operations, privacy, finance, security, deployment, and incident owners.
2. Centres/radii, staff/pilot/LMV/drone masters, compliance policy, pricing, currency, tax/GST, and manual-LMV-fee policy.
3. Hosting/domain/TLS, alerts, backup targets, RPO/RTO, expected load, and support escalation.
4. Client-owned WhatsApp Business Account/sender, approved authentication templates and opt-in wording, current India rate evidence, SMS Principal Entity/header/content-template setup, email/weather/UPI accounts, and sandbox access, supplied only through approved secret handling.
5. Drone/controller vendor, sample evidence exports, usable-evidence definition, and raw-evidence retention/access/deletion policy.
6. Excel/Zoho master-data mapping and reconciliation owner.

## Verification log

| Date | Item | Evidence | Result |
|---|---|---|---|
| July 14, 2026 | Demo/browser baseline | Browser audit and local backend/frontend/schema checks | Local demo evidence only; production blockers remained open. |
| July 22, 2026 | Opaque-session and recovery foundation | Fresh-database backend suite and migration replay | Passed locally; live recovery provider delivery remained open. |
| July 23, 2026 | Authentication hardening closeout | Backend 74/74, browser 30/30, schema/lint/build/Compose rendering | Passed locally; not production approval. |
| July 24, 2026 | Fresh handover bootstrap | Guarded local reset | Passed locally; exactly one active Admin, no demo operational data. |
| July 25, 2026 | Canonical production-readiness documentation | docs/plan migration and link/ignore review | Documentation phase only; no new application behaviour claimed. |
| July 26, 2026 | Phone-verification and provider decision research | Official Firebase, Meta, Google pricing, TRAI, and provider documentation review | Firebase is SMS-only; no recurring free WhatsApp-authentication allowance was accepted; direct Meta Cloud API is a provisional cost baseline pending client onboarding and sandbox evidence. |
| July 26, 2026 | Phase 1 strict-intake source implementation | Prisma validation, syntax checks, locale parsing, frontend lint/build, and production Compose rendering | Passed locally; disposable database/migration/browser and staging evidence remain pending because Docker Desktop was unavailable. Not production approval. |
| July 26, 2026 | Phase 1 strict-intake evidence replay | Docker `rfly-postgres`, disposable `rfly_phase1_migration_20260726` migration replay, backend suite, browser audit | Passed locally: 11/11 migrations applied from empty database, backend 80/80, browser audit 30/30 after allowing expected strict-decline 422 console noise in the audit harness. Staging and production gates remain open. |
| July 26, 2026 | Lightweight LMV fleet and scheduling | Temporary Docker PostgreSQL `rfly-postgres-lmv-test`, Prisma validation, backend suite, frontend lint/build, browser audit | Passed locally: backend 83/83 and browser audit 30/30. Existing `rfly-postgres` container was unavailable because Docker Desktop could not start its old bind mount. Staging and client LMV master-data gates remain open. |
| July 28, 2026 | CX-01 phone-first Sales/customer mapping | Canonical SPEC, placeholders, delivery plan, and atomic work item review | Docs-only mapping completed. No code behaviour changed. Sales-assisted farmer work must preserve customer self-request, avoid Farmer-session impersonation, and audit staff-scoped actions. |
| July 28, 2026 | CX-02/CX-03 Sales-assisted customer intake | Prisma validation, local migration deploy, focused backend CX regression, frontend lint/build | Passed locally. Sales/Admin can search/create customers, open audited service views, and raise customer-linked in-area requests without OTP or Farmer-session impersonation. Public/Farmer request flows remain available. Portal isolation, Business membership, OTP, and staging evidence remain open. |
| July 28, 2026 | PORTAL-01 through PORTAL-07 read-only portal isolation | Prisma validation, local migration deploy, focused portal isolation regression, frontend lint/build | Passed locally. Farmer reads are linked through Customer; Business reads require active explicit organization membership and linked work. Customer self-request remains available. OTP cutover, provider delivery, client master data, and staging privacy review remain open. |
| July 28, 2026 | OTP-01 internal challenge and Firebase retirement | Prisma validation/generate, backend suite, frontend production build, Firebase source/dependency sweep | Passed locally: backend 91/91, frontend build passed, and no Firebase/idToken/recaptcha references remain under backend or frontend. Live WhatsApp/SMS adapter, webhook/fallback, staging evidence, image scans, and external Firebase account revocation remain open. |
| July 28, 2026 | Portal access enablement bridge | Prisma validation/generate, focused Sales/customer regression, backend suite, frontend production build | Passed locally: focused customer regression 6/6, backend 93/93, frontend build passed. Sales/Admin can create or link a Farmer portal user for a Customer without impersonation or Farmer session issuance. Staging privacy review and client access-enable policy remain open. |
| July 28, 2026 | OPS-01 through OPS-06 CI/CD release-image foundation | Workflow review, Compose/runbook update, production secret-boundary update | Added OTP-aware CI/Compose config and a GHCR release-image workflow for backend, migration, and frontend images with digest evidence, SBOM artifacts, and Trivy SARIF artifacts. Not production approval; staging deployment, backups, restore, alerts, and promotion remain blocked on G-08. |
| July 28, 2026 | On-premises demo deployment adaptation | Server handoff review, on-prem Compose override rendering, bootstrap syntax check | Added a demo-only Compose override and runbook for the shared office server on port 8088 without touching existing Jitsi/Nginx/SRS workloads. Compose render passed with temporary secret files. This is not production approval and does not replace HTTPS staging gates. |

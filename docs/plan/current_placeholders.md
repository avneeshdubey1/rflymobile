# Current Placeholders and External-Input Register

**Status:** canonical live register
**Last reviewed:** July 28, 2026

This register records company-owned decisions, provider dependencies, and intentionally disabled capabilities. It is not a production approval list. Never place passwords, private keys, tokens, reset codes, payment credentials, customer data, raw telemetry, or production values in this document.

| Area | Safe current state | Required company input | Owner | Blocks |
|---|---|---|---|---|
| Strict service areas | Phase 1 source enforces the same geofence before accepted Lead creation for public, Sales, and authenticated Farmer intake. Declines create a 30-day minimal contact record only. The forward migration intentionally stops on populated legacy appeal/Form/Bhumeet data. | Active centres, approved radii, refusal wording, approved legacy-data archival path where applicable, and operational owner. | Operations | Fresh-handover migration, staging evidence, and launch |
| LMV fleet | Lightweight local implementation exists: registration, optional label, centre, status, capacity placeholder defaulting to one crew, notes, assignment linkage, same-centre eligibility, active conflict checks, and release on completion/decommission. The assigned pilot is the driver; no separate driver field is used. | Client LMV master list and centre mapping. Detailed compliance, odometer, and service-history fields are deferred until requested. | Fleet/compliance | Client handover data and staging evidence |
| Pilot and drone masters | Current records are incomplete/demo-oriented. | Actual people, centre, licence, drone serial, airworthiness, and maintenance data. | Fleet/compliance | Safe dispatch |
| Customer and organization linkage | CX-01 through CX-03 are implemented locally for Sales-assisted intake: a lightweight Customer record stores canonical phone, Sales/Admin can search/create customers, existing Farmer users are detected for service context, Sales can open an audited staff-scoped Farmer Service View, and customer-linked MANUAL_SALES Leads still pass strict geofence validation. Lead farmer name/phone remain for legacy compatibility until portal-link cards refactor reads. Business organization/membership is not yet modelled. | Business organization/membership rules, customer-data ownership, and approved portal-linking/invitation policy. | Operations/privacy | Portal launch and Business account isolation |
| Billing evidence | Current payment is created from manually entered acreage; no Billing Case/evidence workflow exists. | Drone/controller vendor, sample exports, usable-evidence definition, reviewer process, and mismatch policy. | Operations/finance | Evidence-backed billing |
| Raw telemetry | Raw upload is intentionally disabled. | Retention, deletion, access, encryption/key ownership, storage, backup, and incident policy. | Privacy/security/operations | Raw upload activation |
| Object storage | No approved object storage exists. | Provider, region, encryption/key management, lifecycle, access, backup, and incident owners. | Deployment/security | Raw evidence |
| Pricing and money | Existing seed/config values are non-commercial and current payment fields are not invoice-safe. | Currency, acreage rule, service pricing, manual-LMV-fee policy, discounts, correction/void policy. | Finance/operations | Invoice drafts |
| Tax/GST | Tax issuance is intentionally deferred. | Registration, HSN/SAC, rate, numbering, tax wording, and legal approval. | Finance/legal | Tax invoices |
| UPI and cash settlement | UPI adapter is not live; cash is manual. | Merchant/gateway account, settlement account, reconciliation/refunds, signed webhook, and sandbox evidence. | Finance | Live settlement |
| WhatsApp, SMS, and email | No live provider is selected or approved. Firebase cannot deliver WhatsApp OTP. The target starts with a provider-neutral adapter plus disabled/test adapters; Meta is only a researched candidate. | Client provider decision, account/sender, eligibility, approved templates, opt-in wording, rate-card evidence, budget owner, signed callbacks, sandbox results, and an India-capable SMS provider where required. | Business/provider owner | Live communication and recovery |
| Phone verification and Firebase retirement | Current Farmer proof and Business phone recovery still rely on Firebase; there is no generic application-owned phone-verification challenge or durable delivery worker yet. Firebase has no Firestore/Storage/FCM data role in this repository. | Approved purposes, OTP/enrolment policy, retention policy, Meta and SMS sandbox evidence, cutover owner/window, and external Firebase service-account revocation evidence after removal. | Security/provider owner | Farmer/Business phone verification and production approval |
| Portal enrolment | Current Firebase-era Farmer self-registration is legacy behaviour. The target portal is access-controlled. Sales may staff-confirm a customer/Farmer record during a phone call without OTP for internal request handling, but that does not grant external portal access until the approved link/invitation and OTP policy is implemented. | Confirm whether Farmer external portal access is Sales/Admin-linked only or invitation-based; public self-registration is not approved by default. | Operations/privacy | Farmer portal launch |
| Password recovery | Application controls have local evidence; live delivery is not approved. | Approved WhatsApp/SMS/email delivery, stronger/manual Admin recovery policy, and rotation procedure for recovery secret. | Security/provider owner | Production recovery |
| Recovery hash secret | Production session/recovery deployment requires a secret held outside the checkout. | Generate, store, rotate, and mount the approved secret through the deployment secret store; record no value here. | Deployment/security | Production authentication |
| Fresh handover bootstrap | A guarded local bootstrap exists; its approved containerized deployment procedure is not yet verified. | Named operator, approved run procedure/image, post-bootstrap password replacement, and staging rehearsal. | Deployment/security/client Admin | Fresh client launch |
| Weather | Current provider is not approved/live. | Provider/plan, thresholds, cache/quota policy, and sandbox evidence. | Operations/agronomy | Automated weather decision |
| Excel/Zoho import | No validated import pipeline exists. | Core-master mapping, field quality rules, deduplication policy, dry-run reconciliation, and importer owner. Historic financial/flight import is excluded. | Operations/data owner | Handover import |
| Production host | Compose exists but no approved host/domain is configured. | Linux host/provider, domain, TLS edge, firewall, trusted proxy hops, resource limits, and owner. | Deployment | Staging/production |
| Backups and monitoring | Runbooks exist; automated operations and owners do not. | Backup destination, encryption/key ownership, RPO/RTO, monitoring/logging service, alerts, escalation, and incident owners. | Operations/security | Production launch |
| GPS and location privacy | Current mission location needs policy completion. | Notice, consent, cadence, viewers, retention/deletion, and privacy contact. | Privacy/operations | Live tracking |
| Language review | Technical dictionaries exist but business wording is provisional. | Approved farmer-facing wording and reviewers for supported languages. | Operations/language reviewers | Live messaging |
| Credential remediation | Credential-like local documentation artifacts have been identified and must never be staged. | External credential rotation/revocation evidence without secret values. | Deployment/security | Production approval |

## Resolved or intentionally retired

| Item | Resolution |
|---|---|
| Google Form/surveyor intake | Phase 1 source routes, job, configuration, test fixtures, and UI paths are retired. Historical migration records remain; applying the forward migration to populated legacy data requires approved archival evidence. |
| Out-of-area appeal and transport pricing | Phase 1 source schema/runtime/UI paths are retired. Strict service-area decline replaces them; populated legacy data is intentionally migration-blocked pending approved archival handling. |
| Bhumeet mock | Phase 1 source routes, mock UI, and schema model are retired. It remains neither a production telemetry nor billing strategy. |
| Development seed for handover | Demo/development only. Use migrations and guarded initial-Admin bootstrap for fresh handover. |
| Raw telemetry upload | Intentionally disabled until the required privacy, storage, vendor, and retention approvals exist. |
| Kubernetes operation | Deferred. Compose is the approved initial deployment model. |
| Browser bearer-token storage | Replaced by revocable server-side opaque sessions with cookie/CSRF controls. |
| Firebase Authentication phone proof | Retired target. Current code remains Firebase-dependent until the internal challenge, provider fallback, staging cutover, and removal evidence are complete. |

## Maintenance rule

- Update this register whenever a placeholder, provider boundary, company-owned value, or disabling gate changes.
- Move an item to the retired/resolved table only with verification evidence.
- Keep live file references current after implementation; never substitute a source path for proof that a provider or production control is live.
- Record non-secret rotation, staging, restore, and provider-test evidence in the repository history and hardening register.

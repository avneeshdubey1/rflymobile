# Current Placeholders and External-Input Register

**Status:** canonical live register
**Last reviewed:** July 25, 2026

This register records company-owned decisions, provider dependencies, and intentionally disabled capabilities. It is not a production approval list. Never place passwords, private keys, tokens, reset codes, payment credentials, customer data, raw telemetry, or production values in this document.

| Area | Safe current state | Required company input | Owner | Blocks |
|---|---|---|---|---|
| Strict service areas | Current code still has legacy appeal behaviour; target requires every channel to validate service area before Lead creation. | Active centres, approved radii, refusal wording, and operational owner. | Operations | Strict-intake delivery and launch |
| LMV fleet | No LMV model or scheduler exists yet. | Registration, centre mapping, capacity, maintenance/compliance records, and policy owners. | Fleet/compliance | LMV scheduling |
| Pilot and drone masters | Current records are incomplete/demo-oriented. | Actual people, centre, licence, drone serial, airworthiness, and maintenance data. | Fleet/compliance | Safe dispatch |
| Customer and organization linkage | Current records are lead-centric and portals are incomplete. | Business organization/membership rules and customer-data ownership. | Operations/privacy | Portal launch |
| Billing evidence | Current payment is created from manually entered acreage; no Billing Case/evidence workflow exists. | Drone/controller vendor, sample exports, usable-evidence definition, reviewer process, and mismatch policy. | Operations/finance | Evidence-backed billing |
| Raw telemetry | Raw upload is intentionally disabled. | Retention, deletion, access, encryption/key ownership, storage, backup, and incident policy. | Privacy/security/operations | Raw upload activation |
| Object storage | No approved object storage exists. | Provider, region, encryption/key management, lifecycle, access, backup, and incident owners. | Deployment/security | Raw evidence |
| Pricing and money | Existing seed/config values are non-commercial and current payment fields are not invoice-safe. | Currency, acreage rule, service pricing, manual-LMV-fee policy, discounts, correction/void policy. | Finance/operations | Invoice drafts |
| Tax/GST | Tax issuance is intentionally deferred. | Registration, HSN/SAC, rate, numbering, tax wording, and legal approval. | Finance/legal | Tax invoices |
| UPI and cash settlement | UPI adapter is not live; cash is manual. | Merchant/gateway account, settlement account, reconciliation/refunds, signed webhook, and sandbox evidence. | Finance | Live settlement |
| WhatsApp, SMS, and email | Providers are mocked/fail-open or unavailable. | Provider accounts, senders, templates, opt-in evidence, callbacks, failure policy, and sandbox verification. | Business/provider owner | Live communication and recovery |
| Password recovery | Application controls have local evidence; live delivery is not approved. | Approved WhatsApp/SMS/email delivery and rotation procedure for recovery secret. | Security/provider owner | Production recovery |
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
| Google Form/surveyor intake | Retired target. Legacy code remains until the strict-intake implementation package removes it. |
| Out-of-area appeal and transport pricing | Retired target. Strict service-area decline replaces it. |
| Bhumeet mock | Not a production telemetry or billing strategy. Retire/quarantine legacy mock paths during implementation. |
| Development seed for handover | Demo/development only. Use migrations and guarded initial-Admin bootstrap for fresh handover. |
| Raw telemetry upload | Intentionally disabled until the required privacy, storage, vendor, and retention approvals exist. |
| Kubernetes operation | Deferred. Compose is the approved initial deployment model. |
| Browser bearer-token storage | Replaced by revocable server-side opaque sessions with cookie/CSRF controls. |

## Maintenance rule

- Update this register whenever a placeholder, provider boundary, company-owned value, or disabling gate changes.
- Move an item to the retired/resolved table only with verification evidence.
- Keep live file references current after implementation; never substitute a source path for proof that a provider or production control is live.
- Record non-secret rotation, staging, restore, and provider-test evidence in the repository history and hardening register.

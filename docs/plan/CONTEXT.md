# Product and Operating Context

**Status:** authoritative business context
**Last reviewed:** July 26, 2026

## The operating model

This is a customer-neutral agricultural drone-service operations product. One operating company owns or controls its drones and LMVs, employs pilots and staff, and serves farmers or farm businesses from defined operating centres. Each client receives an isolated deployment; companies do not share a database, volume, secret set, or domain.

The system coordinates a field-service business. It is not a drone marketplace, a generic vehicle tracker, or an automatic billing system without human accountability.

## How work enters the business

The primary real-world path is a phone call. A farmer calls the company and a Sales employee records the request. This supports feature-phone use, intermittent connectivity, and the practical preference for speaking to a person.

The public booking form remains available as a secondary path. It must lead into the same validated workflow and cannot bypass staff review or service-area policy. Google Form and external-surveyor intake are being retired; their current code paths are legacy behaviour until the relevant implementation package removes them.

Farmer and Business accounts are optional status portals, not a requirement for receiving service:

- A Farmer account is linked to its verified phone identity and may see only its own requests, approved invoice drafts, and settlement state.
- A Business account represents a farm group, cooperative, or company. It sees only records explicitly linked to that organization.
- A customer must never gain access to another customer’s request, invoice, location, or communication history.

## Strict service-area policy

Operating centres define the area the company can serve. If a request is outside every active service area, the company does not accept the job.

The system performs the geofence calculation only to decide the outcome. For a declined request it stores a minimal contact-level Declined Enquiry, without persistent address, coordinates, distance, acreage, route, or appeal information. The enquiry is deleted after 30 days. There is no appeal, transport-cost negotiation, or hidden scheduling override.

This is deliberately different from the legacy product behaviour. A record of the refusal helps staff recognize a recent caller without turning an unserviceable request into an operational order.

## Fleet reality: pilot, drone, and LMV

A pilot both drives the assigned LMV and operates the assigned drone. A job therefore needs three coordinated resources:

1. a qualified, available pilot;
2. an available, compliant drone; and
3. an available, compliant LMV from the appropriate operating centre.

The first release reserves one pilot-and-drone crew per LMV, even if vehicle capacity is recorded for future expansion. The system must make vehicle availability, maintenance, and compliance visible to Fleet staff and must reject double-booking server-side.

## Mission and billing are separate

Field work and payment are not the same event. The pilot can complete a mission and free the drone and LMV for the next job before billing is complete.

The current day-long billing delay is understood as a manual evidence-handling process: retrieve or synchronize flight information, identify the job, inspect coverage/area evidence, resolve mismatches, and approve the charge. It is not an unavoidable computing delay.

The target is an internal invoice draft within 30 minutes after usable evidence reaches the system:

Phone or public request
  → transient service-area decision
  → accepted service request or 30-day declined enquiry
  → pilot + drone + LMV scheduling
  → mission completion and immediate fleet release
  → billing evidence and human review
  → invoice draft
  → UPI or cash settlement

The final bill must be based on a human-approved acreage rule, not raw route distance. Telemetry is evidence. It can support review, but it does not silently decide the price.

## Evidence, privacy, and people

The initial billing design is vendor-neutral because the client has not yet supplied a confirmed drone/controller ecosystem, sample exports, or a retention policy. Raw flight evidence will eventually belong in encrypted external object storage with limited role access; it must not be stored as database blobs or copied into audit logs.

Raw telemetry upload is disabled until the company approves retention, deletion, access, encryption, and incident-response policy. This restraint protects pilots, farmers, and the company while the evidence workflow is built.

Farmer communications remain practical:

- WhatsApp is supported where the farmer uses it.
- SMS is the fallback for feature-phone and delivery-failure cases.
- A failed message creates a staff follow-up task. Automated voice calling is out of scope.

### Phone verification and delivery ownership

Firebase's documented phone sign-in flow is SMS-only, so it cannot satisfy the approved WhatsApp-first experience. The target retires Firebase Authentication entirely after a staged cutover. The application owns the phone-verification challenge and uses an external provider only to transport the message.

No delivery provider has been selected. The first implementation builds the internal challenge and a provider-neutral integration boundary; only after the client confirms a provider will its adapter and deployment-secret configuration be activated. This prevents a provider choice from changing the login security model.

A one-time code proves current control of a phone number for one narrow purpose; it does not by itself create a customer relationship, role, or portal entitlement. The default portal-enrolment rule is an existing explicitly linked account or an approved invitation. Any public self-registration policy requires separate client approval.

For an approved Farmer portal login, Farmer phone link, or Business recovery, the server creates the short-lived challenge, sends it first through WhatsApp, and may use SMS only as a controlled fallback. A provider delivery receipt never proves identity. Staff follow-up must help the customer through an approved support process and must never disclose or ask for an OTP.

Every human-facing message remains localized. Tamil and other supported languages require operational review; a translation being technically present is not equivalent to approved business wording.

## Roles

| Role | Operational responsibility |
|---|---|
| Admin | Audited company-wide oversight, correction, configuration, and protected access control. |
| Sales | Phone intake, request processing, customer follow-up, final-acreage approval, and internal invoice-draft release. |
| Fleet Manager | Fleet availability, LMV/drone maintenance visibility, scheduling, and exception handling. |
| Pilot | Drives the assigned LMV, operates the drone, completes the mission, and submits operational evidence. |
| Farmer | Optional verified-phone status portal for its own work and settlement visibility. |
| Business | Optional farm-group/company status portal for explicitly linked work only. |

## Design principles

1. Build for the channel the business actually uses: phone-first staff intake.
2. Automate clean, repeatable work but expose exceptions to a named human queue.
3. Treat fleet, money, privacy, and customer access as server-enforced business controls.
4. Keep business-owned values configurable and auditable.
5. Keep customer data isolated and collect only what the workflow needs.
6. Make every production claim evidence-based: local tests are not production approval.

## Glossary

| Term | Meaning |
|---|---|
| LMV | The light motor vehicle that carries the assigned drone and is driven by the assigned pilot. |
| Declined Enquiry | A minimal, time-limited contact record for a request outside the service area; it is not a Lead or order. |
| Billing Case | The evidence and review workflow created after operational mission completion. |
| Flight Leg | One flight or evidence segment belonging to a billing case; one job may have several. |
| Evidence | Vendor export, approved summary, or other reviewed support for the billing decision. |
| Invoice Draft | An internal, audited draft released after Sales approval; it is not a tax invoice until finance rules are supplied. |
| Settlement | A UPI or cash collection record associated with an issued invoice draft. |
| Follow-up Task | A visible staff task created when a communication, evidence, or automation step needs human action. |

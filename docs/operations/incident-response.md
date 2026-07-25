# Incident response runbook

> **Operational record:** this is not the current product specification. Refer to [docs/plan/AGENTS.md](../plan/AGENTS.md) for release requirements.

## Before launch

The company must assign named primary/backup incident commanders, privacy contact, infrastructure owner, database owner, security owner, customer-communications owner, provider contacts, and legal/compliance escalation. Store that contact sheet in the approved operations system, not this repository.

Define severity, acknowledgement times, quiet-hour behaviour, and escalation. A dashboard without a notified owner is not incident response.

## Immediate actions

1. Record UTC detection time, reporter, deployment/company identifier, symptoms, and request IDs. Do not copy farmer details, tokens, coordinates, chat messages, payment links, or database dumps into the ticket.
2. Assign incident command and severity.
3. Preserve container/image identifiers, sanitized logs, audit IDs, monitoring events, and deployment changes.
4. Contain with the least destructive action:
   - disable the affected provider/webhook;
   - stop frontend/backend to halt writes;
   - restrict the TLS edge/firewall;
   - revoke sessions/rotate a compromised secret through the secret store;
   - isolate the affected company stack without touching another installation.
5. Never delete audit records, wipe a volume, reset migrations, or “clean up” evidence during containment.
6. Assess confidentiality, integrity, availability, affected time window, data categories, and whether exact location/payment/account data was involved.

## Useful safe commands

```sh
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml ps --all
docker compose --env-file "$DEPLOY_ENV" -f compose.production.yml logs --since 60m --no-color frontend backend
docker inspect --format '{{.Image}} {{.State.Status}} {{.State.Health.Status}}' "${DEPLOYMENT_NAME}-backend-1"
```

Filter and export logs through the approved logging service. Do not enable request-body or database-query payload logging to diagnose an incident.

## Scenario guidance

### Suspected credential exposure

- Disable the affected integration/account first.
- Rotate the secret in the provider/secret manager; update the file-mounted secret; recreate only affected containers.
- For JWT/session secrets, treat existing sessions as revoked and communicate forced reauthentication.
- Search version control, CI logs, backups, chat, and tickets for propagation without reproducing the secret.

### Database integrity or failed migration

- Stop writers and preserve the current volume.
- Follow [migration and rollback](migration-rollback.md).
- Restore only from a checksum-verified backup into a clean volume.

### GPS/privacy exposure

- Stop active location ingestion/viewing if necessary.
- Preserve coordinate-free event/request IDs rather than copying coordinates.
- Engage the privacy owner immediately and follow approved notification/data-subject procedures.
- Confirm shared-device/offline queues and cached responses are contained.

### Provider/payment replay or mismatch

- Disable the webhook/provider integration; keep the operational workflow in its visible manual queue.
- Preserve provider event IDs, internal payment IDs, timestamps, and signatures—not full payloads.
- Reconcile with the payment/provider owner before changing final state.

## Recovery and closure

1. Apply a reviewed fix and test it in an isolated/staging environment.
2. Verify backup/restore and rollback paths when relevant.
3. Restore service gradually and monitor health, error rate, authentication failures, queues, payments, jobs, Socket.IO, and providers.
4. Obtain incident-command approval before normal operations resume.
5. Complete a blameless review: timeline, root cause, contributing controls, customer/data impact, detection gaps, corrective owners/dates, and evidence-retention decision.
6. Update runbooks and automated tests; do not mark corrective work complete without evidence.

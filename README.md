# Field Operations Platform

> **Current product target:** start with [docs/plan/AGENTS.md](docs/plan/AGENTS.md). This README describes the current code baseline and local setup; it is not the current product specification.

This repository contains an internal drone-service operations platform for lead intake, geofencing, fleet scheduling, pilot mission work, current-location monitoring, payment tracking, and an auditable CRM timeline.

## Canonical documentation

- [Agent guide](docs/plan/AGENTS.md)
- [Business context](docs/plan/CONTEXT.md)
- [Future-state technical specification](docs/plan/SPEC.md)
- [Production hardening register](docs/plan/production_hardening.md)
- [External-input register](docs/plan/current_placeholders.md)
- [Production-readiness delivery plan](docs/plan/plan_for_production_rediness.md)

## Repository layout

- frontend/ — React and Vite frontend.
- backend/ — Express, Socket.io, Prisma, and PostgreSQL backend.
- backend/prisma/ — schema, migrations, and development/demo seed only.
- compose.production.yml — isolated single-company Compose baseline.
- deploy/ — deployment configuration examples and runbook entry point.

## Local development

Use a local PostgreSQL instance or disposable container, create local environment files from the tracked examples, and keep all credentials outside Git.

    cd backend
    npm install
    npm run prisma:migrate
    npm run dev

In a separate terminal:

    cd frontend
    npm install
    npm run dev

The development seed is for demo data only. A fresh client handover must use migrations and the guarded initial-Admin bootstrap described in the canonical plan.

## Current baseline versus target

The existing application is suitable for a controlled local demonstration and has local evidence for opaque-session authentication, role dashboards, scheduling, pilot lifecycle, offline replay, current-location handling, payment fallback, CRM history, and chat.

Phase 1 source now enforces strict service-area intake and retires active Google Form, appeal, transport-fee, and Bhumeet mock paths. Lightweight LMV scheduling is implemented locally: a scheduled job reserves a pilot, drone, and LMV, and releases the LMV when the mission is completed or decommissioned. Sales-assisted customer intake is also implemented locally: Sales/Admin can search or create a customer, open an audited staff-scoped service view, and raise a customer-linked request without OTP or Farmer-session impersonation while preserving public/Farmer request flows. The strict-intake forward migration intentionally stops on populated legacy data until an approved backup/archival procedure is evidenced. Immediate manual-acreage payment creation, portal isolation, Business membership, and Firebase-dependent Farmer/Business phone proof remain later delivery work.

The pre-Phase-1 baseline had backend 74/74 and browser audit 30/30 evidence on July 23, 2026. Phase 1 local evidence now includes fresh disposable-database migration replay, backend 80/80, and browser audit 30/30. This is not production approval. Real provider delivery, privacy decisions, staging, backup/restore, monitoring, and release gates remain open in the hardening register.

## Verification

    cd backend
    npm test
    npm run prisma:validate

    cd ../frontend
    npm run lint
    npm run build
    npm run test:browser

Use disposable test databases only. Do not seed or reset client data as part of verification.

## Operations

The current Compose foundation keeps database and backend ports private and expects an approved TLS edge. Read [deploy/README.md](deploy/README.md) and the canonical hardening register before staging or production work.

Do not configure Google Form for a new deployment. Do not place credentials, customer data, raw telemetry, or production values in source control, documentation, logs, or chat.

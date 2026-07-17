# Field Operations Platform

An internal drone-service operations platform for lead intake, geofencing, automated assignment, pilot mission execution, live current-location monitoring, payments, and an auditable CRM timeline.

## Architecture

- `frontend/` — React + Vite, Tailwind CSS, `react-i18next`, Socket.io client, and an offline pilot action queue.
- `backend/` — Express, Socket.io, Prisma, and PostgreSQL.
- `backend/prisma/` — data model, migrations, and repeatable development seed data.
- `docs/SPEC.md` — product and technical source of truth.
- `docs/CONTEXT.md` — operating model and domain rationale.
- `docs/AGENTS.md` — engineering constraints and implementation rules.
- `current placeholders.md` — every external integration or business decision still required for production.
- `production hardening.md` — mandatory security, privacy, tenant-isolation, reliability, and release gates.
- `docs/ui_correction_report_2026-07-14.md` — platform-wide UI correction scope, root cause, and browser evidence.

## Local development

1. Start PostgreSQL:

   ```powershell
   docker run --name rfly-postgres -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=rfly_daas -p 5432:5432 -d postgres:16
   ```

2. In `backend/`, create a local `.env` with `DATABASE_URL`, `JWT_SECRET`, and your `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` (if you are testing the Farmer Login). For a fresh seed, choose the local demo password directly in your terminal, then run:

   ```powershell
   npm install
   npm run prisma:migrate
   $env:DEMO_USER_PASSWORD = Read-Host -MaskInput "Choose the local demo password"
   npm run prisma:seed
   Remove-Item Env:DEMO_USER_PASSWORD
   npm run dev
   ```

   The seed creates neutral role accounts for Admin, Sales, Fleet Manager, and Pilot. Their non-secret account identifiers are declared in `backend/prisma/seed.js`; the password is only the local value entered above and is never printed by the application.

   If you are locked out of the local demo Admin account, run `node scripts/resetLocalAdminPassword.local.js` from `backend/`. This ignored, local-only script securely prompts for a replacement password, changes only the Admin account, records a credential-free audit event, and refuses to run in production.

3. In `frontend/`, create a local `.env` and copy the Firebase credentials from `.env.example` into it. Then run:

   ```powershell
   npm install
   npm run dev
   ```

The frontend runs on Vite's local URL and the backend defaults to port `5000`.

If port `5000` reports `EADDRINUSE`, another backend is already running. Stop that older process or use its existing server; do not start a second backend on the same port.

## Demonstration status

The current build is suitable for a controlled local stakeholder demonstration. The verified path covers public GPS intake, Sales verification and appeals, automatic/manual Fleet scheduling, Pilot accept/start/GPS/complete, offline replay, payment cash fallback, CRM history, and Admin–Pilot chat.

The July 14 UI correction gives every active route one customer-neutral operations design system, with professional colour accents and verified desktop, tablet, and phone layouts. The current isolated Edge suite passes 30/30 checks; normal workflows produce no console, runtime, or HTTP errors.

WhatsApp, live weather, Google Form delivery, and UPI remain deliberately mocked or fail-open until provider sandboxes and company-owned configuration are supplied. This demo status is not production approval; see `production hardening.md`.

## Verification

```powershell
cd backend
npm test
npm run prisma:validate

cd ..\frontend
npm run lint
npm run build
npm run test:browser
```

Backend tests reset only `rfly_daas_backend_test`; the Edge audit resets only `rfly_daas_browser_test`. Neither suite seeds or changes the normal demo database. See `docs/demo_acceptance_report_2026-07-14.md` for the latest methodical result.

## Operations notes

- `GET /api/health` checks the database and exposes latest scheduled-job heartbeats.
- Google Form intake is ready at `POST /api/leads/ingest/google-form` (or `/api/forms/webhook`), but needs the real Apps Script, deployment URL, and `FORM_WEBHOOK_SECRET` before use.
- The development database may be reset only through `POST /api/system/seed` by an authenticated Admin; it is disabled in production.
- `npm run demo:prepare` removes interrupted automated-test fixtures from the normal development database without changing the seeded operational sample records.
- Never place production credentials in source control or chat. Review `current placeholders.md` and complete `production hardening.md` before deployment.

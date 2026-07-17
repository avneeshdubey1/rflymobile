# DaaS Field Operations Platform - Context for ChatGPT

This is a zip archive of the DaaS (Drone as a Service) Field Operations Platform.
The platform is an internal drone-service operations application used for lead intake, geofencing, automated assignment, pilot mission execution, live current-location monitoring, payments, and an auditable CRM timeline.

## Directory Structure
- `frontend/`: Contains the React + Vite frontend application. It uses Tailwind CSS, `react-i18next`, Socket.io client, and has an offline pilot action queue.
- `backend/`: Contains the Express + Node.js backend application. It uses Socket.io, Prisma (ORM), and PostgreSQL for the database.
- `backend/prisma/`: Contains the data model, migrations, and seed scripts.
- `docs/`: Contains technical and domain documentation.

## Key Documentation Files to Read
Please review the following files before proceeding with tasks:
1. `README.md`: General overview, local development setup instructions, and architecture.
2. `docs/SPEC.md`: Product and technical source of truth.
3. `docs/CONTEXT.md`: Operating model and domain rationale.
4. `docs/AGENTS.md`: Engineering constraints and implementation rules.
5. `current placeholders.md`: External integrations or business decisions required for production.
6. `production hardening.md`: Security, privacy, tenant-isolation, reliability, and release gates.
7. `history_of_changes.md`: Chronological log of recent fixes and UI corrections.

## Notes
- The `node_modules` folders have been excluded from this zip file to keep the size manageable. 
- You may need to instruct the user to run `npm install` in both the `frontend` and `backend` directories before running the application locally.
- For local development, `rfly_daas` database needs to be running on PostgreSQL. See `README.md` for Docker instructions.

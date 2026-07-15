# Project Guidelines & Context

This file ensures that all agents working on this project are context-aware of the history and current constraints.

## Project Background
* **Project Name**: Customer-neutral DaaS (Drone as a Service) operations platform
* **Goal**: Automate acknowledgement, assignment, and cost verification for drone spraying services without customer-specific branding unless explicitly approved.
* **Constraints**: 
  * The user has a legacy project (`PaaS_Demo-main`) built by a former employee. **DO NOT USE THIS CODEBASE**, as the former employee left on bad terms. The legacy codebase (`rfly-legacy-reference/`) is strictly for reference only; never copy-paste or adapt files directly from it.
  * You MUST continue building on top of the junior intern's codebase (`Daas--main`), which is a React (Vite) + Node (Express) application.
  * No heavy container orchestration (Docker) should be implemented until the frontend and backend features are verified.
  * Build order defined in `SPEC.md` must be strictly followed.

## Environment & Storage Configuration
* **Disk Space Constraint**: The `C:` drive is nearly full. All project work has been migrated to `D:\projects\`.
* **Execution Rule**: Going forward, **ALL heavy operations MUST occur on the `D:` drive**. This includes building Docker images, caching images, mounting database volumes, and running project code. Do not allow caches or dependencies to fill up the `C:` drive.

## Architecture & Code Rules
* **Frontend**: React, React Router. Styled purely with Vanilla CSS (Glassmorphism, dark mode). Avoid Tailwind unless requested.
* **Backend**: Node.js + Express.
* **Data Layer**: The Repository Pattern is mandatory. All database access must go through `backend/src/repositories/`. Never import `PrismaClient` directly in controllers or sockets.
* **Audit & Business Logic**: Every state-changing action must write to `AuditLog`. Never hardcode business values (rates, thresholds); use `PricingConfig` or equivalent.
* **State Machines**: State machine transitions must be server-enforced, not just UI-hidden.
* **Graceful Degradation**: Automated systems must fail open to a human queue (e.g., `NEEDS_MANUAL_SCHEDULING`). Never fail silently.
* **i18n**: Use i18n from day one on any farmer-facing strings (e.g., `en.json`, `ta.json`).

## Domain Context
* **Business Model**: The current data model supports one fleet operator that owns/controls drones and pilots. The product must remain customer-neutral, and multiple companies require isolated deployments or future tenant isolation before production.
* **Intake Process**: The primary intake channel is often via Google Form submitted by an on-site surveyor, not necessarily the farmer directly using the web app.
* **Geofencing**: Leads outside the standard radius have an appeal/negotiation path; they are not strictly rejected.
* **Auto-Assignment**: Automates matching leads to pilots/drones to scale operations. Uses an escalating notification cascade (push -> SMS -> call -> reassignment).

## Guidelines
* Always update `history_of_changes.md` when completing major milestones.
* Before production, deployment, security, privacy, or live-integration work, read and follow the root `production hardening.md`; update it when a decision or hardening status changes.
* At the end of every completed milestone, provide a brief plain-language summary of what changed, what is now working, and what comes next. Assume the reader may be new to the technology involved.
* **Dev Tools**: The legacy JSON `/flush` page was removed in Phase 14. For local development only, an authenticated Admin may use `POST /api/system/seed` to run the Prisma seed; it is disabled in production. Do not place destructive data controls in the main Admin Dashboard.
* **UI Styling**: Use `Outfit` and `Inter` fonts. Use the `.glass-card` selector which inherently applies the SVG noise texture (`::before`) for premium glassmorphism. Use the `.tilt-effect` class for 3D hover interactions.

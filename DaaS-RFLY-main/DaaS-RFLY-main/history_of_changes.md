# History of Changes

## July 7, 2026
* **Project Reset**: Decided to build exclusively on top of `Daas--main` (intern's code) and discard the legacy `PaaS_Demo-main` codebase.
* **Authentication & Routing**: Implemented a mock JSON user store (`users.json`), a Node backend Auth Controller, and React `AuthContext` with Protected Routes to secure the dashboards.
* **UI Overhaul**: Scrapped basic styling in favor of a modern Vanilla CSS Glassmorphism design system.
* **Landing Page**: Created a new `/` landing page with a service request form for Farmers to book a drone.

## July 8, 2026
* **Fleet Manager Drag & Drop**: Completely redesigned the drag-and-drop modal. The popup opens as a slide-up drawer anchored to the bottom of the screen, pushing the modal up, resulting in a significantly more ergonomic user experience.
* **Bhumeet API Integrations**: Added Bhumeet API sync dashboard for Admins, pulling in mock DSP (Drone Service Provider) data for weather, active flights, and daily spray reports.
* **System Dev Tools**: Created a standalone hidden route at `/flush` for independent database table purging and populating. It uses a secure lock screen pattern with the password `flushit>` and is decoupled from standard authentication.
* **UI Looksmaxxing**: Upgraded the global styling by introducing the *Outfit* and *Inter* fonts, a deep 3-color mesh gradient, an SVG noise overlay filter for realistic glassmorphism (`.noise-overlay`), and CSS 3D tilt hover effects (`.tilt-effect`).

## July 9, 2026
* **Role-Based Access Control (RBAC)**: Strengthened role isolation across Sales, Fleet Manager, Admin, and Pilot roles.
* **Socket.io Integration**: Added WebSockets via `socket.io` for real-time `assignment_rescheduled` events, replacing HTTP polling for toast notifications in the Sales dashboard.
* **Fleet Gantt Chart**: Built a new timeline Gantt Chart view for Fleet Managers to view, edit, and reschedule pilot assignments directly, triggering real-time updates for Sales.
* **Bhumeet Proxy Backend**: Implemented the live Bhumeet API sync by establishing an authenticated Node/Express proxy, making Bhumeet data the default view on the Admin Dashboard.

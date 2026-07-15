# RFLY DaaS - System Blueprint & Refactoring Plan

Based on our brainstorming session, this document outlines the upcoming architecture overhaul, role redefinitions, and new features to be implemented after your review. **No code has been written yet.**

## User Review Required
> [!IMPORTANT]
> **Tailwind CSS Adoption**
> The original project guidelines stated to avoid Tailwind CSS and stick to Vanilla CSS. However, based on your request for a "fancy in a professional way" UI overhaul, we will transition the project to use Tailwind CSS for rapid styling, animations, and a modern aesthetic. Please confirm this is acceptable.

## Open Questions
> [!WARNING]
> Before we start tearing things apart, let's align on a few technical decisions:
> 1. **Calendar Component:** For the Google Calendar-like drag-and-drop feature, would you prefer an off-the-shelf library like `react-big-calendar` or `FullCalendar`? (These handle drag-and-drop scheduling natively).
> 2. **Real-time Chat:** The Admin-Pilot drone enquiry chat requires real-time updates and read receipts. Are you okay with implementing `Socket.io` (WebSockets) for this?
> 3. **Database:** You mentioned moving away from JSON files. For relational data like Leads, Assignments, and Users, **PostgreSQL** is highly recommended. Does this align with your tech stack preferences, or do you prefer a NoSQL option like **MongoDB**?

---

## 1. Role Restructuring & Permissions

### The Admin ("God Mode")
- **Omnipresent Access:** The Admin will have a master layout capable of viewing and overriding *any* data across Sales, Fleet, and Pilot modules.
- **Drone Enquiry Chat:** A persistent chat interface between Admin and Pilot.
  - Chat persists until Admin closes it OR after the first pilot response is read by Admin (read receipts).
  - Unread chats remain open; fully read chats auto-close after 24 hours of inactivity, and a participating Admin may close a chat for both sides.

### The Fleet Manager ("Lesser Admin")
- **Scope:** Strictly focused on Drone management (CRUD operations, maintenance) and Pilot Scheduling.
- **Calendar Scheduler:** 
  - Replaces the current Gantt chart.
  - Default: Monthly view. Click a date -> Daily view.
  - Drag-and-drop assignments to pilot schedules.
- **Notification Engine:** When a schedule is dropped/changed, an event is fired to the Sales Dashboard for customer notification.

### The Sales Rep ("The Middle Man")
- **Scope:** Customer liaison. Processes raw leads and structures them for the Fleet Manager.
- **Persistent Leads:** Processed leads no longer disappear. They transition to a "Dispatched/In Progress" state and remain on the Sales dashboard until the mission is entirely complete.
- **Rescheduling Hub:** The irrelevant "Pilot Complaints" tab will be completely rebranded into a **"Reschedule & Notifications"** tab. Sales reps will use this to track Fleet Manager schedule changes and inform farmers.

### The Pilot (Hired Operator)
- **Scope:** Field execution only. No drone ownership.
- **Dynamic Drone Binding:** Drones only appear in the Pilot's dashboard *after* they are assigned and *while* the mission is active.
- **Auto-Release:** Upon mission completion, the drone is automatically un-bound from the pilot.
- **De-commissioning:** Pilots can manually "De-commission" (release) a drone mid-mission if an issue occurs, notifying the Fleet Manager.

---

## 2. UI/UX Overhaul (Tailwind CSS)
We will completely revamp the frontend:
- **Design Language:** Professional, sleek, modern.
- **Framework:** Tailwind CSS will be integrated to replace the complex Vanilla CSS classes.
- **Animations:** Subtle Framer Motion (or Tailwind arbitrary values) for smooth transitions between dashboard states, calendar interactions, and chat pop-ups.

## 3. Database Migration Strategy
While we will initially rebuild the frontend and backend logic using the current JSON structure to validate the UI, we will abstract the data layer (using the Repository Pattern). 
This ensures that when you give the green light, we can seamlessly swap the JSON read/writes for real Database queries (e.g., Prisma ORM + PostgreSQL) without rewriting the core business logic.

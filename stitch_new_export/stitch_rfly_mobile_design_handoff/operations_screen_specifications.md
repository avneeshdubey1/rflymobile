# RFLY Operations: Screen Specification (v1)

## Overview
The RFLY Operations application is a capability-driven tool for Admin, Fleet Manager, and Sales roles. It uses a 5-tab navigation system and handles high-density data for back-office management.

---

## OP-01 Operations Login & Startup
- **Application:** RFLY Operations
- **Authorized Actor:** All staff accounts
- **Purpose:** Secure authentication and version verification.
- **Data Fields:** Operator ID/Email, Passcode, System Version, Connection Status.
- **Controls:** Authenticate (Primary), Request Temporary Access (Secondary).
- **States:**
  - **Loading:** Spinner on 'Authenticate' button.
  - **Invalid:** Inline error: "Invalid operator credentials."
  - **Offline:** Banner: "No connection. Authentication requires network."
  - **Upgrade:** Full-screen blocking modal if version < v4.2.1.
- **Accessibility:** 48dp touch targets, screen reader announcements for errors.

---

## OP-02 Operations Home
- **Application:** RFLY Operations
- **Authorized Actor:** Sales, Fleet Manager, Admin
- **Purpose:** Role-specific action queues and performance overview.
- **Data Fields:** Active capability view, New Leads (24h), Conversion Rate, Critical Exceptions.
- **Controls:** Bulk Actions, New Task (+), Resolve Now (Critical Exception).
- **States:**
  - **Empty:** "No high-priority tasks assigned."
  - **Loading:** Shimmering skeletons for metric cards.
- **Accessibility:** Clear focus order from critical alerts to metrics.

---

## OP-03 Customer Search
- **Application:** RFLY Operations
- **Authorized Actor:** All roles (Write for Sales/Admin)
- **Purpose:** Manage commercial client accounts.
- **Data Fields:** Search (Name/Company/ID), Filter tabs (All, Active, Pending).
- **Controls:** Search button, Filter chips, Customer cards.
- **States:**
  - **No Results:** "No customers found matching '[query]'."
- **Accessibility:** Labels for search input and status chips.

---

## OP-04 Customer Registration
- **Application:** RFLY Operations
- **Authorized Actor:** Sales, Admin
- **Purpose:** Intake for new commercial accounts.
- **Data Fields:** First Name, Last Name, Company Name, Business Email, Primary Phone.
- **Controls:** Save Customer (Primary), Cancel.
- **States:**
  - **Validation:** "Company Name is required" highlight.
  - **Offline:** "Customer will be registered once online."
- **Accessibility:** Explicit focus order through form fields.

---

## OP-05 Lead Intake
- **Application:** RFLY Operations
- **Authorized Actor:** Sales, Admin
- **Purpose:** Geographic-aware lead capture.
- **Data Fields:** Customer Search/Name, Contact Phone, Search Address, Pinpoint on Map (Concept), Latitude/Longitude (Auto-resolve), Service Type, Initial Notes.
- **Controls:** Locate, Submit Lead, Cancel.
- **States:**
  - **Mapping:** "GPS Required" indicator.
  - **Success:** Navigates to OP-06.
- **Deferred:** Manual latitude/longitude typing is disabled; must use address resolution.

---

## OP-06 Lead Outcome
- **Application:** RFLY Operations
- **Authorized Actor:** Sales, Admin
- **Purpose:** Feedback on lead processing and scheduling requirements.
- **Data Fields:** Outcome Type (e.g., Needs Manual Scheduling), Zone Conflict details, Intake Record summary, Est. Value.
- **Controls:** Open Scheduler, Return to Queue.
- **Accessibility:** High-contrast outcome status.

---

## OP-07 Daily Fleet Schedule
- **Application:** RFLY Operations
- **Authorized Actor:** Fleet Manager, Admin
- **Purpose:** View assigned missions for the current sector.
- **Data Fields:** Date/Sector header, Total Missions, Active Now, Completed, Exceptions, Mission List (Seq, Time, Location, Crop).
- **Controls:** Print Manifest, New Mission (+), Mission Row (Navigate to Detail).
- **States:**
  - **Empty:** "No missions scheduled for today."
- **Deferred:** Drag-and-drop rescheduling is not supported in v1.

---

## OP-08 Exceptions
- **Application:** RFLY Operations
- **Authorized Actor:** Fleet Manager, Admin
- **Purpose:** High-priority queue for operational blockers.
- **Data Fields:** Critical/Warning counts, Exception Cards (ID, Type, Description, Location, Time Logged).
- **Controls:** Resolve Issue, Assign Tow, Reroute, View Map.
- **States:**
  - **Success:** Card removed from list upon resolution.

---

## OP-09 Copilot Override
- **Application:** RFLY Operations
- **Authorized Actor:** Fleet Manager, Admin
- **Purpose:** Manual crew reassignment with mandatory audit trail.
- **Data Fields:** Current Assignment (Marcus Vance), Override Reason (Illness, Conflict, No-Show, Directive), Additional Notes, Candidate Search, Candidate List (Flight Hrs, ID).
- **Controls:** Review Override (Primary), Cancel, Candidate Selection (Radio).
- **States:**
  - **Conflict:** "Candidate no longer available" refresh.

---

## OP-10 Profile
- **Application:** RFLY Operations
- **Authorized Actor:** All roles
- **Purpose:** Session management and system information.
- **Data Fields:** Avatar, Name, Employee ID, Role, Operating Hub, Installation details (Version, Framework, Sync time).
- **Controls:** Logout, Logout from all devices.
- **Accessibility:** Standard button labels for destructive actions.

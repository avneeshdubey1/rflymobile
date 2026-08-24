# RFLY Screen Specifications: Pilot Field

## PF-01: Pilot Login
- **Application:** Pilot Field
- **Purpose:** Primary authentication gateway for assigned Pilots.
- **Authorized Actor:** `PILOT` role.
- **Entry Route:** Application launch (when no active session exists).
- **Exit Routes:** 
  - Success -> PF-03 (Today's Work)
- **Data Fields:** Email, Password.
- **States:**
  - **Loading:** Spinner on "Sign In" button.
  - **Validation:** Inline error for empty fields or invalid email format.
  - **Unauthorized:** "Invalid credentials" banner.
  - **Offline:** "Network Unavailable" banner; login disabled.
  - **Conflict:** Mandatory version upgrade required overlay.
- **A11Y Labels:** "Email input field", "Password input field", "Sign in button".
- **Constraints:** No "Forgot Password" or social login in v1.

## PF-03: Today's Work
- **Application:** Pilot Field
- **Purpose:** Daily agenda and mission queue.
- **Authorized Actor:** Assigned `PILOT`.
- **Entry Route:** Post-login or "Work" tab navigation.
- **Exit Routes:**
  - Card Tap -> PF-04 (Assignment Detail)
- **Data Fields:** Server sequence, Farm address (synthetic), Crop type, Acreage, Drone/LMV IDs, Readiness status.
- **States:**
  - **Loading:** Skeleton list items.
  - **Empty:** "No assignments for today" state with refresh action.
  - **Offline:** "Syncing..." status indicator with cached data.
  - **Sync:** Badge indicating number of pending offline actions.
- **A11Y Labels:** "Assignment list", "Refresh work list", "Sync status indicator".

## PF-04: Assignment Detail
- **Application:** Pilot Field
- **Purpose:** Mission-critical information and primary action hub.
- **Authorized Actor:** Assigned `PILOT`.
- **Entry Route:** Tap assignment from PF-03.
- **Exit Routes:**
  - Select Copilot -> PF-06
  - Accept -> PF-05
  - Start -> PF-08
  - Complete -> PF-11
  - Report Issue -> PF-10
- **Data Fields:** Farmer contact (actionable), Farm coordinates (synthetic), Crop, Acreage, Drone/LMV, Operational notes, allowedActions (server-driven).
- **States:**
  - **Stale:** "Assignment updated" banner with refresh requirement.
  - **Removed:** "Assignment no longer available" blocking state.
  - **Offline:** Action queuing with "Sending..." overlay.
- **Constraints:** Telemetry strictly excluded. Navigation is an external map action.

## PF-06: Select Copilot
- **Application:** Pilot Field
- **Purpose:** Primary Pilot selects an eligible crew member.
- **Authorized Actor:** Assigned Primary `PILOT`.
- **Entry Route:** "Select Copilot" action from PF-04.
- **Exit Routes:**
  - Selection Confirmation -> PF-07
- **Data Fields:** Candidate name, Employee code (synthetic).
- **States:**
  - **Empty:** "No eligible candidates found" with Fleet Support contact.
  - **Conflict:** "Selection no longer valid" (candidate assigned elsewhere).
  - **Offline:** List unavailable; requires server check.

## PF-09: Active Mission
- **Application:** Pilot Field
- **Purpose:** Static summary during flight operation.
- **Authorized Actor:** Assigned crew.
- **Entry Route:** Successful "Start" action.
- **Exit Routes:**
  - Report Issue -> PF-10
  - Complete -> PF-11
- **Data Fields:** Mission ID, Duration timer (client-side), Crew, Asset IDs.
- **Constraints:** No live telemetry or battery percentage.

---

# RFLY Screen Specifications: Operations

## OP-03: Customer Search & Intake
- **Application:** RFLY Operations
- **Purpose:** Lookup existing profiles or initiate new registration.
- **Authorized Actor:** `SALES`, `ADMIN`.
- **Entry Route:** "Customers" tab.
- **Exit Routes:**
  - Profile Tap -> Customer Profile
  - New Customer -> OP-04
- **Data Fields:** Name or Phone search input, Recent lookups list.
- **States:**
  - **Unauthorized:** Search restricted to assigned region.
  - **Capability Absent:** "Register" button hidden if not authorized.

## OP-08: Fleet Exception List
- **Application:** RFLY Operations
- **Purpose:** High-priority blocker management.
- **Authorized Actor:** `FLEET_MANAGER`, `ADMIN`.
- **Entry Route:** "Exceptions" tab.
- **Exit Routes:**
  - Item Tap -> OP-09 (Override Audit)
- **Data Fields:** Asset ID, Exception type (Critical/Warning), Mission ID, Location.
- **States:**
  - **Loading:** Polling state for real-time updates.
  - **Empty:** "All clear" success state.

## OP-09: Copilot Override Audit
- **Application:** RFLY Operations
- **Purpose:** Emergency crew reassignment with audit trail.
- **Authorized Actor:** `ADMIN`, `FLEET_MANAGER`.
- **Entry Route:** Action on an Exception or Schedule conflict.
- **Exit Routes:**
  - Confirm -> Success Toast and Return to Queue.
- **Data Fields:** Current assignment, Eligible override list, Reason for override (Mandatory text).
- **States:**
  - **Conflict:** "Revision mismatch" (assignment changed during audit).
  - **Validation:** "Reason required" error.

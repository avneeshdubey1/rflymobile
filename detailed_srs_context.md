# Software Requirements Specification (SRS) - Context & Blueprint

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to provide a comprehensive, detailed blueprint of the RFLY DaaS (Drone as a Service) Field Operations Platform. It serves as the primary technical and business context for authoring the formal Software Requirements Specification (SRS).

### 1.2 Scope
The RFLY platform is an internal, automation-driven operations system. It manages the entire lifecycle of an agricultural drone spraying job: from initial lead intake and geofencing, to automated pilot/drone assignment, offline-first field execution, live monitoring, farmer notification, and payment collection. It replaces manual dispatching with a scalable, auditable digital pipeline.

### 1.3 Definitions & Acronyms
*   **DaaS:** Drone as a Service (farmers pay per job, do not own drones).
*   **Lead:** A service request from a farmer, acting as the central stateful record.
*   **Assignment:** The pairing of a Lead with a Pilot and Drone for a specific date.
*   **Operating Center:** A physical HQ/Branch defining a service radius (geofence).
*   **Discrepancy:** A mismatch between requested acreage and actual sprayed acreage.
*   **PWA:** Progressive Web App (used for the Pilot's offline-capable application).

---

## 2. Overall Description

### 2.1 Product Perspective
The system operates as an independent, single-operator enterprise platform (not a marketplace). It consists of:
1.  A centralized web-based dashboard for Admins, Fleet Managers, and Sales Reps.
2.  A PWA for Pilots designed for unreliable rural cellular networks.
3.  A backend orchestration engine connecting to external services like Firebase Auth, WhatsApp Business API, Weather APIs, and Payment Gateways.

### 2.2 User Characteristics (Actors)
*   **Admin ("God Mode"):** Requires absolute system oversight, ability to manually override states, manage company configurations (pricing, thresholds), and audit logs.
*   **Fleet Manager:** Responsible for fleet health (drone maintenance, DGCA airworthiness) and pilot scheduling exceptions via a drag-and-drop calendar.
*   **Sales Representative:** Acts as the primary human liaison. Processes incoming leads, handles phone negotiations for out-of-range requests, and tracks manual cash payments.
*   **Pilot:** Field operator who executes missions. Requires a streamlined, distraction-free UI that works offline. Does not manage drones long-term; drones are bound per mission.
*   **Farmer:** The end customer. Primarily interacts via a public web form or indirectly via surveyors/Sales. Receives updates and payment links primarily through automated WhatsApp messages.

### 2.3 Operating Environment Constraints
*   **Connectivity:** Pilots will frequently operate in zero-connectivity zones. The Pilot app must queue actions (Accept, Start, Complete) locally via IndexedDB and sync upon reconnection.
*   **Literacy/Tech-Comfort:** Farmers cannot be expected to self-serve through complex apps. Phone calls and WhatsApp are primary communication channels.
*   **Regulatory (DGCA):** Pilot licenses and drone airworthiness have expiry dates that the system must track to soft-block illegal assignments.

---

## 3. System Features (Functional Requirements)

### 3.1 Multi-Channel Lead Intake & Geofencing
*   **FR-1.1:** The system shall ingest leads from a Public Website, a Google Form Webhook (for external surveyors), and Manual Entry (Sales).
*   **FR-1.2:** Upon ingestion, the system shall calculate the Haversine distance to all active Operating Centers.
*   **FR-1.3:** If within a center's radius, the lead is assigned to that center. If outside all radii, the status becomes `OUT_OF_RANGE`.
*   **FR-1.4:** The system shall auto-calculate a suggested out-of-range fee based on configurable per-km pricing.
*   **FR-1.5:** Sales reps and Farmers (via website) must be able to submit an appeal to proceed with the extra fee.

### 3.2 Auto-Assignment Engine
*   **FR-2.1:** The system shall evaluate weather forecasts against configurable wind/rain thresholds before assigning a job.
*   **FR-2.2:** The system shall automatically select the best Pilot and Drone pair based on proximity and workload.
*   **FR-2.3:** If no candidates are available, or weather/DGCA checks fail, the system must route the lead to `NEEDS_MANUAL_SCHEDULING` for the Fleet Manager.

### 3.3 Notification Cascade
*   **FR-3.1:** The system shall notify pilots of new assignments sequentially: In-App Push → SMS → Human Dispatch Call Task.
*   **FR-3.2:** If a pilot fails to accept within the configured timeout, the system shall auto-reassign the job.

### 3.4 Mission Execution & Live Tracking
*   **FR-4.1:** The Pilot PWA must support offline actions (Accept, Start, Complete, Decommission).
*   **FR-4.2:** While a mission is active and connectivity exists, the Pilot app must ping its GPS coordinates to the backend.
*   **FR-4.3:** The Admin/Fleet dashboards shall display the live location of active drones via WebSockets.

### 3.5 Billing & Payments
*   **FR-5.1:** Upon mission completion, the system shall generate a UPI payment link (e.g., Razorpay) based on actual acreage sprayed.
*   **FR-5.2:** The system must support a manual "Cash" fallback where Sales can mark a payment as physically collected.
*   **FR-5.3:** Mission completion shall never be blocked by payment failure. Unpaid jobs land in a "Pending Manual Collection" queue.

### 3.6 Real-Time Chat
*   **FR-6.1:** Admins and Pilots must have access to a real-time (Socket.io) chat channel for active enquiries.
*   **FR-6.2:** The system must track read receipts and auto-close chats after 24 hours of inactivity.

---

## 4. State Machine (Lead Lifecycle)
A critical component of the SRS is the Lead State Machine. Transitions must be strictly enforced by the backend:
1.  `NEW`: Raw submission.
2.  `OUT_OF_RANGE`: Failed geofence.
3.  `APPEAL_PENDING`: Farmer accepts extra fee.
4.  `PROCESSED`: Inside range, ready for assignment.
5.  `SCHEDULED`: Auto or manually assigned to a Pilot.
6.  `PILOT_ACCEPTED`: Pilot confirms they will do the job.
7.  `IN_PROGRESS`: Drone is flying.
8.  `COMPLETED`: Acreage reported, payment generated.
9.  `FLAGGED`: Discrepancy or mid-mission decommission.
10. `NEEDS_MANUAL_SCHEDULING`: Automation failed.

---

## 5. Non-Functional Requirements
*   **Security:** Employee passwords hashed with bcrypt (cost 12). Farmer auth secured via Firebase JWT signatures. All API endpoints protected by JWT Role-Based Access Control (RBAC).
*   **Auditability:** Every state change, override, and payment must write to an immutable `AuditLog` table. This log powers the CRM Timeline drawer.
*   **Internationalization (i18n):** The system must support localization. Currently targeting Tamil (`ta`) and English (`en`), structured to easily add Kannada, Telugu, and Hindi via JSON dictionaries.
*   **Performance:** The backend must handle WebSocket connections for live GPS without blocking standard REST API requests.

---

## 6. Pending Business Decisions (Configurables)
The SRS should specify that the following are managed via a `PricingConfig` database table and are NOT hardcoded:
*   `OUT_OF_RANGE_RATE_PER_KM`
*   `DISCREPANCY_THRESHOLD_PCT`
*   `WIND_THRESHOLD_KPH` & `RAIN_PROBABILITY_THRESHOLD_PCT`
*   `PILOT_LICENSE_GRACE_DAYS`

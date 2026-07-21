# Project Context for SRS Documentation: RFLY DaaS Platform

This document provides a comprehensive overview of the **RFLY DaaS (Drone as a Service) Field Operations Platform**. It is intended to serve as the foundational context for writing a detailed Software Requirements Specification (SRS).

## 1. Product Overview & Business Context
**Business Model:** RFLY is an agricultural drone service company operating in Tamil Nadu, India. They own their drone fleet and employ hired pilots (a single-operator DaaS business, not a marketplace). 
**System Purpose:** An internal, automation-heavy operations pipeline designed to handle a job from intake to payment. It replaces manual spreadsheet tracking with geofencing, automated assignment matching, offline-first pilot execution, live monitoring, and immutable auditing.
**Key Assumption:** Farmers primarily interact via phone calls or external surveyors, not just a self-serve website. Real-world fallback behaviors (e.g., manual cash collection, phone calls) are structural necessities due to rural connectivity and literacy variables.

## 2. Core Workflows & Pipelines

### 2.1 Lead Intake & Geofencing
*   **Channels:** Web Form (farmers/relatives), Google Form Webhook (external field surveyors), Manual Entry (Sales reps).
*   **Geofencing:** Leads are immediately distance-checked against active Operating Centers (e.g., a 50km radius).
*   **Out-of-Range Appeals:** If a lead falls outside the radius, it triggers an appeal flow with an auto-calculated, negotiable extra transport fee.

### 2.2 Auto-Assignment Engine
*   **Weather Gate:** Checks APIs to ensure safe flying conditions (wind/rain thresholds).
*   **Matching:** Automatically finds the best Pilot and Drone candidate pair from the matched center based on workload and proximity.
*   **Fallback:** If automation fails (e.g., no available pilots, bad weather, expired pilot licenses), it falls back to a `NEEDS_MANUAL_SCHEDULING` state for a human to override.

### 2.3 Pilot Notification Cascade
*   A resilient escalation system to ensure job acceptance: 
    1. In-app Push Notification.
    2. Fallback to SMS.
    3. Fallback to a human dispatch call task.
    4. Auto-reassignment if all else fails.

### 2.4 Mission Execution (Offline-First)
*   Pilots use a Progressive Web App (PWA) with a local action queue (IndexedDB) allowing them to accept, start, log acreage, and complete missions in zero-connectivity areas.
*   **Live GPS Tracking:** When online, the app broadcasts live coordinates to the HQ dashboard.

### 2.5 Payments & Billing
*   Automated generation of UPI payment links (via gateways like Razorpay).
*   **Cash Fallback:** If UPI fails or cash is preferred, it lands in a "Pending Manual Collection" dashboard for Sales to track physically.

### 2.6 Auditing & CRM Logbook
*   An immutable, append-only audit log records every status change, GPS ping, and admin override.
*   This feeds a chronological "Logbook" timeline for Sales/Admin to view a lead's entire history.

## 3. User Roles & Permissions
1.  **Admin ("God Mode"):** Complete oversight, configuration management (pricing, centers, compliance thresholds), and ability to override any system status. Real-time chat with Pilots.
2.  **Fleet Manager:** Focused on drone maintenance tracking and pilot scheduling. Manages the drag-and-drop calendar for manual assignment overrides.
3.  **Sales Rep:** Handles the human element—processing leads, negotiating out-of-range appeals, making dispatch calls, and tracking cash payments.
4.  **Pilot:** Field execution only. No drone ownership. Drones are dynamically bound to them for a mission and auto-released upon completion.
5.  **Farmer (End User):** Primarily interacts via WhatsApp Business API messages (localized in Tamil, English, etc.) for job status updates and payment links.

## 4. Technical Architecture
*   **Frontend:** React (Vite), Tailwind CSS, Framer Motion, Service Workers (PWA), `react-i18next` (multi-language support).
*   **Backend:** Node.js, Express, Socket.io (Real-time chat & GPS).
*   **Database:** PostgreSQL managed via Prisma ORM.
*   **External Integrations:** Firebase (Authentication), WhatsApp Business API, Weather API (e.g., OpenWeatherMap), Payment Gateway (e.g., Razorpay), Google Forms (Webhook).

## 5. Constraints & Pending Business Rules (For SRS Scope)
When writing the SRS, note that several business rules are **configuration-driven, not hardcoded**, pending exact values from the business:
*   **DGCA Compliance:** Expiry thresholds for pilot licenses and drone airworthiness (used for soft-blocking assignments).
*   **Pricing:** Specific per-km rates for out-of-range appeals.
*   **Language Scaling:** Architected for 5 languages (Tamil, English, Kannada, Telugu, Hindi), but farmer-facing strings require final native-speaker approval.
*   **Tenant Isolation:** The current database schema is for a single operator. Multi-company scaling requires a future architecture phase.

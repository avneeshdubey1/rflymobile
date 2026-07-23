# Use Case Specification: Authentication & Login

## 1. Use Case Name
User Authentication and Login

## 2. Brief Description
This use case describes how Farmers, Company Employees, and approved Business users authenticate to the DaaS platform. Farmers use Firebase phone OTP; Employees and Business users use email and password. Every successful exchange creates the same server-managed, revocable cookie session.

## 3. Actors
*   **Farmer:** End-user requesting drone services.
*   **Employee:** Includes Admin, Fleet Manager, Sales Rep, and Pilot roles.
*   **Business User:** An activated business account using the separate business portal.
*   **System (Firebase Auth):** External service handling OTP generation and verification for Farmers.

## 4. Preconditions
*   The system backend and database must be operational.
*   For Farmer login, the Firebase Authentication service must be configured and reachable.
*   For Employee login, the employee must have a pre-provisioned account in the system database.

## 5. Main Success Scenarios (Flow of Events)

### Scenario A: Farmer Login (OTP via Firebase)
1.  **Farmer** navigates to the public landing/login page and selects the option to log in via phone number.
2.  **Farmer** enters their mobile phone number.
3.  **System** triggers Firebase Authentication to send a One-Time Password (OTP) via SMS to the provided number.
4.  **Farmer** receives the OTP and enters it into the system.
5.  **System (Client-side)** verifies the OTP with Firebase and receives a Firebase ID Token.
6.  **System (Client-side)** sends the Firebase ID Token to the DaaS backend `/api/auth/farmer/login` endpoint.
7.  **System (Backend)** verifies the ID Token and its revoked state with Firebase Admin, requires the phone sign-in provider, and extracts the verified phone number.
8.  **System (Backend)** canonicalizes the phone and performs a unique lookup for an active user with the `FARMER` role.
9.  **System (Backend)** creates a revocable opaque session and sets a `Secure`, `HttpOnly`, `SameSite=Strict` session cookie plus a readable CSRF cookie.
10. **System (Client-side)** logs the Farmer in and redirects them to the Farmer Dashboard.

### Scenario B: Employee Login (Email/Password)
1.  **Employee** navigates to the employee login portal (`/login`).
2.  **Employee** enters their registered Email (or Employee ID) and Password.
3.  **System (Backend)** receives the credentials at the `/api/auth/login` endpoint.
4.  **System (Backend)** looks up the user in the database.
5.  **System (Backend)** verifies the provided password against the stored bcrypt hash.
6.  **System (Backend)** verifies that the account is active, unarchived, and has an Employee role, then establishes the cookie session only if the credential version, role, and account state still match the verified snapshot. No bearer token is returned to JavaScript.
7.  **System (Client-side)** logs the Employee in and redirects them to their respective role-based dashboard (Admin, Fleet Manager, Sales, or Pilot).

### Scenario C: Business Login (Email/Password)
1.  **Business User** opens `/business/login` and submits email and password.
2.  **System (Backend)** verifies the bcrypt hash and confirms the account has the `BUSINESS` role and is active and unarchived.
3.  **System (Backend)** establishes the same opaque cookie session and the client redirects to the Business dashboard.

## 6. Alternative Flows / Exceptions

*   **A.1 Farmer Phone Not Registered:**
    *   *If* at step 8 of Scenario A, the backend finds no existing user for the verified phone number:
    *   *Then* the system returns a `FARMER_NOT_REGISTERED` error.
    *   *And* the client prompts the Farmer to complete registration by providing their Name, Village, and District.
    *   *Upon submission*, the system creates a new Farmer profile via `/api/auth/farmer/complete-signup` and logs them in.

*   **A.2 Farmer Account Inactive:**
    *   *If* at step 8 of Scenario A, the backend finds the user but the account is marked inactive:
    *   *Then* the system rejects the login with an "account is inactive" message.

*   **B.1 Invalid Employee Credentials:**
    *   *If* at step 5 of Scenario B, the user is not found or the password hash does not match:
    *   *Then* the system returns an "Invalid email or password" error.
    *   *And* the client prompts the employee to try again.

*   **B.2 Legacy Password Hash Upgrade:**
    *   *If* at step 5 of Scenario B, the password matches but the system determines the hash is outdated (e.g., requires a higher bcrypt cost):
    *   *Then* the system conditionally re-hashes the password only if the verified hash and authentication version are unchanged, so a concurrent reset cannot be overwritten.

*   **C.1 Employee Password Recovery:**
    *   The request endpoint always returns the same response shape for existing and nonexistent accounts.
    *   An eligible account receives an expiring, attempt-limited challenge through the queued delivery boundary. Issuing a new challenge revokes older open challenges.
    *   Completion succeeds only if the one-time proof, role, active state, and bound authentication version still match; it changes the password and revokes every session and sibling challenge atomically.

*   **C.2 Business Password Recovery:**
    *   Firebase must prove recent phone authentication for the unique Business phone.
    *   The backend hashes that external proof and allows it to create only one short-lived application reset grant. Replaying the same Firebase proof is rejected.

## 7. Postconditions
*   **Success:** A hashed opaque session record is stored server-side; the browser receives an `HttpOnly` session cookie and navigates to the authorized dashboard. `GET /api/auth/me` restores identity after a reload.
*   **Failure:** No session is created, and the user remains on the login page with an appropriate error message displayed.

## 8. Security Requirements
*   All communication must happen over HTTPS.
*   Employee passwords must be hashed using bcrypt (cost 12 or higher).
*   Passwords longer than bcrypt's 72-byte input boundary must be rejected rather than silently truncated.
*   Farmer authentication must rely on cryptographically verified Firebase ID Tokens; the backend must never trust raw phone numbers sent from the client without the token signature.
*   Account phones must be canonical and unique so phone login or recovery can never bind ambiguously.
*   Session identifiers and CSRF values must never appear in response JSON, browser storage, application logs, or audit snapshots.
*   Unsafe authenticated requests must pass double-submit CSRF validation.
*   Sessions have idle and absolute expiries and are revoked on logout, logout-all, password reset/change, deactivation, archival, or role/auth-version change.
*   Login and recovery endpoints are independently rate-limited. Invalid Employee/Business credentials and ineligible accounts use a generic response.
*   Password recovery uses short-lived, one-time, authentication-version-bound server challenges, bounded attempts, generic account-discovery responses, queued delivery, sibling invalidation, and forced logout of existing sessions. Live WhatsApp/SMS/email delivery still requires approved providers.

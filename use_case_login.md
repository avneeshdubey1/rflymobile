# Use Case Specification: Authentication & Login

## 1. Use Case Name
User Authentication and Login

## 2. Brief Description
This use case describes how different types of users (Farmers and Company Employees) authenticate themselves to access the RFLY DaaS Platform. The system supports two distinct login mechanisms depending on the user's role: an OTP-based phone authentication for Farmers, and a standard Email/Password authentication for Employees (Admins, Fleet Managers, Sales Reps, and Pilots).

## 3. Actors
*   **Farmer:** End-user requesting drone services.
*   **Employee:** Includes Admin, Fleet Manager, Sales Rep, and Pilot roles.
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
6.  **System (Client-side)** sends the Firebase ID Token to the RFLY backend `/api/auth/farmer/login` endpoint.
7.  **System (Backend)** securely verifies the ID Token with Firebase Admin and extracts the verified phone number.
8.  **System (Backend)** checks the database for an active user with the extracted phone number and the `FARMER` role.
9.  **System (Backend)** generates a JWT session token and returns it to the client.
10. **System (Client-side)** logs the Farmer in and redirects them to the Farmer Dashboard.

### Scenario B: Employee Login (Email/Password)
1.  **Employee** navigates to the employee login portal (`/login`).
2.  **Employee** enters their registered Email (or Employee ID) and Password.
3.  **System (Backend)** receives the credentials at the `/api/auth/login` endpoint.
4.  **System (Backend)** looks up the user in the database.
5.  **System (Backend)** verifies the provided password against the stored bcrypt hash.
6.  **System (Backend)** generates a JWT session token and returns it to the client along with the user's role.
7.  **System (Client-side)** logs the Employee in and redirects them to their respective role-based dashboard (Admin, Fleet Manager, Sales, or Pilot).

## 6. Alternative Flows / Exceptions

*   **A.1 Farmer Phone Not Registered:**
    *   *If* at step 8 of Scenario A, the backend finds no existing user for the verified phone number:
    *   *Then* the system returns a `FARMER_NOT_REGISTERED` error.
    *   *And* the client prompts the Farmer to complete registration by providing their Name, Village, and District.
    *   *Upon submission*, the system creates a new Farmer profile via `/api/auth/farmer/signup` and logs them in.

*   **A.2 Farmer Account Inactive:**
    *   *If* at step 8 of Scenario A, the backend finds the user but the account is marked inactive:
    *   *Then* the system rejects the login with an "account is inactive" message.

*   **B.1 Invalid Employee Credentials:**
    *   *If* at step 5 of Scenario B, the user is not found or the password hash does not match:
    *   *Then* the system returns an "Invalid email or password" error.
    *   *And* the client prompts the employee to try again.

*   **B.2 Legacy Password Hash Upgrade:**
    *   *If* at step 5 of Scenario B, the password matches but the system determines the hash is outdated (e.g., requires a higher bcrypt cost):
    *   *Then* the system silently re-hashes the password and updates the database before completing the login flow.

## 7. Postconditions
*   **Success:** A secure JWT token is issued to the client, establishing an authenticated session. The user is navigated to their authorized dashboard based on their role.
*   **Failure:** No session is created, and the user remains on the login page with an appropriate error message displayed.

## 8. Security Requirements
*   All communication must happen over HTTPS.
*   Employee passwords must be hashed using bcrypt (cost 12 or higher).
*   Farmer authentication must rely on cryptographically verified Firebase ID Tokens; the backend must never trust raw phone numbers sent from the client without the token signature.
*   The system must issue short-lived JWTs for session management.

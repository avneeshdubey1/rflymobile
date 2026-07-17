# Farmer OTP Setup

## Firebase Console

1. Open the Firebase project used by this application.
2. Go to **Authentication → Sign-in method** and enable **Phone**.
3. Under **Authentication → Settings → Authorized domains**, add the hostname used by the frontend. `localhost` is sufficient for local testing.
4. For development, add a Firebase test phone number and six-digit test code. This avoids SMS quota and billing issues while verifying the complete application flow.

## Environment

The frontend needs the `VITE_FIREBASE_*` Web App values in `frontend/.env`. The backend needs its matching Firebase Admin values in `backend/.env`. Never commit either file or a service-account JSON file.

The frontend and Firebase Admin credentials must belong to the same Firebase project.

## Database

From `backend/`:

```powershell
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

The migration `20260716090000_add_farmer_identity` adds the Farmer role and profile fields reproducibly.

## Frontend

From `frontend/`:

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Register at `/`, wait for the success redirect, then log in at `/farmer/login`.

## Expected flow

1. Enter name, ten-digit Indian mobile number, village and district.
2. Verify the Firebase OTP.
3. See the registration-success countdown.
4. Log in separately using the same phone number and a fresh OTP.
5. Reach `/farmer/dashboard`.


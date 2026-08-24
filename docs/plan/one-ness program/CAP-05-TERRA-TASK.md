# CAP-05 — Backend: Allow capacitor://localhost as a Mobile App Origin
## Model: Terra 5.6 | Reasoning: LIGHT THINKING | Branch: dev (normal PR flow)

---

### YOUR ABSOLUTE LIMITS

- Touch ONLY these two files:
    backend/middleware/httpSecurity.js
    backend/config/environment.js
- Do NOT touch any other backend file, any frontend file, any Prisma schema,
  any migration, any test file other than the one test file listed below.
- Do NOT commit, push, or deploy anything.
- Do NOT run migrations or seeds.
- Do NOT restart or touch the production or staging servers.
- Make the smallest possible change. No refactors.

---

### CONTEXT AND PROBLEM

The RFLY web frontend is being wrapped in a Capacitor Android APK. When the
Android WebView makes HTTP requests to the backend, it sends this Origin header:

    Origin: capacitor://localhost

The backend CORS middleware (httpSecurity.js) checks this against
config.allowedOrigins, which is loaded from the CORS_ALLOWED_ORIGINS env var.

The problem is that environment.js validates every entry in CORS_ALLOWED_ORIGINS
and rejects any origin whose protocol is not http: or https:. Therefore
`capacitor://localhost` CANNOT be added to CORS_ALLOWED_ORIGINS.

The fix is to add a separate, explicit native-app origin allowlist in the
backend that:
- is controlled by a new boolean env var CAPACITOR_ORIGINS_ENABLED
- when enabled, adds only the exact string "capacitor://localhost" to the
  set of allowed origins (alongside the existing allowedOrigins list)
- is disabled by default (false) — must be explicitly opted in per environment
- leaves all existing CORS behaviour completely unchanged when disabled
- is never a wildcard — it allows only the specific known Capacitor origin

---

### CHANGE 1 — backend/config/environment.js

Read the file first. Find the loadEnvironment function and the returned config
object.

Add ONE new field to the config object:

  capacitorOriginsEnabled: boolean(env.CAPACITOR_ORIGINS_ENABLED, false, 'CAPACITOR_ORIGINS_ENABLED'),

Place it after the allowedOrigins line. Use the existing `boolean()` helper
already in this file — do not introduce any new utility.

Return the new field in the config object that loadEnvironment() returns.

Report:
  - The exact line you added
  - The line number it was inserted at
  - The line number of the allowedOrigins line (as a reference)

---

### CHANGE 2 — backend/middleware/httpSecurity.js

Read the file first. Find the isAllowedOrigin function (lines 6-9).

Replace it with:

function isAllowedOrigin(origin, config) {
  if (!origin) return true;
  if (config.allowedOrigins.includes(origin)) return true;
  if (config.capacitorOriginsEnabled && origin === 'capacitor://localhost') return true;
  return false;
}

That is the ENTIRE change. Do not touch corsPolicy(), securityHeaders(),
errorHandler(), or any other function.

Report:
  - The exact before and after of isAllowedOrigin
  - Confirm no other function was touched

---

### VERIFICATION — run backend tests

From the backend/ directory, run the full test suite:

  npm test

Report:
  - Total tests passed
  - Total tests failed (must be 0)
  - Paste the summary line (e.g. "160 passing")

If any test fails, STOP. Revert your changes. Report which test failed and why.
Do NOT attempt to fix test failures by modifying tests.

---

### ENV VAR DOCUMENTATION — no code change, just report

The following env var must be added to the staging .env file by the maintainer
(you do NOT touch .env files):

    CAPACITOR_ORIGINS_ENABLED=true

And for production .env:

    CAPACITOR_ORIGINS_ENABLED=true

These are NOT committed to Git. They are added manually by the maintainer to
the external env files at /opt/client-staging-app/ and /opt/client-demo-app/.

State this clearly in your report so the maintainer knows what to add.

---

### REPORT — return exactly this structure

```
CAP-05 BACKEND CORS REPORT

Files changed:
  backend/config/environment.js  — line ___ added
  backend/middleware/httpSecurity.js — isAllowedOrigin replaced (lines ___-___)

environment.js change:
  Added: capacitorOriginsEnabled: boolean(env.CAPACITOR_ORIGINS_ENABLED, false, ...)
  Default value: false (disabled unless explicitly set)

httpSecurity.js change (before):
  [paste old isAllowedOrigin]

httpSecurity.js change (after):
  [paste new isAllowedOrigin]

Other functions touched: NONE

Test result: ___ passing, 0 failing

ENV VARS FOR MAINTAINER TO ADD MANUALLY:
  /opt/client-staging-app/deployment.env  → add: CAPACITOR_ORIGINS_ENABLED=true
  /opt/client-demo-app/deployment.env     → add: CAPACITOR_ORIGINS_ENABLED=true
  (Do NOT commit these to Git)

Files outside backend/ touched: NONE
Committed: NO

READY FOR MAINTAINER ENV VAR UPDATE: YES / NO
```

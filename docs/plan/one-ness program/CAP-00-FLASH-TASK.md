# CAP-00 — Prerequisites Check
## Model: Flash 3.6 | Reasoning: DEFAULT (no thinking mode) | Scope: READ-ONLY

---

### YOUR ABSOLUTE LIMITS — READ BEFORE ANYTHING ELSE

- Do NOT modify any file.
- Do NOT run npm install, npx, or any command that writes to disk.
- Do NOT commit, stage, push, or create any branch.
- Do NOT start any server or dev process.
- Your ONLY job is to READ files and REPORT findings.

---

### CONTEXT

You are checking whether the existing RFLY web frontend is ready to be wrapped
in a Capacitor Android shell. Capacitor 6.x will be installed in the next task
(CAP-01). Your job today is only to verify prerequisites and flag any blockers.

Repository root: d:\projects\Daas--main\Daas--main
Frontend directory: d:\projects\Daas--main\Daas--main\frontend

---

### STEP 1 — Read these files completely. Report that you have read each one.

  frontend/package.json
  frontend/vite.config.js
  frontend/src/config.js
  frontend/.gitignore

---

### STEP 2 — Check Node and npm version on this machine

Run these commands (read-only):

  node --version
  npm --version

Report the exact output of each.

---

### STEP 3 — Check Capacitor 6.x compatibility

Capacitor 6.x requires:
  - Node.js >= 18
  - npm >= 9

From the versions you found in Step 2, answer:
  - Is Node.js >= 18? YES or NO
  - Is npm >= 9? YES or NO
  - If either is NO, state it clearly as a BLOCKER.

---

### STEP 4 — Check vite.config.js base path

Open frontend/vite.config.js.

Capacitor requires vite to build with base: './' (relative paths) so that the
WebView can load assets from the local filesystem.

Find the line that sets `base:` and report:
  - Current value of base:
  - Is it set to './'? YES or NO
  - If it is NOT './' state whether it is '/' or absent, and mark as NEEDS CHANGE.

NOTE: The file you are reading currently has base: './' — confirm this is the
case and report COMPATIBLE.

---

### STEP 5 — Check API URL configuration

Open frontend/src/config.js.

Report:
  - The exact content of this file.
  - Does it read API URL from an environment variable (VITE_API_URL)? YES or NO
  - Is there a fallback hardcoded URL? If yes, what is it?
  - Is the variable name prefixed with VITE_ ? (Required for Vite to expose it
    to the browser build.) YES or NO

---

### STEP 6 — Check .gitignore for android/ directory

Open frontend/.gitignore.

Report:
  - Is "android" or "android/" listed in .gitignore? YES or NO
  - If NO, mark as NEEDS ADDITION (CAP-01 will add it).

---

### STEP 7 — Check for known Capacitor-incompatible patterns

In frontend/package.json, check dependencies:

  - Is "socket.io-client" present? Report YES or NO.
    (WebSocket connections may need capacitor-specific handling — note only, not a blocker.)
  - Is "leaflet" or "react-leaflet" present? Report YES or NO.
    (Map components must use explicit load consent — note only, not a blocker.)
  - Is there any dependency that starts with "firebase"? Report YES or NO.
    (Firebase Auth is retired in this project — must NOT be present.)
  - Is "@capacitor" already listed in dependencies? Report YES or NO.
    (If YES, Capacitor is already installed — report version.)

---

### STEP 8 — Backend CORS note (read-only, no backend files needed)

Report the following known fact (no file reading needed — it is already confirmed):

The backend CORS policy reads allowed origins from the CORS_ALLOWED_ORIGINS
environment variable. In development mode, it uses local development defaults.
The Capacitor WebView sends requests with Origin: capacitor://localhost.

This origin is NOT in the current development defaults. It will need to be added
to the staging .env file when CAP-05 runs. This is NOT a blocker for CAP-00 or
CAP-01. It will be discovered during CAP-04 (smoke test) and fixed in CAP-05.

State: NOTED — deferred to CAP-05.

---

### YOUR REPORT — return exactly this structure

```
CAP-00 PREREQUISITES REPORT

Node.js version: ___
npm version: ___

Node >= 18:          YES / NO / BLOCKER
npm >= 9:            YES / NO / BLOCKER

vite.config.js base: '___'
base is './':        COMPATIBLE / NEEDS CHANGE

API URL env var:     VITE_API_URL / other / absent
VITE_ prefix:        YES / NO
Fallback URL:        ___

android/ in .gitignore:     YES / NO (NEEDS ADDITION)

socket.io-client present:   YES / NO
leaflet present:            YES / NO
firebase present:           YES / NO  <-- if YES this is a BLOCKER
@capacitor already present: YES / NO (if YES, version: ___)

CORS note: NOTED — deferred to CAP-05

BLOCKERS (if any):
  - ___

READY FOR CAP-01: YES / NO
```

Do NOT write anything except this report. Do NOT modify any file.

# CAP-01 — Install Capacitor into the Frontend
## Model: Terra 5.6 | Reasoning: LIGHT THINKING (one pass) | Prerequisite: CAP-00 must be READY FOR CAP-01

---

### YOUR ABSOLUTE LIMITS — READ BEFORE ANYTHING ELSE

- Do NOT touch pilot-mobile/ or any backend file.
- Do NOT touch any file outside frontend/.
- Do NOT modify any existing .jsx, .js, .css, or .html source file.
- Do NOT commit, push, or stage anything.
- Do NOT run migrations, seeds, or server deployments.
- Do NOT install any package not listed in ALLOWED INSTALLS below.
- If any step fails or produces unexpected output, STOP and report it.
  Do NOT attempt to fix it by guessing.

---

### CONTEXT

The RFLY web frontend is a Vite + React SPA at frontend/.
You are wrapping it in a Capacitor 6.x Android shell to produce an APK
that staff can install on Android devices.

This task installs Capacitor, initialises the project, and generates the
android/ native project. It does NOT build the APK (that is CAP-06).
It does NOT modify any existing React/JSX source.

Repository root: d:\projects\Daas--main\Daas--main
Working directory for all commands: d:\projects\Daas--main\Daas--main\frontend

---

### ALLOWED INSTALLS (exactly these, no others)

  @capacitor/core      (latest 6.x)
  @capacitor/cli       (latest 6.x)
  @capacitor/android   (latest 6.x)

---

### STEP 1 — Verify CAP-00 passed

Confirm Node >= 18 and npm >= 9 by running:
  node --version
  npm --version

If either check fails, STOP. Do not proceed. Report the failure.

---

### STEP 2 — Install Capacitor packages

Run from frontend/:

  npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/android@latest

After install completes:
  - Report the exact installed versions of @capacitor/core, @capacitor/cli, @capacitor/android
    (read from node_modules/@capacitor/core/package.json, etc.)
  - Confirm no error output from npm install
  - Confirm package.json and package-lock.json were updated

---

### STEP 3 — Initialise Capacitor

Run from frontend/:

  npx cap init "RFLY Operations" "com.rfly.operations.staging" --web-dir dist

This will create frontend/capacitor.config.ts.

After it completes:
  - Confirm capacitor.config.ts was created
  - Report its exact contents

---

### STEP 4 — Verify and harden capacitor.config.ts

Open frontend/capacitor.config.ts.

It must contain:
  appId: 'com.rfly.operations.staging'
  appName: 'RFLY Operations'
  webDir: 'dist'

It must also contain a server block pointing to the staging API.
If the server block is absent, ADD it.

The file must look exactly like this after your edit
(preserve any other fields npx cap init generated):

---
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rfly.operations.staging',
  appName: 'RFLY Operations',
  webDir: 'dist',
  server: {
    // Staging internal address — VPN required
    // Change to production URL before production APK build
    url: 'http://172.20.96.10:8089',
    cleartext: true,
  },
  android: {
    minSdkVersion: 26,
    backgroundColor: '#1A2B44',
  },
};

export default config;
---

IMPORTANT: cleartext: true is required because the staging server uses HTTP
(not HTTPS). This MUST be removed or set to false for any production APK.
Add a comment to this effect in the file.

Report the final contents of capacitor.config.ts after your edit.

---

### STEP 5 — Add android/ to frontend/.gitignore

Open frontend/.gitignore.

The android/ directory is generated code containing build artifacts and
potentially signing-related files. It should be gitignored.

Add this block at the end of frontend/.gitignore if "android" is not already
listed:

# Capacitor Android project (generated — do not commit)
android/

Report:
  - Was android/ already in .gitignore? YES or NO
  - What you added (or "nothing — already present")

---

### STEP 6 — Add Android platform

Run from frontend/:

  npx cap add android

This generates frontend/android/.

After it completes:
  - Confirm frontend/android/ directory was created
  - Confirm frontend/android/app/src/main/AndroidManifest.xml exists
  - Report any warnings from the command output

---

### STEP 7 — Run cap sync

Run from frontend/:

  npx cap sync android

This copies any web assets and plugins into the Android project.
(No dist/ exists yet — that is fine; sync will warn but not fail.)

Report:
  - Exit code
  - Any warnings or errors

---

### STEP 8 — Verify installed Capacitor version is 6.x

Run:

  npx cap --version

Report the exact output. If it shows a version below 6.0.0, STOP and report
as a BLOCKER.

---

### STEP 9 — List files changed

Run:

  git -C "d:\projects\Daas--main\Daas--main" diff --name-only
  git -C "d:\projects\Daas--main\Daas--main" status --short

Report the exact output. Confirm:
  - Only files inside frontend/ were changed
  - No file outside frontend/ was touched
  - No commit was made

---

### YOUR REPORT — return exactly this structure

```
CAP-01 INSTALLATION REPORT

@capacitor/core version:    ___
@capacitor/cli version:     ___
@capacitor/android version: ___
cap CLI version:            ___

capacitor.config.ts created:        YES / NO
  appId:   com.rfly.operations.staging  CONFIRMED / MISMATCH
  appName: RFLY Operations             CONFIRMED / MISMATCH
  webDir:  dist                        CONFIRMED / MISMATCH
  server.url:  http://172.20.96.10:8089  CONFIRMED / MISMATCH
  cleartext comment present:           YES / NO
  android.minSdkVersion: 26           CONFIRMED / MISMATCH

android/ added to .gitignore:        YES (was already there) / YES (added now) / NO (BLOCKER)

frontend/android/ directory created: YES / NO
AndroidManifest.xml present:         YES / NO

cap sync exit code: ___
cap sync warnings:  ___ (or NONE)

Files changed (git diff --name-only):
  ___

Files outside frontend/ changed:     YES (BLOCKER — list them) / NO

Commit made:                         YES (BLOCKER) / NO

BLOCKERS (if any):
  - ___

READY FOR CAP-02: YES / NO
```

Do NOT proceed to CAP-02 without reporting this output first.

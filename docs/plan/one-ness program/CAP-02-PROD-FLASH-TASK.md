# CAP-02-PROD — Production Capacitor Config + Android Network Security
## Model: Flash 3.6 | Reasoning: DEFAULT | Scope: frontend/ only

---

### YOUR ABSOLUTE LIMITS

- Touch ONLY files inside frontend/ and frontend/android/.
- Do NOT touch backend/, pilot-mobile/, docs/, or any .env file.
- Do NOT run npm install or any package manager command.
- Do NOT commit, push, or stage anything.
- Do NOT run npx cap sync or npx cap build — just write the config files.
  (The maintainer will run cap sync and the Gradle build manually.)

---

### CONTEXT

The RFLY Capacitor app currently points to the staging server (172.20.96.10:8089).
The goal is to also support a PRODUCTION build pointing to the live production
server at 103.238.230.152 port 8088 (HTTP, no TLS yet).

Android 9+ blocks cleartext HTTP by default. We must add an Android Network
Security Config that explicitly permits cleartext HTTP to the production IP only.

This task creates:
  1. A production variant of the Capacitor config
  2. The Android Network Security Config XML
  3. Registers the XML in AndroidManifest.xml

---

### STEP 1 — Read these files first

  frontend/capacitor.config.ts
  frontend/android/app/src/main/AndroidManifest.xml

Report that you have read both. Report the current content of AndroidManifest.xml.

---

### STEP 2 — Create frontend/capacitor.config.prod.ts

Create a NEW file (do not modify the existing capacitor.config.ts).

File: frontend/capacitor.config.prod.ts

Contents:
---
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rfly.operations.staging',
  appName: 'RFLY Operations',
  webDir: 'dist',
  server: {
    // Production server — HTTP only until DEC-12 (domain + TLS) is resolved.
    // REMOVE cleartext and switch to HTTPS when a domain is provisioned.
    url: 'http://103.238.230.152:8088',
    cleartext: true,
  },
  android: {
    minSdkVersion: 26,
    backgroundColor: '#1A2B44',
  },
};

export default config;
---

Note: The appId remains com.rfly.operations.staging. The production package ID
(DEC-13) has not been decided yet. This is an internal-use production-pointed
APK, not a Play Store release.

Report: File created at frontend/capacitor.config.prod.ts — YES/NO

---

### STEP 3 — Create Android Network Security Config

Android 9+ (API 28+) blocks cleartext HTTP even with Capacitor's cleartext:true
unless the Android layer also permits it.

Create this file:
  frontend/android/app/src/main/res/xml/network_security_config.xml

Create the res/xml/ directory if it does not exist.

Contents:
---
<?xml version="1.0" encoding="utf-8"?>
<!--
  Network Security Config for RFLY Operations (internal APK).
  Allows cleartext HTTP to the staging and production servers only.
  REMOVE the production domain entry when HTTPS is provisioned (DEC-12).
-->
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <!-- Staging server (VPN required) -->
        <domain includeSubdomains="false">172.20.96.10</domain>
        <!-- Production server (temporary — replace with domain when TLS is ready) -->
        <domain includeSubdomains="false">103.238.230.152</domain>
    </domain-config>
    <!-- All other traffic uses system defaults (cleartext blocked) -->
    <base-config cleartextTrafficPermitted="false" />
</network-security-config>
---

Report: File created at frontend/android/app/src/main/res/xml/network_security_config.xml — YES/NO

---

### STEP 4 — Register Network Security Config in AndroidManifest.xml

Open frontend/android/app/src/main/AndroidManifest.xml.

Find the <application tag. It will look something like:
  <application
      android:label="@string/app_name"
      ...

Add ONE attribute to the <application tag:
  android:networkSecurityConfig="@xml/network_security_config"

The result should look like:
  <application
      android:label="@string/app_name"
      android:networkSecurityConfig="@xml/network_security_config"
      ...

Do NOT change any other attribute. Do NOT add any other line.

Report:
  - The exact <application line(s) before your change
  - The exact <application line(s) after your change

---

### STEP 5 — Verify files changed

List only the files you modified or created:

Expected output:
  CREATED:  frontend/capacitor.config.prod.ts
  CREATED:  frontend/android/app/src/main/res/xml/network_security_config.xml
  MODIFIED: frontend/android/app/src/main/AndroidManifest.xml

Confirm:
  - No file outside frontend/ was touched: YES / NO
  - No backend file was touched: YES / NO
  - No .env file was touched: YES / NO
  - Nothing was committed: YES / NO

---

### INSTRUCTIONS FOR MAINTAINER (not for Flash to execute)

After this task completes, the maintainer must:

1. To build a PRODUCTION-pointed APK:
   Run from frontend/:
     cp capacitor.config.prod.ts capacitor.config.ts
     npm run build
     npx cap sync android
   Then build APK in Android Studio or via Gradle.
   Then RESTORE the staging config:
     git checkout -- capacitor.config.ts
   (capacitor.config.prod.ts is the saved production template)

2. The production .env must have:
     CAPACITOR_ORIGINS_ENABLED=true
   (Added manually by maintainer — see CAP-05 report)

3. Both the staging and production APKs use the same source code.
   The only difference is which capacitor.config.ts is active at build time.

---

### REPORT — return exactly this structure

```
CAP-02-PROD REPORT

frontend/capacitor.config.prod.ts created:             YES / NO
  Production URL: http://103.238.230.152:8088          CONFIRMED
  cleartext: true with comment                         CONFIRMED
  appId: com.rfly.operations.staging                   CONFIRMED

frontend/android/.../network_security_config.xml created: YES / NO
  172.20.96.10 domain entry:                          CONFIRMED
  103.238.230.152 domain entry:                       CONFIRMED
  base-config cleartextTrafficPermitted="false":       CONFIRMED

AndroidManifest.xml android:networkSecurityConfig added: YES / NO
  Other attributes changed: NONE

Files outside frontend/ touched: NONE
Committed: NO

READY FOR MAINTAINER ENV VAR UPDATE + APK BUILD: YES / NO
```

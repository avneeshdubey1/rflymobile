# RFLY Operations Companion — Capacitor WebView Fast-Track Plan

**Status:** active execution  
**Created:** August 23, 2026  
**Revised:** August 24, 2026 — full rewrite applying planner corrections  
**Target:** Production server (main, 103.238.230.152:8088) — internal staff APK  
**Corrections applied:** CAPACITOR_WEBVIEW_FASTTRACK_PLANNER_CORRECTIONS.md (all 7 items)

---

## What this plan does and does not do

**Does:**
- Wrap the existing deployed RFLY web frontend in a Capacitor Android shell
- Build APKs using the existing office self-hosted GitHub Actions runner (same runner as the Pilot APK)
- Produce an internal-use APK that non-Pilot staff can install immediately
- Require zero new React screens — the WebView loads the already-deployed web endpoint
- Give a fast path to production while the native Operations Companion is built properly

**Does not:**
- Replace the native Operations Companion (NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md)
- Touch the Pilot Field app (pilot-mobile/)
- Provide offline capability — the app depends entirely on the deployed server being reachable
- Count as a Play Store release without company-owned Play Console and approved signing policy
- Require Android Studio for normal builds — only optionally for debugging

---

## Corrected architecture

```
Android APK (Capacitor shell — installed on staff device)
  -> WebView loads configured remote web endpoint
     -> deployed RFLY frontend (served by the office stack)
        -> same-origin /api calls
           -> Node/Express backend -> PostgreSQL
```

Key consequences:
- The server must be deployed and healthy before any APK acceptance test
- A later web deployment changes what staff see without replacing the APK
- The app has no meaningful offline mode
- The shell must show a safe loading/error state when the endpoint is unreachable

---

## Environments and network access

| Target | Server endpoint | Access requirement | CORS env var |
|---|---|---|---|
| Staging APK | http://172.20.96.10:8089 | Office LAN or approved split-tunnel VPN | CAPACITOR_ORIGINS_ENABLED=true in /opt/client-staging-app/deployment.env |
| Production APK | http://103.238.230.152:8088 | Temporary internal-use HTTP; VPN recommended | CAPACITOR_ORIGINS_ENABLED=true in /opt/client-demo-app/deployment.env |

- HTTP is a temporary internal delivery exception. Once a company domain and TLS are
  provisioned (DEC-12), switch server.url to HTTPS and remove the cleartext exception
  from both capacitor.config.ts and network_security_config.xml.
- CAPACITOR_ORIGINS_ENABLED is a server-only external configuration value.
  Never commit it, print it in CI logs, or paste it in chat.
- The VPN must grant access only to the staging web endpoint port.
  It must not expose PostgreSQL, backend service ports, or server administration.

---

## Package identity and signing decisions

| APK type | Application ID | Signing | Distribution |
|---|---|---|---|
| Staging artifact | com.rfly.operations.staging | Debug-signed by runner | Private GitHub Actions artifact (7-day retention) |
| Production artifact | PENDING DEC-13 — NOT com.rfly.operations.staging | Company-controlled key | Manual sideload only until Play Console approved |

IMPORTANT:
- A production-distributed APK must NOT use com.rfly.operations.staging as its final ID.
- Staging and production must use distinct application IDs so both can be installed
  concurrently and cannot overwrite each other.
- DEC-13: decide the production application ID before building any production-distributed APK.
- Production distribution requires a company-controlled signing key with an access record,
  backup, and rotation/revocation procedure.
- Play Store release additionally requires the company Play Console account.

---

## Native Android configuration strategy (Correction 2)

frontend/android/ IS committed to Git as normal Capacitor native source.
Only generated build outputs and local environment files are gitignored.

frontend/.gitignore must exclude:
  android/.gradle/
  android/build/
  android/app/build/
  android/local.properties
  android/*.jks
  android/*.keystore
  *.apk

Everything else in android/ — including AndroidManifest.xml, res/, build.gradle,
capacitor.settings.gradle, network_security_config.xml — is committed and
tracked. This makes the CI/CD build fully reproducible from a clean checkout
on the office runner without any local developer state.

---

## Completed work (do not re-run)

| Task | Status | Notes |
|---|---|---|
| CAP-01 Capacitor install | DONE (Terra) | @capacitor/core, cli, android @ 6.2.1; TypeScript pinned to 5.7.3 |
| CAP-03 Vite build + cap sync | DONE (Terra) | dist/ built; cap sync android passes; Capacitor Doctor: Android looking great |
| CAP-05 Backend CORS | DONE (Terra) | 164/164 tests pass; on staging as 90101fb; not yet on main |
| CAP-02-PROD Production config | DONE (Flash) | capacitor.config.prod.ts; network_security_config.xml; AndroidManifest.xml updated |

---

## Remaining tasks — ordered

---

### CAP-G01 — Commit android/ to Git and fix .gitignore  
**Model: Flash 3.6 | Scope: frontend/.gitignore, frontend/android/ only**  
**Spec file: CAP-G01-FLASH-TASK.md**

Currently android/ is gitignored entirely (added during CAP-01). This must be
reversed: android/ source must be committed; only build outputs and local files
remain gitignored.

Steps:
1. Update frontend/.gitignore: remove the line `android/` and replace with the
   specific exclusions listed in the "Native Android configuration strategy" section above.
2. git add frontend/android/ (all tracked files)
3. git add frontend/.gitignore
4. Report exactly which files are now staged (git status --short)

Do NOT commit — the maintainer reviews and commits manually.
Do NOT touch any file outside frontend/.

Definition of done: git status shows android/ files staged; build output dirs not staged;
local.properties not staged; .gitignore updated.

---

### CAP-G02 — Add operations-capacitor-apk job to ci.yml  
**Model: Terra 5.6 | Scope: .github/workflows/ci.yml only**  
**Spec file: CAP-G02-TERRA-TASK.md**

Add a new job `operations-capacitor-apk` to the existing ci.yml workflow,
modelled exactly on the existing `pilot-staging-apk` job (lines 272-393).

Job specification:
- Name: "build standalone Operations Capacitor staging APK on office server"
- Trigger condition: push to staging branch only (same as pilot-staging-apk)
- needs: [backend, frontend, pilot-mobile, isolated-container-stack]
- runs-on: [self-hosted, linux, rfly-onprem]  (same runner as pilot-staging-apk)
- environment: onprem-staging
- timeout-minutes: 60
- working-directory for Capacitor steps: frontend (not pilot-mobile)

Steps (in order):
  1. Checkout CI-passed staging source (same stale-SHA check as pilot job)
  2. Refuse non-staging or stale source (identical guard to pilot job)
  3. actions/setup-node@v4 node-version 24, cache frontend/package-lock.json
  4. actions/setup-java@v5 distribution: temurin, java-version: '17'
  5. Install Android command-line tools (same action as pilot job, same pinned SHA)
  6. Install pinned Android SDK components (same sdkmanager commands as pilot job)
  7. Install frontend dependencies: npm ci (in frontend/)
  8. Vite build with staging API URL:
       env: VITE_API_URL: http://172.20.96.10:8089
       run: npm run build
  9. Capacitor sync: npx cap sync android (in frontend/)
  10. Build staging APK:
       cd frontend/android
       chmod +x gradlew
       ./gradlew :app:assembleRelease --no-daemon --max-workers=2
  11. Verify and package evidence:
       - APK file is non-empty
       - aapt dump badging confirms package: name='com.rfly.operations.staging'
       - apksigner verify passes
       - Forbidden permissions check (same list as pilot job — no BACKGROUND_LOCATION,
         no READ_EXTERNAL_STORAGE, no WRITE_EXTERNAL_STORAGE, no SYSTEM_ALERT_WINDOW)
       - sha256sum APK
       - Write build-metadata.txt:
           source_sha=$GITHUB_SHA
           variant=staging
           api_url=http://172.20.96.10:8089
           package_id=com.rfly.operations.staging
           signing=debug-signed
           distribution=internal-only
  12. Upload artifact:
       name: rfly-operations-staging-${{ github.sha }}
       path: (artifact dir containing APK + sha256 + metadata)
       retention-days: 7
       if-no-files-found: error

Verify: the job DOES NOT run on pull requests or dev pushes; it DOES NOT trigger
on main; it IS a separate job from pilot-staging-apk with its own artifact name.

Definition of done: ci.yml modified; both pilot-staging-apk and operations-capacitor-apk
exist as separate jobs with separate artifact names; yaml is valid (run: npx js-yaml
.github/workflows/ci.yml to check, or: python3 -c "import yaml,sys;yaml.safe_load(sys.stdin)"
< .github/workflows/ci.yml); no other file touched.

---

### CAP-G03 — Maintainer: commit, PR, staging deploy, env var  
**Who: You (maintainer) | No model needed**

Commands:

```bash
# 1. Review what Flash staged in CAP-G01
git diff --cached --stat

# 2. Add the ci.yml change from CAP-G02
git add .github/workflows/ci.yml

# 3. Commit everything together
git commit -m "feat(capacitor): add Operations WebView shell and CI APK job

- commit android/ native source (gitignore only build outputs)
- add operations-capacitor-apk CI job on office runner
- capacitor.config.ts: staging endpoint, cleartext limited to LAN
- network_security_config.xml: cleartext to staging/production IPs only
- CAPACITOR_ORIGINS_ENABLED backend flag (already on staging as 90101fb)"

# 4. Push to dev
git push origin dev

# 5. Open PR: dev -> staging on GitHub. Wait for CI green.
#    NOTE: the operations-capacitor-apk job will NOT run on this PR (push only, staging branch only).
#    It will run when the PR is merged to staging.

# 6. Merge PR to staging. CI runs. After all gates pass, the new
#    operations-capacitor-apk job runs on the office runner and produces
#    the staging APK artifact.

# 7. While CI runs, SSH to server and add the env var:
ssh <user>@103.238.230.152
echo "" >> /opt/client-staging-app/deployment.env
echo "CAPACITOR_ORIGINS_ENABLED=true" >> /opt/client-staging-app/deployment.env
grep CAPACITOR_ORIGINS /opt/client-staging-app/deployment.env
exit
# The env var is picked up on the next staging deployment (triggered by this same push).
```

Definition of done: CI green on staging; staging APK artifact appears in GitHub Actions
for the exact SHA; CAPACITOR_ORIGINS_ENABLED active on staging server.

---

### CAP-G04 — Staging acceptance test  
**Who: You (maintainer) | No Android Studio required**

```bash
# Download the staging APK from GitHub Actions:
# Actions tab -> operations-capacitor-apk job -> Artifacts -> rfly-operations-staging-<sha>

# Verify SHA-256 (PowerShell):
Get-FileHash rfly-operations-staging.apk -Algorithm SHA256
# Compare against the .sha256 file in the artifact

# Install on a VPN-connected test device via USB:
adb install rfly-operations-staging.apk
# Or: transfer the APK to the device and install manually
# (Settings -> Install unknown apps -> allow)
```

Test checklist — record PASS/FAIL for each:
- [ ] Splash screen appears (navy background)
- [ ] Login page loads without errors
- [ ] Admin login -> AdminDashboard renders correctly
- [ ] Fleet login -> FleetManagerDashboard renders correctly
- [ ] Sales login -> MarketingDashboard renders correctly
- [ ] Farmer login (OTP) -> FarmerDashboard renders correctly
- [ ] Business login -> BusinessDashboard renders correctly
- [ ] Android back button navigates correctly within SPA
- [ ] Keyboard does not cover input fields
- [ ] Loading/error state when VPN disconnected (app shows error, not crash)
- [ ] No CORS errors (check adb logcat | grep CORS)
- [ ] No cleartext traffic warnings in logcat

Record acceptance against: source SHA, APK SHA-256, test date, device model, Android version.

Definition of done: all 13 checks pass; acceptance record written to
docs/plan/one-ness program/CAPACITOR_STAGING_ACCEPTANCE.md

---

### CAP-G05 — Promote CAP-05 backend CORS to main  
**Who: You (maintainer) | Normal PR flow**

CAP-05 is already on staging (90101fb). After CAP-G04 staging acceptance:

```bash
# Open PR: staging -> main on GitHub
# CI must pass (164 backend tests + all gates)
# Merge -> production auto-deploys

# After production deployment completes, SSH and add env var:
ssh <user>@103.238.230.152
echo "" >> /opt/client-demo-app/deployment.env
echo "CAPACITOR_ORIGINS_ENABLED=true" >> /opt/client-demo-app/deployment.env
grep CAPACITOR_ORIGINS /opt/client-demo-app/deployment.env
exit
# Env var picked up on the next production deployment restart.
# If needed, restart only the backend container:
# docker compose -p rfly-onprem-demo up -d --no-deps --force-recreate backend
```

Definition of done: main CI green; production deployment healthy;
CAPACITOR_ORIGINS_ENABLED=true active on production server.

---

### CAP-G06 — Production APK (guarded, maintainer-approved dispatch)  
**Who: You (maintainer) | After CAP-G05 production health verified**

IMPORTANT: This is NOT automatic. Do not build until:
- DEC-13 (production application ID) is decided
- Production server is healthy after CAP-G05 deploy
- Staging acceptance (CAP-G04) is recorded

The production APK is a separate manual trigger, not a CI automatic job.
Until a proper release workflow is added, build it locally using the
production config:

```powershell
# In frontend/ on your Windows machine:
Copy-Item capacitor.config.prod.ts capacitor.config.ts -Force
npm run build
npx cap sync android
# Then Gradle build in Android Studio or:
cd android
.\gradlew.bat assembleRelease
# Record APK path and SHA-256
Get-FileHash app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
# Restore staging config
git checkout -- capacitor.config.ts
```

Distribution: sideload via USB or private file share. Track: staff name, device,
APK SHA-256, date installed.

Do NOT distribute this APK publicly. Do NOT submit to Play Store without DEC-13
and company Play Console account.

---

### CAP-G07 — Limitations document  
**Model: Flash 3.6 | After CAP-G04 acceptance**  
**Spec file: CAP-G07-FLASH-TASK.md**

Write docs/plan/one-ness program/CAPACITOR_LIMITATIONS.md recording all
limitations found during acceptance testing plus known architectural limits.
Each entry must have a resolution path (usually: native Operations Companion Phase 1).

---

## Decisions required before production APK distribution

| ID | Question | Status |
|---|---|---|
| DEC-12 | Production domain, TLS, trusted-proxy config | OPEN — HTTP is temporary |
| DEC-13 | Final Android package ID for production | OPEN — required before CAP-G06 |
| DEC-CAP-01 | Play Store account ownership | OPEN |
| DEC-CAP-02 | Production signing key ownership and storage | OPEN |
| DEC-CAP-03 | Should Farmer/Business OTP login work in the WebView APK? | OPEN |

---

## Relationship to Phase 1 (native Operations Companion)

Phase 0 — This plan: Capacitor WebView APK
  Staff get a working app while native app is built
  WebView UX gaps found here feed into Phase 1 requirements
  No backend rework — same API

Phase 1 — NON_PILOT_MOBILE_APP_IMPLEMENTATION_HANDOFF.md
  Native screens, offline capability, push notifications, biometric auth
  Built in parallel; eventually replaces Phase 0
  Same backend API

---

*End of Capacitor WebView Fast-Track Plan (corrected)*  
*Next task: CAP-G01 to Flash 3.6*

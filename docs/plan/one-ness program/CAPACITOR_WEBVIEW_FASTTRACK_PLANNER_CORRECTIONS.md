# Capacitor WebView Fast-Track — Planner Corrections

**Status:** required corrections before the fast-track plan continues  
**Date:** August 24, 2026  
**Scope:** RFLY Operations Capacitor shell only; not the Pilot Expo application.

## Why this correction exists

The existing `CAPACITOR_WEBVIEW_FASTTRACK.md` assumes that Android Studio and
local Gradle are the normal APK build path. That does not match RFLY's actual
operating model: the office self-hosted GitHub Actions runner has already been
used for Android compilation because the maintainer laptop is resource-limited.
The plan must make the **office runner** the authoritative build environment.
Android Studio is optional for investigation and USB device debugging, not a
release prerequisite.

## Required plan changes

### 1. Replace local CAP-06 with an office-runner APK job

Replace `./gradlew assembleRelease` on the maintainer laptop with a dedicated
GitHub Actions job, for example `operations-capacitor-apk`.

- Run it on the existing trusted RFLY self-hosted office runner.
- Trigger it only after the hosted backend, frontend, Pilot-mobile (where
  applicable), and isolated-container-stack gates have passed for the exact
  target SHA.
- For `staging`, build a staging-pointed APK and upload it as a private GitHub
  Actions artifact with seven-day retention.
- Do **not** create a production APK automatically on every `main` push. Make
  it a protected, maintainer-approved dispatch after the matching `main`
  deployment is healthy, until a real signing/release policy is approved.
- The job must use an exact checked-out SHA and record the SHA, API URL,
  package ID, APK SHA-256, signing type, and build time as artifact metadata.
- Reuse the office runner's Android SDK/JDK capability, but do not assume that
  a Pilot APK job automatically builds this different Capacitor application.
  It needs its own explicit workflow job and artifact name.

### 2. Make the native Android configuration reproducible in Git

The current fast-track says `frontend/android/` is ignored. That makes the
following CAP-02 changes local-only and invisible to a clean office-runner
checkout:

- `AndroidManifest.xml` network-security registration;
- `network_security_config.xml`;
- splash/icon resources; and
- any native build configuration.

The revised plan must choose one reproducible strategy before CI/CD work:

1. **Recommended:** commit `frontend/android/` as normal Capacitor native
   source, while ignoring only `android/.gradle/`, `android/build/`,
   `android/app/build/`, `android/local.properties`, keystores, signing files,
   and generated APKs; or
2. keep `frontend/android/` generated, but commit a deterministic post-sync
   script/templates which create every required XML/resource/configuration on
   the office runner.

Do not rely on a developer's untracked Android folder for an internal release.

### 3. Correct the WebView architecture description

With `server.url` configured, the Capacitor shell loads the **deployed remote
web application** in an Android WebView. `npm run build` and `npx cap sync`
prepare the shell, but they do not make the remote site part of the APK's
runtime UI.

Revise the architecture to:

```text
Android APK (Capacitor shell)
  -> WebView loads configured remote web endpoint
     -> deployed RFLY frontend
        -> same-origin /api calls
           -> Node/Express backend -> PostgreSQL
```

Consequences:

- The API must be deployed and healthy before phone acceptance testing.
- The app has no meaningful offline mode; it depends on the selected server.
- A later web deployment changes what staff see without replacing the APK.
- The shell must still have a safe loading/error experience if the endpoint is
  unreachable.

### 4. Correct environment, network, and CORS sequencing

Use the real deployment boundary:

| Target | Current endpoint | Access rule | Required CORS setting |
|---|---|---|---|
| Staging | `http://172.20.96.10:8089` | office LAN or approved split-tunnel VPN | `CAPACITOR_ORIGINS_ENABLED=true` in `/opt/client-staging-app/deployment.env` |
| Production | `http://103.238.230.152:8088` | temporary internal-use HTTP endpoint | `CAPACITOR_ORIGINS_ENABLED=true` in `/opt/client-demo-app/deployment.env` |

- `CAPACITOR_ORIGINS_ENABLED` is a server-only external configuration value;
  never commit it or print it in CI logs.
- CAP-05 is already committed on `staging` as `90101fb`. It must pass normal
  staging acceptance before a reviewed promotion to `main`.
- The VPN grants only the staging web endpoint. It must not expose PostgreSQL,
  Docker, backend service ports, or general server administration to APK users.
- `http://` is a temporary internal delivery exception, not a production
  security target. Once a company domain/TLS is provisioned, switch both the
  endpoint and Android network-security policy to HTTPS and remove the
  cleartext exception.

### 5. Fix package identity and signing decisions

- A production-pointed build must **not** retain
  `com.rfly.operations.staging` as its final application ID.
- Decide and reserve a production ID, for example `com.rfly.operations`, before
  distributing a production-pointed APK or preparing Play Console work.
- Staging and production must use distinct application IDs so both can be
  installed concurrently and cannot overwrite each other.
- The first internal staging artifact may be debug-signed, but production
  distribution needs a company-controlled signing key, access record, backup
  and rotation/revocation procedure. Play Store release additionally requires
  the company's Play Console account and a release signing policy.

### 6. Reorder human testing

Android Studio is optional. The required acceptance route is:

1. push/review source through `dev -> staging`;
2. wait for CI and the staging deployment of that same SHA;
3. download the office-runner APK artifact for that SHA;
4. verify its SHA-256 and install it on a VPN-connected test device;
5. test Admin, Fleet, Sales, Farmer and Business role routing, login, maps,
   back navigation, keyboard, loading/error state and CORS;
6. record acceptance against the source SHA;
7. only then promote the web/CORS change to `main` through the normal review
   path; and
8. create a separately approved production-pointed artifact after production
   health is verified.

Android Studio may still be used later for Logcat, emulator use, USB debugging,
native crash diagnosis, or a one-off local build. It must not be represented as
a prerequisite for the normal internal APK release.

### 7. Correct task status and terminology

- CAP-01 and CAP-03 are complete locally; do not rerun package installation.
- CAP-05 source change and backend test evidence are complete on `staging`:
  164 passed, 0 failed. The environment flags/deployment acceptance remain
  operational steps.
- CAP-02 has only a temporary local production configuration. Its native
  settings must be incorporated by the reproducibility decision in item 2.
- Rename the current `CAP-06 Staging APK build` to `CAP-06 Office-runner
  staging artifact build`.
- Add a new, guarded `CAP-07 Production artifact build` after main deployment
  health verification. Move staff distribution and device tracking after it.

## Planner acceptance criteria

The revised plan is ready only when it specifies:

1. a committed/reproducible native Android configuration strategy;
2. a dedicated self-hosted runner job and artifact retention/evidence rules;
3. separate staging and production IDs/configurations;
4. no local Android Studio requirement for normal builds;
5. temporary HTTP controls and the mandatory TLS exit condition;
6. exact branch, CI, deployment, APK and device-test sequence; and
7. company ownership of production signing and Play Console assets.


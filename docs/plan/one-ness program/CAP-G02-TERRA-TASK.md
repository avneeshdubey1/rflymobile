# CAP-G02 — Add operations-capacitor-apk job to ci.yml
## Model: Terra 5.6 | Reasoning: LIGHT THINKING | Scope: .github/workflows/ci.yml only

---

### YOUR ABSOLUTE LIMITS

- Touch ONLY .github/workflows/ci.yml
- Do NOT touch any other file
- Do NOT run any build commands, npm commands, or git commands
- Do NOT commit, push, or stage anything
- Do NOT modify the existing pilot-staging-apk job in any way

---

### CONTEXT

The existing ci.yml already contains a `pilot-staging-apk` job (starting around
line 272) that builds the Pilot Expo APK on the office self-hosted runner.
You must add a NEW, SEPARATE job for the Operations Capacitor APK.

The two jobs are completely independent:
- pilot-staging-apk: builds from pilot-mobile/ using Expo prebuild + Gradle
- operations-capacitor-apk: builds from frontend/ using Capacitor + Gradle

They share the same runner label (rfly-onprem) but have separate job names,
separate working directories, separate artifact names, and separate APK outputs.

---

### STEP 1 — Read the file

Read .github/workflows/ci.yml completely.

Find and confirm:
  - The exact line number where pilot-staging-apk job starts
  - The exact line number where pilot-staging-apk job ends (last line of the file)
  - The needs: list of pilot-staging-apk
  - The runner label used by pilot-staging-apk
  - The environment: name used by pilot-staging-apk
  - The artifact retention-days value

Report all of these before making any change.

---

### STEP 2 — Add the operations-capacitor-apk job

Append the following new job AFTER the last line of pilot-staging-apk.
This job must be at the same indentation level as other jobs (2 spaces).

The job content to add:

  operations-capacitor-apk:
    name: build standalone Operations Capacitor staging APK on office server
    if: github.event_name == 'push' && github.ref == 'refs/heads/staging'
    needs: [backend, frontend, pilot-mobile, isolated-container-stack]
    runs-on: [self-hosted, linux, rfly-onprem]
    timeout-minutes: 60
    environment: onprem-staging
    env:
      CI: '1'
      VITE_API_URL: http://172.20.96.10:8089
    steps:
      - name: Checkout CI-passed staging source
        uses: actions/checkout@v4

      - name: Refuse non-staging or stale source
        shell: bash
        run: |
          set -euo pipefail
          git fetch --force --no-tags origin \
            refs/heads/staging:refs/remotes/origin/staging
          test "$(git rev-parse HEAD)" = "$(git rev-parse origin/staging)" || {
            echo "The requested revision is not the current staging tip." >&2
            exit 1
          }

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '17'

      - name: Install Android command-line tools
        uses: android-actions/setup-android@40fd30fb8d7440372e1316f5d1809ec01dcd3699 # v4

      - name: Install pinned Android SDK components
        shell: bash
        run: |
          set -euo pipefail
          yes | sdkmanager --licenses >/dev/null || true
          sdkmanager \
            'platform-tools' \
            'platforms;android-36' \
            'build-tools;36.0.0' \
            'cmake;3.22.1' \
            'ndk;27.1.12297006'

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Build Vite production bundle for staging
        working-directory: frontend
        run: npm run build

      - name: Sync Capacitor Android project
        working-directory: frontend
        run: npx cap sync android

      - name: Build Operations Capacitor staging APK
        working-directory: frontend/android
        shell: bash
        run: |
          set -euo pipefail
          chmod +x gradlew
          sed -i 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8/' gradle.properties
          sed -i 's/^org.gradle.parallel=.*/org.gradle.parallel=false/' gradle.properties
          ./gradlew :app:assembleRelease --no-daemon --max-workers=2

      - name: Verify and package APK evidence
        shell: bash
        run: |
          set -euo pipefail
          source_apk='frontend/android/app/build/outputs/apk/release/app-release.apk'
          test -s "$source_apk"
          artifact_dir="$RUNNER_TEMP/rfly-operations-staging-${GITHUB_SHA}"
          mkdir -p "$artifact_dir"
          cp "$source_apk" "$artifact_dir/rfly-operations-staging.apk"
          "$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose \
            "$artifact_dir/rfly-operations-staging.apk"
          "$ANDROID_HOME/build-tools/36.0.0/aapt" dump badging \
            "$artifact_dir/rfly-operations-staging.apk" \
            | grep -q "package: name='com.rfly.operations.staging'"
          apk_permissions="$("$ANDROID_HOME/build-tools/36.0.0/aapt" dump permissions \
            "$artifact_dir/rfly-operations-staging.apk")"
          for forbidden_permission in \
            android.permission.ACCESS_BACKGROUND_LOCATION \
            android.permission.FOREGROUND_SERVICE_LOCATION \
            android.permission.READ_EXTERNAL_STORAGE \
            android.permission.WRITE_EXTERNAL_STORAGE \
            android.permission.SYSTEM_ALERT_WINDOW; do
            if grep -q "$forbidden_permission" <<< "$apk_permissions"; then
              echo "Forbidden Android permission present: $forbidden_permission" >&2
              exit 1
            fi
          done
          sha256sum "$artifact_dir/rfly-operations-staging.apk" \
            > "$artifact_dir/rfly-operations-staging.apk.sha256"
          {
            echo "source_sha=$GITHUB_SHA"
            echo 'variant=staging'
            echo 'api_url=http://172.20.96.10:8089'
            echo 'package_id=com.rfly.operations.staging'
            echo 'signing=debug-signed'
            echo 'distribution=internal-only'
          } > "$artifact_dir/build-metadata.txt"
          echo "APK_ARTIFACT_DIR=$artifact_dir" >> "$GITHUB_ENV"

      - name: Upload installable Operations staging APK
        uses: actions/upload-artifact@v4
        with:
          name: rfly-operations-staging-${{ github.sha }}
          path: ${{ env.APK_ARTIFACT_DIR }}
          if-no-files-found: error
          retention-days: 7

---

### STEP 3 — Validate YAML syntax

Run this command and report the output:

  python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML VALID"

If python3 is not available, try:
  node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8')); console.log('YAML VALID')"

If neither is available, report that validation could not be run.

---

### STEP 4 — Verify separation from pilot job

Confirm:
  - The new job name is `operations-capacitor-apk` (not `pilot-staging-apk`)
  - The artifact name is `rfly-operations-staging-${{ github.sha }}` (not `rfly-pilot-staging-*`)
  - The working directory for the Capacitor build steps is `frontend/android` (not `pilot-mobile/android`)
  - The existing `pilot-staging-apk` job is UNCHANGED (paste its first and last 3 lines to confirm)

---

### REPORT — return exactly this structure

```
CAP-G02 CI WORKFLOW REPORT

pilot-staging-apk starts at line: ___
pilot-staging-apk ends at line:   ___

operations-capacitor-apk job added after line: ___

YAML syntax check: VALID / INVALID (error: ___)

Job separation confirmed:
  Job name:           operations-capacitor-apk  YES / NO
  Artifact name:      rfly-operations-staging-*  YES / NO
  Working directory:  frontend/android           YES / NO
  pilot-staging-apk unchanged:                  YES / NO

Other files changed: NONE
Committed: NO

READY FOR MAINTAINER REVIEW: YES / NO
```

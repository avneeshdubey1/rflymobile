# CAP-G01 — Commit android/ to Git and fix .gitignore
## Model: Flash 3.6 | Reasoning: DEFAULT | Scope: frontend/.gitignore only

---

### YOUR ABSOLUTE LIMITS

- Touch ONLY frontend/.gitignore
- Do NOT modify any other file
- Do NOT run npm, npx, gradle, or any build command
- Do NOT commit, push, or stage anything — report what WOULD be staged
- Do NOT touch backend/, pilot-mobile/, .github/, or docs/

---

### CONTEXT

During CAP-01, `android/` was added to frontend/.gitignore to keep the
generated Android project out of Git. This was correct as a temporary measure,
but the plan has been corrected: the android/ native source must be committed
so the office CI runner can build the APK from a clean checkout.

Only build outputs and local environment files must remain gitignored.

---

### STEP 1 — Read the current frontend/.gitignore

Report its full current contents.

---

### STEP 2 — Update frontend/.gitignore

Remove the line:
  android/

Replace it with these specific exclusions:

  # Capacitor Android — source committed; build outputs and local state excluded
  frontend/android/.gradle/
  frontend/android/build/
  frontend/android/app/build/
  frontend/android/local.properties
  frontend/android/*.jks
  frontend/android/*.keystore
  *.apk

Add this block at the end of the file, after any existing entries.

Report:
  - The exact line you removed
  - The exact block you added
  - The full final content of frontend/.gitignore

---

### STEP 3 — Report what would be staged

Run these two read-only commands and report the exact output:

  git -C "d:\projects\Daas--main\Daas--main" status --short -- frontend/android/
  git -C "d:\projects\Daas--main\Daas--main" ls-files --others --exclude-standard frontend/android/ | head -20

This tells the maintainer which android/ files are now untracked (would be added
when they run git add frontend/android/).

---

### REPORT — return exactly this structure

```
CAP-G01 GITIGNORE REPORT

Line removed from .gitignore:  android/
Block added:                   [paste the block]

Final .gitignore contents:     [paste full file]

Untracked android/ files that would be staged (from git status):
  [paste output]

Files outside frontend/.gitignore changed:  NONE
Committed:                                  NO

READY FOR MAINTAINER GIT ADD: YES / NO
```

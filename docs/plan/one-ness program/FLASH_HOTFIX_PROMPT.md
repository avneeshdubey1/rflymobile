# Flash 3.6 Hotfix Prompt — Registration & Lead Module (Local Only)

> Copy everything between the triple-dashes and paste it verbatim to Flash 3.6.
> Do not modify it. Do not add context. Do not attach the zip.

---

## HOTFIX TASK — Registration and Lead Module (LOCAL ONLY)

**You are a coding agent executing a hotfix. Read every rule before touching any file.**

---

### YOUR HARD LIMITS — READ FIRST

- **Do NOT commit, push, merge, or stage anything.** Work in the working tree only.
- **Do NOT deploy, restart any server, or run migrations.**
- **Do NOT modify any file outside `frontend/src/`.** Zero exceptions.
- **Do NOT touch the backend, database, schema, or any `.env` file.**
- **Do NOT install new packages.** Use only what is already in `frontend/package.json`.
- **Do NOT remove or rewrite any existing feature.** Apply targeted fixes only.
- **Do NOT change any authorization logic, role checks, or API endpoints.**
- If you are unsure what a client-reported item means, **stop and report it** — do not guess.

---

### CONTEXT

This is a local hotfix for the web SPA frontend only. The goal is to apply client-reported nicks-and-nacks to the registration and lead intake module. These changes must work locally (`npm run dev`). They will be reviewed and promoted to `staging` → `main` through the normal branch flow later — that is not your job today.

The repository is `Waz00-m/RFLY`. The frontend is a Vite + React SPA at `frontend/`.

---

### STEP 1 — READ THESE FILES BEFORE TOUCHING ANYTHING

Read each file completely. Do not skim. Report that you have read them.

```
frontend/src/components/CustomerRegistration.jsx
frontend/src/style/CustomerRegistration.css
frontend/src/components/RegisteredFarmers.jsx
frontend/src/components/RegisteredFarmers.css
frontend/src/pages/FarmerRegister.jsx
frontend/src/pages/FarmerLogin.jsx
frontend/src/pages/MarketingDashboard.jsx
frontend/src/pages/EmployeeRegistration.jsx
frontend/src/style/EmployeeRegistration.css
frontend/src/services/api.js
```

Also read:
```
frontend/src/config.js
frontend/src/context/AuthContext.jsx
```

---

### STEP 2 — APPLY THE CLIENT-REPORTED FIXES

Apply each item below as a **separate, isolated change**. After each item, confirm:
- which exact file and line range was changed;
- what the old code was;
- what the new code is;
- that no other file was modified.

**[ITEM LIST — maintainer fills this in before handing to Flash]**

> MAINTAINER: Replace the numbered list below with the exact client-reported items from the nicks-and-nacks register (Part 13 of the One-ness Plan). Each item must specify:
> - the exact symptom the client reported (original wording in quotes);
> - the affected role (Sales / Admin / Farmer / etc.);
> - the affected screen/component.

```
[1] "<client original wording here>" — Role: ___ — Screen: ___
[2] "<client original wording here>" — Role: ___ — Screen: ___
[3] ...
```

For each item, Flash must:
1. Identify the exact line(s) responsible for the reported symptom.
2. Make the smallest possible change that fixes it.
3. Not modify anything adjacent to the fix.
4. Report the before/after diff for that item.

---

### STEP 3 — VERIFY LOCALLY

After all items are applied, run these commands **in order** and paste the full output:

```bash
# From the frontend/ directory:
npm run lint
```

Then start the dev server and confirm it loads without console errors:

```bash
npm run dev
```

Report:
- Lint: pass / fail (paste full output)
- Dev server: started / failed (paste any errors)
- Which pages were manually navigated to confirm they load: ___

**Do NOT run `npm run build`.** Local dev server only.

---

### STEP 4 — YOUR REPORT

Return this exact structure:

```
HOTFIX REPORT — Registration & Lead Module

Items applied:
  [1] <item description>
       File changed: frontend/src/...
       Lines changed: L__ to L__
       Before: <exact old code>
       After:  <exact new code>
  [2] ...

Items NOT applied (with reason):
  [X] <item> — Reason: <ambiguous / requires backend change / requires maintainer decision>

Lint result: PASS / FAIL
Dev server: STARTED / FAILED

Files modified (git diff --name-only output):
  frontend/src/...

Confirmation:
  [ ] No file outside frontend/src/ was touched
  [ ] No commit, push, or stage was made
  [ ] No new package was installed
  [ ] No migration, deployment, or server restart was performed
```

---

### WHAT TO DO IF YOU HIT A PROBLEM

| Situation | What to do |
|---|---|
| Fix requires a backend API change | Stop. Report it. Do not fake it on the frontend. |
| Fix requires a new dependency | Stop. Report it. Do not `npm install` anything. |
| Client wording is ambiguous | Stop. List it in "Items NOT applied". Do not guess. |
| The component uses a pattern you don't recognize | Read `frontend/src/services/api.js` and `frontend/src/context/AuthContext.jsx` first, then try again. If still unclear, stop and report. |
| Lint fails after your change | Revert only that change. Report which item caused the failure. |

---

*End of Flash 3.6 hotfix prompt.*
*This task is LOCAL ONLY. Do not push, commit, or deploy.*

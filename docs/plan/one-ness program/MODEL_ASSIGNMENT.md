# RFLY One-ness Program — Model Assignment & Task Sizing Guide

**Status:** planning reference for task bundlers and agents  
**Created:** August 21, 2026  
**Read alongside:** `PLAN.md`

---

## Worker model roster

| Model | Tier | Reasoning mode | Context window assumption |
|---|---|---|---|
| Flash 3.6 | Lowest / fastest | **No extended thinking** — default/fast mode only | Small; treat as ~16k effective task context |
| Terra 5.6 | Mid | **Light thinking** — one reasoning pass before answer | Medium; ~32k effective |
| GPT 5.5 | Highest | **Extended reasoning** — full chain-of-thought | Large; ~128k+ |

### Reasoning mode rationale

**Flash 3.6 — no thinking mode:**  
Flash is optimized for speed, not deep multi-step planning. Giving it a thinking budget wastes tokens and can cause hallucinated intermediate steps. Keep it in default mode. Instead of asking Flash to reason, the *task specification itself must do the reasoning* — it should be so well-scoped that no reasoning is required beyond "read this, write that, run this test."

**Terra 5.6 — light thinking:**  
Terra can handle moderate coordination but should not be left to architect anything. One thinking pass is enough to handle a 2–3 file task with a clear contract. Do not give Terra open-ended architectural tasks; give it a defined input contract and a defined output.

**GPT 5.5 — extended reasoning:**  
Use extended reasoning for architectural decisions, cross-cutting refactors, state machine verification, security review, and any task that requires holding multiple invariants in mind simultaneously. Bundle multiple consecutive atomic tasks for GPT 5.5 rather than creating one giant mega-task.

---

## Task sizing rules (Flash 3.6 is the constraint)

A task is **Flash-safe** if all of the following are true:

| Rule | Limit |
|---|---|
| Files changed | Max 2 (ideally 1) |
| New functions introduced | Max 3 |
| Lines of new code | Max ~120 |
| External dependencies introduced | 0 (unless explicitly listed in task) |
| Requires reading more than N files to understand context | Max 3 files listed explicitly in task |
| Success criterion | Binary — either a specific test passes or a specific output is observable |
| Ambiguity in the task spec | Zero — no "figure out how to" wording |

A task is **Flash-unsafe** (route to Terra or GPT) if it:
- Requires designing a data model or schema
- Crosses service/layer boundaries (e.g., touching both a controller and a repository)
- Requires understanding a state machine holistically
- Requires reconciling two conflicting implementations
- Involves any security, privacy, or authorization decision

---

## Bundling strategy for higher-end models

### Flash 3.6 — one task per invocation
Flash gets one atomic task. The bundle is the task spec itself. Output is verified before the next task begins.

### Terra 5.6 — bundle 2–4 consecutive Flash-safe tasks
Bundle only tasks with a linear dependency (task N output is task N+1 input). Do not bundle tasks from different feature areas. Terra verifies each subtask before proceeding and reports all four results together.

### GPT 5.5 — bundle one full package
A "package" in PLAN.md (e.g., PF-03) is one GPT 5.5 bundle. GPT reads all prerequisite files, plans, implements, and returns the complete package report. GPT may also be used for cross-cutting review passes (e.g., security audit across all completed packages).

---

## Model assignment per plan phase

### Phase 0 — Baseline and glossary (ON-series)

| Task | Assigned to | Notes |
|---|---|---|
| ON-00 Baseline freeze | Flash 3.6 | Read-only; record current SHAs and test results |
| ON-01 Glossary doc | Terra 5.6 | Cross-reference server enums; write doc |
| ON-02 Parity matrix confirmation | GPT 5.5 | Requires holding the full parity matrix in context |
| ON-03 Operations route inventory | Terra 5.6 | Read mobileV1Routes.js; compare to expected list |

### Phase 0.5 — Design system (DS-series, new)

| Task | Assigned to | Notes |
|---|---|---|
| DS-00 Web design token file | Terra 5.6 | Create `frontend/src/styles/tokens.css` or equivalent |
| DS-01 Apply palette to web global styles | Flash 3.6 × 3 | One Flash task per area: layout/nav, buttons, status chips |
| DS-02 Apply palette to web Pilot workspace | Flash 3.6 × 2 | Cards and action controls |
| DS-03 Apply palette to web Fleet/Admin workspace | Flash 3.6 × 2 | Schedule, management views |
| DS-04 Apply palette to web Sales/Farmer/Business workspace | Flash 3.6 × 2 | Forms, lead intake, portal |
| DS-05 Visual regression snapshot pass | Terra 5.6 | Run frontend lint/build; confirm no regressions |

### Phase 1 — Pilot Field repair (PF-series)

| Package | Assigned to | Atomic sub-tasks for Flash |
|---|---|---|
| PF-00 Baseline | Flash 3.6 | Single output: written baseline doc |
| PF-01 Contract + config | Terra 5.6 | API client + build profiles (2 files) |
| PF-02 Auth + bootstrap | GPT 5.5 | Full session state machine |
| PF-03 Encrypted storage | GPT 5.5 | Encryption + user-scope + migration (architectural) |
| PF-03a Purge rules | Flash 3.6 | Implement purge function in storage module |
| PF-03b Storage schema migration | Flash 3.6 | Add schema version + migration function |
| PF-04 Sync engine | GPT 5.5 | Full durable queue (architectural) |
| PF-04a Queue lock | Flash 3.6 | Single-lock implementation in sync module |
| PF-04b Backoff timer | Flash 3.6 | Bounded exponential backoff function |
| PF-04c Conflict retention | Flash 3.6 | Store conflict/rejected evidence without deletion |
| PF-05 Navigation + design system | Terra 5.6 | Tab replacement + token application |
| PF-05a Status chip component | Flash 3.6 | Single component with all canonical states |
| PF-05b Assignment card component | Flash 3.6 | Single component |
| PF-05c Sync state indicator | Flash 3.6 | Single component |
| PF-05d Offline banner | Flash 3.6 | Single component |
| PF-06 Work list + detail | Terra 5.6 | Bundle: list screen + detail screen (2 screens) |
| PF-06a ACCEPT visibility fix | Flash 3.6 | One conditional in work list card |
| PF-06b START guard fix | Flash 3.6 | Remove conditional render; require explicit press |
| PF-06c Offline/stale/cancelled states | Flash 3.6 × 3 | One state per Flash task |
| PF-07 Copilot formation | Terra 5.6 | Bundle: candidate fetch + selection + confirmation |
| PF-07a No-candidate state | Flash 3.6 | Single screen state |
| PF-07b Conflict + refresh state | Flash 3.6 | Single outcome handler |
| PF-08 Mission actions + issues | Terra 5.6 | Bundle: accept/start/complete + issue form |
| PF-08a Auto-start-on-mount removal | Flash 3.6 | Delete auto-mutation from useEffect/useFocusEffect |
| PF-08b Acreage decimal validation | Flash 3.6 | Validation function + UI feedback |
| PF-08c Issue category form | Flash 3.6 | Controlled form component |
| PF-09 Profile + security | Terra 5.6 | Bundle: profile screen + logout journeys |
| PF-10 Tests + CI | GPT 5.5 | Full test suite design; then Flash 3.6 writes individual test files |
| PF-10a–10n Individual test files | Flash 3.6 × N | One test file per module (auth, storage, sync, etc.) |
| PF-11 Physical-device acceptance | Human / maintainer | Evidence collection only |
| PF-12 Release readiness report | Terra 5.6 | Compile placeholder register into report |

### Phase 2 — Operations backend contracts (OC-series)

| Task | Assigned to | Notes |
|---|---|---|
| OC-00 Route audit | Flash 3.6 | Read file; produce list |
| OC-01 Employee session DTO | Terra 5.6 | 2 files: route + DTO |
| OC-02 Farmer OTP mobile DTO | Terra 5.6 | Adapts existing OTP-01 service |
| OC-03 Business login DTO | Terra 5.6 | Adapts existing auth service |
| OC-04 Sales lead intake DTO | Flash 3.6 × 2 | Route file + DTO file |
| OC-05 Fleet assignment + exception DTOs | Terra 5.6 | Multiple DTOs |
| OC-06 Fleet Live GPS DTO | Flash 3.6 | Single DTO file |
| OC-07 Farmer service request DTO | Flash 3.6 × 2 | Route + DTO |
| OC-08 Contract tests | GPT 5.5 | Full role-negative test design; Flash writes individual test files |

### Phase 3 — Operations Companion client (OM-series)

| Task | Assigned to | Notes |
|---|---|---|
| OM-00 Scaffold ops-mobile/ | GPT 5.5 | Architectural; sets boundary for all subsequent OM tasks |
| OM-01 Shared design-system primitives | Terra 5.6 | Reuse PF-05 tokens |
| OM-02 Auth journeys (3 types) | GPT 5.5 | Full session state machine for 3 login paths |
| OM-03 Sales workspace | Terra 5.6 | Bundle: customer search + lead intake |
| OM-03a Registration screen | Flash 3.6 | Single screen |
| OM-03b Geofence result screen | Flash 3.6 | Single screen |
| OM-04 Fleet workspace | GPT 5.5 | Schedule + exceptions (complex state) |
| OM-04a Live GPS screen | Flash 3.6 | Single screen |
| OM-04b Copilot override screen | Flash 3.6 | Single screen |
| OM-05 Farmer workspace | Terra 5.6 | Bundle: services list + request wizard |
| OM-05a–05e Wizard steps | Flash 3.6 × 5 | One step per Flash task |
| OM-06 Admin bounded workspace | Terra 5.6 | Read-only views only |
| OM-07 Business workspace | Flash 3.6 × 2 | Overview + requests list |
| OM-08 Sync/offline/profile | Terra 5.6 | Reuse PF-09 patterns |
| OM-09 Tests + CI | GPT 5.5 + Flash 3.6 × N | Same pattern as PF-10 |
| OM-10 Release readiness | Terra 5.6 | Same pattern as PF-12 |

### Phase 4 — Web SPA alignment (WEB-series)

| Task | Assigned to | Notes |
|---|---|---|
| WEB-00 Status chip terminology | Flash 3.6 × N | One component at a time |
| WEB-01 Pilot workspace parity | Terra 5.6 | Targeted parity fixes from Part 3 |
| WEB-02 AA-10/AA-11 drag/resize | GPT 5.5 | Complex browser interaction |
| WEB-03 Farmer/Business portal alignment | Terra 5.6 | DTO alignment |
| WEB-04 Cross-client regression | GPT 5.5 | Requires holding full matrix in context |

### Nicks and nacks intake (NN-series, pending zip)

| Task | Assigned to | Notes |
|---|---|---|
| NN-00 Review colleague's registration/lead changes | GPT 5.5 | Reconcile pasted code vs source; identify conflicts |
| NN-01–NN-N Individual integration tasks | Flash 3.6 / Terra 5.6 | One per item, sized at Flash level |

---

## Flash 3.6 task spec template

Every Flash task must be handed to the model in this exact format. No deviations:

```
TASK: [one sentence]
READ THESE FILES:
  - path/to/file1 (lines X–Y)
  - path/to/file2 (lines X–Y)
CHANGE THIS FILE: path/to/target/file
CHANGE EXACTLY THIS: [quote exact function/block to change]
TO THIS: [exact replacement]
SUCCESS CRITERION: [exact test command] returns [exact expected output]
DO NOT: touch any other file
DO NOT: add any import not listed below
ALLOWED NEW IMPORTS: [list or "none"]
```

If a task cannot be expressed in this template, it is not Flash-safe. Escalate to Terra or GPT.

---

## Verification chain

After every task, regardless of model:

1. Run the specified test command and record exact output.
2. Run `npx tsc --noEmit` (mobile) or frontend lint/build (web).
3. Confirm no unrelated file was modified (`git diff --name-only`).
4. Report: task ID, files changed, test output, TypeScript/lint result, and confirmation that no commit/push/deploy occurred.

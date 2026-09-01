# Current Engineering State

**Status:** current shared handoff
**Observed:** September 1, 2026

## August 31 local Pilot scheduling and cash-report candidate

- Manual assignment and rescheduling now require a future service-window start,
  preserving the service start as the approved Copilot-selection deadline. The
  previously reproduced empty-Copilot case was caused by creating an assignment
  after its selected window had already ended, not by the candidate Pilot's
  centre, availability, licence, Drone, or LMV state.
- Pilot assignment and Copilot-selection screens now fall back to a known route
  when opened directly, so a back action no longer dispatches an unhandled
  `GO_BACK` action.
- A completed B2C crew may submit one exact, idempotent cash-handover report.
  Admin can read pending reports. This is an operational report only: it does
  not approve price, issue an invoice, reconcile settlement, or enable UPI.
  The displayed QR remains explicitly non-payable until RFLY supplies an
  approved merchant QR/provider configuration.
- The consolidated candidate passes backend 179/179, Pilot 22/22 plus
  TypeScript and Expo Doctor 21/21, frontend lint/build, the disposable
  37-migration/66-check clean/populated replay, and a focused real-browser 4/4
  covering calendar persistence, browser Primary-Pilot Copilot selection,
  mobile containment and health. Staging, merchant QR, finance reconciliation,
  and physical-device acceptance remain pending.

## August 31 local Fleet consistency and asset-lifecycle candidate

- `B2C Cash Reports` is promoted near the top of the Admin navigation. It is
  still deployment-feature-gated and remains a pending operational report, not
  an invoice or reconciled settlement.
- Pilot Drone/LMV links are now explicitly shareable preferences. Several
  Pilots may prefer the same office asset and assets may remain unpreferred as
  backups. Actual Assignment rows remain exclusive and retain the existing
  crew, Drone, LMV, centre, availability, and overlap checks.
- Admin and Fleet Pilot rosters receive a minimal authenticated realtime
  invalidation signal after Pilot mutations and refetch server-authorized data;
  window-focus refresh remains the fallback. No Pilot profile data is placed in
  the socket event.
- Fleet calendar movement uses five-minute resolution, direct date/view
  navigation, and a separate full-tab calendar route. Server-side validation,
  conflict rejection, and the manual editor remain authoritative.
- Admin/Fleet Drone and LMV maintenance now uses a structured modal with quick
  reasons plus a required accountable note. Operations-created work appears in
  the same request ledger as Pilot reports, while direct status changes,
  returns, and retirements appear in a separate attributed lifecycle activity
  view. Active-mission asset faults still go through the mission issue path.
- The browser Pilot workspace now uses the same server-authoritative,
  revision-checked Copilot formation service as the Android Pilot client. It
  lists only eligible candidates for the assigned Primary Pilot and keeps
  mission acceptance locked until the crew is ready.

## Source and deployment

- The active development flow is `dev` -> `staging` -> `main`.
- `main` deploys the office production stack identified as
  `rfly-onprem-demo` on port 8088 after its application/container CI succeeds.
  The identifier contains `demo` for historical reasons; it is the current live
  stack and must not be renamed casually.
- `staging` deploys the isolated internal stack `rfly-onprem-staging` on port
  8089 after staging CI succeeds.
- The office host uses snap-packaged Docker. One-shot importer commands there
  require `compose.snap-import.yml` as the last Compose overlay.
- The self-hosted runner checkout is owned by `rflyrunner`. Root may see Git's
  dubious-ownership warning; do not change global safe-directory policy. Run
  read-only Git inspection as `rflyrunner`.

## Implemented database/import state

- The additive master/history/import schema and 22-migration replay have passed
  the disposable migration harness.
- Farmer workbook import is implemented as an isolated operator CLI with
  preflight, encrypted prepare, report, approval, commit, verify, abort, and
  retention-aware purge. It does not create live Leads.
- Drone master import has a separate preflight/plan/commit flow. It is not part
  of the farmer workbook transaction and still requires an approved operating
  centre assignment.
- The client farmer workbook has two sheets: 745 Zoho CRM rows and 1,219 Google
  Forms rows (1,964 total).

## Proven staging import evidence

On August 10, 2026, staging completed and reconciled the approved farmer import:

| Result | Count |
|---|---:|
| Source rows | 1,964 |
| Imported source rows | 1,924 |
| Safely skipped rows | 40 |
| Customers after import | 1,611 |
| Historical service records | 743 |
| Village visit records | 1,181 |
| Live Leads created | 0 |

Verification reported zero incomplete rows, unexpected results, or outcome
mismatches, and the reconciliation checksum matched. This is staging evidence,
not proof that production has been imported.

## Current gates and next work

The local Release 1 maintenance/asset-lifecycle candidate now supports safe LMV
transfer and retirement, Pilot- and Operations-raised Drone/LMV maintenance,
Admin/Fleet processing accountability, affected-asset quarantine, attributed
lifecycle activity, shareable asset preferences, Admin capability supremacy,
responsive bounded fleet views, a visible disabled auto-assignment policy, and
the revised Fleet-versus-Admin Copilot boundary. Current evidence is recorded
above: backend 179/179, frontend lint/build, Pilot TypeScript and 22/22 tests,
Expo Doctor 21/21, the 37-migration/66-check disposable migration harness, and
focused real-browser acceptance 4/4 all pass. Prior browser evidence includes
policy roles, persisted resource/window changes, normalized sequence,
server-rejected overlap with rollback, keyboard scheduling, bounded calendar
queries, terminal opt-in, mobile Admin containment, tablet Fleet containment,
database health, and scheduled-job health. Human functional/visual acceptance,
focused commit review, staging deployment, and production promotion remain
pending. Use `RELEASE_1_FUNCTIONAL_ACCEPTANCE_CHECKLIST.md`; the non-Pilot
Operations Companion is explicitly outside this acceptance run.

The local Pilot mobile candidate now has a distinct AVAILABLE/OFFLINE
operational state and foreground-only live mission location. Offline Pilots are
excluded server-side from automatic/manual assignment and crew formation, and
cannot go offline while scheduled or engaged. Admin/Fleet can view only the
latest sample for accepted/in-progress work; terminal transitions clear it.
Background tracking and route history remain disabled, and production
activation still requires the privacy/notice and physical-device gates in the
placeholder register.

The staging CI also compiles an arm64 standalone release-mode Android APK on
the office runner after every hosted staging gate passes. It embeds the
VPN-only staging API address, verifies its package and permission boundary, and
retains the private artifact for seven days. The APK uses internal debug
signing and is staging evidence only; it is not a Play Store or production
release.

The Pilot client also has a separate, manual exact-`main` production artifact
workflow for the current internal field trial. It refuses stale source, checks
that the same commit is healthy on the office production stack, confirms the
mobile API is enabled, and then builds `com.rfly.pilot` against the public
production endpoint. This temporary artifact uses HTTP and internal debug
signing. It is not a Play Store release and must be replaced by the normal
HTTPS-only production variant once the company domain, TLS and release-signing
custody are approved.

The local auto-assignment candidate covers `AA-00` through `AA-09` and most
of `AA-10`. The complete backend suite now passes 172/172; frontend lint/build,
Pilot mobile typecheck and 22/22 tests, and Expo Doctor 21/21 pass. The migration
harness replays all 29 migrations with 61 validated checks. The rebuilt isolated Compose stack
migrates once and reports healthy database/jobs without exposing PostgreSQL or
the backend on host ports. A focused real-browser audit passes 6/6 for policy
roles, bounded views, persisted four-resource/window/sequence edits, overlap
rollback, keyboard manual scheduling, terminal filtering, and health. Pointer
drag/resize is still an explicit acceptance gap, so `AA-10`/`AA-11` are not yet
closed. Commit review, staging deployment/acceptance, and production promotion
remain pending; production is unchanged. Resume with the pointer interaction
gap in `AUTO_ASSIGNMENT_POLICY_IMPLEMENTATION_PLAN.md`.

1. Production farmer import has not been performed. Use
   `docs/MIGRATION_ON_MAIN.md`; do not improvise commands from chat history.
2. Production already contains operational customer data. The importer must
   enrich/match safely and preserve existing records; a verified backup is
   mandatory.
3. Staging was observed with two active Admin rows. Resolve that separately
   through the supported account-management path. Never reproduce that state in
   production, and do not use raw SQL to delete an Admin.
4. Client source files remain local/private and must not be committed.
5. The drone import remains a separate reviewed operation after the farmer
   migration and operating-centre decision.

## Client-master hotfix checkpoint

The guarded client-master importer is committed and deployed. It reads dropdown
masters, clusters, the Pilot roster, Drone serials, LMVs and source genset
references while deliberately excluding the `PRICE` sheet. Staging proved its
preflight/plan/backup/atomic-commit flow. The maintainer declared the production
hotfix/import complete on August 23, 2026. Treat the web/client-master hotfix as
closed unless a separately reproduced regression is reported; do not rerun the
production import as part of later mobile work. Imported roster Pilots remain
inactive/offline and imported Drone/LMV records remain out of service until an
authorized operator reviews and activates them.

The separate Expo/React Native Operations Companion now exists under
`operations-mobile/`. Its corrective recovery candidate implements real mobile
authentication, server-issued role/capability navigation, typed Sales/Fleet/
Farmer/Business contracts, safe user-scoped read caching, and foreground-only
location. Local evidence passes TypeScript, 24/24 Jest tests and Expo Doctor
21/21. Its staging APK job is consolidated into the main CI workflow and is
gated on the web, backend, both mobile clients, and isolated Compose stack. It
is not yet production-accepted: exact-SHA office-runner APK evidence and
role-by-role physical-device testing remain open. The older Capacitor WebView
shell is retained only as historical/interim material and is not the release
target. Continue through
`one-ness program/OPERATIONS_MOBILE_CORRECTION_PLAN.md`; do not begin OC-12
until its physical acceptance gates are recorded. Existing Stitch exports
remain design evidence only.

## Known historical trap

Older Gemini, emergency-UI, schema-resume, dated audit, and manual command files
describe superseded commits or unsafe one-off recovery attempts. They have been
moved to `docs/unrealted_docs_for_current_version/` locally and are not valid
implementation guidance.

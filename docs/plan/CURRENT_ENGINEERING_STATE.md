# Current Engineering State

**Status:** current shared handoff
**Observed:** August 11, 2026

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

The local auto-assignment candidate covers `AA-00` through `AA-09` and most
of `AA-10`. The complete backend suite passes 133/133; frontend lint/build and
both production dependency audits pass; the migration harness replays all 23
migrations with 49 validated checks; and the rebuilt isolated Compose stack
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

## Known historical trap

Older Gemini, emergency-UI, schema-resume, dated audit, and manual command files
describe superseded commits or unsafe one-off recovery attempts. They have been
moved to `docs/unrealted_docs_for_current_version/` locally and are not valid
implementation guidance.

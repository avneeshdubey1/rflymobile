# RFLY DaaS Release 1 Functional Acceptance Checklist

**Status:** local acceptance guide
**Last verified:** August 30, 2026
**Scope:** web application and RFLY Pilot Android application
**Excluded:** `operations-mobile/` (the non-Pilot companion application)

This guide is for a tester who has not worked on the project before. It covers
hands-on behaviour, role boundaries, responsive web use, the Pilot mission
lifecycle, offline synchronization, and maintenance accountability. Automated
tests remain separate evidence; this checklist is human acceptance evidence.

## 1. Safety boundary

- Perform this checklist only against the maintainer-confirmed **local test
  database**. Never assume that a URL is local merely because it looks familiar.
- Do not run a seed, database reset, initial-Admin bootstrap, import, raw SQL, or
  Prisma Studio operation while testing.
- Do not use real customer names, phone numbers, addresses, coordinates, bills,
  or photographs. Use maintainer-approved synthetic values prefixed with
  `UAT-<date>-<tester initials>`.
- Do not change staging or production data, VPN profiles, deployment settings,
  pricing, or provider configuration.
- Record the role, time, test ID, expected result, actual result, screenshot, and
  severity for every failure. Do not include passwords or exact GPS coordinates
  in screenshots or reports.

## 2. Scope expectations

The tester should not report the following deliberate boundaries as defects:

- The non-Pilot mobile application under `operations-mobile/` is excluded.
- Background location and route-history tracking are disabled. Pilot location is
  foreground-only and only for accepted or in-progress work.
- Copilot selection is an online, server-confirmed action; it is not queued
  offline.
- Fleet reserves the Primary Pilot, Drone, and LMV. The Primary Pilot selects the
  Copilot in the Pilot app. Admin may assign a Copilot directly as an override.
- Automatic assignment may be visible but greyed out while the policy is paused.
- The future Cluster/HUB/MINIHUB/SPOKE hierarchy is not implemented. The current
  `OperatingCenter` remains the scheduling and service-area authority.
- Play Store signing, raw datalogger/telemetry ingestion, tax invoices, and live
  WhatsApp/SMS/payment providers are outside this acceptance run.

## 3. Required test fixtures

The maintainer must privately provide these accounts; passwords must not be
written into this document:

- one active Admin;
- one active Sales Executive;
- one active Fleet Manager;
- one active Primary Pilot;
- one active candidate Copilot at the same operating center;
- optionally, a second Pilot at another operating center for rejection tests.

The local database also needs:

- at least two active operating centers;
- at least two schedulable Drones at the test center;
- at least two schedulable LMVs at the test center;
- one spare Drone and one spare LMV that are not linked to active work;
- current Pilot licence dates;
- imported/entered Crop, Spray Purpose, Cluster, Request Type, B2B category,
  Reporting Admin, and Lead Source master values.

Before testing, record the synthetic identifiers below:

| Fixture | Tester value |
|---|---|
| UAT prefix | |
| Admin account | |
| Sales account | |
| Fleet account | |
| Primary Pilot | |
| Candidate Copilot | |
| Test operating center | |
| Primary Pilot preferred Drone | |
| Primary Pilot preferred LMV | |
| Spare Drone | |
| Spare LMV | |

## 4. Defect severity

- **Blocker:** login is impossible, data is corrupted/lost, the lifecycle cannot
  proceed, or one role receives another role's authority.
- **High:** a core action fails without a safe alternative, conflicts are
  accepted, offline actions disappear, or an asset is incorrectly available.
- **Medium:** a supported action works incorrectly but has a safe workaround.
- **Cosmetic:** text, spacing, animation, alignment, or visual polish only.

## 5. Admin web checklist

### A-01 Authentication and role boundary

- [ ] A wrong password produces a clear error and does not open the dashboard.
- [ ] The correct Admin account opens the Admin workspace.
- [ ] Refreshing the page retains the valid session.
- [ ] Admin can open the Fleet scheduling board and return to the Admin workspace
      without logging out.
- [ ] Sign out invalidates the session and protected pages return to login.

### A-02 Navigation and capability superset

- [ ] Admin can reach Fleet Overview, Feasible Regions, Customer Registration,
      New Lead, Drones, Pilots, Live Pilot GPS, Assignments, Schedule assignments,
      Registered Customers, Lead Details, My Team, Auto-assignment policy,
      Maintenance requests, Master Data, and Profile.
- [ ] Admin can perform every operation Fleet or Sales can perform where the
      interface exposes that operation.
- [ ] No tab unexpectedly redirects to another role or requires re-login.

### A-03 Master data and forms

- [ ] Crop Type is a dropdown containing configured values.
- [ ] Spray Purpose is a dropdown—not a group of decorative buttons—and contains
      configured values.
- [ ] Cluster, Request Type, Reporting Admin, and Lead Source contain values.
- [ ] Selecting B2B reveals the B2B sub-category dropdown.
- [ ] Selecting B2C hides and clears the B2B sub-category.
- [ ] Required-field validation explains the missing field instead of silently
      failing.
- [ ] Do not permanently edit shared master values during this test.

### A-04 Team, Pilot preferences, and assets

- [ ] My Team shows the expected active accounts and roles.
- [ ] Pilot management shows available Drone and LMV choices.
- [ ] Assign a preferred Drone and preferred LMV to the Primary Pilot.
- [ ] Reopen the Pilot record and confirm both preferences persisted.
- [ ] Transfer an unused LMV to a second operating center after confirmation.
- [ ] Confirm an incompatible preferred-LMV link is cleared after transfer.
- [ ] Confirm an LMV attached to active work cannot be transferred.
- [ ] Retire only the designated spare LMV and confirm it remains visible as a
      retired historical record rather than disappearing.
- [ ] Confirm a retired LMV is absent from scheduling choices.
- [ ] Confirm a Drone/LMV in Maintenance or Out of Service is absent from
      scheduling choices.

### A-05 Scheduling as Admin

- [ ] Open a request from the manual scheduling queue.
- [ ] Select the Primary Pilot and confirm eligible preferred Drone/LMV values
      autofill when configured.
- [ ] Confirm Admin can explicitly select a Copilot or leave selection to the
      Primary Pilot.
- [ ] Save a valid service window and operational unit.
- [ ] Attempt to reuse a Pilot, Copilot, Drone, or LMV in an overlapping window;
      the server must reject it and preserve the previous schedule.
- [ ] Reorder a same-day job and confirm the server displays a normalized,
      contiguous daily sequence.
- [ ] Move or resize an eligible calendar job and confirm the change persists
      after refresh.
- [ ] Confirm terminal jobs are hidden by default and appear only when requested.
- [ ] Remove only a synthetic unscheduled request, enter a reason, and confirm it
      leaves the queue while its history remains available.

### A-06 Auto-assignment presentation

- [ ] The complete policy panel remains visible when automatic assignment is
      paused.
- [ ] The paused panel is visibly disabled/greyed, not missing.
- [ ] Fleet can read the policy but cannot save it.
- [ ] If Admin temporarily enables or edits the policy, record the original
      values first and restore them before ending the test.

### A-07 Maintenance accountability

- [ ] Maintenance requests have Open and History views.
- [ ] Each request identifies asset type, asset, reason, requester, time, and
      status.
- [ ] Accepting, rejecting, or resolving requires a meaningful note.
- [ ] The processing and resolving person's name remains visible afterward.
- [ ] A request cannot be processed twice through incompatible transitions.
- [ ] Returning an asset to service is rejected while its related mission is
      still non-terminal.
- [ ] A safely resolved, unassigned asset can return to service and then reappear
      in eligible scheduling choices.

### A-08 Audit and operational visibility

- [ ] Lead Details shows the synthetic request lifecycle in chronological order.
- [ ] Assignment changes, removals, asset changes, and maintenance processing
      identify the acting staff member without exposing credentials or exact GPS.
- [ ] Live Pilot GPS does not show an unassigned or merely available Pilot.
- [ ] Accepted/in-progress work can show a recent Pilot sample.
- [ ] Completing/flagging the mission clears live tracking visibility.

## 6. Fleet Manager web checklist

### F-01 Authentication and least privilege

- [ ] Fleet login opens the Fleet workspace.
- [ ] Fleet cannot open Admin account/master-data management through navigation
      or a copied Admin URL.
- [ ] Fleet can access scheduling, Pilot/asset views, maintenance requests, and
      live location needed for operations.

### F-02 Manual scheduling

- [ ] The manual queue scrolls internally and does not make the whole page grow
      without bound.
- [ ] A request can be opened with keyboard focus and Enter—not only a mouse.
- [ ] Fleet selects Primary Pilot, Drone, LMV, start, and end.
- [ ] Fleet does **not** receive a Copilot override selector; the UI explains that
      the Primary Pilot chooses the Copilot.
- [ ] Selecting a Primary Pilot autofills eligible preferred assets.
- [ ] A missing/maintenance/other-center preference does not autofill and a valid
      alternative remains selectable.
- [ ] Saving creates exactly one assignment and removes the request from the
      manual queue.

### F-03 Calendar and conflict control

- [ ] Month, week, and day views load without unbounded network requests.
- [ ] Calendar cards show the correct request and Pilot.
- [ ] Drag/drop and resize feel responsive and settle cleanly without jumping.
- [ ] Refresh confirms the edited service window persisted.
- [ ] An overlapping crew/Drone/LMV edit is rejected with a useful message.
- [ ] The original persisted window remains unchanged after rejection.

### F-04 Fleet and maintenance

- [ ] Available, Assigned, Maintenance, and Out-of-Service states are clear.
- [ ] Fleet can transfer only an inactive Pilot/unused LMV between centers.
- [ ] Fleet can accept or resolve a Pilot-created maintenance request with notes.
- [ ] Admin later sees the Fleet Manager's processor identity.
- [ ] Fleet cannot return an asset to service while an active/flagged mission
      still references it.

## 7. Sales Executive web checklist

### S-01 Authentication and least privilege

- [ ] Sales login opens the Sales workspace.
- [ ] Sales cannot access Admin team/master controls, Fleet scheduling mutations,
      or maintenance processing using navigation or copied URLs.

### S-02 Customer registration and duplicate safety

- [ ] Register a synthetic customer with all required location/language fields.
- [ ] A truthful success message appears only after the server accepts it.
- [ ] The new customer immediately appears in Registered Customers/search.
- [ ] Submit the same canonical phone again.
- [ ] The UI reports rejection or safe reconciliation; it must not falsely claim a
      second customer was created.
- [ ] Search confirms there is only one canonical customer identity.
- [ ] Cluster and Cluster Type are manually selectable where currently exposed.

### S-03 New Lead

- [ ] Open **New Lead** and select the registered synthetic customer.
- [ ] Seasonal Crop, chemical brand, chemical proof, discount, and manual Drone
      number fields are absent.
- [ ] Crop Type and Spray Purpose are populated dropdowns.
- [ ] B2C can be submitted without a sub-category.
- [ ] B2B requires and preserves a B2B sub-category.
- [ ] Cluster, Reporting Admin, and Lead Source are selectable and persist.
- [ ] The selected preferred language is accepted; no unexplained `ta`, `en`, or
      schema-validation error appears.
- [ ] An in-area request is accepted and linked to the correct operating center.
- [ ] An out-of-area synthetic request is clearly declined and does not enter the
      scheduling queue.
- [ ] The accepted request appears in Lead Details and progresses to processing/
      manual scheduling as policy dictates.

## 8. Admin web application on a physical phone

Use the LAN URL supplied by the maintainer. Do not use the non-Pilot Android
application for this section.

- [ ] Login works in Chrome/Firefox on the phone.
- [ ] Navigation is horizontally scrollable and every current Admin tab can be
      reached.
- [ ] Fleet Overview, My Team, Lead Details, Live Pilot GPS, Maintenance requests,
      and Master Data have no page-level horizontal overflow.
- [ ] Long lists scroll inside their intended region instead of stretching the
      entire page indefinitely.
- [ ] Forms remain usable when the virtual keyboard is open.
- [ ] Dropdowns, date/time fields, confirmation dialogs, and close buttons are
      tappable and not clipped.
- [ ] Portrait and landscape rotation do not hide unsaved form actions.
- [ ] The scheduling calendar remains contained on a phone/tablet. Use the manual
      form when precision drag/drop is unsuitable on a small touch screen.
- [ ] Sign out returns to login and Back does not reopen a protected screen.

## 9. End-to-end operational lifecycle

Use one synthetic request consistently through these steps:

1. [ ] Sales registers/searches the customer and creates an in-area request.
2. [ ] Sales/Admin confirms the request and master-data values in Lead Details.
3. [ ] Admin or Fleet schedules the Primary Pilot, Drone, LMV, and service window.
4. [ ] If Fleet scheduled it, the Primary Pilot sees **Select Copilot** and chooses
       one eligible same-center Pilot online.
5. [ ] If Admin assigned the Copilot, the Pilot sees the already formed crew.
6. [ ] Primary Pilot accepts the assignment.
7. [ ] Admin/Fleet sees foreground location only after accepted/engaged work and
       while the Pilot app is open with permission.
8. [ ] Primary Pilot completes all pre-flight checks and starts the mission.
9. [ ] Primary Pilot completes with a valid positive actual acreage.
10. [ ] Admin/Fleet sees Completed and no longer sees live location.
11. [ ] The Drone and LMV return to their correct schedulable state unless an
        issue explicitly placed one into maintenance.
12. [ ] Lead Details/Audit shows customer intake, scheduling, crew formation,
        acceptance, start, completion, actor identities, and timestamps.

## 10. RFLY Pilot Android checklist

Use a physical Android phone. Browser/Expo web mode is useful for visual work but
does not prove SQLite, SecureStore, Android location permission, or native
restart behaviour.

### P-01 Installation, login, and restart

- [ ] Install/open the maintainer-approved development APK or Expo build.
- [ ] Wrong password gives an authentication error, not “server unreachable.”
- [ ] Correct active Pilot credentials load the Pilot profile and assignments.
- [ ] Close the app fully and reopen it; no `NativeDatabase.execAsync`
      NullPointerException appears.
- [ ] Re-login/reopen does not produce an unexplained HTTP 409.
- [ ] Logout clears the session; another Pilot cannot see the previous Pilot's
      cached assignments.

### P-02 Availability and assignment eligibility

- [ ] Profile shows the animated Available/Offline control.
- [ ] Setting Offline persists after refresh and prevents new assignment.
- [ ] Setting Available restores eligibility.
- [ ] Trying to go Offline with scheduled/engaged work is rejected clearly.

### P-03 Assignment and crew formation

- [ ] A newly scheduled job appears after pull-to-refresh/Sync Now.
- [ ] Farmer, farm, window, expected acreage, Primary Pilot, Drone, and LMV are
      correct.
- [ ] Primary Pilot sees eligible Copilot candidates for Fleet-scheduled work.
- [ ] Self-selection, cross-center, expired/unavailable, or conflicting candidates
      are excluded/rejected.
- [ ] Confirming the Copilot updates the crew after sync.
- [ ] Copilot selection while offline is not falsely queued as successful.

### P-04 Mission state and validation

- [ ] Accept is available only after crew formation is ready.
- [ ] Start is unavailable until acceptance.
- [ ] Start requires all displayed pre-flight checks.
- [ ] Complete is unavailable until In Progress.
- [ ] Completion rejects empty, zero, negative, or over-precision acreage.
- [ ] Valid completion synchronizes once and does not duplicate on repeated taps or
      reconnects.
- [ ] Rejecting an offered assignment requires a reason and sends it back for
      visible manual rescheduling.

### P-05 Foreground location

- [ ] Before acceptance, Admin/Fleet cannot monitor the Pilot.
- [ ] On accepted/in-progress work, Android asks for foreground permission.
- [ ] With permission and the app open, Admin/Fleet receives a recent location.
- [ ] Denial gives a clear local status without crashing the app.
- [ ] Backgrounding/closing the app stops foreground-only tracking.
- [ ] Completion or issue reporting clears live location on the server.

### P-06 Offline persistence and replay

Start this test online and synchronize the assignment first.

- [ ] Enable airplane mode; the securely cached assignment remains readable.
- [ ] Queue one permitted mission action and confirm it is visible in the Sync tab
      as pending rather than falsely reported as server-complete.
- [ ] Close/reopen without uninstalling; cached work and the pending action remain.
- [ ] Restore connectivity and press Sync Now.
- [ ] The pending action becomes applied once, the assignment refreshes, and no
      duplicate server transition appears.
- [ ] A server conflict remains visible and is not silently discarded.
- [ ] Do not uninstall the app as an offline-recovery procedure; report any case
      that appears to require it as High severity.

### P-07 Drone and LMV issue reporting

Use a separate synthetic accepted/in-progress assignment because reporting an
asset problem flags that mission.

- [ ] Drone malfunction offers quick reasons such as Battery not charged and
      Propeller damaged plus a custom note.
- [ ] LMV malfunction offers Vehicle breakdown, Tyre, Engine, Electrical, Other,
      plus a custom note.
- [ ] Notes reject empty input and avoid exact coordinates.
- [ ] After synchronization, the affected asset immediately becomes unavailable
      for scheduling; the unaffected asset is not incorrectly quarantined.
- [ ] Admin/Fleet sees the Pending maintenance request.
- [ ] Admin/Fleet accepts/resolves it with notes and the actor identity persists.
- [ ] Pilot refresh shows the maintenance status and processing person.
- [ ] The flagged mission and maintenance asset are not silently returned to
      normal service.

## 11. Completion criteria

Release 1 functional acceptance is successful when:

- every Blocker/High test passes;
- the complete synthetic lifecycle reaches Completed exactly once;
- role boundaries hold even with copied URLs;
- schedule conflicts are server-rejected;
- offline work is durable and reconciled visibly;
- maintenance quarantine and processor accountability are correct;
- desktop and mobile-browser layouts remain usable;
- all Medium/Cosmetic defects are recorded with reproducible evidence.

## 12. Local startup — current maintainer workstation

These commands start the current source locally. They do not deploy anything.
Use PowerShell and replace the sample LAN address with the laptop's active
Wi-Fi/Ethernet IPv4 address from `ipconfig`.

### Terminal 1 — PostgreSQL

Start Docker Desktop from Windows, then:

```powershell
docker info
docker start rfly-postgres
docker ps --filter "name=rfly-postgres"
Test-NetConnection 127.0.0.1 -Port 5432
```

`docker start` is harmless when the existing local container is already
running. Do not create another database container and do not run a reset/seed.

### Terminal 2 — backend

```powershell
$repo = 'D:\projects\Daas--main\Daas--main'
$lanIp = '192.168.1.7' # replace using ipconfig

Set-Location "$repo\backend"
npx prisma migrate deploy

$env:CORS_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://${lanIp}:5173"
$env:MOBILE_API_ENABLED = 'true'

npm start
```

Keep this terminal open. Expected output includes `Server running on port 5000`.
If dependencies have never been installed, run `npm ci` once before the
migration. Never run `prisma migrate reset`, `prisma db push`, a seed, or the
initial-Admin bootstrap against the existing local test database.

### Terminal 3 — web frontend

```powershell
$repo = 'D:\projects\Daas--main\Daas--main'
$lanIp = '192.168.1.7' # same address used above

Set-Location "$repo\frontend"
$env:VITE_API_URL = "http://${lanIp}:5000"
npm run dev -- --host 0.0.0.0 --port 5173
```

If dependencies have never been installed, run `npm ci` once first. Open:

- laptop: `http://localhost:5173`
- physical phone on the same LAN: `http://<LAN-IP>:5173`
- API health from either device: `http://<LAN-IP>:5000/api/health`

Allow Node/Docker on **Private networks** if Windows Firewall prompts. Do not
open these development ports on a public network or router.

### Terminal 4 — Pilot app through Expo

```powershell
$repo = 'D:\projects\Daas--main\Daas--main'
$lanIp = '192.168.1.7' # same address used above

Set-Location "$repo\pilot-mobile"
$env:RFLY_APP_VARIANT = 'development'
$env:EXPO_PUBLIC_API_URL = "http://${lanIp}:5000"
npm start -- --lan --clear
```

Run `npm ci` once first on a new checkout. Scan the QR code with the supported
Expo Go/development client while the phone is on the same LAN. Do not use `w`
as native acceptance evidence; browser mode does not prove Android SQLite,
SecureStore, or location behaviour.

## 13. New tester starting instructions

The preferred arrangement is for the maintainer to start PostgreSQL, backend,
frontend, and Expo. The tester should not need shell, database, Git, or server
access.

Give the tester only:

1. the local web URL;
2. the Expo QR/development build;
3. role credentials through a private channel;
4. the approved synthetic-data prefix;
5. this checklist and a defect-report sheet.

Tester procedure:

1. Connect laptop/phone to the same private Wi-Fi as the maintainer laptop.
2. Open `http://<LAN-IP>:5000/api/health`; stop and report if it is not healthy.
3. Open `http://<LAN-IP>:5173` in a normal browser.
4. Use separate private/incognito windows for Admin, Fleet, and Sales so sessions
   do not overwrite each other.
5. Test one role section at a time, then perform the shared lifecycle.
6. On Android, scan the Expo QR/open the approved build and use only the assigned
   synthetic Pilot account.
7. Report failures; do not attempt database cleanup or reinstall the Pilot app as
   a fix.

## 14. Fast troubleshooting

| Symptom | Maintainer check |
|---|---|
| Database connection fails | `docker ps --filter "name=rfly-postgres"` and `Test-NetConnection 127.0.0.1 -Port 5432` |
| Browser says server error | Check backend terminal, then `Invoke-RestMethod http://127.0.0.1:5000/api/health` |
| Backend logs `origin_denied` | Correct `CORS_ALLOWED_ORIGINS` and restart backend |
| Phone cannot open health URL | Confirm LAN IP, same private Wi-Fi, VPN state, and Windows Private-network firewall permission |
| Web loads but API uses wrong host | Set `VITE_API_URL` before starting Vite, then restart Vite |
| Pilot says API unreachable | Open the same API health URL on the phone; confirm `EXPO_PUBLIC_API_URL` and restart Expo |
| Pilot API returns disabled/not found | Set `MOBILE_API_ENABLED=true` before starting/restarting backend |
| Login fails for every role | Confirm the accounts belong to this local database; do not seed/reset to repair credentials |
| UI appears stale | Stop only Vite/Expo with `Ctrl+C`, restart with `--clear` for Expo, and reload |

Stop backend, Vite, and Expo with `Ctrl+C` in their terminals. PostgreSQL may stay
running for continued local work; stop it only when desired with
`docker stop rfly-postgres`.

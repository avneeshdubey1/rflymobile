# Implementation Walkthrough (Phase I - Pilot Workflow)

We have successfully completed the second half of Phase I: The Pilot Operations and Cost Verification Engine!

## 1. Auto-Assignment Engine
- **The Fleet**: The backend now maintains a mock database of RFLY drones (`drones.json`) tracking their status (`Active`, `Maintenance`, `Standby`) and GPS location.
- **The Matchmaker**: When the Sales Rep clicks "Submit to Google Form", the backend simultaneously scans the drone database, grabs an `Active` drone, and assigns it to a Pilot. 

## 2. The Pilot App (`/pilot`)
The Pilot Dashboard is now fully functional and simulates a mobile app interface:
- **Mission Feed**: Pilots log in and immediately see their assigned Spraying Tasks.
- **Acceptance & Issue Reporting**: 
  - A pilot can click **Accept & Start Mission**.
  - If something goes wrong in the field (e.g., Battery Failure), the pilot can click **Report Battery Issue**. The system will immediately flag the current drone as `Maintenance` and automatically suggest a swap to a nearby `Standby` drone.
- **Mission Completion**: Once done, the pilot types in the exact Acres sprayed and clicks **Complete**.

## 3. Cost Discrepancy Engine (Sales/Admin Dashboard)
- **The Math**: When the pilot completes a mission, the backend takes their manually entered acres and compares it against our mock "GPS Logger Data" (simulating a 10% DCS data difference for testing).
- **The Alerts**: If the difference is greater than 5%, the backend flags it as a "High Severity Discrepancy".
- **The Escalation UI**: If you log into the Sales Dashboard (`sales@rfly.com`), you will now see a bright red **SYSTEM ALERT** box at the top alerting you to any Pilots who have reported Drone Issues or triggered a High Cost Discrepancy!

### How to Test This Right Now:
1. Restart your Node backend server.
2. Go to the Sales dashboard (`http://localhost:5174/marketing`) and submit a pending lead to Google Forms. (This will trigger the auto-assignment).
3. Log out and log back in as `pilot@rfly.com` (`password123`).
4. You will see your new mission! Click **Accept**.
5. To test the **Discrepancy Engine**: Enter `10` acres and click Complete. Since the backend simulates the drone only logging `9` acres, this 10% discrepancy will trigger a flag!
6. Log back into the Sales dashboard and look at the top for the red **SYSTEM ALERT**!

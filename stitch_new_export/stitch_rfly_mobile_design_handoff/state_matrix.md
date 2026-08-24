# RFLY State Matrix

| ID | Screen Name | Loading | Empty | Offline/Queued | Conflict/Error | Success/Applied |
|----|-------------|---------|-------|----------------|----------------|-----------------|
| PF-01 | Login | Spinner | N/A | "No connection" banner | "Invalid credentials" | Navigate to Work |
| PF-03 | Work List | Skeletons | "No work assigned" | "Showing cached data" | Sync Error toast | List populated |
| PF-04 | Detail | Skeletons | N/A | Banner: Read-only | N/A | Data visible |
| PF-05 | Accept | Button Loading | N/A | "Action queued" | "Server conflict" | "Accepted" |
| PF-06 | Copilot Select| List Spinner | "No candidates" | "Offline: Cannot load" | "Selection failed" | Navigate to Confirm|
| PF-10 | Report Issue | Button Loading | N/A | "Issue queued" | "Submission failed" | "Issue reported" |
| PF-11 | Complete | Button Loading | N/A | "Completion queued" | "Validation error" | "Work finished" |
| PF-12 | Sync Status | List Spinner | "All actions synced"| Live queue | Retry/Manual review | Action removed |

# RFLY Operations Navigation Map

## Top-Level Destinations (Bottom Tabs)
1. **Home:** `OP-02 Operations Home` (Default)
2. **Customers:** `OP-03 Customer Search`
3. **Schedule:** `OP-07 Daily Fleet Schedule`
4. **Exceptions:** `OP-08 Exceptions`
5. **Profile:** `OP-10 Profile`

## Authorized Flows

### Sales/Admin: Customer Management
- **Search:** `OP-03`
- **Registration:** `OP-03` -> `OP-04` (New Customer)
- **Lead Intake:** `OP-04` -> `OP-05` (Create Lead) -> `OP-06` (Lead Outcome)

### Fleet Manager/Admin: Fleet Management
- **Schedule View:** `OP-07`
- **Exception Resolution:** `OP-08` (List) -> Resolve Action
- **Copilot Override:** `OP-07` -> `OP-09` (Select Assignment) -> Apply Override

### Shared
- **Authentication:** `OP-01` (Login/Startup) -> `OP-02`
- **Session/Security:** `OP-10`
- **System:** `OP-01` (Upgrade Required)
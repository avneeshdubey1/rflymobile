# History of Changes

## 1. Fleet Manager Dashboard Enhancements
- **Pilots Management**: Added a new "Pilots" tab in `FleetManagerDashboard.jsx` allowing Fleet Managers to view registered pilots, their active status, and the operating center they are assigned to. Included a form to register new pilots (which require admin approval to become active).
- **Drones Management**: Added a "Drones" tab in the dashboard for tracking the fleet. Fleet Managers can now view drone statuses, register new aircraft, and request or approve maintenance directly from the UI.
- **Backend Support**: Added necessary backend routes (`userRoutes.js` and `droneRoutes.js`) and controller logic (`userController.js` and `droneController.js`) to support adding and managing pilots and drones.

## 2. Admin Geo-fencing Capabilities
- **Operating Centers Setup**: Created `OperatingCenter` CRUD operations to manage geo-fenced zones. Added `centerController.js` and `centerRoutes.js` to expose these operations.
- **Visual Map Integration**: Implemented a comprehensive Admin Geo-fencing dashboard using `react-leaflet` to visualize Operating Centers on a map, complete with radius highlights representing active service areas.

## 3. Lead Intake & Auto-Assignment Pipeline
- **Business Logic Migration**: Consolidated the lead evaluation logic—including terrain risk checks (Mountainous, Flatland, etc.), water body buffer zone evaluations, and chemical proof validations—deep into `intakeService.js` so that all lead sources (Website, Google Forms, Manual) are processed uniformly.
- **Auto-Assignment Trigger**: Fixed a critical bug where verified leads were remaining in a `NEW` state without being assigned. The `intakeController.website` endpoint was updated to actively trigger the auto-assignment engine when a lead successfully evaluates to a `PROCESSED` state.
- **Fallback Workflows**: Ensured that leads failing certain criteria (e.g., claiming to have chemicals but lacking proof) are properly flagged as `MANUAL_CALL_REQUIRED` or `NEEDS_MANUAL_SCHEDULING`, routing them correctly to the Fleet Manager's manual queue.

## 4. Manual Scheduling Drag & Drop Fix
- **Race Condition Resolution**: Addressed a bug in `FleetManagerDashboard.jsx` where dropping a lead card onto a pilot's calendar failed to schedule the request. Removed a premature `onDragEnd` state cleanup that was clearing the dragged lead before React Big Calendar's `onDropFromOutside` handler could execute. The manual drag-and-drop scheduling now functions smoothly.

# RFLY Shared Design System (V1)

## 1. Visual Foundation
- **Primary Color:** Navy (#1A2B44) - Professional, deep, authoritative.
- **Secondary/Accent Color:** Safety Orange (#FF6B00) - High visibility for field actions, caution, and status.
- **Neutral Palette:** 
  - Background: #F8F9FA (Light Gray)
  - Surface: #FFFFFF (White)
  - Text Primary: #121212
  - Text Secondary: #5F6368
  - Disabled: #E0E0E0
- **Typography:** Sans-serif (Roboto or system default).
  - Heading: 24px Bold
  - Subheading: 18px Medium
  - Body: 16px Regular
  - Caption: 14px Regular
- **Spacing:** 8dp grid system.
- **Radius:** 8dp for cards and inputs; 24dp for large buttons.
- **Elevation:** Minimal (1-2dp) for surface cards to maintain high-contrast legibility.

## 2. Interactive States
- **Focus:** 2dp border in Safety Orange.
- **Disabled:** 0.38 opacity on elements; gray background for buttons.
- **Status Tokens:**
  - Success: #2E7D32 (Green)
  - Warning/Pending: #ED6C02 (Orange)
  - Blocked/Error: #D32F2F (Red)
  - Offline: #757575 (Gray)

## 3. Accessibility
- **Touch Targets:** Minimum 48x48dp for all interactive elements.
- **Contrast:** AA/AAA compliance for all text on background.
- **Dynamic Text:** Layouts use flex/wrap to accommodate font scaling and localized strings.

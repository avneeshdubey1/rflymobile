# RFLY Accessibility Specification

- **Target Size:** All buttons and touchable rows are minimum 48dp height/width.
- **Color Contrast:** Navy (#1A2B44) on White/Light Gray exceeds 4.5:1. Safety Orange on White text is checked for legibility.
- **Dynamic Text:** Containers use auto-layout to prevent text clipping at 200% zoom.
- **Focus Order:** Top-to-bottom, left-to-right. Skip navigation for main content not required (single-column mobile).
- **Labels:**
  - Icons have `aria-label` (e.g., "Call farm contact", "Open navigation").
  - Status chips describe state (e.g., "Ready for acceptance").
- **Announcements:** Screen transitions and success/error toasts must be announced by screen readers.

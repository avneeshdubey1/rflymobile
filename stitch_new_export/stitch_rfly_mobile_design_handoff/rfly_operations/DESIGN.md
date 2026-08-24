---
name: RFLY Operations
colors:
  surface: '#f8f9fa'
  surface-dim: '#D9DADB'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#EDEEEF'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#44474d'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4f5f7b'
  primary: '#04162e'
  on-primary: '#ffffff'
  primary-container: '#1a2b44'
  on-primary-container: '#8292b0'
  inverse-primary: '#b6c7e7'
  secondary: '#a04100'
  on-secondary: '#ffffff'
  secondary-container: '#fe6b00'
  on-secondary-container: '#572000'
  tertiary: '#12171b'
  on-tertiary: '#ffffff'
  tertiary-container: '#272b2f'
  on-tertiary-container: '#8e9297'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b6c7e7'
  on-primary-fixed: '#091c34'
  on-primary-fixed-variant: '#374762'
  secondary-fixed: '#ffdbcc'
  secondary-fixed-dim: '#ffb693'
  on-secondary-fixed: '#351000'
  on-secondary-fixed-variant: '#7a3000'
  tertiary-fixed: '#dfe3e8'
  tertiary-fixed-dim: '#c3c7cc'
  on-tertiary-fixed: '#181c20'
  on-tertiary-fixed-variant: '#43474c'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
  status-success: '#2E7D32'
  status-error: '#D32F2F'
  status-warning: '#ED6C02'
  status-offline: '#757575'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
  data-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '800'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 12px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
  touch-target-min: 48px
---

## Brand & Style

The design system for the Operations application is a high-density, professional expansion of the field-tested RFLY foundation. While the Pilot app prioritizes outdoor visibility, the Operations system focuses on **Corporate / Modern** precision for back-office tasks like fleet management, admin, and sales. It maintains a **Industrial / Functional** aesthetic that bridges the gap between field-ruggedness and data-heavy software.

The brand personality is authoritative, systematic, and reliable. It utilizes a structured visual hierarchy to manage complex information without overwhelming the user. The style emphasizes utility through "Safety-First" visual cues, ensuring that critical operational data is never obscured by decorative elements. The emotional response should be one of complete control and operational clarity.

## Colors

The palette is anchored by **Navy (#1A2B44)** as the primary brand color, representing authority and the core operational foundation. **Safety Orange (#FF6B00)** serves as the high-visibility secondary/accent color, reserved for primary actions, critical alerts, and operational triggers.

- **Primary (Navy):** Used for global navigation, headers, and structural components to provide a professional, grounded environment.
- **Secondary (Safety Orange):** Applied to call-to-action buttons, active selection states, and focus indicators.
- **Neutral (Light Gray):** The primary background color to reduce eye strain during long-form administrative sessions.
- **Surface Palette:** A range of grays from White (`#FFFFFF`) to Container-High (`#E7E8E9`) is used to create logical grouping and "Z-axis" hierarchy without relying on heavy shadows.

## Typography

This design system uses a dual-font strategy to separate intent. **Hanken Grotesk** is the primary typeface, chosen for its sharp geometry and modern professional tone. It handles all UI labels, navigation, and instructional text. 

**JetBrains Mono** is utilized for the "Data Layer." This includes acreage values, coordinates, fleet IDs, and telemetry readings. The monospaced nature prevents layout "jitter" when numbers update in real-time and provides a clear visual distinction between descriptive labels and technical data. 

For mobile-specific views, `display-lg` should scale down to `headline-md` for headers to maintain screen real estate for data tables.

## Layout & Spacing

The system is governed by a strict **8dp linear grid**. All spacing, component heights, and layout margins are multiples of 8. 

- **Desktop Operations:** Uses a fixed-sidebar fluid content area. The sidebar (Navy) houses capability-driven navigation. The main content area utilizes a 12-column grid for complex data dashboards.
- **Mobile/Responsive:** Transitions to a 4-column fluid grid with 16px side margins.
- **Spacing Rhythm:** Use `stack-md` (16px) for related items within a card and `stack-lg` (24px) to separate distinct functional sections. 
- **Data Density:** In Admin views, vertical padding may be reduced to 4px/8px within table rows to allow for high-information density, provided the overall touch target remains accessible.

## Elevation & Depth

This design system prioritizes **Tonal Layering** and **Bold Borders** over shadows to maintain clarity across various screen qualities.

- **Background:** Uses `#F8F9FA` as the canvas.
- **Container Level 1:** White (`#FFFFFF`) cards with a 1px solid border (`#EDEEEF`).
- **Active State:** Elements in focus or active use a 2px border in **Safety Orange**.
- **Sidebar/Navigation:** Uses a solid Navy surface to "pin" the navigation to the left, creating a clear vertical anchor.
- **Shadows:** Only used sparingly for floating action buttons or temporary overlays (modals), using a low-diffusion, high-opacity "Industrial" shadow: `0px 4px 0px rgba(0, 0, 0, 0.05)`.

## Shapes

The shape language reflects a balance between structural stability and modern ergonomics. 

- **Containers & Inputs:** Standardized at a **0.5rem (8px)** radius. This creates a boxy, dependable look that aligns with the 8dp grid.
- **Action Elements:** Primary buttons and chips use a **1.5rem (24px)** or "Pill" radius. This high degree of rounding differentiates "things you click" from "containers you read."
- **Icons:** Must use a 2px stroke weight with squared ends to match the Hanken Grotesk terminals.

## Components

### Buttons
- **Primary Action:** Pill-shaped, Safety Orange background, White text. Used for "Start Assignment," "Create User," or "Confirm."
- **System Action:** Pill-shaped, Navy background, White text. Used for secondary navigation or bulk edits.
- **Ghost:** Navy text, no background, 8px radius focus state. Used for "Cancel" or "Back."

### Data Tables
- Header: Navy background with White `label-caps` text.
- Rows: White background, 1px Gray divider, 48px minimum height.
- Data Cells: Use `data-sm` (JetBrains Mono) for numerical values.

### Input Fields
- Outlined 8px radius with a 2px stroke.
- Labels: Always visible, positioned above the field using `label-caps`.
- Validation: 2px Red border for errors with helper text below.

### Status Badges
- Solid background colors (Success-Green, Error-Red, Warning-Orange).
- Text: White, Bold, `label-caps`. 
- Shape: Pill-shaped.

### Capability Navigation
- Sidebar items: 48dp height, 16px horizontal padding.
- Active state: Safety Orange left-border (4px) and Navy-tinted background.

### Cards
- White surface, 1px border. 
- Assignments: Feature a 4px Navy left-border to denote a "Work" item.
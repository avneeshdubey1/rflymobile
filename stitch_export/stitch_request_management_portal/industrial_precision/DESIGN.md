---
name: Industrial Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#0d1c2f'
  on-tertiary-container: '#76859b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  rfly-blue: '#0F172A'
  safety-orange: '#F97316'
  status-success: '#166534'
  status-warning: '#9A3412'
  status-offline: '#475569'
  surface-slate: '#E2E8F0'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  headline-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  touch-target-min: 48px
  gutter: 16px
  margin-mobile: 20px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is engineered for "Industrial Precision," prioritizing utility, clarity, and reliability for outdoor drone operations. It is designed for pilots and operational staff who require split-second information processing under challenging environmental conditions, such as high-glare sunlight or low-connectivity zones.

The visual style is **Corporate / Modern** with a **Minimalist** focus on information density. It avoids decorative flourishes in favor of functional aesthetics.
- **Narrative:** Professional, dependable, and technically advanced.
- **Target Audience:** Field pilots, fleet managers, and operations coordinators.
- **Emotional Response:** Efficiency, safety, and operational control.
- **Visual Strategy:** High-contrast elements ensure readability; a "data-first" hierarchy uses progressive disclosure to manage complexity without overwhelming the user.

## Colors

This design system utilizes a high-contrast palette specifically calibrated for outdoor visibility.
- **RFLY Blue (Primary):** A deep navy used for core structural elements, navigation, and primary headers to provide a grounded, professional feel.
- **Safety Orange (Secondary):** Reserved strictly for critical actions, alerts, and active mission states. Its high visibility ensures it stands out against any background.
- **Neutral Slates:** A range of grays from `#F8FAFC` to `#334155` are used to create "Surface-Container" tiers, helping to organize information without adding visual weight.
- **Functional Colors:** Success, warning, and offline states use reinforced, darker shades of green, orange, and gray to maintain WCAG AA contrast ratios against light backgrounds.

## Typography

The typography system is built for legibility and data precision.
- **Primary Typeface:** **IBM Plex Sans** is used for its technical yet approachable character, providing excellent readability across different screen densities.
- **Data Typeface:** **JetBrains Mono** is employed for all telemetry, coordinates, and numeric figures. Its monospaced nature ensures that jumping numbers (e.g., battery % or acreage) stay aligned and are easy to scan.
- **Hierarchy:** Use `label-caps` for section headers and metadata labels to distinguish them clearly from interactive body text. 
- **Tabular Figures:** Ensure `font-variant-numeric: tabular-nums` is active for all numeric displays to prevent layout shift during live data updates.

## Layout & Spacing

The layout utilizes a **fluid grid** model optimized for the physical constraints of field work.
- **Touch Targets:** A strict minimum of 48x48px for all interactive elements to accommodate gloved hands or movement.
- **Rhythm:** A 4px baseline grid governs all spacing. Vertical stacks typically use 16px (`stack-md`) to separate logical groups, while related labels and data use 8px (`stack-sm`).
- **Margins:** A 20px outer margin on mobile devices provides a "safe zone" for thumb interaction and prevents content from feeling cramped near bezel edges.
- **Content Density:** In the Operations app, density may increase slightly, but the Pilot app must maintain generous whitespace to reduce cognitive load during flight operations.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Low-contrast outlines** rather than heavy shadows, which can wash out in direct sunlight.
- **Surface Levels:** The base level is the lightest (`#F8FAFC`). Cards and secondary containers use a subtle border (`1px solid #E2E8F0`) or a slightly darker fill to denote containment.
- **Active States:** Active mission cards use a thicker 2px left-border of `Safety Orange` to signal "live" status.
- **Interactive Depth:** Only the primary action buttons and floating action buttons (FABs) use a tight, high-opacity ambient shadow to suggest clickability. All other elements remain flat to maintain clarity.

## Shapes

The shape language is **Soft (0.25rem)**, reflecting an industrial, hardware-adjacent aesthetic. 
- **Buttons and Inputs:** Use the standard 4px (`0.25rem`) radius. This provides a clean, "machined" look that feels more rugged than fully rounded UI.
- **Status Chips:** Use a slightly higher `rounded-lg` (8px) to distinguish them from interactive buttons.
- **Selection States:** Indicators for selected pilots or drones should use sharp corners or very minimal rounding to suggest "locking" into place.

## Components

- **Buttons:** Primary buttons use `RFLY Blue` with white text. Critical mission buttons (Start/Stop) use `Safety Orange`. All buttons must meet the 48px height requirement.
- **Status Chips:** Compact indicators with a background tint and high-contrast text. 
    - *Success:* Green background, Dark Green text.
    - *Warning:* Orange background, Dark Orange text.
    - *Offline:* Slate background, White text.
- **Progressive Disclosure Lists:** Use "Summary Cards" that show the most vital data (Acreage, Status, Time). Tapping expands the card downward to reveal secondary details (Farmer info, LMV details) without navigating away.
- **Input Fields:** Heavy 1.5px borders in `Tertiary Slate`. Use Large labels above the field. Numeric inputs should always trigger a decimal-pad keyboard.
- **Bottom Navigation:** Fixed, high-contrast bar using `RFLY Blue`. Active icons are highlighted in `Safety Orange` with clear text labels to ensure no ambiguity.
- **Progress Bars:** Thick, 8px bars for synchronization and upload states, using `Safety Orange` to indicate progress against a `Surface Slate` track.
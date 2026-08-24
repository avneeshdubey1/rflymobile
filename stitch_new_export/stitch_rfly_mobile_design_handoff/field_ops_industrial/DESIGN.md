---
name: Field Ops Industrial
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#5a4136'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#4f5f7b'
  on-secondary: '#ffffff'
  secondary-container: '#ccdefe'
  on-secondary-container: '#51617d'
  tertiary: '#5b5f64'
  on-tertiary: '#ffffff'
  tertiary-container: '#95999f'
  on-tertiary-container: '#2d3136'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#b6c7e7'
  on-secondary-fixed: '#091c34'
  on-secondary-fixed-variant: '#374762'
  tertiary-fixed: '#dfe3e8'
  tertiary-fixed-dim: '#c3c7cc'
  on-tertiary-fixed: '#181c20'
  on-tertiary-fixed-variant: '#43474c'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
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
  touch-target-min: 48px
  margin-mobile: 16px
  gutter: 12px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style

The design system is engineered for high-stakes agricultural environments where clarity and reliability are paramount. The brand personality is professional, rugged, and functional, prioritizing utility over decoration. It adopts a **Corporate / Modern** aesthetic with **High-Contrast** elements to ensure the interface remains legible under direct sunlight during field operations. 

The emotional response is one of confidence and precision. By utilizing heavy weights, structured layouts, and a "safety-first" visual hierarchy, the system communicates that it is a tool rather than an entertainment app. Every visual choice is optimized for the physical constraints of outdoor drone piloting: high glare, gloved interaction, and the need for rapid data processing.

## Colors

This design system utilizes a high-visibility palette optimized for outdoor use. 

- **Primary (Safety Orange):** Reserved strictly for primary actions, critical flight controls, and active states. It provides maximum contrast against the sky and field environments.
- **Secondary (Navy):** Used for structural elements, headers, and primary navigation to provide a grounded, professional feel.
- **Tertiary (Gray):** Applied to secondary information and supporting text to maintain a clear hierarchy.
- **Background (Light Gray):** A slightly off-white neutral to reduce screen glare compared to pure white.

Status colors (Green, Red, Orange, Gray) follow industrial standards for immediate recognition of drone health and mission status.

## Typography

The typography system prioritizes numerical clarity and rapid scanning. 

- **Hanken Grotesk** is used for all UI labels and headings due to its sharp, contemporary geometry and high legibility at various weights.
- **JetBrains Mono** is introduced specifically for telemetry data, coordinates, and sensor readings. The monospaced nature ensures that fluctuating numbers do not cause layout shifts and remain distinct from descriptive text.
- **Hierarchy:** Use `label-caps` for section headers and "all-caps" treatments on small buttons. Use `display-lg` for critical flight metrics (e.g., Altitude, Battery %).

## Layout & Spacing

The design system is built on a strict **8dp grid** to ensure mathematical alignment and consistency. 

- **Touch Targets:** All interactive elements must maintain a minimum height/width of 48dp to accommodate use in outdoor environments or while wearing thin work gloves.
- **Margins:** A standard 16px side margin is used for mobile layouts.
- **Density:** While the style is rugged, the layout avoids unnecessary clutter. Use generous vertical stacking (`stack-lg`) between unrelated functional groups to prevent accidental taps.
- **Grid:** Use a 4-column fluid grid for mobile, where cards typically span the full width (4 columns) to maximize the tap area for data entries.

## Elevation & Depth

This design system avoids complex shadows and blurs which wash out in high-brightness environments. Instead, it uses **Bold Borders** and **Tonal Layers** to create depth.

- **Flat Surface:** The primary background uses the neutral light gray.
- **Surface Cards:** Interactive or grouped content resides on pure white cards with a 2px solid border (`#D1D5DB` or secondary Navy for active states).
- **No Shadows:** Shadows are disabled to ensure the interface remains crisp and high-contrast. Depth is communicated through thickness of borders and intentional color blocking.

## Shapes

The shape language balances the "rugged" aesthetic with modern ergonomics.

- **Standard Elements:** Cards and input fields use a **0.5rem (8px)** radius to provide a structural, solid feel.
- **Buttons:** Primary action buttons utilize a **24px (Pill)** radius, creating a distinct visual difference between "containers" and "actions."
- **Icons:** Use thick-stroke (2px minimum) icons with squared terminals to match the professional tone.

## Components

### Buttons
- **Primary:** Solid Safety Orange background, White text, 24px radius. High-impact for "Take Off" or "Return to Home."
- **Secondary:** Solid Navy background, White text. Used for system settings or configuration.
- **Outline:** 2px Navy border with Navy text for non-critical actions.

### Cards
- High-contrast white containers.
- 2px border in Light Gray (`#E0E0E0`).
- Internal padding of 16px.

### Input Fields
- Outlined style with 2px stroke.
- Focused state uses the Secondary Navy color for the border.
- Floating labels to ensure context is never lost during data entry.

### Status Chips
- Bold, solid background colors (Green, Red, Orange, Gray).
- White, bold text using `label-caps` typography.
- Used for "GPS Lock," "Battery Health," and "Signal Strength."

### Telemetry Readouts
- Specialized component using a Navy background and JetBrains Mono text in White or Safety Orange. 
- Designed for maximum contrast against map backgrounds or video feeds.

### List Items
- 64dp minimum height.
- Explicit dividers (1px solid) between items to define touch boundaries.
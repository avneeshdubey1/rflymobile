---
name: Industrial Precision
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container-medium: '#eef1f4'
  surface-container-high: '#e5e9ed'
  surface-container-highest: '#dce1e6'
  on-surface: '#0f172a'
  on-surface-variant: '#475569'
  primary: '#0f172a'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#f1f5f9'
  secondary: '#f97316'
  on-secondary: '#ffffff'
  secondary-container: '#ffedd5'
  on-secondary-container: '#7c2d12'
  outline: '#94a3b8'
  outline-variant: '#cbd5e1'
  error: '#dc2626'
  on-error: '#ffffff'
  success: '#16a34a'
  on-success: '#ffffff'
  warning: '#ca8a04'
  on-warning: '#ffffff'
  surface-container: '#f0edef'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  surface-tint: '#565e74'
  inverse-primary: '#bec6e0'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
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
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#fcf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
typography:
  font-family: IBM Plex Sans
  headline-lg: 700 24px/32px IBM Plex Sans
  headline-md: 700 20px/28px IBM Plex Sans
  headline-sm: 700 16px/24px IBM Plex Sans
  body-lg: 400 16px/24px IBM Plex Sans
  body-md: 400 14px/20px IBM Plex Sans
  body-sm: 400 12px/16px IBM Plex Sans
  label-lg: 500 14px/20px IBM Plex Sans
  label-md: 500 12px/16px IBM Plex Sans
  label-sm: 500 11px/16px IBM Plex Sans
spacing:
  margin-mobile: 16px
  gutter-mobile: 12px
  stack-lg: 24px
  stack-md: 16px
  stack-sm: 8px
  touch-target-min: 48px
shape:
  roundness: 4px
  touch-target-min: 48px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
---

# Industrial Precision Design System

## Core Principles
1. **High Contrast:** Navy and Safety Orange on neutral backgrounds for maximum sunlight readability.
2. **Field Safety:** Minimum 48dp touch targets for outdoor use.
3. **Compact Information:** Summaries followed by progressive detail.
4. **State Clarity:** Explicit indicators for offline, synced, and conflict states.

## Components
- **Buttons:** Large, high-contrast with clear icons. 48dp height minimum.
- **Cards:** Subtle borders, no heavy shadows, clear type hierarchy.
- **Status Chips:** High-contrast backgrounds with semantic colors (Safety Orange for warnings/actions).
- **Offline Banner:** Sticky top-level indicator for synchronization status.
- **Input Fields:** Outlined with 1px stroke, clear labels, and error states.
export const colors = {
  primary: "#1A2B44", // Navy
  accent: "#FF6B00", // Safety Orange
  background: "#F8F9FA",
  surface: "#FFFFFF",
  textPrimary: "#121212",
  textSecondary: "#5F6368",
  disabled: "#E0E0E0",
  status: {
    success: "#2E7D32",
    warning: "#ED6C02",
    error: "#D32F2F",
    offline: "#757575",
  },
};

export const typography = {
  heading: { fontSize: 24, fontWeight: "bold" as const },
  subheading: { fontSize: 18, fontWeight: "500" as const }, // Medium
  body: { fontSize: 16, fontWeight: "normal" as const },
  caption: { fontSize: 14, fontWeight: "normal" as const },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 24,
};

export const touchTargets = {
  minSize: 48,
};

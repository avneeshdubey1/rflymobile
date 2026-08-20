import React from "react";
import {
  ActivityIndicator,
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { colors, typography, radius, spacing, touchTargets } from "./tokens";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  let backgroundColor = colors.accent;
  let textColor = colors.surface;
  let borderColor = "transparent";
  let borderWidth = 0;

  if (variant === "secondary") {
    backgroundColor = "transparent";
    textColor = colors.primary;
    borderColor = colors.primary;
    borderWidth = 1;
  } else if (variant === "destructive") {
    backgroundColor = "transparent";
    textColor = colors.status.error;
    borderColor = colors.status.error;
    borderWidth = 1;
  }

  if (disabled) {
    backgroundColor = colors.disabled;
    textColor = colors.textSecondary;
    borderColor = "transparent";
    borderWidth = 0;
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor, borderColor, borderWidth },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

interface StatusChipProps {
  label: string;
  status: "success" | "warning" | "error" | "offline" | "info";
}

export function StatusChip({ label, status }: StatusChipProps) {
  let backgroundColor = colors.background;

  if (status === "success") backgroundColor = colors.status.success;
  else if (status === "warning") backgroundColor = colors.status.warning;
  else if (status === "error") backgroundColor = colors.status.error;
  else if (status === "offline") backgroundColor = colors.status.offline;
  else if (status === "info") backgroundColor = colors.primary;

  return (
    <View style={[styles.statusChip, { backgroundColor }]}>
      <Text style={styles.statusChipText}>{label}</Text>
    </View>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

interface BannerProps {
  tone: "offline" | "error" | "success" | "info";
  title: string;
  message?: string;
}

export function Banner({ tone, title, message }: BannerProps) {
  const palette = {
    offline: {
      color: colors.status.offline,
      background: "#EEEEEE",
      icon: "cloud-off" as const,
    },
    error: {
      color: colors.status.error,
      background: "#FFEBEE",
      icon: "error-outline" as const,
    },
    success: {
      color: colors.status.success,
      background: "#E8F5E9",
      icon: "check-circle-outline" as const,
    },
    info: {
      color: colors.primary,
      background: "#E8EEF8",
      icon: "info-outline" as const,
    },
  }[tone];

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: palette.background, borderColor: palette.color },
      ]}
    >
      <MaterialIcons name={palette.icon} size={24} color={palette.color} />
      <View style={styles.bannerCopy}>
        <Text style={[styles.bannerTitle, { color: palette.color }]}>
          {title}
        </Text>
        {message ? <Text style={styles.bannerMessage}>{message}</Text> : null}
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name="assignment" size={40} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTargets.minSize,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    width: "100%",
  },
  buttonText: {
    ...typography.subheading,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: "flex-start",
  },
  statusChipText: {
    ...typography.caption,
    color: colors.surface,
    fontWeight: "bold",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  banner: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerCopy: {
    flex: 1,
  },
  bannerTitle: {
    ...typography.subheading,
    fontWeight: "700",
  },
  bannerMessage: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl * 2,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.subheading,
    color: colors.primary,
    marginTop: spacing.md,
    fontWeight: "700",
  },
  emptyMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});

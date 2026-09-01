import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Assignment, MutationRequest } from "../src/contracts/mobile-api";
import { getAssignment } from "../src/lib/database";
import { useAuthStore } from "../src/store/auth";
import { useSyncStore } from "../src/store/sync";
import { Banner, Button } from "../src/design-system/components";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../src/design-system/tokens";

const categories = [
  ["DRONE_MALFUNCTION", "Drone malfunction"],
  ["LMV_MALFUNCTION", "LMV / vehicle malfunction"],
  ["SAFETY_HAZARD", "Safety hazard"],
  ["WEATHER_BLOCKER", "Weather blocker"],
  ["CUSTOMER_BLOCKER", "Customer blocker"],
  ["OTHER", "Other"],
] as const;

type Category = (typeof categories)[number][0];

const maintenanceReasons = {
  DRONE_MALFUNCTION: [
    ["BATTERY_NOT_CHARGED", "Battery not charged"],
    ["PROPELLER_DAMAGED", "Propeller damaged"],
    ["ELECTRICAL_ISSUE", "Electrical issue"],
    ["OTHER", "Other"],
  ],
  LMV_MALFUNCTION: [
    ["VEHICLE_BREAKDOWN", "Vehicle breakdown"],
    ["TYRE_ISSUE", "Tyre damage"],
    ["ENGINE_ISSUE", "Engine issue"],
    ["ELECTRICAL_ISSUE", "Electrical issue"],
    ["OTHER", "Other"],
  ],
} as const;

type MaintenanceReasonCode =
  (typeof maintenanceReasons)[keyof typeof maintenanceReasons][number][0];

export default function ReportIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const queueMutation = useSyncStore((state) => state.queueMutation);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [maintenanceReasonCode, setMaintenanceReasonCode] =
    useState<MaintenanceReasonCode | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && id) void getAssignment(profile.id, id).then(setAssignment);
  }, [id, profile]);

  const submit = async () => {
    const trimmed = note.trim();
    const isAssetIssue = category === "DRONE_MALFUNCTION" || category === "LMV_MALFUNCTION";
    if (!assignment || !category || !trimmed || (isAssetIssue && !maintenanceReasonCode)) {
      setError("Choose a category and describe what happened.");
      return;
    }
    if (trimmed.length > 500) {
      setError("Issue notes cannot exceed 500 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const mutation: MutationRequest = {
        assignmentId: assignment.id,
        clientActionId: Crypto.randomUUID(),
        action: "REPORT_ISSUE",
        expectedRevision: assignment.revision,
        issueCategory: category,
        issueNote: trimmed,
        ...(maintenanceReasonCode ? { maintenanceReasonCode } : {}),
      };
      await queueMutation(mutation);
      router.replace({
        pathname: "/assignment/[id]",
        params: { id: assignment.id },
      });
    } catch (caught: any) {
      setError(caught?.message || "The issue could not be queued.");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="close" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Issue</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Banner
          tone="error"
          title="Operational issue"
          message="Submitting flags this assignment for Fleet review. Do not include coordinates in the note."
        />
        {error ? (
          <Banner tone="error" title="Check the report" message={error} />
        ) : null}
        <Text style={styles.label}>CATEGORY</Text>
        <View style={styles.categories}>
          {categories.map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.category,
                category === value && styles.categorySelected,
              ]}
              onPress={() => {
                setCategory(value);
                setMaintenanceReasonCode(null);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: category === value }}
            >
              <MaterialIcons
                name={
                  category === value
                    ? "radio-button-checked"
                    : "radio-button-unchecked"
                }
                size={22}
                color={
                  category === value
                    ? colors.status.error
                    : colors.textSecondary
                }
              />
              <Text style={styles.categoryText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {category && category in maintenanceReasons ? (
          <>
            <Text style={[styles.label, styles.noteLabel]}>QUICK REASON</Text>
            <View style={styles.quickReasons}>
              {maintenanceReasons[category as keyof typeof maintenanceReasons].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.quickReason,
                    maintenanceReasonCode === value && styles.quickReasonSelected,
                  ]}
                  onPress={() => {
                    setMaintenanceReasonCode(value);
                    if (!note.trim()) setNote(label);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.quickReasonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
        <Text style={[styles.label, styles.noteLabel]}>WHAT HAPPENED?</Text>
        <TextInput
          style={styles.note}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          textAlignVertical="top"
          placeholder="Describe the operational condition without entering GPS coordinates."
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.counter}>{note.length}/500</Text>
        <View style={styles.actions}>
          <Button
            title="Submit Issue"
            variant="destructive"
            onPress={submit}
            loading={submitting}
          />
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => router.back()}
            disabled={submitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: "#E5C2AE",
    paddingHorizontal: spacing.sm,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...typography.subheading,
    flex: 1,
    textAlign: "center",
    color: colors.primary,
    fontWeight: "700",
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  label: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  categories: { gap: spacing.sm },
  category: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  categorySelected: {
    borderColor: colors.status.error,
    backgroundColor: "#FFF1F1",
  },
  categoryText: { ...typography.body, color: colors.textPrimary },
  quickReasons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  quickReason: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  quickReasonSelected: {
    borderColor: colors.status.error,
    backgroundColor: "#FFF1F1",
  },
  quickReasonText: { ...typography.caption, color: colors.textPrimary, fontWeight: "700" },
  noteLabel: { marginTop: spacing.lg },
  note: {
    minHeight: 150,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  counter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});

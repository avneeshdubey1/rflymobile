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
import { Banner, Button, Card } from "../src/design-system/components";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../src/design-system/tokens";

const safetyChecks = [
  "Weather conditions are within operational limits.",
  "Airspace authorization is active and verified.",
  "Drone hardware pre-flight inspection is complete.",
];

export default function ActionConfirmScreen() {
  const { id, action } = useLocalSearchParams<{
    id: string;
    action: "ACCEPT" | "START" | "REJECT";
  }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const queueMutation = useSyncStore((state) => state.queueMutation);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [checked, setChecked] = useState<boolean[]>(
    safetyChecks.map(() => false),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (profile && id) void getAssignment(profile.id, id).then(setAssignment);
  }, [id, profile]);

  const isStart = action === "START";
  const isReject = action === "REJECT";
  const enabled =
    Boolean(assignment) &&
    Boolean(action) &&
    assignment!.allowedActions.includes(action!) &&
    (!isStart || checked.every(Boolean)) && (!isReject || rejectionReason.trim().length >= 3);

  const confirm = async () => {
    if (!assignment || !action || !enabled) return;
    setSubmitting(true);
    setError(null);
    try {
      const mutation: MutationRequest = {
        assignmentId: assignment.id,
        clientActionId: Crypto.randomUUID(),
        action,
        expectedRevision: assignment.revision,
        ...(isReject ? { issueNote: rejectionReason.trim() } : {}),
      };
      await queueMutation(mutation);
      if (action === "REJECT") {
        router.replace("/(tabs)");
      } else if (action === "START") {
        router.replace({
          pathname: "/mission-active",
          params: { id: assignment.id },
        });
      } else {
        router.replace({
          pathname: "/assignment/[id]",
          params: { id: assignment.id },
        });
      }
    } catch (caught: any) {
      setError(caught?.message || "The action could not be queued.");
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
        <Text style={styles.headerTitle}>
          {isStart ? "Pre-Flight Brief" : isReject ? "Reject Assignment" : "Accept Assignment"}
        </Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <Banner tone="error" title="Action unavailable" message={error} />
        ) : null}
        {!assignment ? (
          <Text style={styles.loading}>Loading assignment…</Text>
        ) : (
          <>
            <Card>
              <Text style={styles.eyebrow}>
                MISSION #{assignment.dailySequence}
              </Text>
              <Text style={styles.farm}>{assignment.farmer.displayName}</Text>
              <Text style={styles.meta}>
                {assignment.crop || "Crop not recorded"} •{" "}
                {assignment.expectedAcreage} acres
              </Text>
              <Text style={styles.meta}>{assignment.farm.displayAddress}</Text>
            </Card>

            {isReject ? (
              <View style={styles.checkSection}>
                <Banner tone="error" title="Manual rescheduling required" message="Rejecting releases the reserved drone and vehicle and sends this request to Admin and Fleet for manual rescheduling." />
                <Text style={styles.sectionTitle}>Reason</Text>
                <TextInput value={rejectionReason} onChangeText={setRejectionReason} multiline maxLength={500} placeholder="Explain why you cannot accept this assignment" style={{ minHeight: 110, borderWidth: 1, borderColor: colors.textSecondary, borderRadius: radius.md, padding: spacing.md, textAlignVertical: 'top', backgroundColor: colors.surface }} />
              </View>
            ) : isStart ? (
              <View style={styles.checkSection}>
                <Text style={styles.sectionTitle}>Safety checklist</Text>
                {safetyChecks.map((label, index) => (
                  <TouchableOpacity
                    key={label}
                    style={styles.checkRow}
                    onPress={() =>
                      setChecked((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? !value : value,
                        ),
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: checked[index] }}
                  >
                    <MaterialIcons
                      name={
                        checked[index] ? "check-box" : "check-box-outline-blank"
                      }
                      size={28}
                      color={
                        checked[index]
                          ? colors.status.success
                          : colors.textSecondary
                      }
                    />
                    <Text style={styles.checkText}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <Banner
                  tone="info"
                  title="Command confirmation"
                  message="Starting records that the crew has completed every check above."
                />
              </View>
            ) : (
              <Banner
                tone="info"
                title="Acceptance is explicit"
                message="Your acceptance is stored locally first and will synchronize safely if the connection drops."
              />
            )}

            {!assignment.allowedActions.includes(action!) ? (
              <Banner
                tone="error"
                title="Assignment changed"
                message="Return to the assignment and refresh before continuing."
              />
            ) : null}
            <View style={styles.actions}>
              <Button
                title={isStart ? "Start Mission" : isReject ? "Reject Assignment" : "Accept Assignment"}
                onPress={confirm}
                disabled={!enabled}
                loading={submitting}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => router.back()}
                disabled={submitting}
              />
            </View>
          </>
        )}
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
  loading: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
  },
  farm: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  checkSection: { marginTop: spacing.md },
  sectionTitle: {
    ...typography.heading,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 72,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  checkText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});

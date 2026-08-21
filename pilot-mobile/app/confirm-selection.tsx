import { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Assignment,
  CopilotCandidate,
  ZAssignmentResponse,
  ZEligibleCopilotsResponse,
} from "../src/contracts/mobile-api";
import { api, fetchTyped } from "../src/lib/api";
import { getAssignment, saveAssignments } from "../src/lib/database";
import { useAuthStore } from "../src/store/auth";
import { Banner, Button, Card } from "../src/design-system/components";
import { colors, spacing, typography } from "../src/design-system/tokens";

export default function ConfirmSelectionScreen() {
  const { id, candidateId } = useLocalSearchParams<{
    id: string;
    candidateId: string;
  }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [candidate, setCandidate] = useState<CopilotCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !id || !candidateId) return;
    Promise.all([
      getAssignment(profile.id, id),
      fetchTyped(
        ZEligibleCopilotsResponse,
        api.get(`/pilot/assignments/${id}/eligible-copilots`),
      ),
    ])
      .then(([cached, response]) => {
        setAssignment(cached);
        setCandidate(
          response.candidates.find((item) => item.id === candidateId) ?? null,
        );
        if (
          !cached ||
          !response.candidates.some((item) => item.id === candidateId)
        ) {
          setError(
            "This selection is no longer available. Return and refresh the candidate list.",
          );
        }
      })
      .catch((caught: any) =>
        setError(caught?.message || "The selection could not be verified."),
      )
      .finally(() => setLoading(false));
  }, [candidateId, id, profile]);

  const confirm = async () => {
    if (!profile || !assignment || !candidate) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetchTyped(
        ZAssignmentResponse,
        api.post(`/pilot/assignments/${assignment.id}/copilot`, {
          candidateId: candidate.id,
          expectedRevision: assignment.revision,
        }),
      );
      await saveAssignments(profile.id, [response.assignment]);
      router.replace({
        pathname: "/assignment/[id]",
        params: { id: assignment.id },
      });
    } catch (caught: any) {
      setError(caught?.message || "Copilot selection failed.");
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
          <MaterialIcons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Selection</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <Banner tone="error" title="Selection unavailable" message={error} />
        ) : null}
        {loading ? (
          <Text style={styles.loading}>
            Verifying the latest assignment revision…
          </Text>
        ) : null}
        {assignment && candidate ? (
          <>
            <Card>
              <Text style={styles.eyebrow}>
                MISSION #{assignment.dailySequence}
              </Text>
              <Text style={styles.title}>{assignment.farmer.displayName}</Text>
              <Text style={styles.meta}>{assignment.farm.displayAddress}</Text>
              <Text style={styles.meta}>
                {assignment.crop || "Crop not recorded"} •{" "}
                {assignment.expectedAcreage} acres
              </Text>
            </Card>
            <Card>
              <Text style={styles.eyebrow}>SELECTED COPILOT</Text>
              <Text style={styles.title}>{candidate.name}</Text>
              <Text style={styles.meta}>
                {candidate.employeeCode || "Employee ID not recorded"}
              </Text>
            </Card>
            <Banner
              tone="info"
              title="Online confirmation required"
              message="Crew selection is revision-checked by the server and is not queued offline."
            />
            <View style={styles.actions}>
              <Button
                title="Confirm Copilot"
                onPress={confirm}
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
        ) : null}
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
    justifyContent: "center",
    alignItems: "center",
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
    marginVertical: spacing.xl,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  CopilotCandidate,
  ZEligibleCopilotsResponse,
} from "../src/contracts/mobile-api";
import { api, fetchTyped } from "../src/lib/api";
import { Banner, EmptyState } from "../src/design-system/components";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../src/design-system/tokens";

export default function SelectCopilotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<CopilotCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchTyped(
      ZEligibleCopilotsResponse,
      api.get(`/pilot/assignments/${id}/eligible-copilots`),
    )
      .then((response) => setCandidates(response.candidates))
      .catch((caught: any) =>
        setError(caught?.message || "Eligible copilots could not be loaded."),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return candidates;
    return candidates.filter((candidate) =>
      `${candidate.name} ${candidate.employeeCode || ""}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [candidates, query]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Copilot</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.search}>
          <MaterialIcons name="search" size={26} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or ID"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>
        {error ? (
          <Banner tone="error" title="Copilots unavailable" message={error} />
        ) : null}
        {loading ? (
          <ActivityIndicator
            style={styles.loading}
            size="large"
            color={colors.accent}
          />
        ) : null}
        {!loading && !visible.length ? (
          <EmptyState
            title="No eligible copilots"
            message="Fleet may need to resolve centre, licence, or schedule availability."
          />
        ) : null}
        {visible.map((candidate) => (
          <TouchableOpacity
            key={candidate.id}
            style={styles.candidate}
            onPress={() =>
              router.push({
                pathname: "/confirm-selection",
                params: { id, candidateId: candidate.id },
              })
            }
            accessibilityRole="button"
          >
            <View style={styles.avatar}>
              <Text style={styles.initials}>
                {candidate.name
                  .split(/\s+/u)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </Text>
            </View>
            <View style={styles.candidateCopy}>
              <Text style={styles.candidateName}>{candidate.name}</Text>
              <Text style={styles.employeeCode}>
                {candidate.employeeCode || "Employee ID not recorded"}
              </Text>
            </View>
            <Text style={styles.eligible}>ELIGIBLE</Text>
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={colors.primary}
            />
          </TouchableOpacity>
        ))}
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
  search: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#E5C2AE",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.textPrimary },
  loading: { marginTop: spacing.xl },
  candidate: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.disabled,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCE7FA",
  },
  initials: {
    ...typography.subheading,
    color: colors.primary,
    fontWeight: "700",
  },
  candidateCopy: { flex: 1 },
  candidateName: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  employeeCode: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  eligible: {
    ...typography.caption,
    color: colors.status.success,
    fontWeight: "700",
  },
});

import { useCallback, useState } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Assignment } from "../../src/contracts/mobile-api";
import { getAssignments, getMutationRecords } from "../../src/lib/database";
import { useAuthStore } from "../../src/store/auth";
import { useSyncStore } from "../../src/store/sync";
import {
  Banner,
  Card,
  EmptyState,
  StatusChip,
} from "../../src/design-system/components";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../src/design-system/tokens";

type WorkSegment = "TODAY" | "UPCOMING";

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatWindow(assignment: Assignment) {
  const start = new Date(assignment.serviceWindowStart);
  const end = new Date(assignment.serviceWindowEnd);
  return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function statusFor(assignment: Assignment) {
  if (assignment.status === "COMPLETED")
    return { label: "COMPLETED", tone: "offline" as const };
  if (assignment.status === "IN_PROGRESS")
    return { label: "IN PROGRESS", tone: "warning" as const };
  if (assignment.status === "PILOT_ACCEPTED")
    return { label: "ACCEPTED", tone: "info" as const };
  if (assignment.crewFormationState === "PENDING_COPILOT_SELECTION") {
    return { label: "COPILOT NEEDED", tone: "warning" as const };
  }
  if (assignment.crewFormationState === "READY")
    return { label: "READY", tone: "success" as const };
  return { label: assignment.status, tone: "info" as const };
}

export default function WorkScreen() {
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const offlineMessage = useAuthStore((state) => state.error);
  const { sync, refreshAssignments, syncError } = useSyncStore();
  const [segment, setSegment] = useState<WorkSegment>("TODAY");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pendingByAssignment, setPendingByAssignment] = useState<
    Record<string, string[]>
  >({});
  const [refreshing, setRefreshing] = useState(false);

  const readCache = useCallback(async () => {
    if (!profile) return;
    const [cachedAssignments, mutations] = await Promise.all([
      getAssignments(profile.id),
      getMutationRecords(profile.id),
    ]);
    setAssignments(cachedAssignments);
    const pending: Record<string, string[]> = {};
    mutations
      .filter((record) => ["PENDING", "RETRY_LATER"].includes(record.status))
      .forEach((record) => {
        pending[record.mutation.assignmentId] = [
          ...(pending[record.mutation.assignmentId] ?? []),
          record.mutation.action,
        ];
      });
    setPendingByAssignment(pending);
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    try {
      await sync();
      await refreshAssignments();
    } catch {
      // The cached list remains visible. The sync store provides the safe error copy.
    } finally {
      await readCache();
      setRefreshing(false);
    }
  }, [profile, readCache, refreshAssignments, sync]);

  useFocusEffect(
    useCallback(() => {
      void readCache().then(() => refresh());
    }, [readCache, refresh]),
  );

  const visible = assignments
    .filter((assignment) =>
      segment === "TODAY"
        ? isToday(assignment.serviceWindowStart)
        : !isToday(assignment.serviceWindowStart) &&
          new Date(assignment.serviceWindowStart) > new Date(),
    )
    .sort((left, right) => left.dailySequence - right.dailySequence);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>FIELD OPERATIONS</Text>
            <Text style={styles.title}>RFLY Pilot</Text>
          </View>
          <MaterialIcons
            name={syncError ? "cloud-off" : "cloud-done"}
            size={28}
            color={syncError ? colors.status.error : colors.status.success}
          />
        </View>

        {offlineMessage || syncError ? (
          <Banner
            tone="offline"
            title="Offline mode"
            message="Showing cached assignments. Pull down to retry synchronization."
          />
        ) : null}

        <View style={styles.segmented}>
          {(["TODAY", "UPCOMING"] as WorkSegment[]).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.segment, segment === item && styles.segmentActive]}
              onPress={() => setSegment(item)}
              accessibilityRole="tab"
              accessibilityState={{ selected: segment === item }}
            >
              <Text
                style={[
                  styles.segmentText,
                  segment === item && styles.segmentTextActive,
                ]}
              >
                {item === "TODAY" ? "Today" : "Upcoming"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {visible.length ? (
          visible.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              pendingActions={pendingByAssignment[assignment.id] ?? []}
              onPress={() =>
                router.push({
                  pathname: "/assignment/[id]",
                  params: { id: assignment.id },
                })
              }
            />
          ))
        ) : (
          <EmptyState
            title={
              segment === "TODAY"
                ? "No work assigned today"
                : "No upcoming assignments"
            }
            message="New assignments will appear here after Fleet schedules them."
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AssignmentCard({
  assignment,
  pendingActions,
  onPress,
}: {
  assignment: Assignment;
  pendingActions: string[];
  onPress: () => void;
}) {
  const status = statusFor(assignment);
  const primary = assignment.crew.find(
    (member) => member.crewRole === "PRIMARY_PILOT",
  );
  const copilot = assignment.crew.find(
    (member) => member.crewRole === "COPILOT",
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <Card
        style={
          assignment.status === "COMPLETED" ? styles.completedCard : undefined
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.farmName}>{assignment.farmer.displayName}</Text>
            <Text style={styles.cropLine}>
              {assignment.crop || "Crop not recorded"} |{" "}
              {assignment.expectedAcreage} acres
            </Text>
          </View>
          <StatusChip label={status.label} status={status.tone} />
        </View>
        <View style={styles.divider} />
        <View style={styles.windowRow}>
          <MaterialIcons name="schedule" size={22} color={colors.primary} />
          <Text style={styles.windowText}>{formatWindow(assignment)}</Text>
          <Text style={styles.sequence}>#{assignment.dailySequence}</Text>
        </View>
        <View style={styles.crewBox}>
          <Text style={styles.crewText}>
            <Text style={styles.crewLabel}>Crew: </Text>
            Primary: {primary?.displayName || "Unassigned"} | Copilot:{" "}
            {copilot?.displayName || "Pending"}
          </Text>
        </View>
        {pendingActions.length ? (
          <Text style={styles.pendingText}>
            {pendingActions.join(", ")} queued for sync
          </Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: 112,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: { ...typography.heading, color: colors.primary, fontSize: 30 },
  segmented: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5C2AE",
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  segmentTextActive: { color: colors.surface },
  completedCard: { opacity: 0.65 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardTitleBlock: { flex: 1 },
  farmName: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  cropLine: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.disabled,
    marginVertical: spacing.md,
  },
  windowRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  windowText: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontVariant: ["tabular-nums"],
  },
  sequence: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  crewBox: {
    backgroundColor: "#F2F3F5",
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  crewText: { ...typography.body, color: colors.textPrimary },
  crewLabel: { fontWeight: "700" },
  pendingText: {
    ...typography.caption,
    color: colors.status.warning,
    marginTop: spacing.sm,
    fontWeight: "700",
  },
});

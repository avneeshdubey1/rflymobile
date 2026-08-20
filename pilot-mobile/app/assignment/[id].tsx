import { useCallback, useState } from "react";
import {
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Assignment,
  ZAssignmentResponse,
} from "../../src/contracts/mobile-api";
import { api, fetchTyped } from "../../src/lib/api";
import {
  getAssignment,
  getMutationRecords,
  saveAssignments,
} from "../../src/lib/database";
import { useAuthStore } from "../../src/store/auth";
import {
  Banner,
  Button,
  Card,
  StatusChip,
} from "../../src/design-system/components";
import {
  colors,
  radius,
  spacing,
  typography,
} from "../../src/design-system/tokens";

function formattedDate(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AssignmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [pendingActions, setPendingActions] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refreshServer = true) => {
      if (!profile || !id) return;
      setError(null);
      const cached = await getAssignment(profile.id, id);
      if (cached) setAssignment(cached);
      const records = await getMutationRecords(profile.id);
      setPendingActions(
        records
          .filter(
            (record) =>
              record.mutation.assignmentId === id &&
              ["PENDING", "RETRY_LATER"].includes(record.status),
          )
          .map((record) => record.mutation.action),
      );

      if (!refreshServer) return;
      try {
        const response = await fetchTyped(
          ZAssignmentResponse,
          api.get(`/pilot/assignments/${id}`),
        );
        await saveAssignments(profile.id, [response.assignment]);
        setAssignment(response.assignment);
        setOffline(false);
      } catch (caught: any) {
        setOffline(true);
        if (!cached)
          setError(caught?.message || "Assignment could not be loaded.");
      }
    },
    [id, profile],
  );

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  if (!assignment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Assignment Details" onBack={() => router.back()} />
        <View style={styles.centered}>
          {error ? (
            <Banner
              tone="error"
              title="Assignment unavailable"
              message={error}
            />
          ) : (
            <Text>Loading assignment…</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const primary = assignment.crew.find(
    (member) => member.crewRole === "PRIMARY_PILOT",
  );
  const copilot = assignment.crew.find(
    (member) => member.crewRole === "COPILOT",
  );
  const allowed = assignment.allowedActions;
  const openMap = () =>
    Linking.openURL(
      `https://www.openstreetmap.org/?mlat=${assignment.farm.latitude}&mlon=${assignment.farm.longitude}#map=17/${assignment.farm.latitude}/${assignment.farm.longitude}`,
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Assignment Details" onBack={() => router.back()} />
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
        {offline ? (
          <Banner
            tone="offline"
            title="Cached assignment"
            message="Actions already queued are safe. Refresh after reconnecting."
          />
        ) : null}
        {pendingActions.length ? (
          <Banner
            tone="info"
            title="Action queued"
            message={`${pendingActions.join(", ")} will remain visible in Sync until the server responds.`}
          />
        ) : null}

        <View style={styles.statusPanel}>
          <Text style={styles.eyebrow}>STATUS</Text>
          <Text style={styles.statusTitle}>
            {assignment.status.replaceAll("_", " ")}
          </Text>
          <StatusChip
            label={assignment.crewFormationState.replaceAll("_", " ")}
            status={
              assignment.crewFormationState === "READY" ? "success" : "warning"
            }
          />
        </View>

        <Card>
          <Text style={styles.sectionTitle}>Farm Information</Text>
          <Detail label="FARMER" value={assignment.farmer.displayName} />
          <Detail label="PHONE" value={assignment.farmer.operationalPhone} />
          <Detail label="FARM ADDRESS" value={assignment.farm.displayAddress} />
          {assignment.farm.plusCode ? (
            <Detail label="PLUS CODE" value={assignment.farm.plusCode} />
          ) : null}
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.smallAction} onPress={openMap}>
              <MaterialIcons name="map" size={20} color={colors.primary} />
              <Text style={styles.smallActionText}>Open map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.smallAction}
              onPress={() =>
                Linking.openURL(`tel:${assignment.farmer.operationalPhone}`)
              }
            >
              <MaterialIcons name="call" size={20} color={colors.primary} />
              <Text style={styles.smallActionText}>Call farmer</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Operational Details</Text>
          <View style={styles.twoColumns}>
            <Detail
              label="CROP"
              value={assignment.crop || "Not recorded"}
              compact
            />
            <Detail
              label="ACREAGE"
              value={`${assignment.expectedAcreage} acres`}
              compact
            />
          </View>
          <Detail
            label="SERVICE WINDOW"
            value={`${formattedDate(assignment.serviceWindowStart)} – ${formattedDate(assignment.serviceWindowEnd)}`}
          />
          {assignment.operationalNotes.map((note, index) => (
            <Detail
              key={`${index}-${note}`}
              label={`NOTE ${index + 1}`}
              value={note}
            />
          ))}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Crew & Equipment</Text>
          <Detail
            label="PRIMARY PILOT"
            value={primary?.displayName || "Not assigned"}
          />
          <Detail
            label="COPILOT"
            value={copilot?.displayName || "Selection required"}
          />
          <Detail
            label="DRONE"
            value={`${assignment.drone.code} • ${assignment.drone.serialNumber}`}
          />
          <Detail
            label="LMV"
            value={
              assignment.lmv
                ? `${assignment.lmv.label || "Vehicle"} • ${assignment.lmv.registrationNumber}`
                : "Not assigned"
            }
          />
          <Detail
            label="OPERATING CENTRE"
            value={assignment.operatingCenter?.displayName || "Not recorded"}
          />
        </Card>

        {assignment.issue ? (
          <Banner
            tone="error"
            title={assignment.issue.category.replaceAll("_", " ")}
            message={assignment.issue.note}
          />
        ) : null}

        <View style={styles.actions}>
          {allowed.includes("SELECT_COPILOT") ? (
            <Button
              title="Select Copilot"
              onPress={() =>
                router.push({
                  pathname: "/select-copilot",
                  params: { id: assignment.id },
                })
              }
            />
          ) : null}
          {allowed.includes("ACCEPT") ? (
            <Button
              title="Accept Assignment"
              onPress={() =>
                router.push({
                  pathname: "/action-confirm",
                  params: { id: assignment.id, action: "ACCEPT" },
                })
              }
            />
          ) : null}
          {allowed.includes("START") ? (
            <Button
              title="Start Mission"
              onPress={() =>
                router.push({
                  pathname: "/action-confirm",
                  params: { id: assignment.id, action: "START" },
                })
              }
            />
          ) : null}
          {allowed.includes("COMPLETE") ? (
            <Button
              title="Complete Mission"
              onPress={() =>
                router.push({
                  pathname: "/mission-completed",
                  params: { id: assignment.id },
                })
              }
            />
          ) : null}
          {allowed.includes("REPORT_ISSUE") ? (
            <Button
              title="Report Issue"
              variant="destructive"
              onPress={() =>
                router.push({
                  pathname: "/report-issue",
                  params: { id: assignment.id },
                })
              }
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.back}
        onPress={onBack}
        accessibilityLabel="Go back"
      >
        <MaterialIcons name="arrow-back" size={26} color={colors.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.back} />
    </View>
  );
}

function Detail({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.detail, compact && styles.compactDetail]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E5C2AE",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  back: {
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
  scroll: { flex: 1 },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  centered: { flex: 1, justifyContent: "center", padding: spacing.lg },
  statusPanel: {
    backgroundColor: "#FFF0E7",
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statusTitle: {
    ...typography.subheading,
    color: colors.primary,
    fontWeight: "700",
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  detail: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.disabled,
  },
  compactDetail: { flex: 1 },
  detailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  detailValue: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  twoColumns: { flexDirection: "row", gap: spacing.lg },
  inlineActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: "wrap",
  },
  smallAction: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  smallActionText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: "700",
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});

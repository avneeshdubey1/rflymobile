import { useCallback, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Assignment } from "../src/contracts/mobile-api";
import { getAssignment, getMutationRecords } from "../src/lib/database";
import { useAuthStore } from "../src/store/auth";
import {
  Banner,
  Button,
  Card,
  StatusChip,
} from "../src/design-system/components";
import { colors, spacing, typography } from "../src/design-system/tokens";

export default function MissionActiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [pendingStart, setPendingStart] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile || !id) return;
      void Promise.all([
        getAssignment(profile.id, id),
        getMutationRecords(profile.id),
      ]).then(([cached, records]) => {
        setAssignment(cached);
        setPendingStart(
          records.some(
            (record) =>
              record.mutation.assignmentId === id &&
              record.mutation.action === "START" &&
              ["PENDING", "RETRY_LATER"].includes(record.status),
          ),
        );
      });
    }, [id, profile]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <MaterialIcons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mission</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!assignment ? (
          <Text style={styles.loading}>Loading mission…</Text>
        ) : (
          <>
            {pendingStart ? (
              <Banner
                tone="offline"
                title="Start queued"
                message="Mission controls stay locked until the server confirms the start."
              />
            ) : null}
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>
                MISSION #{assignment.dailySequence}
              </Text>
              <Text style={styles.title}>{assignment.farmer.displayName}</Text>
              <StatusChip
                label={assignment.status.replaceAll("_", " ")}
                status={
                  assignment.status === "IN_PROGRESS" ? "warning" : "info"
                }
              />
            </View>
            <Card>
              <Text style={styles.sectionTitle}>Current work</Text>
              <Text style={styles.value}>
                {assignment.crop || "Crop not recorded"} •{" "}
                {assignment.expectedAcreage} acres
              </Text>
              <Text style={styles.value}>{assignment.farm.displayAddress}</Text>
              <Text style={styles.label}>DRONE</Text>
              <Text style={styles.value}>{assignment.drone.code}</Text>
              <Text style={styles.label}>LMV</Text>
              <Text style={styles.value}>
                {assignment.lmv?.registrationNumber || "Not assigned"}
              </Text>
            </Card>
            <Banner
              tone="info"
              title="No live telemetry displayed"
              message="This app records operational state only. Battery and flight telemetry are shown only when an approved source is integrated."
            />
            <View style={styles.actions}>
              {assignment.allowedActions.includes("COMPLETE") ? (
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
              {assignment.allowedActions.includes("REPORT_ISSUE") ? (
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
              <Button
                title="View Assignment Details"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/assignment/[id]",
                    params: { id: assignment.id },
                  })
                }
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
    color: colors.primary,
    flex: 1,
    textAlign: "center",
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
  hero: { paddingVertical: spacing.lg, gap: spacing.sm },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: { ...typography.heading, color: colors.textPrimary, fontSize: 30 },
  sectionTitle: {
    ...typography.subheading,
    color: colors.primary,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});

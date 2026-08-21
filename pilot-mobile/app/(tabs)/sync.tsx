import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { getMutationRecords, MutationRecord } from "../../src/lib/database";
import { useAuthStore } from "../../src/store/auth";
import { useSyncStore } from "../../src/store/sync";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  StatusChip,
} from "../../src/design-system/components";
import { colors, spacing, typography } from "../../src/design-system/tokens";

function recordTone(
  status: string,
): "success" | "warning" | "error" | "offline" | "info" {
  if (status === "APPLIED" || status === "ALREADY_APPLIED") return "success";
  if (status === "CONFLICT" || status === "REJECTED") return "error";
  if (status === "PENDING" || status === "RETRY_LATER") return "warning";
  return "info";
}

export default function SyncScreen() {
  const profile = useAuthStore((state) => state.profile);
  const { isSyncing, lastSyncTime, syncError, sync } = useSyncStore();
  const [records, setRecords] = useState<MutationRecord[]>([]);

  const load = useCallback(async () => {
    if (profile) setRecords(await getMutationRecords(profile.id));
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const synchronize = async () => {
    await sync();
    await load();
  };

  const unresolved = records.filter((record) =>
    ["PENDING", "RETRY_LATER", "CONFLICT", "REJECTED"].includes(record.status),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>OFFLINE QUEUE</Text>
        <Text style={styles.title}>Sync Status</Text>
        {syncError ? (
          <Banner
            tone="offline"
            title="Server unreachable"
            message="Your queued actions remain on this device. Retry when connectivity returns."
          />
        ) : null}
        <Card>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.label}>ENGINE STATE</Text>
              <Text style={styles.value}>
                {isSyncing ? "Synchronizing" : "Ready"}
              </Text>
            </View>
            <StatusChip
              label={isSyncing ? "SYNCING" : syncError ? "OFFLINE" : "READY"}
              status={isSyncing ? "info" : syncError ? "offline" : "success"}
            />
          </View>
          <Text style={styles.lastSync}>
            {lastSyncTime
              ? `Last synchronized ${new Date(lastSyncTime).toLocaleString()}`
              : "No synchronization completed in this session"}
          </Text>
          <Button
            title="Sync Now"
            onPress={synchronize}
            loading={isSyncing}
            style={styles.syncButton}
          />
        </Card>

        <Text style={styles.sectionTitle}>Action evidence</Text>
        {!records.length ? (
          <EmptyState
            title="All actions synced"
            message="Queued actions and server receipts will appear here."
          />
        ) : (
          records.map((record) => (
            <Card key={record.mutation.clientActionId}>
              <View style={styles.summaryRow}>
                <View style={styles.recordCopy}>
                  <Text style={styles.recordAction}>
                    {record.mutation.action.replaceAll("_", " ")}
                  </Text>
                  <Text style={styles.recordId}>
                    Assignment {record.mutation.assignmentId.slice(0, 8)}
                  </Text>
                </View>
                <StatusChip
                  label={record.status.replaceAll("_", " ")}
                  status={recordTone(record.status)}
                />
              </View>
              <Text style={styles.lastSync}>
                {new Date(record.updatedAt).toLocaleString()}
              </Text>
              {record.receipt ? (
                <Text style={styles.receipt}>
                  Server revision {record.receipt.resultingRevision}
                </Text>
              ) : null}
            </Card>
          ))
        )}
        {unresolved.some((record) =>
          ["CONFLICT", "REJECTED"].includes(record.status),
        ) ? (
          <Banner
            tone="error"
            title="Manual review required"
            message="Conflict and rejected receipts are retained. Contact Fleet before repeating the action."
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingBottom: 112,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  eyebrow: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    ...typography.heading,
    color: colors.primary,
    fontSize: 30,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  value: {
    ...typography.subheading,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    fontWeight: "700",
  },
  lastSync: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  syncButton: { marginTop: spacing.md },
  sectionTitle: {
    ...typography.subheading,
    color: colors.primary,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  recordCopy: { flex: 1 },
  recordAction: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  recordId: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  receipt: {
    ...typography.caption,
    color: colors.status.success,
    marginTop: spacing.sm,
    fontWeight: "700",
  },
});

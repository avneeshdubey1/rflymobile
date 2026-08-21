import { useEffect, useMemo, useState } from "react";
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

export default function CompleteMissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const queueMutation = useSyncStore((state) => state.queueMutation);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [acreage, setAcreage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !id) return;
    void getAssignment(profile.id, id).then((cached) => {
      setAssignment(cached);
      if (cached) setAcreage(cached.actualAcreage || cached.expectedAcreage);
    });
  }, [id, profile]);

  const normalizedAcreage = useMemo(() => acreage.trim(), [acreage]);
  const acreageValid =
    /^(0|[1-9]\d*)(\.\d{1,2})?$/u.test(normalizedAcreage) &&
    Number(normalizedAcreage) > 0;

  const complete = async () => {
    if (!assignment || !acreageValid) {
      setError(
        "Enter a positive acreage with no more than two decimal places.",
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const mutation: MutationRequest = {
        assignmentId: assignment.id,
        clientActionId: Crypto.randomUUID(),
        action: "COMPLETE",
        expectedRevision: assignment.revision,
        actualAcreage: normalizedAcreage,
      };
      await queueMutation(mutation);
      router.replace("/(tabs)");
    } catch (caught: any) {
      setError(caught?.message || "Completion could not be queued.");
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
        <Text style={styles.headerTitle}>Complete Mission</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Banner tone="error" title="Check completion" message={error} />
        ) : null}
        {assignment ? (
          <>
            <Card>
              <Text style={styles.eyebrow}>
                MISSION #{assignment.dailySequence}
              </Text>
              <Text style={styles.title}>{assignment.farmer.displayName}</Text>
              <Text style={styles.meta}>{assignment.farm.displayAddress}</Text>
            </Card>
            <Text style={styles.label}>ACTUAL ACREAGE TREATED</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={acreage}
                onChangeText={setAcreage}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                maxLength={12}
              />
              <Text style={styles.unit}>ACRES</Text>
            </View>
            <Banner
              tone="info"
              title="Completion is durable"
              message="The completion is stored locally before synchronization. Fleet reuse remains governed by the server after it is applied."
            />
            <View style={styles.actions}>
              <Button
                title="Complete Mission"
                onPress={complete}
                disabled={!acreageValid}
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
        ) : (
          <Text style={styles.loading}>Loading mission…</Text>
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
  label: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 1,
    marginVertical: spacing.sm,
  },
  inputRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});

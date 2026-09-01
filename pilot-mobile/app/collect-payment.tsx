import { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Assignment, ZCashCollectionResponse } from "../src/contracts/mobile-api";
import { api, fetchTyped } from "../src/lib/api";
import { getAssignment } from "../src/lib/database";
import { useAuthStore } from "../src/store/auth";
import { Banner, Button, Card } from "../src/design-system/components";
import { colors, radius, spacing, typography } from "../src/design-system/tokens";

export default function CollectPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && id) void getAssignment(profile.id, id).then(setAssignment);
  }, [id, profile]);

  const normalizedAmount = amount.trim();
  const amountValid = useMemo(
    () => /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/u.test(normalizedAmount) && Number(normalizedAmount) > 0,
    [normalizedAmount],
  );
  const returnToAssignment = () => {
    if (id) router.replace({ pathname: "/assignment/[id]", params: { id } });
    else router.replace("/(tabs)");
  };

  const recordCash = async () => {
    if (!id || !amountValid) {
      setError("Enter the exact cash received with no more than two decimal places.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await fetchTyped(
        ZCashCollectionResponse,
        api.post(`/pilot/assignments/${id}/cash-collection`, {
          clientActionId: Crypto.randomUUID(),
          amount: normalizedAmount,
        }),
      );
      returnToAssignment();
    } catch (caught: any) {
      setError(caught?.message || "Cash collection could not be recorded.");
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={returnToAssignment} accessibilityLabel="Return to assignment">
          <MaterialIcons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Collect Payment</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Banner tone="error" title="Payment not recorded" message={error} /> : null}
        <Card>
          <Text style={styles.eyebrow}>B2C FIELD COLLECTION</Text>
          <Text style={styles.title}>{assignment?.farmer.displayName || "Completed mission"}</Text>
          <Text style={styles.copy}>Record only cash physically received from the customer. This remains pending Admin reconciliation and does not create or approve an invoice.</Text>
        </Card>
        <View style={styles.qrPlaceholder} accessibilityLabel="RFLY UPI QR placeholder not active">
          <MaterialIcons name="qr-code-2" size={88} color={colors.textSecondary} />
          <Text style={styles.qrTitle}>RFLY UPI QR placeholder</Text>
          <Text style={styles.qrWarning}>NOT PAYABLE — the official merchant QR has not been configured.</Text>
        </View>
        <Text style={styles.label}>CASH AMOUNT RECEIVED</Text>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>₹</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSecondary} maxLength={12} />
        </View>
        <View style={styles.actions}>
          <Button title="Collected as Cash" onPress={recordCash} disabled={!amountValid} loading={submitting} />
          <Button title="Cancel" variant="secondary" onPress={returnToAssignment} disabled={submitting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: "#E5C2AE", paddingHorizontal: spacing.sm },
  headerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...typography.subheading, color: colors.primary, flex: 1, textAlign: "center", fontWeight: "700" },
  content: { padding: spacing.md, paddingBottom: spacing.xl, width: "100%", maxWidth: 680, alignSelf: "center" },
  eyebrow: { ...typography.caption, color: colors.accent, fontWeight: "700", letterSpacing: 1 },
  title: { ...typography.heading, color: colors.textPrimary, marginTop: spacing.sm },
  copy: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  qrPlaceholder: { minHeight: 230, alignItems: "center", justifyContent: "center", padding: spacing.lg, marginVertical: spacing.md, borderWidth: 2, borderStyle: "dashed", borderColor: colors.textSecondary, borderRadius: radius.md, backgroundColor: colors.surface },
  qrTitle: { ...typography.subheading, color: colors.primary, fontWeight: "700", marginTop: spacing.sm },
  qrWarning: { ...typography.body, color: colors.status.error, textAlign: "center", fontWeight: "700", marginTop: spacing.sm },
  label: { ...typography.caption, color: colors.primary, fontWeight: "700", letterSpacing: 1, marginTop: spacing.md },
  amountRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  currency: { ...typography.heading, color: colors.primary },
  input: { flex: 1, minHeight: 60, paddingHorizontal: spacing.sm, fontSize: 22, color: colors.textPrimary },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});

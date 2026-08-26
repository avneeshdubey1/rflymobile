import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../src/store/auth";
import { Banner, Button } from "../src/design-system/components";
import { colors, radius, spacing, typography } from "../src/design-system/tokens";

export default function RecoveryScreen() {
  const error = useAuthStore((state) => state.error);
  const initialize = useAuthStore((state) => state.initialize);
  const logout = useAuthStore((state) => state.logout);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <MaterialIcons name="sync-problem" size={52} color={colors.accent} />
        <Text style={styles.title}>Session setup needs attention</Text>
        <Text style={styles.description}>
          Your signed-in session is preserved. Retry setup before reinstalling
          the app so cached mission evidence remains protected.
        </Text>
        <View style={styles.panel}>
          <Banner
            tone="error"
            title="Setup incomplete"
            message={error || "Pilot workspace setup could not be completed."}
          />
          <Button title="Retry setup" onPress={() => void initialize()} />
          <Button
            title="Sign out"
            variant="secondary"
            onPress={() => void logout()}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  title: {
    ...typography.heading,
    color: colors.primary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 520,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  panel: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.disabled,
  },
  secondaryButton: { marginTop: spacing.md },
});

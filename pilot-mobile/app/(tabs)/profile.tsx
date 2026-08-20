import { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import { useAuthStore } from "../../src/store/auth";
import { useSyncStore } from "../../src/store/sync";
import { Banner, Button, Card } from "../../src/design-system/components";
import { colors, spacing, typography } from "../../src/design-system/tokens";
import { useLocationStore } from "../../src/store/location";

export default function ProfileScreen() {
  const { profile, operatingCenter, logout, logoutAll, setPilotAvailability } =
    useAuthStore();
  const resetSync = useSyncStore((state) => state.reset);
  const trackingStatus = useLocationStore((state) => state.status);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );

  const updateAvailability = async (available: boolean) => {
    setSavingAvailability(true);
    setAvailabilityError(null);
    try {
      await setPilotAvailability(available ? "AVAILABLE" : "OFFLINE");
    } catch (error: any) {
      setAvailabilityError(
        error?.message || "Availability could not be changed.",
      );
    } finally {
      setSavingAvailability(false);
    }
  };

  const confirmLogout = (allDevices: boolean) => {
    Alert.alert(
      allDevices ? "Log out all installations?" : "Log out this installation?",
      allDevices
        ? "Every active mobile session for this account will be revoked."
        : "Cached assignments and queued action data on this installation will be securely removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: allDevices ? "Log out all" : "Log out",
          style: "destructive",
          onPress: () => {
            resetSync();
            void (allDevices ? logoutAll() : logout());
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>Profile & Security</Text>
        <Card>
          <View style={styles.availabilityRow}>
            <View style={styles.availabilityCopy}>
              <Text style={styles.availabilityTitle}>
                {profile?.pilotAvailabilityState === "AVAILABLE"
                  ? "Available for assignments"
                  : "Offline"}
              </Text>
              <Text style={styles.availabilityDescription}>
                {profile?.pilotAvailabilityState === "AVAILABLE"
                  ? "Fleet may assign work. Mission GPS runs only while this app is open and an accepted mission is active."
                  : "Fleet cannot assign new work while you are offline."}
              </Text>
            </View>
            <Switch
              value={profile?.pilotAvailabilityState === "AVAILABLE"}
              onValueChange={(value) => void updateAvailability(value)}
              disabled={!profile || savingAvailability}
              trackColor={{ false: colors.disabled, true: "#F8B37D" }}
              thumbColor={
                profile?.pilotAvailabilityState === "AVAILABLE"
                  ? colors.accent
                  : colors.status.offline
              }
              accessibilityLabel="Available for assignments"
              accessibilityHint="Controls whether Fleet may assign new work to you"
            />
          </View>
          <Text style={styles.locationState}>
            Mission location:{" "}
            {trackingStatus.replaceAll("_", " ").toLowerCase()}
          </Text>
        </Card>
        {availabilityError ? (
          <Banner
            tone="error"
            title="Availability unchanged"
            message={availabilityError}
          />
        ) : null}
        <Card>
          <Info label="NAME" value={profile?.displayName || "Unavailable"} />
          <Info
            label="EMPLOYEE ID"
            value={profile?.employeeCode || "Not recorded"}
          />
          <Info label="ROLE" value={profile?.role || "Unavailable"} />
          <Info
            label="OPERATING CENTRE"
            value={operatingCenter?.displayName || "Not assigned"}
          />
          <Info
            label="LANGUAGE"
            value={profile?.preferredLanguage || "Not recorded"}
          />
        </Card>
        <Banner
          tone="info"
          title="Device-scoped security"
          message="Logging out deletes the encrypted local assignment cache and its device key."
        />
        <Card>
          <Info label="APP" value="RFLY Pilot" />
          <Info
            label="VERSION"
            value={Constants.expoConfig?.version || "1.0.0"}
          />
        </Card>
        <View style={styles.actions}>
          <Button
            title="Log Out This Installation"
            variant="secondary"
            onPress={() => confirmLogout(false)}
          />
          <Button
            title="Log Out All Installations"
            variant="destructive"
            onPress={() => confirmLogout(true)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
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
  info: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.disabled,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  availabilityCopy: { flex: 1 },
  availabilityTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  availabilityDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  locationState: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});

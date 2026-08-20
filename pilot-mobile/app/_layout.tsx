import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../global.css";
import { useAuthStore } from "../src/store/auth";
import { colors } from "../src/design-system/tokens";
import MissionLocationCoordinator from "../src/components/MissionLocationCoordinator";

const busyStatuses = new Set([
  "INITIALIZING",
  "AUTHENTICATING",
  "BOOTSTRAPPING",
]);

export default function RootLayout() {
  const status = useAuthStore((state) => state.status);
  const initialize = useAuthStore((state) => state.initialize);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (useAuthStore.getState().status === "INITIALIZING") {
      void initialize();
    }
  }, [initialize]);

  useEffect(() => {
    if (busyStatuses.has(status)) return;
    const root = segments[0];
    const isPublic = root === "login" || root === "upgrade";

    if (status === "UPGRADE_REQUIRED" && root !== "upgrade") {
      router.replace("/upgrade");
      return;
    }
    if ((status === "UNAUTHENTICATED" || status === "REVOKED") && !isPublic) {
      router.replace("/login");
      return;
    }
    if (status === "READY" && (isPublic || !root)) {
      router.replace("/(tabs)");
    }
  }, [router, segments, status]);

  return (
    <View style={styles.root}>
      <MissionLocationCoordinator />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: styles.stack }}
      />
      {busyStatuses.has(status) ? (
        <View
          style={styles.loadingOverlay}
          accessibilityLabel="Loading Pilot Field"
        >
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : null}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stack: { backgroundColor: colors.background },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});

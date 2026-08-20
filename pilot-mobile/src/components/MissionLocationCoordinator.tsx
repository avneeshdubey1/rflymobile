import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Location from "expo-location";
import { api, fetchTyped } from "../lib/api";
import { getAssignments } from "../lib/database";
import { ZLocationResponse } from "../contracts/mobile-api";
import { useAuthStore } from "../store/auth";
import { useLocationStore } from "../store/location";
import { useSyncStore } from "../store/sync";

const TRACKED_STATUSES = new Set(["PILOT_ACCEPTED", "IN_PROGRESS"]);

export default function MissionLocationCoordinator() {
  const authStatus = useAuthStore((state) => state.status);
  const profile = useAuthStore((state) => state.profile);
  const capabilities = useAuthStore((state) => state.capabilities);
  const featureFlags = useAuthStore((state) => state.featureFlags);
  const policies = useAuthStore((state) => state.policies);
  const lastSyncTime = useSyncStore((state) => state.lastSyncTime);
  const setLocationState = useLocationStore((state) => state.setState);
  const resetLocationState = useLocationStore((state) => state.reset);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let watcher: Location.LocationSubscription | null = null;

    async function start() {
      resetLocationState();
      if (
        authStatus !== "READY" ||
        !profile ||
        appState !== "active" ||
        profile.pilotAvailabilityState !== "AVAILABLE" ||
        !capabilities.includes("FOREGROUND_LOCATION") ||
        !featureFlags?.foregroundLocation ||
        !policies
      )
        return;

      const assignments = await getAssignments(profile.id);
      const assignment = assignments
        .filter(
          (item) =>
            TRACKED_STATUSES.has(item.status) &&
            item.allowedActions.includes("SEND_LOCATION"),
        )
        .sort((left, right) => {
          if (left.status === "IN_PROGRESS" && right.status !== "IN_PROGRESS")
            return -1;
          if (right.status === "IN_PROGRESS" && left.status !== "IN_PROGRESS")
            return 1;
          return left.dailySequence - right.dailySequence;
        })[0];
      if (!assignment || cancelled) return;

      setLocationState({
        status: "REQUESTING_PERMISSION",
        assignmentId: assignment.id,
      });
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationState({
          status: "PERMISSION_DENIED",
          assignmentId: assignment.id,
        });
        return;
      }

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: policies.locationIntervalSeconds * 1000,
          distanceInterval: 10,
        },
        async (sample) => {
          if (cancelled) return;
          const accuracyMetres = sample.coords.accuracy;
          if (
            accuracyMetres !== null &&
            accuracyMetres > policies.locationAccuracyMetres
          ) {
            setLocationState({
              status: "POOR_ACCURACY",
              assignmentId: assignment.id,
            });
            return;
          }
          try {
            const response = await fetchTyped(
              ZLocationResponse,
              api.post(`/pilot/assignments/${assignment.id}/location`, {
                latitude: sample.coords.latitude,
                longitude: sample.coords.longitude,
                accuracyMetres,
                capturedAt: new Date(sample.timestamp).toISOString(),
              }),
            );
            if (!cancelled)
              setLocationState({
                status: "TRACKING",
                assignmentId: assignment.id,
                lastSentAt: response.location.acceptedAt,
              });
          } catch {
            if (!cancelled)
              setLocationState({
                status: "SEND_FAILED",
                assignmentId: assignment.id,
              });
          }
        },
      );
      if (!cancelled)
        setLocationState({ status: "TRACKING", assignmentId: assignment.id });
    }

    void start().catch(() => {
      if (!cancelled) setLocationState({ status: "SEND_FAILED" });
    });
    return () => {
      cancelled = true;
      watcher?.remove();
      resetLocationState();
    };
  }, [
    appState,
    authStatus,
    capabilities,
    featureFlags,
    lastSyncTime,
    policies,
    profile,
    resetLocationState,
    setLocationState,
  ]);

  return null;
}

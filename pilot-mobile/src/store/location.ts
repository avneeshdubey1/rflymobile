import { create } from "zustand";

export type LocationTrackingStatus =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "TRACKING"
  | "PERMISSION_DENIED"
  | "POOR_ACCURACY"
  | "SEND_FAILED";

interface LocationState {
  status: LocationTrackingStatus;
  assignmentId: string | null;
  lastSentAt: string | null;
  setState: (state: Partial<Omit<LocationState, "setState">>) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  status: "IDLE",
  assignmentId: null,
  lastSentAt: null,
  setState: (state) => set(state),
  reset: () => set({ status: "IDLE", assignmentId: null, lastSentAt: null }),
}));

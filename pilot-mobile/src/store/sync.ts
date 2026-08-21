import { create } from "zustand";
import { api, fetchTyped } from "../lib/api";
import {
  ZAssignmentListResponse,
  ZBootstrapResponse,
  ZChangePage,
  ZMutationRequest,
  ZSyncRequest,
  ZSyncResponse,
  MutationRequest,
} from "../contracts/mobile-api";
import { useAuthStore } from "./auth";
import {
  getPendingMutations,
  getCursor,
  setCursor,
  updateMutationStatus,
  saveAssignments,
  deleteAssignments,
  clearAssignments,
  insertMutation,
} from "../lib/database";
import { z } from "zod";

interface SyncState {
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  consecutiveFailures: number;

  sync: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
  queueMutation: (mutation: MutationRequest) => Promise<string>;
  reset: () => void;
}

const MAX_MUTATIONS_PER_REQUEST = 20;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

function calculateBackoff(failures: number): number {
  if (failures === 0) return 0;
  const backoff = INITIAL_BACKOFF_MS * Math.pow(2, failures - 1);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

// Global promise to track backoff delays
let backoffTimeout: ReturnType<typeof setTimeout> | null = null;

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncTime: null,
  syncError: null,
  consecutiveFailures: 0,

  queueMutation: async (mutation: MutationRequest) => {
    const profile = useAuthStore.getState().profile;
    if (!profile)
      throw new Error("Cannot queue mutation without an active profile.");

    ZMutationRequest.parse(mutation);
    // GM-04: Persist the complete mutation before attempting network transmission.
    await insertMutation(profile.id, mutation);

    // The durable write finishes before transport begins. A lost connection can
    // therefore never lose the Pilot's action.
    void get().sync();
    return mutation.clientActionId;
  },

  refreshAssignments: async () => {
    const profile = useAuthStore.getState().profile;
    if (!profile) return;
    const response = await fetchTyped(
      ZAssignmentListResponse,
      api.get("/pilot/assignments"),
    );
    await saveAssignments(profile.id, response.assignments);
  },

  sync: async () => {
    if (get().isSyncing) return;

    const { consecutiveFailures } = get();

    // Apply bounded exponential backoff if there were previous failures
    if (consecutiveFailures > 0) {
      if (backoffTimeout) return; // already waiting
      const delay = calculateBackoff(consecutiveFailures);
      await new Promise((resolve) => {
        backoffTimeout = setTimeout(() => {
          backoffTimeout = null;
          resolve(true);
        }, delay);
      });
    }

    // Re-check sync lock after backoff
    if (get().isSyncing) return;

    const profile = useAuthStore.getState().profile;
    if (!profile) return; // Unauthenticated

    set({ isSyncing: true, syncError: null });

    try {
      const pendingMutations = await getPendingMutations(
        profile.id,
        MAX_MUTATIONS_PER_REQUEST,
      );
      let cursor = await getCursor(profile.id);
      if (!cursor) {
        const bootstrap = await fetchTyped(
          ZBootstrapResponse,
          api.get("/pilot/bootstrap"),
        );
        await saveAssignments(profile.id, bootstrap.assignments);
        await setCursor(profile.id, bootstrap.sync.cursor);
        cursor = bootstrap.sync.cursor;
      }

      let syncRes: any;
      if (pendingMutations.length > 0) {
        const requestPayload: z.infer<typeof ZSyncRequest> = {
          cursor,
          mutations: pendingMutations,
        };
        syncRes = await fetchTyped(
          ZSyncResponse,
          api.post("/pilot/sync", requestPayload),
        );

        // Update receipts
        for (const receipt of syncRes.mutationReceipts) {
          await updateMutationStatus(
            profile.id,
            receipt.clientActionId,
            receipt.outcome,
            receipt,
          );
        }
      } else {
        syncRes = await fetchTyped(
          ZChangePage,
          api.get(`/pilot/changes?cursor=${encodeURIComponent(cursor)}`),
        );
      }

      // Handle full resync
      if (syncRes.fullResyncRequired) {
        // GM-04: full resync preserves unresolved evidence.
        // (We don't wipe mutations table, only assignments)
        await clearAssignments(profile.id);
      } else {
        if (syncRes.removedAssignmentIds.length > 0) {
          await deleteAssignments(profile.id, syncRes.removedAssignmentIds);
        }
      }

      if (syncRes.changedAssignments.length > 0) {
        await saveAssignments(profile.id, syncRes.changedAssignments);
      }

      await setCursor(profile.id, syncRes.nextCursor);

      set({
        lastSyncTime: Date.now(),
        consecutiveFailures: 0,
        syncError: null,
      });

      set({ isSyncing: false });
    } catch {
      // GM-04: Keep transport failures inside typed UI state. Logging from this
      // layer is noisy in production and risks later exposing request context.
      set((state) => ({
        isSyncing: false,
        consecutiveFailures: state.consecutiveFailures + 1,
        syncError: "Failed to synchronize with server.",
      }));
    }
  },

  reset: () => {
    if (backoffTimeout) clearTimeout(backoffTimeout);
    backoffTimeout = null;
    set({
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      consecutiveFailures: 0,
    });
  },
}));

import { useSyncStore } from "../src/store/sync";
import { useAuthStore } from "../src/store/auth";
import { api } from "../src/lib/api";
import * as db from "../src/lib/database";
import MockAdapter from "axios-mock-adapter";

// Mock DB
jest.mock("../src/lib/database", () => ({
  insertMutation: jest.fn().mockResolvedValue(undefined),
  getPendingMutations: jest.fn().mockResolvedValue([]),
  getCursor: jest.fn().mockResolvedValue("init"),
  setCursor: jest.fn().mockResolvedValue(undefined),
  updateMutationStatus: jest.fn().mockResolvedValue(undefined),
  clearAssignments: jest.fn().mockResolvedValue(undefined),
  deleteAssignments: jest.fn().mockResolvedValue(undefined),
  saveAssignments: jest.fn().mockResolvedValue(undefined),
}));

describe("Sync Engine", () => {
  let mockApi: MockAdapter;

  beforeEach(() => {
    mockApi = new MockAdapter(api);
    jest.clearAllMocks();
    useAuthStore.setState({
      profile: { id: "test-profile-1" } as any,
    });
    useSyncStore.setState({
      isSyncing: false,
      consecutiveFailures: 0,
      syncError: null,
      lastSyncTime: null,
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    mockApi.restore();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("queueMutation inserts mutation and triggers sync", async () => {
    const mutation: any = {
      assignmentId: "12345678-1234-4234-8234-123456789012",
      clientActionId: "12345678-1234-4234-8234-123456789013",
      action: "ACCEPT",
      expectedRevision: 1,
    };

    // Stub sync to do nothing
    const syncSpy = jest
      .spyOn(useSyncStore.getState(), "sync")
      .mockResolvedValue(undefined);

    await useSyncStore.getState().queueMutation(mutation);

    expect(db.insertMutation).toHaveBeenCalledWith("test-profile-1", mutation);
    expect(syncSpy).toHaveBeenCalled();
  });

  it("syncs correctly with empty mutations (downsync)", async () => {
    const validAssignment = {
      id: "12345678-1234-4234-8234-123456789012",
      leadId: "12345678-1234-4234-8234-123456789012",
      revision: 1,
      status: "SCHEDULED",
      crewFormationState: "READY",
      dailySequence: 1,
      serviceWindowStart: "2026-08-18T12:00:00Z",
      serviceWindowEnd: "2026-08-18T14:00:00Z",
      farmer: { displayName: "F", operationalPhone: "+1234567890" },
      farm: { displayAddress: "A", plusCode: null, latitude: 1, longitude: 1 },
      crop: null,
      expectedAcreage: "10.0",
      actualAcreage: null,
      issue: null,
      crew: [
        {
          id: "12345678-1234-4234-8234-123456789012",
          displayName: "C",
          crewRole: "PRIMARY_PILOT",
        },
      ],
      drone: {
        id: "12345678-1234-4234-8234-123456789012",
        code: "D",
        serialNumber: "S",
      },
      lmv: null,
      operatingCenter: null,
      operationalNotes: [],
      updatedAt: "2026-08-18T12:00:00Z",
      allowedActions: ["ACCEPT"],
    };

    mockApi.onGet("/pilot/changes?cursor=init").reply(200, {
      success: true,
      serverTime: "2026-08-18T12:00:00Z",
      nextCursor: "cursor-2",
      fullResyncRequired: false,
      changedAssignments: [validAssignment],
      removedAssignmentIds: ["12345678-1234-4234-8234-123456789013"],
    });

    await useSyncStore.getState().sync();

    expect(db.getPendingMutations).toHaveBeenCalledWith("test-profile-1", 20);
    expect(db.saveAssignments).toHaveBeenCalledWith("test-profile-1", [
      validAssignment,
    ]);
    expect(db.deleteAssignments).toHaveBeenCalledWith("test-profile-1", [
      "12345678-1234-4234-8234-123456789013",
    ]);
    expect(db.setCursor).toHaveBeenCalledWith("test-profile-1", "cursor-2");
    expect(useSyncStore.getState().consecutiveFailures).toBe(0);
  });

  it("syncs correctly with pending mutations (upsync)", async () => {
    const validMutation = {
      assignmentId: "12345678-1234-4234-8234-123456789012",
      clientActionId: "12345678-1234-4234-8234-123456789012",
      action: "ACCEPT",
      expectedRevision: 1,
    };

    (db.getPendingMutations as jest.Mock)
      .mockResolvedValueOnce([validMutation]) // First call returns 1 pending
      .mockResolvedValueOnce([]); // Re-check at the end returns 0

    mockApi.onPost("/pilot/sync").reply(200, {
      success: true,
      serverTime: "2026-08-18T12:00:00Z",
      mutationReceipts: [
        {
          clientActionId: "12345678-1234-4234-8234-123456789012",
          outcome: "APPLIED",
          assignmentId: "12345678-1234-4234-8234-123456789012",
          action: "ACCEPT",
          resultingRevision: 2,
          receivedAt: "2026-08-18T12:00:00Z",
        },
      ],
      nextCursor: "cursor-3",
      fullResyncRequired: false,
      changedAssignments: [],
      removedAssignmentIds: [],
    });

    await useSyncStore.getState().sync();

    expect(mockApi.history.post.length).toBe(1);
    expect(JSON.parse(mockApi.history.post[0].data).mutations).toHaveLength(1);
    expect(db.updateMutationStatus).toHaveBeenCalledWith(
      "test-profile-1",
      "12345678-1234-4234-8234-123456789012",
      "APPLIED",
      expect.objectContaining({ outcome: "APPLIED" }),
    );
    expect(db.setCursor).toHaveBeenCalledWith("test-profile-1", "cursor-3");
  });

  it("applies exponential backoff on failures", async () => {
    (db.getPendingMutations as jest.Mock).mockResolvedValue([]);
    mockApi.onGet("/pilot/changes?cursor=init").reply(500);

    // 1st attempt
    await useSyncStore.getState().sync();
    expect(useSyncStore.getState().consecutiveFailures).toBe(1);

    // 2nd attempt (should block until timer fires)
    const syncPromise = useSyncStore.getState().sync();
    expect(useSyncStore.getState().isSyncing).toBe(false); // Backoff is blocking before lock is acquired

    // Advance timers by 1 second (INITIAL_BACKOFF_MS)
    jest.advanceTimersByTime(1000);
    await syncPromise;

    expect(useSyncStore.getState().consecutiveFailures).toBe(2);
  });
});

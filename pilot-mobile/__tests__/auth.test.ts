import { useAuthStore } from "../src/store/auth";
import { api } from "../src/lib/api";
import * as SecureStore from "expo-secure-store";
import MockAdapter from "axios-mock-adapter";

describe("Auth Store", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    jest.clearAllMocks();
    useAuthStore.setState({
      status: "INITIALIZING",
      profile: null,
      operatingCenter: null,
      capabilities: [],
      featureFlags: null,
      policies: null,
      installationKey: null,
      error: null,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it("generates installation key if missing on initialize", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

    await useAuthStore.getState().initialize();

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "rfly_installation_key",
      expect.any(String),
    );
    expect(useAuthStore.getState().installationKey).toBeDefined();
    expect(useAuthStore.getState().status).toBe("UNAUTHENTICATED");
  });

  it("rejects login for non-PILOT role", async () => {
    mock.onPost("/pilot/auth/login").reply(200, {
      success: true,
      session: {
        accessToken: "token123456789012345678901234567890",
        tokenType: "Bearer",
        idleExpiresAt: "2026-08-18T12:00:00Z",
        absoluteExpiresAt: "2026-08-18T12:00:00Z",
      },
      installation: {
        id: "12345678-1234-4234-8234-123456789012",
        platform: "ANDROID",
        appVersion: "1.0.0",
      },
      profile: {
        role: "FLEET_MANAGER",
        id: "12345678-1234-4234-8234-123456789012",
        displayName: "O",
        employeeCode: null,
        preferredLanguage: "en",
        homeCenterId: null,
        pilotAvailabilityState: "AVAILABLE",
      },
    });

    await useAuthStore.getState().login("test@test.com", "password123");

    expect(useAuthStore.getState().status).toBe("UNAUTHENTICATED");
    expect(useAuthStore.getState().error).toMatch(/restricted to Field Pilots/);
  });

  it("successful login proceeds to bootstrap and READY state", async () => {
    const validProfile = {
      id: "12345678-1234-4234-8234-123456789012",
      role: "PILOT",
      displayName: "P",
      employeeCode: null,
      preferredLanguage: "en",
      homeCenterId: null,
      pilotAvailabilityState: "AVAILABLE",
    };

    mock.onPost("/pilot/auth/login").reply(200, {
      success: true,
      session: {
        accessToken: "token123456789012345678901234567890",
        tokenType: "Bearer",
        idleExpiresAt: "2026-08-18T12:00:00Z",
        absoluteExpiresAt: "2026-08-18T12:00:00Z",
      },
      installation: {
        id: "12345678-1234-4234-8234-123456789012",
        platform: "ANDROID",
        appVersion: "1.0.0",
      },
      profile: validProfile,
    });

    mock.onGet("/pilot/bootstrap").reply(200, {
      success: true,
      apiVersion: "v1",
      app: "PILOT_FIELD",
      serverTime: "2026-08-18T12:00:00Z",
      operatingTimeZone: "UTC",
      profile: validProfile,
      operatingCenter: null,
      assignmentWindow: {
        from: "2026-08-18T12:00:00Z",
        to: "2026-08-18T12:00:00Z",
      },
      assignments: [],
      capabilities: ["MISSION_MUTATE"],
      featureFlags: {
        chat: false,
        foregroundLocation: true,
        issueReporting: true,
      },
      appVersions: { minimum: "1.0.0", recommended: "1.0.0" },
      sync: { cursor: "init" },
      policies: {
        offlineGraceSeconds: 0,
        terminalCacheSeconds: 0,
        locationIntervalSeconds: 1,
        locationAccuracyMetres: 1,
        backgroundLocationEnabled: false,
      },
    });

    await useAuthStore.getState().login("test@test.com", "password123123123");

    expect(useAuthStore.getState().status).toBe("READY");
    expect(useAuthStore.getState().capabilities).toContain("MISSION_MUTATE");
  });

  it("explains an installation cap instead of reducing a valid 409 envelope to HTTP 409", async () => {
    mock.onPost("/pilot/auth/login").reply(409, {
      success: false,
      error: {
        code: "INSTALLATION_LIMIT_REACHED",
        message: "The active installation limit has been reached",
        retryable: false,
      },
    });

    await useAuthStore
      .getState()
      .login("pilot@example.test", "password123123123");

    expect(useAuthStore.getState().status).toBe("UNAUTHENTICATED");
    expect(useAuthStore.getState().error).toMatch(/maximum number of devices/i);
  });

  it("preserves an authenticated session when bootstrap needs operational recovery", async () => {
    const validProfile = {
      id: "22345678-1234-4234-8234-123456789012",
      role: "PILOT",
      displayName: "Pilot",
      employeeCode: null,
      preferredLanguage: "en",
      homeCenterId: null,
      pilotAvailabilityState: "AVAILABLE",
    };

    mock.onPost("/pilot/auth/login").reply(200, {
      success: true,
      session: {
        accessToken: "token123456789012345678901234567890",
        tokenType: "Bearer",
        idleExpiresAt: "2026-08-18T12:00:00Z",
        absoluteExpiresAt: "2026-08-18T12:00:00Z",
      },
      installation: {
        id: "32345678-1234-4234-8234-123456789012",
        platform: "ANDROID",
        appVersion: "1.0.0",
      },
      profile: validProfile,
    });
    mock.onGet("/pilot/bootstrap").reply(409, {
      success: false,
      error: {
        code: "ASSIGNMENT_LOCATION_INCOMPLETE",
        message: "Assigned farm location is incomplete",
        retryable: false,
      },
    });

    await useAuthStore
      .getState()
      .login("pilot@example.test", "password123123123");

    expect(useAuthStore.getState().status).toBe("RECOVERY_REQUIRED");
    expect(useAuthStore.getState().profile).toEqual(validProfile);
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalledWith(
      "rfly_access_token",
    );
    expect(useAuthStore.getState().error).toMatch(/farm location corrected/i);
  });

  it("handleUnauthorized transitions to REVOKED and clears token", () => {
    useAuthStore.setState({ status: "READY", profile: {} as any });

    useAuthStore.getState().handleUnauthorized();

    expect(useAuthStore.getState().status).toBe("REVOKED");
    expect(useAuthStore.getState().profile).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      "rfly_access_token",
    );
  });
});

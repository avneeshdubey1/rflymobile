import { api, fetchTyped, API_BASE_URL, ApiError } from "../src/lib/api";
import { ZLoginResponse } from "../src/contracts/mobile-api";
import * as SecureStore from "expo-secure-store";
import MockAdapter from "axios-mock-adapter";

describe("API Configuration and Validation", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(api);
    jest.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
  });

  it("injects bearer token if available", async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce("test-token");

    mock.onGet("/test").reply(200, { success: true });

    await api.get("/test");

    expect(mock.history.get[0].headers?.Authorization).toBe(
      "Bearer test-token",
    );
  });

  it("injects request ID if not present", async () => {
    mock.onGet("/test").reply(200, { success: true });

    await api.get("/test");

    expect(mock.history.get[0].headers?.["X-Request-ID"]).toBeDefined();
  });

  it("throws ApiError on 401 and calls onUnauthenticated", async () => {
    mock.onGet("/test").reply(401, {
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Please login",
        retryable: false,
      },
    });

    let onUnauthCalled = false;
    const { setApiCallbacks } = require("../src/lib/api");
    setApiCallbacks({
      onUnauthenticated: () => {
        onUnauthCalled = true;
      },
      onUpgradeRequired: () => {},
    });

    await expect(api.get("/test")).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
    });

    expect(onUnauthCalled).toBe(true);
  });

  it("handles 200 OK with success: false as an error", async () => {
    mock.onPost("/test").reply(200, {
      success: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Invalid input",
        retryable: false,
      },
    });

    await expect(api.post("/test")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("fetchTyped validates response against schema", async () => {
    const validResponse = {
      success: true,
      session: {
        accessToken: "12345678901234567890123456789012",
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
        id: "12345678-1234-4234-8234-123456789012",
        displayName: "Test Pilot",
        employeeCode: "P001",
        preferredLanguage: "en",
        homeCenterId: null,
        role: "PILOT",
        pilotAvailabilityState: "AVAILABLE",
      },
    };

    mock.onPost("/login").reply(200, validResponse);

    const result = await fetchTyped(ZLoginResponse, api.post("/login"));
    expect(result.success).toBe(true);
    expect(result.profile.role).toBe("PILOT");
  });

  it("fetchTyped throws VALIDATION_FAILED on invalid response", async () => {
    const invalidResponse = {
      success: true,
      // Missing session
    };

    mock.onPost("/login").reply(200, invalidResponse);

    await expect(
      fetchTyped(ZLoginResponse, api.post("/login")),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      retryable: false,
    });
  });
});

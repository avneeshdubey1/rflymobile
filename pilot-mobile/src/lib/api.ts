import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import Constants from "expo-constants";
import * as SecureStore from "./storage";
import { z } from "zod";
import {
  ZApiErrorResponse,
  ApiErrorResponse,
  ApiErrorCode,
} from "../contracts/mobile-api";

const ZConfigUrl = z.string().url().min(1);

const embeddedApiUrl = Constants.expoConfig?.extra?.apiUrl;
const configuredApiUrl =
  typeof embeddedApiUrl === "string" ? embeddedApiUrl.trim() : undefined;

if (!configuredApiUrl) {
  throw new Error(
    "The embedded API URL is missing. Build the app with EXPO_PUBLIC_API_URL set to an API address reachable from the Android device.",
  );
}

const parsedUrl = ZConfigUrl.safeParse(configuredApiUrl);
if (!parsedUrl.success) {
  throw new Error(
    `EXPO_PUBLIC_API_URL must be a valid URL. Received: ${configuredApiUrl}`,
  );
}

const configuredBaseUrl = parsedUrl.data.replace(/\/+$/u, "");
export const API_BASE_URL = configuredBaseUrl.endsWith("/api/mobile/v1")
  ? configuredBaseUrl
  : `${configuredBaseUrl}/api/mobile/v1`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

export interface ApiError {
  code: ApiErrorCode | "NETWORK_ERROR" | "VALIDATION_FAILED";
  message: string;
  retryable: boolean;
  requestId?: string;
  details?: any;
}

type InterceptorCallbacks = {
  onUnauthenticated: () => void;
  onUpgradeRequired: () => void;
};

let callbacks: InterceptorCallbacks | null = null;

export const setApiCallbacks = (newCallbacks: InterceptorCallbacks) => {
  callbacks = newCallbacks;
};

// Request Interceptor: Inject Bearer Token & Request ID
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync("rfly_access_token");
      if (token && config.headers) {
        if (typeof config.headers.set === "function") {
          config.headers.set("Authorization", `Bearer ${token}`);
        } else {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      // Inject a tracing request ID for diagnostics if not present
      if (config.headers && !config.headers["X-Request-ID"]) {
        const requestId =
          globalThis.crypto?.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        if (typeof config.headers.set === "function") {
          config.headers.set("X-Request-ID", requestId);
        } else {
          config.headers["X-Request-ID"] = requestId;
        }
      }
    } catch {
      // Ignore secure store errors during request
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Parse errors, handle 401/426, and privacy-safe diagnostics
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data && response.data.success === false) {
      // It's a formatted error disguised as a 200
      const parsed = ZApiErrorResponse.safeParse(response.data);
      if (parsed.success) {
        return Promise.reject(parsed.data.error as ApiError);
      }
      return Promise.reject({
        code: "INTERNAL_ERROR",
        message: "Received unsuccessful response with invalid error format",
        retryable: false,
      } as ApiError);
    }
    return response;
  },
  (error: AxiosError<unknown>) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 401) {
        callbacks?.onUnauthenticated();
      } else if (status === 426) {
        callbacks?.onUpgradeRequired();
      }

      // Try to parse standard API error envelope
      const parsedError = ZApiErrorResponse.safeParse(data);
      if (parsedError.success) {
        return Promise.reject(parsedError.data.error);
      }

      // Handle HTML/Proxy error responses safely without leaking PII
      return Promise.reject({
        code: "INTERNAL_ERROR",
        message: `Server returned HTTP ${status}`,
        retryable: status >= 500 || status === 429,
      } as ApiError);
    }

    // Network or timeout errors
    const fallbackError: ApiError = {
      code: "NETWORK_ERROR",
      message:
        error.code === "ECONNABORTED"
          ? "The server did not respond in time."
          : "The server is unreachable. Check your connection and API address.",
      retryable: true,
    };
    return Promise.reject(fallbackError);
  },
);

/**
 * Utility to fetch and parse a strongly typed response.
 */
export async function fetchTyped<T>(
  schema: z.ZodSchema<T>,
  request: Promise<AxiosResponse<unknown>>,
): Promise<T> {
  const response = await request;
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) {
    const error: ApiError = {
      code: "VALIDATION_FAILED",
      message: "Failed to validate API response payload against schema.",
      retryable: false,
      details: parsed.error.issues,
    };
    return Promise.reject(error);
  }
  return parsed.data;
}

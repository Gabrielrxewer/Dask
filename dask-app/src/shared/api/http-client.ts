import { appConfig, buildApiUrl } from "@/shared/config/env";
import { beginGlobalLoading } from "@/shared/lib/loading/global-loading";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type AuthMode = "none" | "optional" | "required";

export interface ApiErrorPayload {
  message?: string;
  details?: unknown;
  issues?: unknown;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;
  public readonly issues?: unknown;
  public readonly isNetworkError: boolean;

  public constructor({
    message,
    status,
    details,
    issues,
    isNetworkError = false
  }: {
    message: string;
    status: number;
    details?: unknown;
    issues?: unknown;
    isNetworkError?: boolean;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.issues = issues;
    this.isNetworkError = isNetworkError;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export interface HttpAuthBridge {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  handleUnauthorized: () => void;
  getCsrfToken?: () => string | null;
}

let authBridge: HttpAuthBridge | null = null;

export function setHttpAuthBridge(bridge: HttpAuthBridge | null): void {
  authBridge = bridge;
}

interface InternalRequestConfig {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  authMode: AuthMode;
  retryOnUnauthorized: boolean;
  isRetryAttempt: boolean;
  globalLoading: boolean;
}

export interface RequestConfig {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  authMode?: AuthMode;
  retryOnUnauthorized?: boolean;
  globalLoading?: boolean;
}

function createApiError(status: number, payload: unknown): ApiError {
  if (!payload || typeof payload !== "object") {
    return new ApiError({
      status,
      message: `Request failed with status ${status}`
    });
  }

  const objectPayload = payload as ApiErrorPayload;

  return new ApiError({
    status,
    message: objectPayload.message ?? `Request failed with status ${status}`,
    details: objectPayload.details,
    issues: objectPayload.issues
  });
}

function isMutatingMethod(method: HttpMethod): boolean {
  return method !== "GET";
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const normalizedName = name.toLowerCase();
  return Object.keys(headers).some(key => key.toLowerCase() === normalizedName);
}

function resolveCredentialsMode(): RequestCredentials {
  return appConfig.authTransportMode === "cookie-session" ? "include" : "same-origin";
}

async function readResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? { message: text } : undefined;
}

async function runRequest<T>(config: InternalRequestConfig): Promise<T> {
  const stopGlobalLoading = config.globalLoading
    ? beginGlobalLoading({
        source: "request",
        label: config.method === "GET" ? "Sincronizando dados da tela" : "Processando sua solicitacao"
      })
    : () => undefined;
  const headers: Record<string, string> = {
    ...config.headers
  };

  if (!hasHeader(headers, "accept")) {
    headers.Accept = "application/json";
  }

  if (config.body !== undefined && !(config.body instanceof FormData) && !hasHeader(headers, "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  if (authBridge && config.authMode !== "none") {
    const accessToken = authBridge.getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    } else if (config.authMode === "required" && appConfig.authTransportMode !== "cookie-session") {
      throw new ApiError({
        status: 401,
        message: "Authentication required."
      });
    }

    if (isMutatingMethod(config.method)) {
      const csrfToken = authBridge.getCsrfToken?.();
      if (csrfToken) {
        headers[appConfig.csrfHeaderName] = csrfToken;
      }
    }
  }

  let response: Response;

  try {
    try {
      response = await fetch(buildApiUrl(config.path), {
        method: config.method,
        headers,
        body: config.body === undefined || config.body instanceof FormData ? (config.body as BodyInit | undefined) : JSON.stringify(config.body),
        signal: config.signal,
        credentials: resolveCredentialsMode()
      });
    } catch {
      throw new ApiError({
        status: 0,
        message: "Network error. Please check your connection and try again.",
        isNetworkError: true
      });
    }

    const payload = await readResponsePayload(response);

    if (response.ok) {
      return payload as T;
    }

    const error = createApiError(response.status, payload);

    if (
      error.status === 401 &&
      config.authMode !== "none" &&
      config.retryOnUnauthorized &&
      !config.isRetryAttempt &&
      authBridge
    ) {
      const refreshedAccessToken = await authBridge.refreshAccessToken();

      if (refreshedAccessToken || appConfig.authTransportMode === "cookie-session") {
        return runRequest<T>({
          ...config,
          isRetryAttempt: true
        });
      }

      authBridge.handleUnauthorized();
    }

    throw error;
  } finally {
    stopGlobalLoading();
  }
}

function toInternalConfig(path: string, config: RequestConfig): InternalRequestConfig {
  const method = config.method ?? "GET";

  return {
    method,
    path,
    body: config.body,
    headers: config.headers,
    signal: config.signal,
    authMode: config.authMode ?? "optional",
    retryOnUnauthorized: config.retryOnUnauthorized ?? true,
    isRetryAttempt: false,
    globalLoading: config.globalLoading ?? false
  };
}

export const apiClient = {
  request<T>(path: string, config: RequestConfig = {}): Promise<T> {
    return runRequest<T>(toInternalConfig(path, config));
  },

  get<T>(path: string, config: Omit<RequestConfig, "method" | "body"> = {}): Promise<T> {
    return apiClient.request<T>(path, { ...config, method: "GET" });
  },

  post<T>(path: string, body?: unknown, config: Omit<RequestConfig, "method" | "body"> = {}): Promise<T> {
    return apiClient.request<T>(path, { ...config, method: "POST", body });
  },

  put<T>(path: string, body?: unknown, config: Omit<RequestConfig, "method" | "body"> = {}): Promise<T> {
    return apiClient.request<T>(path, { ...config, method: "PUT", body });
  },

  patch<T>(path: string, body?: unknown, config: Omit<RequestConfig, "method" | "body"> = {}): Promise<T> {
    return apiClient.request<T>(path, { ...config, method: "PATCH", body });
  },

  delete<T>(path: string, config: Omit<RequestConfig, "method" | "body"> = {}): Promise<T> {
    return apiClient.request<T>(path, { ...config, method: "DELETE" });
  }
};

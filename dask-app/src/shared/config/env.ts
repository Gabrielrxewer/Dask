export type AuthTransportMode = "body-refresh-token" | "cookie-session";

const DEFAULT_API_BASE_URL = "http://localhost:3333";
const DEFAULT_API_PREFIX = "/api/v1";
const DEFAULT_CSRF_HEADER_NAME = "x-csrf-token";

function normalizeApiPrefix(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "/") {
    return "";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

function resolveAuthTransportMode(value: string | undefined): AuthTransportMode {
  if (value === "cookie-session") {
    return "cookie-session";
  }

  return "body-refresh-token";
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const raw = (value ?? DEFAULT_API_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

export const appConfig = {
  apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  apiPrefix: normalizeApiPrefix(import.meta.env.VITE_API_PREFIX ?? DEFAULT_API_PREFIX),
  authTransportMode: resolveAuthTransportMode(import.meta.env.VITE_AUTH_TRANSPORT_MODE),
  csrfHeaderName: import.meta.env.VITE_CSRF_HEADER_NAME ?? DEFAULT_CSRF_HEADER_NAME
} as const;

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${appConfig.apiBaseUrl}${appConfig.apiPrefix}${normalizedPath}`;
}

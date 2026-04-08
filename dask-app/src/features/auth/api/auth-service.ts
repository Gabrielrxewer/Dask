import { appConfig } from "@/shared/config/env";
import { ApiError, apiClient } from "@/shared/api/http-client";
import type {
  AuthServiceContract,
  AuthSuccessResponse,
  AuthTokenPair,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput
} from "@/features/auth/api/types";

function buildRefreshPayload(input: RefreshInput): RefreshInput | undefined {
  if (appConfig.authTransportMode === "cookie-session") {
    return undefined;
  }

  if (!input.refreshToken) {
    throw new ApiError({
      status: 401,
      message: "Missing refresh token."
    });
  }

  return { refreshToken: input.refreshToken };
}

function buildLogoutPayload(input: LogoutInput): LogoutInput | undefined {
  if (appConfig.authTransportMode === "cookie-session") {
    return undefined;
  }

  if (!input.refreshToken) {
    throw new ApiError({
      status: 401,
      message: "Missing refresh token."
    });
  }

  return { refreshToken: input.refreshToken };
}

export const authService: AuthServiceContract = {
  register(input: RegisterInput): Promise<AuthSuccessResponse> {
    return apiClient.post<AuthSuccessResponse>("/auth/register", input, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  login(input: LoginInput): Promise<AuthSuccessResponse> {
    return apiClient.post<AuthSuccessResponse>("/auth/login", input, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  refresh(input: RefreshInput): Promise<AuthTokenPair> {
    return apiClient.post<AuthTokenPair>("/auth/refresh", buildRefreshPayload(input), {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  async logout(input: LogoutInput): Promise<void> {
    await apiClient.post<void>("/auth/logout", buildLogoutPayload(input), {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  async logoutAll(): Promise<void> {
    await apiClient.post<void>("/auth/logout-all", undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  me() {
    return apiClient.get<AuthSuccessResponse["user"]>("/auth/me", {
      authMode: "required",
      retryOnUnauthorized: true
    });
  }
};

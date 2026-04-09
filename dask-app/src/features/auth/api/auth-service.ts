import { apiClient } from "@/shared/api/http-client";
import type { AuthenticatedUser } from "@/entities/user";
import type {
  AuthServiceContract,
  AuthSuccessResponse,
  LoginInput,
  LogoutInput,
  RefreshResponse,
  RefreshInput,
  RegisterInput
} from "@/features/auth/api/types";

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

  refresh(_input: RefreshInput): Promise<RefreshResponse> {
    return apiClient.post<RefreshResponse>("/auth/refresh", undefined, {
      authMode: "optional",
      retryOnUnauthorized: false
    });
  },

  async logout(_input: LogoutInput): Promise<void> {
    await apiClient.post<void>("/auth/logout", undefined, {
      authMode: "optional",
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
    return apiClient.get<AuthenticatedUser>("/auth/me", {
      authMode: "required",
      retryOnUnauthorized: true
    });
  }
};

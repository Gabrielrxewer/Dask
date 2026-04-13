import { apiClient } from "@/shared/api/http-client";
import type { AuthenticatedUser } from "@/entities/user";
import type {
  AuthServiceContract,
  AuthSuccessResponse,
  ConfirmPasswordResetInput,
  LoginInput,
  LogoutInput,
  RefreshResponse,
  RefreshInput,
  RegisterInput,
  ResendVerificationEmailInput,
  RequestPasswordResetInput,
  RequestPasswordResetResponse
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
  },

  requestPasswordReset(input: RequestPasswordResetInput): Promise<RequestPasswordResetResponse> {
    return apiClient.post<RequestPasswordResetResponse>("/auth/password-reset/request", input, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
    await apiClient.post<void>("/auth/password-reset/confirm", input, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  async resendVerificationEmail(input: ResendVerificationEmailInput): Promise<void> {
    await apiClient.post<void>("/auth/email-verification/resend", input, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  async verifyEmail(token: string): Promise<void> {
    await apiClient.get<void>(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  }
};

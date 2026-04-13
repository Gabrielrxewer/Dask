import type { AuthenticatedUser } from "@/entities/user";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export interface RefreshInput {
}

export interface LogoutInput {
}

export interface RefreshResponse {
  accessToken: string;
}

export interface AuthSuccessResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface RequestPasswordResetResponse {
  message: string;
  resetToken?: string;
}

export interface ConfirmPasswordResetInput {
  token: string;
  newPassword: string;
}

export interface ResendVerificationEmailInput {
  email: string;
}

export interface AuthServiceContract {
  register: (input: RegisterInput) => Promise<AuthSuccessResponse>;
  login: (input: LoginInput) => Promise<AuthSuccessResponse>;
  refresh: (input: RefreshInput) => Promise<RefreshResponse>;
  logout: (input: LogoutInput) => Promise<void>;
  logoutAll: () => Promise<void>;
  me: () => Promise<AuthenticatedUser>;
  requestPasswordReset: (input: RequestPasswordResetInput) => Promise<RequestPasswordResetResponse>;
  confirmPasswordReset: (input: ConfirmPasswordResetInput) => Promise<void>;
  resendVerificationEmail: (input: ResendVerificationEmailInput) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
}

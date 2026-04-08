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
  refreshToken?: string;
}

export interface LogoutInput {
  refreshToken?: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSuccessResponse extends AuthTokenPair {
  user: AuthenticatedUser;
}

export interface AuthServiceContract {
  register: (input: RegisterInput) => Promise<AuthSuccessResponse>;
  login: (input: LoginInput) => Promise<AuthSuccessResponse>;
  refresh: (input: RefreshInput) => Promise<AuthTokenPair>;
  logout: (input: LogoutInput) => Promise<void>;
  logoutAll: () => Promise<void>;
  me: () => Promise<AuthenticatedUser>;
}

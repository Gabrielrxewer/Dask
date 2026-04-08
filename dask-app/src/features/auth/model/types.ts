import type { AuthenticatedUser } from "@/entities/user";

export type AuthStatus =
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "refreshing"
  | "session_expired"
  | "logout_in_progress";

export interface AuthState {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  initialized: boolean;
  sessionNotice: string | null;
  errorMessage: string | null;
}

export interface AuthSnapshot extends AuthState {
  isAuthenticated: boolean;
}

import { useMemo } from "react";
import { useAuth } from "@/features/auth/model";

export function useSessionStatus() {
  const auth = useAuth();

  return useMemo(
    () => ({
      status: auth.status,
      isAuthenticated: auth.isAuthenticated,
      isInitializing: auth.status === "initializing",
      isRefreshing: auth.status === "refreshing",
      isSessionExpired: auth.status === "session_expired",
      isLogoutInProgress: auth.status === "logout_in_progress"
    }),
    [auth.status, auth.isAuthenticated]
  );
}

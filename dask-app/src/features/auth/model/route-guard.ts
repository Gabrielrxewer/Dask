import type { AuthSnapshot } from "@/features/auth/model/types";

export interface RouteGuardResult {
  mode: "allow" | "redirect" | "loading";
  redirectTo?: string;
  reason?: "session_expired" | "unauthenticated";
}

export function resolveProtectedRoute(snapshot: AuthSnapshot): RouteGuardResult {
  if (snapshot.status === "initializing" || snapshot.status === "refreshing") {
    return { mode: "loading" };
  }

  if (snapshot.isAuthenticated) {
    return { mode: "allow" };
  }

  return {
    mode: "redirect",
    redirectTo: "/login",
    reason: snapshot.status === "session_expired" ? "session_expired" : "unauthenticated"
  };
}

export function resolvePublicRoute(snapshot: AuthSnapshot): RouteGuardResult {
  if (snapshot.status === "initializing" || snapshot.status === "refreshing") {
    return { mode: "loading" };
  }

  if (snapshot.isAuthenticated) {
    return {
      mode: "redirect",
      redirectTo: "/board"
    };
  }

  return { mode: "allow" };
}

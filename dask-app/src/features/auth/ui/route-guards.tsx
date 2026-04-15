import { Navigate, Outlet, useLocation } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { AuthRouteFallback } from "@/features/auth/ui/auth-route-fallback";
import { useAuth } from "@/features/auth/model";
import { useProtectedRouteGuard, usePublicRouteGuard } from "@/features/auth/model/use-auth-route-guard";

interface PublicRouteProps {
  children: JSX.Element;
}

interface AdminRouteProps {
  children: JSX.Element;
}

interface LocationState {
  from?: {
    pathname?: string;
    search?: string;
  };
}

export function ProtectedRoute() {
  const guard = useProtectedRouteGuard();

  if (guard.mode === "loading") {
    return <AuthRouteFallback />;
  }

  if (guard.mode === "redirect") {
    return <Navigate replace to={guard.redirectTo ?? routePaths.login} state={guard.redirectState} />;
  }

  return <Outlet />;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const guard = usePublicRouteGuard();
  const location = useLocation();

  if (guard.mode === "loading") {
    return <AuthRouteFallback />;
  }

  if (guard.mode === "redirect") {
    const state = (location.state as LocationState | null) ?? null;
    const fallbackPath = guard.redirectTo ?? routePaths.workspaceEntry;
    const fromPath = state?.from?.pathname;
    const fromSearch = state?.from?.search ?? "";

    // Allow redirecting back to protected app routes (/w/...) or billing flow (/choose-plan).
    // Paths like /login, /reset-password or /verify-email must never be
    // used as redirect targets — they would create confusing loops.
    const VALID_PREFIXES = ["/w", "/choose-plan"];
    const isValidAppPath =
      typeof fromPath === "string" && VALID_PREFIXES.some((prefix) => fromPath.startsWith(prefix));
    const redirectTo = isValidAppPath ? `${fromPath}${fromSearch}` : fallbackPath;

    return <Navigate replace to={redirectTo} />;
  }

  return children;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const guard = useProtectedRouteGuard();
  const auth = useAuth();

  if (guard.mode === "loading") {
    return <AuthRouteFallback />;
  }

  if (guard.mode === "redirect") {
    return <Navigate replace to={guard.redirectTo ?? routePaths.login} state={guard.redirectState} />;
  }

  if (!auth.user?.isPlatformAdmin) {
    return <Navigate replace to={routePaths.workspaceEntry} />;
  }

  return children;
}

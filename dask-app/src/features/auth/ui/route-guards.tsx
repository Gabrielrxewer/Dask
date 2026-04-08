import { Navigate, Outlet, useLocation } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { AuthRouteFallback } from "@/features/auth/ui/auth-route-fallback";
import { useProtectedRouteGuard, usePublicRouteGuard } from "@/features/auth/model/use-auth-route-guard";

interface PublicRouteProps {
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
    const fallbackPath = guard.redirectTo ?? routePaths.board;
    const fromPath = state?.from?.pathname;
    const fromSearch = state?.from?.search ?? "";
    const redirectTo = fromPath ? `${fromPath}${fromSearch}` : fallbackPath;

    return <Navigate replace to={redirectTo} />;
  }

  return children;
}

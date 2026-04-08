import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/model";
import { resolveProtectedRoute, resolvePublicRoute } from "@/features/auth/model/route-guard";

export function useProtectedRouteGuard() {
  const auth = useAuth();
  const location = useLocation();

  return useMemo(() => {
    const result = resolveProtectedRoute(auth);

    if (result.mode !== "redirect") {
      return {
        ...result,
        redirectState: null
      };
    }

    return {
      ...result,
      redirectState: {
        from: { pathname: location.pathname, search: location.search },
        reason: result.reason
      }
    };
  }, [auth, location.pathname, location.search]);
}

export function usePublicRouteGuard() {
  const auth = useAuth();
  return useMemo(() => resolvePublicRoute(auth), [auth]);
}

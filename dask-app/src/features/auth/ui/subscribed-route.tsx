import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { AuthRouteFallback } from "@/features/auth/ui/auth-route-fallback";
import { useProtectedRouteGuard } from "@/features/auth/model/use-auth-route-guard";
import { billingStore, useBilling } from "@/modules/billing";

/**
 * Requires:
 *   1. User to be authenticated (delegates to ProtectedRoute logic)
 *   2. User to have an active Stripe subscription
 *
 * If billing status is still loading, renders a fallback.
 * If no active subscription, redirects to /choose-plan.
 */
export function SubscribedRoute() {
  const authGuard = useProtectedRouteGuard();
  const billing = useBilling();

  // Kick off billing load as soon as we know the user is authenticated
  useEffect(() => {
    if (authGuard.mode === "allow" && billing.loadState === "idle") {
      billingStore.load();
    }
  }, [authGuard.mode, billing.loadState]);

  // Auth check first
  if (authGuard.mode === "loading") {
    return <AuthRouteFallback />;
  }

  if (authGuard.mode === "redirect") {
    return <Navigate replace to={authGuard.redirectTo ?? routePaths.login} state={authGuard.redirectState} />;
  }

  // Billing check
  if (billing.loadState === "idle" || billing.loadState === "loading") {
    return <AuthRouteFallback />;
  }

  if (!billing.status?.canAccessPlatform) {
    return <Navigate replace to={routePaths.choosePlan} />;
  }

  return <Outlet />;
}

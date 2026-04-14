import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/model";
import { billingStore, useBilling } from "@/modules/billing";

/**
 * Ensures billing status is loaded for authenticated users.
 * Used for billing-related routes that don't require a subscription.
 */
export function BillingProvider() {
  const { isAuthenticated, status } = useAuth();
  const billing = useBilling();

  useEffect(() => {
    if (isAuthenticated && billing.loadState === "idle") {
      billingStore.load();
    } else if (status === "unauthenticated" || status === "session_expired") {
      billingStore.reset();
    }
  }, [isAuthenticated, status, billing.loadState]);

  return <Outlet />;
}

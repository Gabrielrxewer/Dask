import { useSyncExternalStore } from "react";
import { billingStore } from "./billing-store";
import type { BillingState } from "./types";

export function useBilling(): BillingState {
  return useSyncExternalStore(
    (listener) => billingStore.subscribe(listener),
    () => billingStore.getSnapshot()
  );
}

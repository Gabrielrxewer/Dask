import { useMutation } from "@tanstack/react-query";
import { portalService } from "@/pages/billing-public-page/api/portal-service";

export function useBillingPortalOnboardMutation() {
  return useMutation({
    mutationFn: (billingToken: string) => portalService.onboardBillingToken(billingToken)
  });
}

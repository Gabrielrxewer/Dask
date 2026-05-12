import { useQuery } from "@tanstack/react-query";
import { adminTelemetryService } from "@/pages/platform-admin-page/api/admin-telemetry-service";
import type { AdminTelemetryOverview } from "@/pages/platform-admin-page/model/types";

export function usePlatformAdminTelemetryOverviewQuery(options: { enabled?: boolean } = {}) {
  return useQuery<AdminTelemetryOverview>({
    queryKey: ["platform-admin", "telemetry", "overview"],
    queryFn: () => adminTelemetryService.getOverview(),
    enabled: options.enabled ?? true,
    refetchInterval: 30000
  });
}

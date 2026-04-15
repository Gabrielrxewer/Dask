import { apiClient } from "@/shared/api/http-client";
import type { AdminTelemetryOverview } from "@/pages/platform-admin-page/model/types";

export const adminTelemetryService = {
  getOverview(): Promise<AdminTelemetryOverview> {
    return apiClient.get<AdminTelemetryOverview>("/admin/telemetry/overview", {
      authMode: "required",
      retryOnUnauthorized: true
    });
  }
};

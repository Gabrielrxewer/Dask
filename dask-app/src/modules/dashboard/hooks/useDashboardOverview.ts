import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { dashboardApi } from "@/modules/dashboard/services/dashboard-api";
import type { DashboardFilters, DashboardResponse } from "@/modules/dashboard/types";
import { isApiError } from "@/shared/api/http-client";

export function useDashboardOverview(filters: DashboardFilters) {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!workspaceSlug) {
      setDashboard(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    dashboardApi
      .fetchOverview(workspaceSlug, filters, controller.signal)
      .then((response) => {
        setDashboard(response);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(isApiError(caught) ? caught.message : "Nao foi possivel carregar o dashboard.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [workspaceSlug, filters, refreshKey]);

  const reload = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  return {
    dashboard,
    isLoading,
    error,
    reload
  };
}

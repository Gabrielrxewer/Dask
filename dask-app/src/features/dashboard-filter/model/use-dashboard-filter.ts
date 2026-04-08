import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { DashboardFilterState } from "@/features/dashboard-filter/model/types";
import { initialDashboardFilter } from "@/features/dashboard-filter/model/filter-utils";

interface UseDashboardFilterResult {
  filter: DashboardFilterState;
  setQuery: (query: string) => void;
  toggleMineOnly: () => void;
  setFilter: Dispatch<SetStateAction<DashboardFilterState>>;
}

export function useDashboardFilter(initialState: DashboardFilterState = initialDashboardFilter): UseDashboardFilterResult {
  const [filter, setFilter] = useState<DashboardFilterState>(initialState);

  const setQuery = useCallback((query: string) => {
    setFilter(prev => ({ ...prev, query }));
  }, []);

  const toggleMineOnly = useCallback(() => {
    setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }));
  }, []);

  return {
    filter,
    setQuery,
    toggleMineOnly,
    setFilter
  };
}

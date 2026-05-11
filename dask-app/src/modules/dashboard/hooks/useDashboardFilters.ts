import { useCallback, useMemo, useState } from "react";
import type { DashboardFilterKey, DashboardFilters } from "@/modules/dashboard/types";

function startOfDayIso(date: Date): string {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString();
}

function endOfDayIso(date: Date): string {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next.toISOString();
}

function makeDefaultFilters(): DashboardFilters {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);

  return {
    from: startOfDayIso(start),
    to: endOfDayIso(end)
  };
}

export function dateInputToIso(value: string, boundary: "start" | "end"): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return boundary === "start" ? startOfDayIso(parsed) : endOfDayIso(parsed);
}

export function isoToDateInput(value: string | undefined): string {
  if (!value) {
    return "";
  }

  const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) {
    return isoDate[1];
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useDashboardFilters(initialFilters?: DashboardFilters) {
  const [filters, setFilters] = useState<DashboardFilters>(() => initialFilters ?? makeDefaultFilters());

  const updateFilter = useCallback((key: DashboardFilterKey, value: string | undefined) => {
    setFilters((current) => {
      const next = { ...current };
      if (value && value.trim().length > 0) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  }, []);

  const applyFilters = useCallback((nextFilters: DashboardFilters) => {
    setFilters(() => {
      const next: DashboardFilters = {};
      (Object.entries(nextFilters) as Array<[DashboardFilterKey, string | undefined]>).forEach(([key, value]) => {
        if (value && value.trim().length > 0) {
          next[key] = value;
        }
      });
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(makeDefaultFilters());
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => typeof value === "string" && value.length > 0).length,
    [filters]
  );

  return {
    filters,
    updateFilter,
    applyFilters,
    resetFilters,
    activeFilterCount
  };
}

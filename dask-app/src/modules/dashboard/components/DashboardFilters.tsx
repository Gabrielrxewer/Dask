import { useMemo } from "react";
import { isoToDateInput } from "@/modules/dashboard/hooks";
import type { DashboardFilterKey, DashboardFilterOptions, DashboardFilters } from "@/modules/dashboard/types";

interface DashboardFiltersProps {
  filters: DashboardFilters;
  options: DashboardFilterOptions;
}

type FilterOption = { id: string; label: string };

interface FilterChip {
  key: string;
  label: string;
}

const FILTER_LABELS: Record<Exclude<DashboardFilterKey, "from" | "to">, string> = {
  assigneeId: "Responsavel",
  itemTypeId: "Tipo",
  stateId: "Estado",
  columnId: "Coluna",
  workflowId: "Workflow",
  status: "Status"
};

function findOptionLabel(options: FilterOption[], value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return options.find((option) => option.id === value)?.label ?? value;
}

function formatDateChip(value: string | undefined): string {
  const input = isoToDateInput(value);
  if (!input) {
    return "";
  }

  const [year, month, day] = input.split("-");
  return `${day}/${month}/${year}`;
}

export function buildDashboardFilterChips(filters: DashboardFilters, options: DashboardFilterOptions): FilterChip[] {
  const chips: FilterChip[] = [];
  const from = formatDateChip(filters.from);
  const to = formatDateChip(filters.to);

  if (from || to) {
    chips.push({
      key: "period",
      label: `Periodo: ${from || "inicio"} -> ${to || "hoje"}`
    });
  }

  const optionMap: Record<Exclude<DashboardFilterKey, "from" | "to">, FilterOption[]> = {
    assigneeId: options.members,
    itemTypeId: options.itemTypes,
    stateId: options.states,
    columnId: options.columns,
    workflowId: options.workflows,
    status: options.automationStatuses
  };

  (Object.keys(optionMap) as Array<Exclude<DashboardFilterKey, "from" | "to">>).forEach((key) => {
    const value = filters[key];
    const label = findOptionLabel(optionMap[key], value);
    if (label) {
      chips.push({
        key,
        label: `${FILTER_LABELS[key]}: ${label}`
      });
    }
  });

  return chips;
}

export function DashboardFilters({
  filters,
  options
}: DashboardFiltersProps) {
  const chips = useMemo(() => buildDashboardFilterChips(filters, options), [filters, options]);

  if (chips.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-active-filters" aria-label="Filtros ativos">
      {chips.map((chip) => (
        <span className="dashboard-active-filters__chip" key={chip.key}>{chip.label}</span>
      ))}
    </section>
  );
}

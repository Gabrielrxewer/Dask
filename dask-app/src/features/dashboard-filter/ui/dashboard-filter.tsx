import type { ChangeEvent } from "react";
import type { DashboardFilterState } from "@/features/dashboard-filter/model/types";
import { Button, FilterBar, TextInput } from "@/shared/ui";
import "./dashboard-filter.css";

interface DashboardFilterProps {
  query: DashboardFilterState["query"];
  mineOnly: DashboardFilterState["mineOnly"];
  onQueryChange: (value: string) => void;
  onMineToggle: () => void;
}

export function DashboardFilter({
  query,
  mineOnly,
  onQueryChange,
  onMineToggle
}: DashboardFilterProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onQueryChange(event.target.value);
  };

  return (
    <FilterBar className="dashboard-filter">
      <TextInput
        className="dashboard-filter__search"
        type="search"
        value={query}
        onChange={handleChange}
        placeholder="Buscar tarefa, tag ou responsavel..."
        aria-label="Buscar tarefa, tag ou responsavel"
      />

      <Button
        variant="outline"
        className={mineOnly ? "dashboard-filter__mine-toggle active" : "dashboard-filter__mine-toggle"}
        onClick={onMineToggle}
        aria-pressed={mineOnly}
      >
        Somente minhas
      </Button>
    </FilterBar>
  );
}

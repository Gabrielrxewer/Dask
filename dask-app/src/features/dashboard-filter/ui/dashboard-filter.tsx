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
      <div className="dashboard-filter__search">
        <TextInput
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Buscar tarefa, tag ou responsavel..."
          aria-label="Buscar tarefa"
        />
      </div>

      <Button
        variant="primary"
        className={mineOnly ? "dashboard-filter__mine-button active" : "dashboard-filter__mine-button"}
        onClick={onMineToggle}
        aria-pressed={mineOnly}
      >
        Somente minhas
      </Button>
    </FilterBar>
  );
}

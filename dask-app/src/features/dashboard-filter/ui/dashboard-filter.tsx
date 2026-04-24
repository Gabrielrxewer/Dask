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
        <svg
          className="dashboard-filter__search-icon"
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <TextInput
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Buscar tarefa ou responsavel"
          aria-label="Buscar tarefa"
        />
      </div>

      <Button
        variant="outline"
        className={mineOnly ? "dashboard-filter__mine-button active" : "dashboard-filter__mine-button"}
        onClick={onMineToggle}
        aria-pressed={mineOnly}
      >
        Minhas
      </Button>
    </FilterBar>
  );
}

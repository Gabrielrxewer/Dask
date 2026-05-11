import type { MembersById } from "@/entities/member";
import type { TaskStatusId, TaskStatus } from "@/entities/task";
import { AppDateRangePicker, AppIcon, AppSelect, Button, type AppDateRangeValue } from "@/shared/ui";

export interface WorkItemListAdvancedFilterState {
  workflowStateId?: TaskStatusId;
  assigneeId?: string;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
}

interface WorkItemListFilterBarProps {
  value: WorkItemListAdvancedFilterState;
  statuses: TaskStatus[];
  membersById: MembersById;
  assigneeDisabled?: boolean;
  onChange: (patch: Partial<WorkItemListAdvancedFilterState>) => void;
  onClear: () => void;
}

function hasActiveFilters(value: WorkItemListAdvancedFilterState) {
  return Boolean(value.workflowStateId || value.assigneeId || value.dueDateFrom || value.dueDateTo);
}

export function WorkItemListFilterBar({
  value,
  statuses,
  membersById,
  assigneeDisabled = false,
  onChange,
  onClear
}: WorkItemListFilterBarProps) {
  const memberOptions = Object.values(membersById)
    .filter((member) => member.id && member.name)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((member) => ({ value: member.id, label: member.name }));
  const dueDateRange: AppDateRangeValue = {
    from: value.dueDateFrom ?? null,
    to: value.dueDateTo ?? null
  };

  return (
    <div className="work-item-list-filter-bar" aria-label="Filtros avancados da lista">
      <AppSelect
        className="work-item-list-filter-bar__select"
        value={value.workflowStateId ?? "all"}
        items={[
          { value: "all", label: "Todos os status" },
          ...statuses.map((status) => ({ value: status.id, label: status.label }))
        ]}
        onValueChange={(nextValue) => onChange({ workflowStateId: nextValue === "all" ? undefined : nextValue })}
        aria-label="Filtrar por status"
      />
      <AppSelect
        className="work-item-list-filter-bar__select"
        value={value.assigneeId ?? "all"}
        items={[
          { value: "all", label: assigneeDisabled ? "Responsavel: minhas" : "Todos responsaveis" },
          ...memberOptions
        ]}
        disabled={assigneeDisabled}
        onValueChange={(nextValue) => onChange({ assigneeId: nextValue === "all" ? undefined : nextValue })}
        aria-label="Filtrar por responsavel"
      />
      <AppDateRangePicker
        className="work-item-list-filter-bar__date"
        value={dueDateRange}
        placeholder="Prazo"
        onChange={(nextValue) => onChange({
          dueDateFrom: nextValue?.from ?? null,
          dueDateTo: nextValue?.to ?? null
        })}
        aria-label="Filtrar por prazo"
      />
      {hasActiveFilters(value) ? (
        <Button
          type="button"
          className="work-item-list-filter-bar__clear"
          variant="ghost"
          size="sm"
          onClick={onClear}
        >
          <AppIcon name="x" size={14} />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}

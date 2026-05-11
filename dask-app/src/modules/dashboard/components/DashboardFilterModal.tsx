import { useEffect, useState } from "react";
import { AppDatePicker, AppDialog, AppSelect, Button } from "@/shared/ui";
import { dateInputToIso, isoToDateInput } from "@/modules/dashboard/hooks";
import type { DashboardFilterOptions, DashboardFilters } from "@/modules/dashboard/types";

interface DashboardFilterModalProps {
  filters: DashboardFilters;
  options: DashboardFilterOptions;
  onApply: (filters: DashboardFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value?: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string | undefined) => void;
}) {
  const allValue = "__all__";

  return (
    <label className="dashboard-filter-modal__field">
      <span>{label}</span>
      <AppSelect
        value={value ?? allValue}
        onValueChange={(nextValue) => onChange(nextValue === allValue ? undefined : nextValue)}
        aria-label={label}
        items={[
          { value: allValue, label: "Todos" },
          ...options.map((option) => ({ value: option.id, label: option.label }))
        ]}
      />
    </label>
  );
}

export function DashboardFilterModal({
  filters,
  options,
  onApply,
  onReset,
  onClose
}: DashboardFilterModalProps) {
  const [draft, setDraft] = useState<DashboardFilters>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const updateDraft = (key: keyof DashboardFilters, value: string | undefined) => {
    setDraft((current) => {
      const next = { ...current };
      if (value && value.trim().length > 0) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  return (
    <AppDialog
      title="Filtros do dashboard"
      description="Ajuste o periodo e os recortes globais dos indicadores."
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="dashboard-filter-modal"
      contentClassName="dashboard-filter-modal__content"
      footer={
        <div className="dashboard-filter-modal__footer">
          <Button type="button" variant="ghost" onClick={handleReset}>Limpar filtros</Button>
          <div className="dashboard-filter-modal__footer-actions">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="dashboard-filter-modal-form">Aplicar filtros</Button>
          </div>
        </div>
      }
    >
      <form
        id="dashboard-filter-modal-form"
        className="dashboard-filter-modal__grid"
        onSubmit={(event) => {
          event.preventDefault();
          handleApply();
        }}
      >
        <label className="dashboard-filter-modal__field">
          <span>Inicio</span>
          <AppDatePicker
            value={isoToDateInput(draft.from)}
            onChange={(value) => updateDraft("from", dateInputToIso(value ?? "", "start"))}
            aria-label="Inicio"
          />
        </label>
        <label className="dashboard-filter-modal__field">
          <span>Fim</span>
          <AppDatePicker
            value={isoToDateInput(draft.to)}
            onChange={(value) => updateDraft("to", dateInputToIso(value ?? "", "end"))}
            aria-label="Fim"
          />
        </label>
        <FilterSelect label="Responsavel" value={draft.assigneeId} options={options.members} onChange={(value) => updateDraft("assigneeId", value)} />
        <FilterSelect label="Tipo" value={draft.itemTypeId} options={options.itemTypes} onChange={(value) => updateDraft("itemTypeId", value)} />
        <FilterSelect label="Estado" value={draft.stateId} options={options.states} onChange={(value) => updateDraft("stateId", value)} />
        <FilterSelect label="Coluna" value={draft.columnId} options={options.columns} onChange={(value) => updateDraft("columnId", value)} />
        <FilterSelect label="Workflow" value={draft.workflowId} options={options.workflows} onChange={(value) => updateDraft("workflowId", value)} />
        <FilterSelect label="Status" value={draft.status} options={options.automationStatuses} onChange={(value) => updateDraft("status", value)} />
      </form>
    </AppDialog>
  );
}

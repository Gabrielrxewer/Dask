import { useState } from "react";
import type { MembersById } from "@/entities/member";
import type { TaskStatus, TaskStatusId } from "@/entities/task";
import { AppDialog, AppIcon, AppSelect, Button } from "@/shared/ui";

interface WorkItemDataGridBulkActionsProps {
  selectedCount: number;
  statuses: TaskStatus[];
  membersById: MembersById;
  pending?: boolean;
  onClearSelection: () => void;
  onStatusChange?: (statusId: TaskStatusId) => void;
  onAssigneeChange?: (assigneeId: string) => void;
  onArchive?: () => void;
}

export function WorkItemDataGridBulkActions({
  selectedCount,
  statuses,
  membersById,
  pending = false,
  onClearSelection,
  onStatusChange,
  onAssigneeChange,
  onArchive
}: WorkItemDataGridBulkActionsProps) {
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const memberOptions = Object.values(membersById)
    .filter((member) => member.id && member.name)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((member) => ({ value: member.id, label: member.name }));

  return (
    <div className="work-item-data-grid__bulk-actions" aria-live="polite">
      <span>{selectedCount} selecionado{selectedCount === 1 ? "" : "s"}</span>
      <AppSelect
        className="work-item-data-grid__bulk-status"
        value=""
        placeholder={pending ? "Atualizando..." : "Alterar status"}
        disabled={pending || !onStatusChange}
        items={statuses.map((status) => ({ value: status.id, label: status.label }))}
        onValueChange={(statusId) => onStatusChange?.(statusId)}
        aria-label="Alterar status dos itens selecionados"
      />
      <AppSelect
        className="work-item-data-grid__bulk-assignee"
        value=""
        placeholder={pending ? "Atualizando..." : "Atribuir"}
        disabled={pending || !onAssigneeChange || memberOptions.length === 0}
        items={memberOptions}
        onValueChange={(assigneeId) => onAssigneeChange?.(assigneeId)}
        aria-label="Atribuir responsavel aos itens selecionados"
      />
      <AppDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title="Arquivar itens"
        description={`Arquivar ${selectedCount} ${selectedCount === 1 ? "item selecionado" : "itens selecionados"}? Eles saem das listas operacionais.`}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setConfirmArchiveOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setConfirmArchiveOpen(false);
                onArchive?.();
              }}
              disabled={pending || !onArchive}
            >
              Arquivar
            </Button>
          </>
        }
      >
        <p className="work-item-data-grid__bulk-confirm-copy">
          Esta acao registra os itens como arquivados e remove a selecao da lista atual.
        </p>
      </AppDialog>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirmArchiveOpen(true)}
        disabled={pending || !onArchive}
      >
        <AppIcon name="archive" size={14} />
        Arquivar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClearSelection} disabled={pending}>
        Limpar
      </Button>
    </div>
  );
}

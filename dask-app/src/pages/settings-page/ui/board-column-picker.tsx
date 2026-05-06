import type { Ref } from "react";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { EmptyState } from "@/shared/ui";
import { IconPlus } from "./board-editor-icons";
import { BoardColumnForm } from "./board-column-form";
import type { BoardAddColumnMode } from "./board-editor-settings.model";

type BoardColumnPickerProps = {
  mode: BoardAddColumnMode;
  columnsAvailableToAdd: ApiBoardColumn[];
  activeStates: ApiWorkflowState[];
  newColumnInputRef: Ref<HTMLInputElement>;
  newColumnName: string;
  newColumnStateId: string;
  saving: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onAddExistingColumn: (columnId: string) => void;
  onStartNewColumn: () => void;
  onNewColumnNameChange: (value: string) => void;
  onNewColumnStateIdChange: (value: string) => void;
  onCreateColumn: () => void;
  onBackToPicker: () => void;
};

export function BoardColumnPicker({
  mode,
  columnsAvailableToAdd,
  activeStates,
  newColumnInputRef,
  newColumnName,
  newColumnStateId,
  saving,
  onOpenPicker,
  onClosePicker,
  onAddExistingColumn,
  onStartNewColumn,
  onNewColumnNameChange,
  onNewColumnStateIdChange,
  onCreateColumn,
  onBackToPicker
}: BoardColumnPickerProps) {
  if (mode === null) {
    return (
      <button
        type="button"
        className="board-editor__add-column"
        onClick={(event) => {
          event.stopPropagation();
          onOpenPicker();
        }}
      >
        <span className="board-editor__add-column-icon">
          <IconPlus />
        </span>
        <span>Nova coluna</span>
      </button>
    );
  }

  if (mode === "pick") {
    return (
      <div className="board-editor__column board-editor__column--picker" onClick={(event) => event.stopPropagation()}>
        <div className="board-editor__picker-head">
          <span>Adicionar coluna</span>
          <button type="button" className="board-editor__picker-close" onClick={onClosePicker}>
            x
          </button>
        </div>
        <div className="board-editor__picker-body">
          {columnsAvailableToAdd.length > 0 ? (
            <>
              <p className="board-editor__picker-section-label">Existentes</p>
              <ul className="board-editor__picker-list">
                {columnsAvailableToAdd.map((column) => {
                  const state = activeStates.find((entry) => entry.id === column.stateIds[0]);
                  return (
                    <li key={column.id}>
                      <button type="button" className="board-editor__picker-item" onClick={() => onAddExistingColumn(column.id)}>
                        <span className="board-editor__picker-dot" style={{ background: state?.color ?? "var(--brand-blue)" }} />
                        <span className="board-editor__picker-col-name">{column.name}</span>
                        <span className="board-editor__picker-col-slug">/{column.slug}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <EmptyState className="board-editor__picker-empty" size="compact">Todas as colunas ja estao nesta perspectiva.</EmptyState>
          )}
          <div className="board-editor__picker-divider" />
          <button type="button" className="board-editor__picker-new-btn" onClick={onStartNewColumn}>
            <IconPlus />
            Criar nova coluna
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="board-editor__column board-editor__column--new" onClick={(event) => event.stopPropagation()}>
      <BoardColumnForm
        inputRef={newColumnInputRef}
        name={newColumnName}
        stateId={newColumnStateId}
        activeStates={activeStates}
        saving={saving}
        submitLabel="Criar"
        savingLabel="..."
        cancelLabel="Voltar"
        placeholder="Ex: Em validacao"
        onNameChange={onNewColumnNameChange}
        onStateIdChange={onNewColumnStateIdChange}
        onSubmit={onCreateColumn}
        onCancel={onBackToPicker}
      />
    </div>
  );
}

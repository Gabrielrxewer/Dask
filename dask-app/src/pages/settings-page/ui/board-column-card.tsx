import type { DragEvent } from "react";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { IconEye, IconEyeOff, IconGrip, IconPencil, IconPlus, IconTrash } from "./board-editor-icons";
import { BoardColumnDeleteModal } from "./board-column-delete-modal";
import { BoardColumnForm } from "./board-column-form";
import { BoardEditorPreview } from "./board-editor-preview";

type BoardColumnCardProps = {
  column: ApiBoardColumn;
  activeStates: ApiWorkflowState[];
  isHidden: boolean;
  hasCreateTaskButton: boolean;
  isEditing: boolean;
  isConfirmingDelete: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  editingColumnName: string;
  editingColumnStateId: string;
  saving: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, columnId: string) => void;
  onStartEdit: (column: ApiBoardColumn) => void;
  onEditingColumnNameChange: (value: string) => void;
  onEditingColumnStateIdChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onShowColumn: (columnId: string) => void;
  onHideColumn: (columnId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onCancelDelete: () => void;
  onToggleCreateTaskColumn: (columnId: string) => void;
};

export function BoardColumnCard({
  column,
  activeStates,
  isHidden,
  hasCreateTaskButton,
  isEditing,
  isConfirmingDelete,
  isDragging,
  isDragOver,
  editingColumnName,
  editingColumnStateId,
  saving,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onStartEdit,
  onEditingColumnNameChange,
  onEditingColumnStateIdChange,
  onSaveEdit,
  onCancelEdit,
  onShowColumn,
  onHideColumn,
  onDeleteColumn,
  onCancelDelete,
  onToggleCreateTaskColumn
}: BoardColumnCardProps) {
  const stateForColumn = activeStates.find((state) => state.id === column.stateIds[0]);

  return (
    <div
      className={[
        "board-editor__column",
        isHidden ? "board-editor__column--hidden" : "",
        isEditing ? "board-editor__column--editing" : "",
        isConfirmingDelete ? "board-editor__column--confirming" : "",
        isDragging ? "board-editor__column--dragging" : "",
        isDragOver ? "board-editor__column--drag-over" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      draggable={!isHidden && !isEditing && !isConfirmingDelete}
      onDragStart={(event) => onDragStart(event, column.id)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, column.id)}
      onDrop={(event) => onDrop(event, column.id)}
      onClick={(event) => event.stopPropagation()}
    >
      {isEditing ? (
        <BoardColumnForm
          name={editingColumnName}
          stateId={editingColumnStateId}
          activeStates={activeStates}
          saving={saving}
          submitLabel="Salvar"
          savingLabel="..."
          cancelLabel="Cancelar"
          autoFocus
          onNameChange={onEditingColumnNameChange}
          onStateIdChange={onEditingColumnStateIdChange}
          onSubmit={onSaveEdit}
          onCancel={onCancelEdit}
        />
      ) : (
        <>
          <div className="board-editor__column-head">
            {!isHidden && (
              <span className="board-editor__drag-handle" title="Arrastar para reorganizar">
                <IconGrip />
              </span>
            )}
            <div className="board-editor__column-title">
              <span className="board-editor__column-dot" style={{ background: stateForColumn?.color ?? "var(--brand-blue)" }} />
              <span className="board-editor__column-name">{column.name}</span>
            </div>
            <div className="board-editor__column-actions">
              {!isHidden && (
                <button
                  type="button"
                  className="board-editor__action-btn board-editor__action-btn--edit"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartEdit(column);
                  }}
                  title="Editar"
                >
                  <IconPencil />
                </button>
              )}
              <button
                type="button"
                className={`board-editor__action-btn board-editor__action-btn--visibility${isHidden ? " is-hidden" : " is-visible"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  isHidden ? onShowColumn(column.id) : onHideColumn(column.id);
                }}
                title={isHidden ? "Mostrar nesta perspectiva" : "Ocultar nesta perspectiva"}
              >
                {isHidden ? <IconEyeOff /> : <IconEye />}
              </button>
              {!isHidden && (
                <button
                  type="button"
                  className={`board-editor__action-btn board-editor__action-btn--delete${isConfirmingDelete ? " is-confirming" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteColumn(column.id);
                  }}
                  title={isConfirmingDelete ? "Confirmar?" : "Remover"}
                  disabled={saving}
                >
                  <IconTrash />
                </button>
              )}
            </div>
          </div>

          <div className="board-editor__column-meta">
            <span className="board-editor__state-dot" style={{ background: stateForColumn?.color ?? "var(--info-border)" }} />
            <span className="board-editor__state-name">{stateForColumn?.name ?? "Sem estado"}</span>
            <span className="board-editor__col-slug">/{column.slug}</span>
            {!isHidden && (
              <button
                type="button"
                className={`board-editor__create-toggle${hasCreateTaskButton ? " is-enabled" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCreateTaskColumn(column.id);
                }}
                title={hasCreateTaskButton ? "Remover botao de criar tarefa desta coluna" : "Mostrar botao de criar tarefa nesta coluna"}
              >
                <IconPlus />
                Criar aqui
              </button>
            )}
            {isHidden && (
              <span className="board-editor__hidden-badge">
                <IconEyeOff />
                Oculta
              </span>
            )}
          </div>

          <BoardEditorPreview isHidden={isHidden} />

          {isConfirmingDelete && (
            <BoardColumnDeleteModal
              columnName={column.name}
              saving={saving}
              onConfirm={() => onDeleteColumn(column.id)}
              onCancel={onCancelDelete}
            />
          )}
        </>
      )}
    </div>
  );
}

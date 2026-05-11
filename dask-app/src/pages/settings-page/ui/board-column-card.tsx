import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { ConfirmModal } from "@/shared/ui";
import { IconEye, IconEyeOff, IconGrip, IconPencil, IconPlus, IconTrash } from "./board-editor-icons";
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
  const isSortableDisabled = isHidden || isEditing || isConfirmingDelete;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({
    id: column.id,
    disabled: isSortableDisabled
  });
  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={sortableStyle}
      className={[
        "board-editor__column",
        isHidden ? "board-editor__column--hidden" : "",
        isEditing ? "board-editor__column--editing" : "",
        isConfirmingDelete ? "board-editor__column--confirming" : "",
        isDragging || isSortableDragging ? "board-editor__column--dragging" : "",
        isDragOver ? "board-editor__column--drag-over" : ""
      ]
        .filter(Boolean)
        .join(" ")}
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
              <span
                className="board-editor__drag-handle"
                title="Arrastar para reorganizar"
                {...attributes}
                {...listeners}
              >
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
            <ConfirmModal
              titleId="board-column-delete-title"
              eyebrow="Remover coluna"
              title={<>Remover <strong>{column.name}</strong>?</>}
              description="A coluna sera removida desta configuracao de board."
              confirmLabel={saving ? "Removendo..." : "Sim, remover"}
              isConfirming={saving}
              tone="danger"
              onConfirm={() => onDeleteColumn(column.id)}
              onClose={onCancelDelete}
            />
          )}
        </>
      )}
    </div>
  );
}

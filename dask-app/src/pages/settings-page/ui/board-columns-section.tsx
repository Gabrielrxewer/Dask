import type { Ref } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates
} from "@dnd-kit/sortable";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { BoardColumnCard } from "./board-column-card";
import { BoardColumnPicker } from "./board-column-picker";
import { BoardEditorLoader } from "./board-editor-loader";
import type { BoardAddColumnMode, BoardPerspective } from "./board-editor-settings.model";

type BoardColumnsSectionProps = {
  loading: boolean;
  columnsToShow: ApiBoardColumn[];
  columnsAvailableToAdd: ApiBoardColumn[];
  activeStates: ApiWorkflowState[];
  activePerspective: BoardPerspective | null;
  activePendingHidden: Set<string>;
  editingColumnId: string | null;
  editingColumnName: string;
  editingColumnStateId: string;
  deletingColumnId: string | null;
  addColumnMode: BoardAddColumnMode;
  newColumnInputRef: Ref<HTMLInputElement>;
  newColumnName: string;
  newColumnStateId: string;
  draggingId: string | null;
  dragOverId: string | null;
  saving: boolean;
  onDragStart: (columnId: string) => void;
  onDragEnd: (activeId: string, targetId: string | null) => void;
  onDragOver: (columnId: string | null) => void;
  onDragCancel: () => void;
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
  onOpenAddColumnPicker: () => void;
  onCloseAddColumnPicker: () => void;
  onAddExistingColumn: (columnId: string) => void;
  onStartNewColumn: () => void;
  onNewColumnNameChange: (value: string) => void;
  onNewColumnStateIdChange: (value: string) => void;
  onCreateColumn: () => void;
  onBackToPicker: () => void;
};

export function BoardColumnsSection({
  loading,
  columnsToShow,
  columnsAvailableToAdd,
  activeStates,
  activePerspective,
  activePendingHidden,
  editingColumnId,
  editingColumnName,
  editingColumnStateId,
  deletingColumnId,
  addColumnMode,
  newColumnInputRef,
  newColumnName,
  newColumnStateId,
  draggingId,
  dragOverId,
  saving,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragCancel,
  onStartEdit,
  onEditingColumnNameChange,
  onEditingColumnStateIdChange,
  onSaveEdit,
  onCancelEdit,
  onShowColumn,
  onHideColumn,
  onDeleteColumn,
  onCancelDelete,
  onToggleCreateTaskColumn,
  onOpenAddColumnPicker,
  onCloseAddColumnPicker,
  onAddExistingColumn,
  onStartNewColumn,
  onNewColumnNameChange,
  onNewColumnStateIdChange,
  onCreateColumn,
  onBackToPicker
}: BoardColumnsSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const sortableColumnIds = columnsToShow.map((column) => column.id);

  const handleDragStart = (event: DragStartEvent) => {
    onDragStart(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    onDragOver(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    onDragEnd(String(event.active.id), event.over ? String(event.over.id) : null);
  };

  return (
    <div className="board-editor__canvas-wrap">
      <div className="board-editor__canvas">
        {loading ? (
          <BoardEditorLoader />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={onDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableColumnIds} strategy={horizontalListSortingStrategy}>
              {columnsToShow.map((column) => {
                const isHidden = activePendingHidden.has(column.id);
                return (
                  <BoardColumnCard
                    key={column.id}
                    column={column}
                    activeStates={activeStates}
                    isHidden={isHidden}
                    hasCreateTaskButton={Boolean(activePerspective?.createTaskColumnIds?.includes(column.id))}
                    isEditing={editingColumnId === column.id}
                    isConfirmingDelete={deletingColumnId === column.id}
                    isDragging={draggingId === column.id}
                    isDragOver={dragOverId === column.id && draggingId !== column.id}
                    editingColumnName={editingColumnName}
                    editingColumnStateId={editingColumnStateId}
                    saving={saving}
                    onStartEdit={onStartEdit}
                    onEditingColumnNameChange={onEditingColumnNameChange}
                    onEditingColumnStateIdChange={onEditingColumnStateIdChange}
                    onSaveEdit={onSaveEdit}
                    onCancelEdit={onCancelEdit}
                    onShowColumn={onShowColumn}
                    onHideColumn={onHideColumn}
                    onDeleteColumn={onDeleteColumn}
                    onCancelDelete={onCancelDelete}
                    onToggleCreateTaskColumn={onToggleCreateTaskColumn}
                  />
                );
              })}
            </SortableContext>

            <BoardColumnPicker
              mode={addColumnMode}
              columnsAvailableToAdd={columnsAvailableToAdd}
              activeStates={activeStates}
              newColumnInputRef={newColumnInputRef}
              newColumnName={newColumnName}
              newColumnStateId={newColumnStateId}
              saving={saving}
              onOpenPicker={onOpenAddColumnPicker}
              onClosePicker={onCloseAddColumnPicker}
              onAddExistingColumn={onAddExistingColumn}
              onStartNewColumn={onStartNewColumn}
              onNewColumnNameChange={onNewColumnNameChange}
              onNewColumnStateIdChange={onNewColumnStateIdChange}
              onCreateColumn={onCreateColumn}
              onBackToPicker={onBackToPicker}
            />
          </DndContext>
        )}
      </div>
    </div>
  );
}

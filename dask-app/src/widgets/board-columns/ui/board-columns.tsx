import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { MembersById } from "@/entities/member";
import { MemberAvatar } from "@/entities/member";
import { TaskCard, groupTasksByStatus } from "@/entities/task";
import type {
  BoardConfig,
  Task,
  TaskCustomFieldValue,
  TaskPriority,
  TaskStatus,
  TaskStatusId
} from "@/entities/task";
import type { AiAgentSummary, Customer, DocumentKind, WorkItemLinkedDocument, WorkspaceDocument } from "@/modules/workspace/model";
import type { CreateTaskInput, TaskScheduleInput, UpdateTaskInput } from "@/modules/workspace";
import { CreateTaskButton } from "@/features/create-task";
import { AppDialog, AppIcon, Button, EmptyState, VirtualList, toast } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./board-columns.css";

interface BoardColumnsProps {
  statuses: TaskStatus[];
  tasks: Task[];
  boardConfig: BoardConfig;
  membersById: MembersById;
  compactCards?: boolean;
  onMoveTask: (taskId: string, statusId: TaskStatusId, position?: number) => Promise<void> | void;
  onDeleteTask: (taskId: string) => Promise<void> | void;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
  onUpdateTaskTitle: (taskId: string, title: string) => Promise<void> | void;
  onUpdateTaskDescription: (taskId: string, description: string) => Promise<void> | void;
  onUpdateTaskCustomField: (
    taskId: string,
    fieldId: string,
    value: TaskCustomFieldValue
  ) => Promise<void> | void;
  onUpdateTaskSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void> | void;
  onUpdateTaskChecklist: (taskId: string, checklist: Task["checklist"]) => Promise<void> | void;
  onSaveTask: (taskId: string, input: UpdateTaskInput) => Promise<void> | void;
  onCreateTask?: (statusId: TaskStatusId, input: CreateTaskInput) => void | Promise<void>;
  createTaskStatusIds?: string[];
  aiAgents: AiAgentSummary[];
  availableTags?: Array<{ id: string; name: string; color: string }>;
  onRunAiAgentOnItem: (
    itemId: string,
    agentId: string,
    input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
  onRunAiRiskAnalysis: (
    itemId: string,
    input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
  listWorkspaceDocuments: () => Promise<WorkspaceDocument[]>;
  createWorkspaceDocument?: (input: {
    title: string;
    content?: string;
    kind?: DocumentKind;
    linkedEntityType?: "work_item" | "customer" | "proposal" | "contract";
    linkedEntityId?: string;
    tags?: string[];
    metadata?: WorkspaceDocument["metadata"];
    position?: number;
  }) => Promise<WorkspaceDocument>;
  listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
  linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
  unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
  onOpenDocument?: (documentId: string, taskId: string) => void;
  listCustomers?: (input?: { search?: string }) => Promise<Customer[]>;
  initialSelectedTaskId?: string;
}

type DropTarget = {
  statusId: TaskStatusId;
  index: number;
};

type BoardDragData =
  | { type: "task"; taskId: string; statusId: TaskStatusId; index: number }
  | { type: "column"; statusId: TaskStatusId };

const VIRTUALIZE_CARD_THRESHOLD = 45;
const ESTIMATED_CARD_HEIGHT = 148;

function toColumnDroppableId(statusId: TaskStatusId): string {
  return `board-column:${statusId}`;
}

interface DeleteTaskDialogProps {
  taskTitle: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteTaskDialog({ taskTitle, isDeleting, onCancel, onConfirm }: DeleteTaskDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      onCancel();
    }
  };

  return (
    <AppDialog
      open
      onOpenChange={handleOpenChange}
      showClose={!isDeleting}
      className="board-delete-dialog"
    >
      <div className="board-delete-dialog__icon" aria-hidden="true">
        <AppIcon name="trash" size={24} strokeWidth={1.8} />
      </div>

      <div className="board-delete-dialog__body">
        <h2 id="board-delete-task-title" className="board-delete-dialog__title">Excluir este item?</h2>
        <p className="board-delete-dialog__description">
          Voce realmente deseja excluir <strong>{taskTitle}</strong>? Essa acao nao pode ser desfeita.
        </p>
      </div>

      <div className="board-delete-dialog__actions">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isDeleting}>
          Nao
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          disabled={isDeleting}
          loading={isDeleting}
        >
          {isDeleting ? "Excluindo..." : "Sim, excluir"}
        </Button>
      </div>
    </AppDialog>
  );
}

function normalizeTaskPositions(tasks: Task[]): Task[] {
  const grouped = new Map<string, Task[]>();

  tasks.forEach(task => {
    const statusTasks = grouped.get(task.status) ?? [];
    statusTasks.push(task);
    grouped.set(task.status, statusTasks);
  });

  return Array.from(grouped.values()).flatMap(statusTasks =>
    [...statusTasks]
      .sort((left, right) => (left.position ?? 0) - (right.position ?? 0))
      .map((task, index) => ({ ...task, position: index }))
  );
}

function moveTaskLocally(tasks: Task[], taskId: string, nextStatus: TaskStatusId, nextPosition: number): Task[] {
  const currentTask = tasks.find(task => task.id === taskId);
  if (!currentTask) {
    return tasks;
  }

  const remainingTasks = tasks.filter(task => task.id !== taskId);
  const nextTasks = remainingTasks.map(task => ({ ...task }));
  const targetTasks = nextTasks
    .filter(task => task.status === nextStatus)
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const insertAt = Math.max(0, Math.min(nextPosition, targetTasks.length));

  targetTasks.splice(insertAt, 0, {
    ...currentTask,
    status: nextStatus,
    position: insertAt
  });

  const targetIds = new Set(targetTasks.map(task => task.id));
  const untouchedTasks = nextTasks.filter(task => !targetIds.has(task.id));

  return normalizeTaskPositions([...untouchedTasks, ...targetTasks]);
}

function readBoardDragData(event: DragOverEvent | DragEndEvent): BoardDragData | null {
  return (event.over?.data.current as BoardDragData | undefined) ?? null;
}

function resolveDropTargetFromDnd(event: DragOverEvent | DragEndEvent, columns: Record<string, Task[]>): DropTarget | null {
  const data = readBoardDragData(event);
  if (!data) {
    return null;
  }

  if (data.type === "column") {
    return {
      statusId: data.statusId,
      index: columns[data.statusId]?.length ?? 0
    };
  }

  return {
    statusId: data.statusId,
    index: data.index
  };
}

interface BoardTaskCardProps {
  task: Task;
  index: number;
  status: TaskStatus;
  boardConfig: BoardConfig;
  compactCards: boolean;
  membersById: MembersById;
  statuses: TaskStatus[];
  isDragging: boolean;
  disabled?: boolean;
  creatorName: string;
  onOpen: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
  onUpdateTaskChecklist: (taskId: string, checklist: Task["checklist"]) => Promise<void> | void;
  onMoveToStatus: (taskId: string, statusId: TaskStatusId) => Promise<void> | void;
}

function BoardTaskCard({
  task,
  index,
  status,
  boardConfig,
  compactCards,
  membersById,
  statuses,
  isDragging,
  disabled = false,
  creatorName,
  onOpen,
  onDelete,
  onUpdatePriority,
  onUpdateTaskChecklist,
  onMoveToStatus
}: BoardTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({
    id: task.id,
    disabled,
    data: {
      type: "task",
      taskId: task.id,
      statusId: status.id,
      index
    } satisfies BoardDragData
  });

  return (
    <div
      ref={setNodeRef}
      className={cn("board-column__item", (isDragging || isSortableDragging) && "board-column__item--dragging")}
      style={{
        transform: CSS.Transform.toString(transform),
        transition
      }}
      {...attributes}
      {...listeners}
    >
      <TaskCard
        task={task}
        boardConfig={boardConfig}
        compact={compactCards}
        draggable={false}
        contextualDisplay={{
          suppressCreatedByWhenAssigneeVisible: true
        }}
        membersById={membersById}
        displayStatuses={statuses}
        statusLabel={status.label}
        creatorName={creatorName}
        assigneeName={membersById[task.assignee]?.name ?? "Usuario"}
        assigneeSlot={<MemberAvatar member={membersById[task.assignee]} />}
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
        isDragging={isDragging || isSortableDragging}
        onOpen={onOpen}
        onDelete={onDelete}
        onUpdatePriority={onUpdatePriority}
        onUpdateChecklist={onUpdateTaskChecklist}
        onMoveToStatus={onMoveToStatus}
      />
    </div>
  );
}

interface BoardColumnTaskListProps {
  status: TaskStatus;
  tasks: Task[];
  isTarget: boolean;
  dropTarget: DropTarget | null;
  draggingTaskId: string;
  boardConfig: BoardConfig;
  compactCards: boolean;
  membersById: MembersById;
  statuses: TaskStatus[];
  resolveCreatorName: (task: Task) => string;
  onOpenTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
  onUpdateTaskChecklist: (taskId: string, checklist: Task["checklist"]) => Promise<void> | void;
  onMoveToStatus: (taskId: string, statusId: TaskStatusId) => Promise<void> | void;
}

function BoardColumnTaskList({
  status,
  tasks,
  isTarget,
  dropTarget,
  draggingTaskId,
  boardConfig,
  compactCards,
  membersById,
  statuses,
  resolveCreatorName,
  onOpenTask,
  onDeleteTask,
  onUpdatePriority,
  onUpdateTaskChecklist,
  onMoveToStatus
}: BoardColumnTaskListProps) {
  const shouldVirtualize = tasks.length > VIRTUALIZE_CARD_THRESHOLD && !draggingTaskId;

  const renderTask = (task: Task, index: number) => (
    <>
      {isTarget && dropTarget?.index === index ? <div className="board-column__drop-indicator" /> : null}
      <BoardTaskCard
        task={task}
        index={index}
        status={status}
        boardConfig={boardConfig}
        compactCards={compactCards}
        membersById={membersById}
        statuses={statuses}
        creatorName={resolveCreatorName(task)}
        isDragging={draggingTaskId === task.id}
        onOpen={onOpenTask}
        onDelete={onDeleteTask}
        onUpdatePriority={onUpdatePriority}
        onUpdateTaskChecklist={onUpdateTaskChecklist}
        onMoveToStatus={onMoveToStatus}
      />
    </>
  );

  if (shouldVirtualize) {
    return (
      <VirtualList
        items={tasks}
        estimateSize={ESTIMATED_CARD_HEIGHT}
        overscan={8}
        className="board-column__virtual-list"
        viewportClassName="board-column__virtual-viewport"
        itemClassName="board-column__virtual-item"
        getItemKey={(task) => task.id}
        renderItem={(task, index) => renderTask(task, index)}
      />
    );
  }

  return <>{tasks.map((task, index) => <div key={task.id}>{renderTask(task, index)}</div>)}</>;
}

interface BoardColumnListDropAreaProps {
  statusId: TaskStatusId;
  children: ReactNode;
}

function BoardColumnListDropArea({ statusId, children }: BoardColumnListDropAreaProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: toColumnDroppableId(statusId),
    data: {
      type: "column",
      statusId
    } satisfies BoardDragData
  });

  return (
    <div ref={setNodeRef} className={cn("board-column__list", isOver && "board-column__list--over")}>
      {children}
    </div>
  );
}

export function BoardColumns({
  statuses,
  tasks,
  boardConfig,
  membersById,
  compactCards = false,
  onMoveTask,
  onDeleteTask,
  onUpdatePriority,
  onUpdateTaskTitle,
  onUpdateTaskDescription,
  onUpdateTaskCustomField,
  onUpdateTaskSchedule,
  onUpdateTaskChecklist,
  onSaveTask,
  onCreateTask,
  createTaskStatusIds,
  aiAgents,
  availableTags = [],
  onRunAiAgentOnItem,
  onRunAiRiskAnalysis,
  listWorkspaceDocuments,
  createWorkspaceDocument,
  listWorkItemLinkedDocuments,
  linkDocumentToWorkItem,
  unlinkDocumentFromWorkItem,
  onOpenDocument,
  listCustomers,
  initialSelectedTaskId = ""
}: BoardColumnsProps) {
  const [draggingTaskId, setDraggingTaskId] = useState("");
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialSelectedTaskId);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks);
  const [taskPendingDeleteId, setTaskPendingDeleteId] = useState<string>("");
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  const columns = useMemo(() => groupTasksByStatus(optimisticTasks, statuses), [optimisticTasks, statuses]);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const selectedTask = useMemo(
    () => optimisticTasks.find(task => task.id === selectedTaskId) ?? null,
    [optimisticTasks, selectedTaskId]
  );
  const activeDragTask = useMemo(
    () => optimisticTasks.find(task => task.id === draggingTaskId) ?? null,
    [draggingTaskId, optimisticTasks]
  );
  const activeDragStatus = useMemo(
    () => (activeDragTask ? statuses.find(status => status.id === activeDragTask.status) ?? null : null),
    [activeDragTask, statuses]
  );
  const selectedStatus = useMemo(
    () => (selectedTask ? statuses.find(status => status.id === selectedTask.status) ?? null : null),
    [selectedTask, statuses]
  );
  const taskPendingDelete = useMemo(
    () => optimisticTasks.find(task => task.id === taskPendingDeleteId) ?? null,
    [optimisticTasks, taskPendingDeleteId]
  );

  const resolveCreatorName = (task: Task): string => {
    const createdBy = task.customFields["createdBy"];
    if (typeof createdBy === "string" && createdBy.trim()) {
      const createdByMember = (membersById as Record<string, { name?: string }>)[createdBy];
      if (createdByMember?.name) {
        return createdByMember.name;
      }
      return createdBy;
    }

    return membersById[task.assignee]?.name ?? "Usuario";
  };

  const selectedCreatorName = selectedTask ? resolveCreatorName(selectedTask) : "Usuario";

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as BoardDragData | undefined;
    if (!data || data.type !== "task") {
      return;
    }

    setDraggingTaskId(data.taskId);
    document.body.classList.add("board-is-dragging");
  }, []);

  const clearDragState = useCallback(() => {
    setDraggingTaskId("");
    setDropTarget(null);
    document.body.classList.remove("board-is-dragging");
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const target = resolveDropTargetFromDnd(event, columns);
    setDropTarget(target);
  }, [columns]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const activeData = event.active.data.current as BoardDragData | undefined;
    const target = resolveDropTargetFromDnd(event, columns);

    if (!activeData || activeData.type !== "task" || !target) {
      clearDragState();
      return;
    }

    const previousTasks = optimisticTasks;
    const nextTasks = moveTaskLocally(previousTasks, activeData.taskId, target.statusId, target.index);

    setOptimisticTasks(nextTasks);
    clearDragState();

    try {
      await onMoveTask(activeData.taskId, target.statusId, target.index);
    } catch {
      setOptimisticTasks(previousTasks);
      toast.error("Nao foi possivel mover o item.", {
        description: "A posicao anterior foi restaurada."
      });
    }
  }, [clearDragState, columns, onMoveTask, optimisticTasks]);

  useEffect(() => {
    return () => {
      document.body.classList.remove("board-is-dragging");
    };
  }, []);

  useEffect(() => {
    if (selectedTaskId && !optimisticTasks.some(task => task.id === selectedTaskId)) {
      setSelectedTaskId("");
    }
  }, [optimisticTasks, selectedTaskId]);

  useEffect(() => {
    if (taskPendingDeleteId && !optimisticTasks.some(task => task.id === taskPendingDeleteId)) {
      setTaskPendingDeleteId("");
      setIsDeletingTask(false);
    }
  }, [optimisticTasks, taskPendingDeleteId]);

  const handleRequestDeleteTask = (taskId: string) => {
    setTaskPendingDeleteId(taskId);
  };

  const handleConfirmDeleteTask = async () => {
    if (!taskPendingDeleteId || isDeletingTask) {
      return;
    }

    setIsDeletingTask(true);

    try {
      await onDeleteTask(taskPendingDeleteId);
      setTaskPendingDeleteId("");
      toast.success("Item excluido.");
    } catch (error) {
      toast.error("Nao foi possivel excluir o item.", {
        description: error instanceof Error ? error.message : "Tente novamente."
      });
    } finally {
      setIsDeletingTask(false);
    }
  };

  return (
    <main className="board-columns-wrap">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={clearDragState}
        onDragEnd={event => void handleDragEnd(event)}
      >
        <section className="board-columns">
          {statuses.map(status => {
            const statusTasks = columns[status.id] ?? [];
            const isTarget = dropTarget?.statusId === status.id;
            const canCreateInColumn = onCreateTask
              ? Array.isArray(createTaskStatusIds)
                ? createTaskStatusIds.includes(status.id)
                : statuses[0]?.id === status.id
              : false;

            return (
              <section
                className={`board-column ${isTarget ? "board-column--drop-target" : ""}`}
                key={status.id}
              >
                <header className="board-column__head">
                  <div className="board-column__title">
                    <span className="board-column__dot" style={{ background: status.dot }} />
                    <h2>{status.label}</h2>
                  </div>
                  <span className="board-column__counter">{statusTasks.length}</span>
                </header>

                <BoardColumnListDropArea statusId={status.id}>
                  {canCreateInColumn ? (
                    <CreateTaskButton
                      className="board-column__create-task"
                      onCreate={input => onCreateTask?.(status.id, input)}
                      initialStatusId={status.id}
                      statuses={statuses}
                      boardConfig={boardConfig}
                      membersById={membersById}
                      taskTypes={boardConfig.taskTypes}
                      availableTags={availableTags}
                    />
                  ) : null}

                  {statusTasks.length === 0 && !isTarget ? (
                    <EmptyState
                      className="board-column__empty"
                      variant="card"
                      size="compact"
                      title="Nenhum item nesta etapa."
                      description="Crie um item ou mova uma oportunidade para iniciar este fluxo."
                    />
                  ) : null}

                  <SortableContext items={statusTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                    <BoardColumnTaskList
                      status={status}
                      tasks={statusTasks}
                      isTarget={isTarget}
                      dropTarget={dropTarget}
                      draggingTaskId={draggingTaskId}
                      boardConfig={boardConfig}
                      compactCards={compactCards}
                      membersById={membersById}
                      statuses={statuses}
                      resolveCreatorName={resolveCreatorName}
                      onOpenTask={setSelectedTaskId}
                      onDeleteTask={handleRequestDeleteTask}
                      onUpdatePriority={onUpdatePriority}
                      onUpdateTaskChecklist={onUpdateTaskChecklist}
                      onMoveToStatus={onMoveTask}
                    />
                  </SortableContext>

                  {isTarget && dropTarget?.index === statusTasks.length ? (
                    <div className="board-column__drop-indicator" />
                  ) : null}
                </BoardColumnListDropArea>
              </section>
            );
          })}
        </section>

        <DragOverlay>
          {activeDragTask && activeDragStatus ? (
            <div className="board-column__drag-overlay">
              <TaskCard
                task={activeDragTask}
                boardConfig={boardConfig}
                compact={compactCards}
                draggable={false}
                contextualDisplay={{
                  suppressCreatedByWhenAssigneeVisible: true
                }}
                membersById={membersById}
                displayStatuses={statuses}
                statusLabel={activeDragStatus.label}
                creatorName={resolveCreatorName(activeDragTask)}
                assigneeName={membersById[activeDragTask.assignee]?.name ?? "Usuario"}
                assigneeSlot={<MemberAvatar member={membersById[activeDragTask.assignee]} />}
                onDragStart={() => undefined}
                onDragEnd={() => undefined}
                isDragging
                onUpdatePriority={onUpdatePriority}
                onUpdateChecklist={onUpdateTaskChecklist}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          mode="edit"
          task={selectedTask}
          status={selectedStatus}
          statuses={statuses}
          assignee={membersById[selectedTask.assignee]}
          membersById={membersById}
          availableTags={availableTags}
          creatorName={selectedCreatorName}
          boardConfig={boardConfig}
          onUpdatePriority={onUpdatePriority}
          onUpdateTitle={onUpdateTaskTitle}
          onUpdateDescription={onUpdateTaskDescription}
          onUpdateCustomField={onUpdateTaskCustomField}
          onUpdateSchedule={onUpdateTaskSchedule}
          onSaveTask={onSaveTask}
          onUpdateStatus={statusId => onMoveTask(selectedTask.id, statusId)}
          aiAgents={aiAgents}
          onRunAiAgentOnItem={onRunAiAgentOnItem}
          onRunAiRiskAnalysis={onRunAiRiskAnalysis}
          listWorkspaceDocuments={listWorkspaceDocuments}
          createWorkspaceDocument={createWorkspaceDocument}
          listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
          linkDocumentToWorkItem={linkDocumentToWorkItem}
          unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
          onOpenDocument={onOpenDocument}
          listCustomers={listCustomers}
          onClose={() => setSelectedTaskId("")}
        />
      ) : null}

      {taskPendingDelete ? (
        <DeleteTaskDialog
          taskTitle={taskPendingDelete.title}
          isDeleting={isDeletingTask}
          onCancel={() => {
            if (!isDeletingTask) {
              setTaskPendingDeleteId("");
            }
          }}
          onConfirm={() => void handleConfirmDeleteTask()}
        />
      ) : null}
    </main>
  );
}

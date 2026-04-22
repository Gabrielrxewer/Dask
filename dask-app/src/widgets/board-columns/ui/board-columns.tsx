import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
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
import type { AiAgentSummary, WorkItemLinkedDocument, WorkspaceDocument } from "@/modules/workspace/model";
import type { CreateTaskInput, TaskScheduleInput, UpdateTaskInput } from "@/modules/workspace";
import { getTaskDragPayload, setTaskDragPayload } from "@/features/change-status";
import { CreateTaskButton } from "@/features/create-task";
import { Button, ModalShell } from "@/shared/ui";
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
  listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
  linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
  unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
}

type DropTarget = {
  statusId: TaskStatusId;
  index: number;
};

interface DeleteTaskDialogProps {
  taskTitle: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteTaskDialog({ taskTitle, isDeleting, onCancel, onConfirm }: DeleteTaskDialogProps) {
  return (
    <ModalShell titleId="board-delete-task-title" onClose={isDeleting ? () => undefined : onCancel} className="board-delete-dialog">
      <div className="board-delete-dialog__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 6h18" strokeLinecap="round" />
          <path d="M8 6V4.8c0-.99.81-1.8 1.8-1.8h4.4c.99 0 1.8.81 1.8 1.8V6" />
          <path d="M6.5 6.5l.9 11.1A2 2 0 0 0 9.39 19.5h5.22a2 2 0 0 0 1.99-1.9l.9-11.1" />
          <path d="M10 10.2v5.6M14 10.2v5.6" strokeLinecap="round" />
        </svg>
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
        <button
          type="button"
          className="board-delete-dialog__confirm"
          onClick={onConfirm}
          disabled={isDeleting}
        >
          {isDeleting ? "Excluindo..." : "Sim, excluir"}
        </button>
      </div>
    </ModalShell>
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

function resolveDropIndex(event: DragEvent<HTMLElement>, draggingTaskId: string): number {
  const cardElements = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>("[data-board-card='true']")
  ).filter(card => card.dataset.taskId !== draggingTaskId);

  for (let index = 0; index < cardElements.length; index += 1) {
    const card = cardElements[index];
    const rect = card.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (event.clientY < midpoint) {
      return index;
    }
  }

  return cardElements.length;
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
  aiAgents,
  availableTags = [],
  onRunAiAgentOnItem,
  onRunAiRiskAnalysis,
  listWorkspaceDocuments,
  listWorkItemLinkedDocuments,
  linkDocumentToWorkItem,
  unlinkDocumentFromWorkItem
}: BoardColumnsProps) {
  const [draggingTaskId, setDraggingTaskId] = useState("");
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks);
  const [taskPendingDeleteId, setTaskPendingDeleteId] = useState<string>("");
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  useEffect(() => {
    setOptimisticTasks(tasks);
  }, [tasks]);

  const columns = useMemo(() => groupTasksByStatus(optimisticTasks, statuses), [optimisticTasks, statuses]);
  const selectedTask = useMemo(
    () => optimisticTasks.find(task => task.id === selectedTaskId) ?? null,
    [optimisticTasks, selectedTaskId]
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

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    setDraggingTaskId(taskId);
    document.body.classList.add("board-is-dragging");
    setTaskDragPayload(event, taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId("");
    setDropTarget(null);
    document.body.classList.remove("board-is-dragging");
  };

  const handleDrop = async (event: DragEvent<HTMLElement>, statusId: TaskStatusId) => {
    event.preventDefault();
    const taskId = getTaskDragPayload(event) || draggingTaskId;
    if (!taskId) {
      return;
    }

    const dropIndex =
      dropTarget?.statusId === statusId ? dropTarget.index : resolveDropIndex(event, taskId);
    const previousTasks = optimisticTasks;
    const nextTasks = moveTaskLocally(previousTasks, taskId, statusId, dropIndex);

    setOptimisticTasks(nextTasks);
    setDropTarget(null);

    try {
      await onMoveTask(taskId, statusId, dropIndex);
    } catch {
      setOptimisticTasks(previousTasks);
    }
  };

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
    } finally {
      setIsDeletingTask(false);
    }
  };

  return (
    <main className="board-columns-wrap">
      <section className="board-columns">
        {statuses.map(status => {
          const statusTasks = columns[status.id] ?? [];
          const isTarget = dropTarget?.statusId === status.id;
          const isFirstColumn = statuses[0]?.id === status.id;

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

              <div
                className="board-column__list"
                onDragOver={event => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTarget({
                    statusId: status.id,
                    index: resolveDropIndex(event, draggingTaskId)
                  });
                }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDropTarget(current => (current?.statusId === status.id ? null : current));
                  }
                }}
                onDrop={event => void handleDrop(event, status.id)}
              >
                {onCreateTask && isFirstColumn ? (
                  <CreateTaskButton
                    className="board-column__create-task"
                    onCreate={input => onCreateTask(status.id, input)}
                    initialStatusId={status.id}
                    statuses={statuses}
                    boardConfig={boardConfig}
                    membersById={membersById}
                    taskTypes={boardConfig.taskTypes}
                    availableTags={availableTags}
                  />
                ) : null}

                {statusTasks.length === 0 && !isTarget ? (
                  <p className="board-column__empty">Sem itens nesta etapa.</p>
                ) : null}

                {statusTasks.map((task, index) => (
                  <div className="board-column__item" key={task.id}>
                    {isTarget && dropTarget?.index === index ? <div className="board-column__drop-indicator" /> : null}
                    <TaskCard
                      task={task}
                      boardConfig={boardConfig}
                      compact={compactCards}
                      contextualDisplay={{
                        suppressCreatedByWhenAssigneeVisible: true
                      }}
                      membersById={membersById}
                      displayStatuses={statuses}
                      statusLabel={status.label}
                      creatorName={resolveCreatorName(task)}
                      assigneeName={membersById[task.assignee]?.name ?? "Usuario"}
                      assigneeSlot={<MemberAvatar member={membersById[task.assignee]} />}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggingTaskId === task.id}
                      onOpen={setSelectedTaskId}
                      onDelete={handleRequestDeleteTask}
                      onUpdatePriority={onUpdatePriority}
                      onUpdateChecklist={onUpdateTaskChecklist}
                    />
                  </div>
                ))}

                {isTarget && dropTarget?.index === statusTasks.length ? (
                  <div className="board-column__drop-indicator" />
                ) : null}
              </div>
            </section>
          );
        })}
      </section>

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
          listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
          linkDocumentToWorkItem={linkDocumentToWorkItem}
          unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
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

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
import type { AiAgentSummary } from "@/modules/workspace/model";
import type { CreateTaskInput, TaskScheduleInput, UpdateTaskInput } from "@/modules/workspace";
import { getTaskDragPayload, setTaskDragPayload } from "@/features/change-status";
import { CreateTaskButton } from "@/features/create-task";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./board-columns.css";

interface BoardColumnsProps {
  statuses: TaskStatus[];
  tasks: Task[];
  boardConfig: BoardConfig;
  membersById: MembersById;
  compactCards?: boolean;
  onMoveTask: (taskId: string, statusId: TaskStatusId, position?: number) => Promise<void> | void;
  onUpdatePriority: (taskId: string, priority: TaskPriority) => Promise<void> | void;
  onUpdateTaskTitle: (taskId: string, title: string) => Promise<void> | void;
  onUpdateTaskDescription: (taskId: string, description: string) => Promise<void> | void;
  onUpdateTaskCustomField: (
    taskId: string,
    fieldId: string,
    value: TaskCustomFieldValue
  ) => Promise<void> | void;
  onUpdateTaskSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void> | void;
  onSaveTask: (taskId: string, input: UpdateTaskInput) => Promise<void> | void;
  onToggleChecklistItem: (taskId: string, itemId: string) => Promise<void> | void;
  onCreateTask?: (statusId: TaskStatusId, input: CreateTaskInput) => void | Promise<void>;
  createTaskTypes?: Array<{ id: string; label: string }>;
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
}

type DropTarget = {
  statusId: TaskStatusId;
  index: number;
};

function normalizeTaskPositions(tasks: Task[]): Task[] {
  const grouped = new Map<string, Task[]>();

  tasks.forEach(task => {
    const statusTasks = grouped.get(task.status) ?? [];
    statusTasks.push(task);
    grouped.set(task.status, statusTasks);
  });

  return Array.from(grouped.values()).flatMap(statusTasks =>
    [...statusTasks]
      .sort((left, right) => left.position - right.position)
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
    .sort((left, right) => left.position - right.position);
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
  onUpdatePriority,
  onUpdateTaskTitle,
  onUpdateTaskDescription,
  onUpdateTaskCustomField,
  onUpdateTaskSchedule,
  onSaveTask,
  onToggleChecklistItem,
  onCreateTask,
  createTaskTypes,
  aiAgents,
  availableTags = [],
  onRunAiAgentOnItem,
  onRunAiRiskAnalysis
}: BoardColumnsProps) {
  const [draggingTaskId, setDraggingTaskId] = useState("");
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>(tasks);

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
                    typeOptions={createTaskTypes}
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
                      statusLabel={status.label}
                      creatorName={resolveCreatorName(task)}
                      assigneeName={membersById[task.assignee]?.name ?? "Usuario"}
                      assigneeSlot={<MemberAvatar member={membersById[task.assignee]} />}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      isDragging={draggingTaskId === task.id}
                      onOpen={setSelectedTaskId}
                      onUpdatePriority={onUpdatePriority}
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
          onToggleChecklistItem={onToggleChecklistItem}
          aiAgents={aiAgents}
          onRunAiAgentOnItem={onRunAiAgentOnItem}
          onRunAiRiskAnalysis={onRunAiRiskAnalysis}
          onClose={() => setSelectedTaskId("")}
        />
      ) : null}
    </main>
  );
}

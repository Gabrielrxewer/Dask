import { useMemo, useState } from "react";
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
  onMoveTask: (taskId: string, statusId: TaskStatusId) => Promise<void> | void;
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
  onCreateTask?: (input: CreateTaskInput) => void | Promise<void>;
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
  const [dropTargetStatus, setDropTargetStatus] = useState<TaskStatusId | "">("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  const columns = useMemo(() => groupTasksByStatus(tasks, statuses), [tasks, statuses]);
  const selectedTask = useMemo(
    () => tasks.find(task => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
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
    setDropTargetStatus("");
    document.body.classList.remove("board-is-dragging");
  };

  const handleDrop = (event: DragEvent<HTMLElement>, statusId: TaskStatusId) => {
    event.preventDefault();
    const taskId = getTaskDragPayload(event) || draggingTaskId;
    if (taskId) {
      onMoveTask(taskId, statusId);
    }
    setDropTargetStatus("");
  };

  return (
    <main className="board-columns-wrap">
      <section className="board-columns">
        {statuses.map(status => {
          const statusTasks = columns[status.id] ?? [];
          const isTarget = dropTargetStatus === status.id;
          const isBacklogColumn =
            status.id.trim().toLowerCase() === "backlog" ||
            status.label.trim().toLowerCase() === "backlog";

          return (
            <section
              className={`board-column ${isTarget ? "board-column--drop-target" : ""}`}
              key={status.id}
              onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetStatus(status.id);
              }}
              onDragLeave={() => {
                setDropTargetStatus(current => (current === status.id ? "" : current));
              }}
              onDrop={event => handleDrop(event, status.id)}
            >
              <header className="board-column__head">
                <div className="board-column__title">
                  <span className="board-column__dot" style={{ background: status.dot }} />
                  <h2>{status.label}</h2>
                </div>
                <span className="board-column__counter">{statusTasks.length}</span>
              </header>

              <div className="board-column__list">
                {isBacklogColumn && onCreateTask ? (
                  <CreateTaskButton
                    className="board-column__create-task"
                    onCreate={onCreateTask}
                    typeOptions={createTaskTypes}
                  />
                ) : null}

                {statusTasks.length === 0 ? (
                  <p className="board-column__empty">Sem itens nesta etapa.</p>
                ) : (
                  statusTasks.map(task => (
                    <TaskCard
                      key={task.id}
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
                  ))
                )}
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
          onUpdateStatus={onMoveTask}
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

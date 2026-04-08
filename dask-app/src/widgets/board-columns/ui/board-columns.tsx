import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { MembersById } from "@/entities/member";
import { MemberAvatar } from "@/entities/member";
import { TaskCard, groupTasksByStatus } from "@/entities/task";
import type { BoardConfig, Task, TaskStatus, TaskStatusId } from "@/entities/task";
import { getTaskDragPayload, setTaskDragPayload } from "@/features/change-status";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./board-columns.css";

interface BoardColumnsProps {
  statuses: TaskStatus[];
  tasks: Task[];
  boardConfig: BoardConfig;
  membersById: MembersById;
  onMoveTask: (taskId: string, statusId: TaskStatusId) => void;
  onToggleChecklistItem: (taskId: string, itemId: string) => void;
}

export function BoardColumns({
  statuses,
  tasks,
  boardConfig,
  membersById,
  onMoveTask,
  onToggleChecklistItem
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

  const handleDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    setDraggingTaskId(taskId);
    setTaskDragPayload(event, taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId("");
    setDropTargetStatus("");
  };

  const handleDrop = (event: DragEvent<HTMLElement>, statusId: TaskStatusId) => {
    event.preventDefault();
    const taskId = getTaskDragPayload(event);
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

          return (
            <section
              className={`board-column ${isTarget ? "board-column--drop-target" : ""}`}
              key={status.id}
              onDragOver={event => {
                event.preventDefault();
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
                {statusTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    boardConfig={boardConfig}
                    assigneeSlot={<MemberAvatar member={membersById[task.assignee]} />}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingTaskId === task.id}
                    onOpen={setSelectedTaskId}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </section>

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          task={selectedTask}
          status={selectedStatus}
          assignee={membersById[selectedTask.assignee]}
          boardConfig={boardConfig}
          onToggleChecklistItem={onToggleChecklistItem}
          onClose={() => setSelectedTaskId("")}
        />
      ) : null}
    </main>
  );
}

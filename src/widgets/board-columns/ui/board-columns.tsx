import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import type { MembersById } from "@/entities/member";
import { MemberAvatar } from "@/entities/member";
import { TaskCard, groupTasksByStatus } from "@/entities/task";
import type { Task, TaskStatus, TaskStatusId } from "@/entities/task";
import { getTaskDragPayload, setTaskDragPayload } from "@/features/change-status";
import "./board-columns.css";

interface BoardColumnsProps {
  statuses: TaskStatus[];
  tasks: Task[];
  membersById: MembersById;
  onMoveTask: (taskId: string, statusId: TaskStatusId) => void;
}

export function BoardColumns({ statuses, tasks, membersById, onMoveTask }: BoardColumnsProps) {
  const [draggingTaskId, setDraggingTaskId] = useState("");
  const [dropTargetStatus, setDropTargetStatus] = useState<TaskStatusId | "">("");

  const columns = useMemo(() => groupTasksByStatus(tasks, statuses), [tasks, statuses]);

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
                    assigneeSlot={<MemberAvatar member={membersById[task.assignee]} />}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isDragging={draggingTaskId === task.id}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}

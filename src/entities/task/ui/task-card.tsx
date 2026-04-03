import type { DragEvent, ReactNode } from "react";
import { formatShortDate } from "@/shared/lib/date/format-date";
import { priorityMeta } from "@/entities/task/model/task-statuses";
import type { Task } from "@/entities/task";
import "./task-card.css";

interface TaskCardProps {
  task: Task;
  assigneeSlot?: ReactNode;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  assigneeSlot = null,
  onDragStart,
  onDragEnd,
  isDragging = false
}: TaskCardProps) {
  const priority = priorityMeta[task.priority] ?? priorityMeta.low;

  return (
    <article
      className={`task-card ${isDragging ? "task-card--dragging" : ""}`.trim()}
      draggable
      onDragStart={event => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
    >
      <header className="task-card__head">
        <span className={`task-card__priority ${priority.className}`}>{priority.label}</span>
        <button className="task-card__ghost" type="button" aria-label="Mais acoes">
          ...
        </button>
      </header>

      <h4 className="task-card__title">{task.title}</h4>
      <p className="task-card__text">{task.text}</p>

      <div className="task-card__tags">
        {task.tags.map(tag => (
          <span className="task-card__tag" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <footer className="task-card__footer">
        {assigneeSlot}
        <div className="task-card__meta">
          <span>{`Checklist ${task.checklist.done}/${task.checklist.total}`}</span>
          <span>{`Prazo ${formatShortDate(task.due)}`}</span>
        </div>
      </footer>
    </article>
  );
}

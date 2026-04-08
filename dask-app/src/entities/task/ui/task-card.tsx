import type { DragEvent, ReactNode } from "react";
import { formatShortDate } from "@/shared/lib/date/format-date";
import { buildTaskTypeMetaMap, priorityMeta } from "@/entities/task";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskFieldDefinition } from "@/entities/task";
import "./task-card.css";

interface TaskCardProps {
  task: Task;
  boardConfig: BoardConfig;
  assigneeSlot?: ReactNode;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  onOpen?: (taskId: string) => void;
}

function formatCustomFieldValue(value: TaskCustomFieldValue, definition: TaskFieldDefinition): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (definition.type === "boolean") {
    return value ? "Sim" : "Nao";
  }

  if (value === null || typeof value === "undefined" || value === "") {
    return "-";
  }

  return String(value);
}

export function TaskCard({
  task,
  boardConfig,
  assigneeSlot = null,
  onDragStart,
  onDragEnd,
  isDragging = false,
  onOpen
}: TaskCardProps) {
  const checklistTotal = task.checklist.items.length;
  const checklistDone = task.checklist.items.filter(item => item.done).length;
  const priority = priorityMeta[task.priority] ?? priorityMeta.low;
  const typeMap = buildTaskTypeMetaMap(boardConfig.taskTypes);
  const type = typeMap[task.type] ?? {
    id: task.type,
    label: task.type,
    background: "#edf5ff",
    border: "#cfe2ff",
    text: "#1d4e85"
  };
  const fieldMap = boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
    acc[field.id] = field;
    return acc;
  }, {});

  const visibleFields = boardConfig.cardLayout.visibleFieldIds
    .map(fieldId => ({
      definition: fieldMap[fieldId],
      value: task.customFields[fieldId]
    }))
    .filter(
      (item): item is { definition: TaskFieldDefinition; value: TaskCustomFieldValue } =>
        Boolean(item.definition) && typeof item.value !== "undefined"
    )
    .slice(0, 4);

  const canOpen = typeof onOpen === "function";

  return (
    <article
      className={`task-card ${isDragging ? "task-card--dragging" : ""}`.trim()}
      draggable
      onDragStart={event => onDragStart(event, task.id)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen?.(task.id)}
      onKeyDown={event => {
        if (!canOpen) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(task.id);
        }
      }}
      role={canOpen ? "button" : undefined}
      tabIndex={canOpen ? 0 : undefined}
      aria-label={canOpen ? `Abrir detalhes da tarefa ${task.title}` : undefined}
    >
      <header className="task-card__head">
        <div className="task-card__badges">
          <span
            className="task-card__type"
            style={{
              backgroundColor: type.background,
              borderColor: type.border,
              color: type.text
            }}
          >
            {type.label}
          </span>
          <span className={`task-card__priority ${priority.className}`}>{priority.label}</span>
        </div>
        <button
          className="task-card__ghost"
          type="button"
          aria-label="Mais acoes"
          onClick={event => event.stopPropagation()}
        >
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

      {visibleFields.length > 0 ? (
        <div className="task-card__fields">
          {visibleFields.map(({ definition, value }) => (
            <span className="task-card__field" key={definition.id}>
              <strong>{definition.label}</strong>
              {formatCustomFieldValue(value, definition)}
            </span>
          ))}
        </div>
      ) : null}

      <footer className="task-card__footer">
        {assigneeSlot}
        <div className="task-card__meta">
          <span>{`Checklist ${checklistDone}/${checklistTotal}`}</span>
          <span>{`Prazo ${formatShortDate(task.due)}`}</span>
        </div>
      </footer>
    </article>
  );
}

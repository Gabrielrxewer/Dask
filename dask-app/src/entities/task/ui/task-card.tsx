import type { DragEvent, ReactNode } from "react";
import { buildTaskChecklistSummary, buildTaskTypeMetaMap, getTaskTypeDisplayMeta, priorityMeta } from "@/entities/task";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskFieldDefinition, TaskPriority } from "@/entities/task";
import { cn } from "@/shared/lib/cn";
import { formatShortDate } from "@/shared/lib/date/format-date";
import "./task-card.css";

interface TaskCardProps {
  task: Task;
  boardConfig: BoardConfig;
  compact?: boolean;
  creatorName?: string;
  assigneeName?: string;
  assigneeSlot?: ReactNode;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  onOpen?: (taskId: string) => void;
  onUpdatePriority?: (taskId: string, priority: TaskPriority) => void;
}

const taskTypeIconById: Record<string, string> = {
  bug: "B",
  "user-story": "US",
  incident: "I",
  epic: "E",
  hotfix: "H",
  improvement: "M",
  spike: "S",
  research: "R"
};

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

function resolveFieldChipTone(definition: TaskFieldDefinition, value: TaskCustomFieldValue): string {
  if (definition.id !== "severity" || typeof value !== "string") {
    return "";
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "critical") {
    return "task-card__field-chip--critical";
  }

  if (normalizedValue === "high") {
    return "task-card__field-chip--high";
  }

  if (normalizedValue === "medium") {
    return "task-card__field-chip--medium";
  }

  if (normalizedValue === "low") {
    return "task-card__field-chip--low";
  }

  return "";
}

export function TaskCard({
  task,
  boardConfig,
  compact = false,
  creatorName,
  assigneeName,
  assigneeSlot = null,
  onDragStart,
  onDragEnd,
  isDragging = false,
  onOpen,
  onUpdatePriority
}: TaskCardProps) {
  const checklist = buildTaskChecklistSummary(task);
  const priority = priorityMeta[task.priority] ?? priorityMeta[2];
  const typeMap = buildTaskTypeMetaMap(boardConfig.taskTypes);
  const type = getTaskTypeDisplayMeta(typeMap, task.type);
  const fieldMap = boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
    acc[field.id] = field;
    return acc;
  }, {});

  const maxVisibleTags = compact ? 1 : 2;
  const maxVisibleFields = compact ? 1 : 2;
  const visibleFields = boardConfig.cardLayout.visibleFieldIds
    .map(fieldId => ({
      definition: fieldMap[fieldId],
      value: task.customFields[fieldId]
    }))
    .filter(
      (item): item is { definition: TaskFieldDefinition; value: TaskCustomFieldValue } =>
        Boolean(item.definition) && typeof item.value !== "undefined"
    )
    .slice(0, maxVisibleFields);

  const canOpen = typeof onOpen === "function";
  const canUpdatePriority = typeof onUpdatePriority === "function";
  const nextPriority: TaskPriority = task.priority === 4 ? 0 : ((task.priority + 1) as TaskPriority);
  const authorLabel = creatorName ?? "Usuario";
  const ownerLabel = assigneeName ?? authorLabel;
  const typeIcon = taskTypeIconById[task.type] ?? "T";
  const displayTags = task.tags.slice(0, maxVisibleTags);
  const hiddenTagsCount = Math.max(task.tags.length - displayTags.length, 0);
  const hasSupportingInfo = displayTags.length > 0 || hiddenTagsCount > 0 || visibleFields.length > 0;
  const showCreator = authorLabel.trim().toLowerCase() !== ownerLabel.trim().toLowerCase();
  const hasChecklist = checklist.total > 0;
  const hasDueDate = Boolean(task.due);

  return (
    <article
      className={cn(
        "task-card",
        `task-card--priority-${task.priority}`,
        compact && "task-card--compact",
        isDragging && "task-card--dragging"
      )}
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
          >
            <span className="task-card__type-icon" aria-hidden="true">
              {typeIcon}
            </span>
            <span>{type.label}</span>
          </span>
          <button
            type="button"
            className={cn("task-card__priority", priority.className)}
            aria-label={`Prioridade atual ${priority.label}. Clique para mudar.`}
            disabled={!canUpdatePriority}
            onClick={event => {
              event.stopPropagation();
              if (!canUpdatePriority) {
                return;
              }
              onUpdatePriority(task.id, nextPriority);
            }}
          >
            {priority.label}
          </button>
        </div>
      </header>

      <div className="task-card__body">
        <h4 className="task-card__title">{task.title}</h4>
        {task.text ? <p className="task-card__text">{task.text}</p> : null}
        {showCreator ? <p className="task-card__caption">{`Criado por ${authorLabel}`}</p> : null}

        {hasSupportingInfo ? (
          <div className="task-card__supporting">
            {displayTags.map(tag => (
              <span className="task-card__tag" key={tag}>
                {tag}
              </span>
            ))}
            {hiddenTagsCount > 0 ? (
              <span className="task-card__tag task-card__tag--more">{`+${hiddenTagsCount}`}</span>
            ) : null}

            {visibleFields.map(({ definition, value }) => (
              <span
                className={cn("task-card__field-chip", resolveFieldChipTone(definition, value))}
                key={definition.id}
              >
                <strong>{definition.label}</strong>
                <span>{formatCustomFieldValue(value, definition)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="task-card__footer">
        <div className="task-card__owner">
          {assigneeSlot}
          <div className="task-card__owner-text">
            <strong>Responsavel</strong>
            <span>{ownerLabel}</span>
          </div>
        </div>
        <div className="task-card__meta">
          {hasChecklist ? (
            <span className="task-card__meta-item">
              <strong>{`${checklist.done}/${checklist.total}`}</strong>
              <span>Checklist</span>
            </span>
          ) : null}
          {hasDueDate ? (
            <span className="task-card__meta-item">
              <strong>{formatShortDate(task.due)}</strong>
              <span>Prazo</span>
            </span>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

import { useEffect, useId, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  buildTaskChecklistSummary,
  buildTaskTypeMetaMap,
  getTaskTypeDisplayMeta,
  isSystemCardFieldId,
  priorityMeta,
  resolveFieldIdsForTaskType
} from "@/entities/task";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskFieldDefinition, TaskPriority } from "@/entities/task";
import { TaskTypeIcon, resolveTaskTypeIconName } from "@/entities/task/ui/task-type-icon";
import { cn } from "@/shared/lib/cn";
import { formatShortDate } from "@/shared/lib/date/format-date";
import "./task-card.css";

interface TaskCardProps {
  task: Task;
  boardConfig: BoardConfig;
  compact?: boolean;
  draggable?: boolean;
  fieldSlotRenderer?: (slot: { fieldId: string; area: "badge" | "title" | "description" | "summary" | "tags" | "custom-field" | "meta"; content: ReactNode }) => ReactNode;
  creatorName?: string;
  assigneeName?: string;
  statusLabel?: string;
  assigneeSlot?: ReactNode;
  onDragStart: (event: DragEvent<HTMLElement>, taskId: string) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  onOpen?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onUpdatePriority?: (taskId: string, priority: TaskPriority) => void;
}

type TaskCardSlotArea = "badge" | "title" | "description" | "summary" | "tags" | "custom-field" | "meta";

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

function getSystemFieldArea(fieldId: string): TaskCardSlotArea {
  if (fieldId === "sys:type" || fieldId === "sys:status") return "badge";
  if (fieldId === "sys:title") return "title";
  if (fieldId === "sys:description") return "description";
  if (fieldId === "sys:tags") return "tags";
  if (fieldId === "sys:checklist" || fieldId === "sys:due-date") return "meta";
  return "summary";
}

export function TaskCard({
  task,
  boardConfig,
  compact = false,
  draggable = true,
  fieldSlotRenderer,
  creatorName,
  assigneeName,
  statusLabel,
  assigneeSlot = null,
  onDragStart,
  onDragEnd,
  isDragging = false,
  onOpen,
  onDelete,
  onUpdatePriority
}: TaskCardProps) {
  const checklist = buildTaskChecklistSummary(task);
  const [isMounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const typeMap = buildTaskTypeMetaMap(boardConfig.taskTypes);
  const type = getTaskTypeDisplayMeta(typeMap, task.type);
  const fieldMap = boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
    acc[field.id] = field;
    return acc;
  }, {});

  const effectiveVisibleFieldIds = resolveFieldIdsForTaskType(
    task.type,
    boardConfig.cardLayout.visibleFieldIdsByType,
    boardConfig.cardLayout.visibleFieldIds
  );
  const visibleFieldIdSet = new Set(effectiveVisibleFieldIds);
  const visibleCustomFieldIds = effectiveVisibleFieldIds.filter(fieldId => !isSystemCardFieldId(fieldId));

  const visibleFields = visibleCustomFieldIds
    .map(fieldId => ({
      definition: fieldMap[fieldId],
      value: task.customFields[fieldId]
    }))
    .filter(
      (item): item is { definition: TaskFieldDefinition; value: TaskCustomFieldValue } =>
        Boolean(item.definition)
    );

  const showType = visibleFieldIdSet.has("sys:type");
  const showStatus = visibleFieldIdSet.has("sys:status");
  const showTitle = visibleFieldIdSet.has("sys:title");
  const showDescription = visibleFieldIdSet.has("sys:description");
  const showCreatedBy = visibleFieldIdSet.has("sys:created-by");
  const showAssignee = visibleFieldIdSet.has("sys:assignee");
  const showTags = visibleFieldIdSet.has("sys:tags");
  const showChecklist = visibleFieldIdSet.has("sys:checklist");
  const showDueDate = visibleFieldIdSet.has("sys:due-date");
  const hasMetaFooter = showChecklist || showDueDate;

  const canOpen = typeof onOpen === "function";
  const authorLabel = creatorName ?? "Usuario";
  const ownerLabel = assigneeName ?? authorLabel;
  const displayTags = task.tags.slice(0, 4);
  const hiddenTagsCount = Math.max(task.tags.length - displayTags.length, 0);
  const typeLabel = type.label?.trim() || task.type;
  const typeIconName = resolveTaskTypeIconName(type.id);
  const priorityLabel = priorityMeta[task.priority]?.label ?? "Prioridade";
  const renderFieldSlot = (
    fieldId: string,
    area: TaskCardSlotArea,
    content: ReactNode
  ) => (fieldSlotRenderer ? fieldSlotRenderer({ fieldId, area, content }) : content);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target))
      ) {
        return;
      }
      setIsMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useLayoutEffect(() => {
    if (!isMenuOpen || !menuButtonRef.current || !menuRef.current) {
      return;
    }

    const updatePosition = () => {
      if (!menuButtonRef.current || !menuRef.current) {
        return;
      }

      const gap = 10;
      const viewportPadding = 12;
      const buttonRect = menuButtonRef.current.getBoundingClientRect();
      const popoverRect = menuRef.current.getBoundingClientRect();

      let left = buttonRect.right - popoverRect.width;
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - popoverRect.width - viewportPadding));

      let top = buttonRect.bottom + gap;
      if (top + popoverRect.height > window.innerHeight - viewportPadding) {
        top = buttonRect.top - popoverRect.height - gap;
      }
      top = Math.max(viewportPadding, top);

      setMenuStyle({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isMenuOpen]);

  const orderedSummaryFieldIds = effectiveVisibleFieldIds.filter(
    fieldId =>
      visibleFieldIdSet.has(fieldId) &&
      (fieldId === "sys:created-by" || fieldId === "sys:assignee")
  );

  const orderedMetaFieldIds = effectiveVisibleFieldIds.filter(
    fieldId =>
      visibleFieldIdSet.has(fieldId) &&
      (fieldId === "sys:checklist" || fieldId === "sys:due-date")
  );

  const renderedSummaryFields = orderedSummaryFieldIds.map(fieldId => {
    if (fieldId === "sys:created-by") {
      return renderFieldSlot(
        fieldId,
        getSystemFieldArea(fieldId),
        <span className="task-card__summary-item" key={fieldId}>
          <strong>Criado por</strong>
          <span>{authorLabel}</span>
        </span>
      );
    }

    return renderFieldSlot(
      fieldId,
      getSystemFieldArea(fieldId),
      <span className="task-card__summary-item" key={fieldId}>
        <strong>Responsavel</strong>
        <span>{ownerLabel}</span>
      </span>
    );
  });

  const renderedMetaFields = orderedMetaFieldIds.map(fieldId => {
    if (fieldId === "sys:checklist") {
      return renderFieldSlot(fieldId, getSystemFieldArea(fieldId), <span key={fieldId}>{`Checklist ${checklist.done}/${checklist.total}`}</span>);
    }

    return renderFieldSlot(fieldId, getSystemFieldArea(fieldId), <span key={fieldId}>{`Prazo ${formatShortDate(task.due)}`}</span>);
  });

  return (
    <article
      className={cn(
        "task-card",
        `task-card--priority-${task.priority}`,
        compact && "task-card--compact",
        isDragging && "task-card--dragging"
      )}
      data-board-card="true"
      data-task-id={task.id}
      draggable={draggable}
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
          {showType ? (
            renderFieldSlot(
              "sys:type",
              "badge",
              <span
                className="task-card__type-icon"
                role="img"
                aria-label={typeLabel}
                title={typeLabel}
                style={{
                  color: type.text
                }}
              >
                <TaskTypeIcon name={typeIconName} />
              </span>
            )
          ) : null}

          {showStatus ? renderFieldSlot("sys:status", "badge", <span className="task-card__tag">{statusLabel ?? task.status}</span>) : null}
        </div>
        <button
          ref={menuButtonRef}
          className="task-card__ghost"
          type="button"
          aria-label="Mais acoes"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls={isMenuOpen ? menuId : undefined}
          onClick={event => {
            event.stopPropagation();
            setIsMenuOpen(current => !current);
          }}
        >
          <span aria-hidden="true">•••</span>
        </button>
      </header>

      {showTitle ? renderFieldSlot("sys:title", "title", <h4 className="task-card__title">{task.title}</h4>) : null}
      {showDescription && task.text
        ? renderFieldSlot("sys:description", "description", <p className="task-card__text">{task.text}</p>)
        : null}

      {showCreatedBy || showAssignee ? (
        <div className="task-card__summary">
          {renderedSummaryFields}
        </div>
      ) : null}

      {showTags ? (
        renderFieldSlot(
          "sys:tags",
          "tags",
          <div className="task-card__tags">
            {displayTags.map(tag => (
              <span className="task-card__tag" key={tag}>
                {tag}
              </span>
            ))}
            {hiddenTagsCount > 0 ? <span className="task-card__tag task-card__tag--more">{`+${hiddenTagsCount}`}</span> : null}
          </div>
        )
      ) : null}

      {visibleFields.length > 0 ? (
        <div className="task-card__fields">
          {visibleFields.map(({ definition, value }) => (
            renderFieldSlot(
              definition.id,
              "custom-field",
              <span className="task-card__field" key={definition.id}>
                <strong>{definition.label}</strong>
                <span className="task-card__field-value">{formatCustomFieldValue(value, definition)}</span>
              </span>
            )
          ))}
        </div>
      ) : null}

      {showAssignee || hasMetaFooter ? (
        <footer className="task-card__footer">
          {showAssignee ? (
            <div className="task-card__owner">
              {assigneeSlot}
              <div className="task-card__owner-text">
                <strong>Responsavel</strong>
                <span>{ownerLabel}</span>
              </div>
            </div>
          ) : null}
          {hasMetaFooter ? (
            <div className="task-card__meta">
              {renderedMetaFields}
            </div>
          ) : null}
        </footer>
      ) : null}

      {isMounted && isMenuOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="task-card__menu"
              role="menu"
              aria-label={`Acoes da tarefa ${task.title}`}
              style={{ top: `${menuStyle.top}px`, left: `${menuStyle.left}px` }}
              onClick={event => event.stopPropagation()}
            >
              {canOpen ? (
                <div className="task-card__menu-section" role="none">
                  <button
                    type="button"
                    className="task-card__menu-action"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpen?.(task.id);
                    }}
                  >
                    Abrir item
                  </button>
                </div>
              ) : null}

              {onUpdatePriority ? (
                <div className="task-card__menu-section" role="none">
                  <div className="task-card__menu-group" role="none">
                    <span className="task-card__menu-label">Prioridade</span>
                    <div className="task-card__menu-priority-row" role="none">
                      {[0, 1, 2, 3, 4].map(option => {
                        const optionPriority = option as TaskPriority;
                        const isActive = task.priority === optionPriority;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={cn("task-card__menu-priority-pill", isActive && "task-card__menu-priority-pill--active")}
                            role="menuitemradio"
                            aria-checked={isActive}
                            aria-label={`Definir prioridade ${priorityMeta[optionPriority].label}`}
                            title={priorityMeta[optionPriority].label}
                            onClick={() => {
                              setIsMenuOpen(false);
                              onUpdatePriority(task.id, optionPriority);
                            }}
                          >
                            <span className={cn("task-card__menu-priority-dot", `task-card__menu-priority-dot--${option}`)} aria-hidden="true" />
                            <span>{`P${option}`}</span>
                          </button>
                        );
                      })}
                    </div>
                    <span className="task-card__menu-helper">{priorityLabel}</span>
                  </div>
                </div>
              ) : null}

              {onDelete ? (
                <div className="task-card__menu-section" role="none">
                  <button
                    type="button"
                    className="task-card__menu-action task-card__menu-action--danger"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDelete(task.id);
                    }}
                  >
                    Excluir item
                  </button>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </article>
  );
}

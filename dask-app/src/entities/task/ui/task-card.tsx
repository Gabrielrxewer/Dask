import { Fragment, createElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { MembersById } from "@/entities/member";
import {
  matchesTaskFieldStorage,
  priorityMeta
} from "@/entities/task";
import { buildTaskCardRenderModel, CARD_SLOT_LIMITS, type TaskCardDebugSnapshot, type TaskCardSlotArea } from "@/entities/task/model/task-card-render-model";
import type { BoardConfig, Task, TaskFieldDefinition, TaskPriority, TaskStatus } from "@/entities/task";
import { WorkItemFieldRenderer } from "@/entities/task/ui/field-presentation";
import { cn } from "@/shared/lib/cn";
import "./task-card.css";

type TaskCardFieldSlotContext = {
  fieldId: string;
  area: "badge" | "title" | "description" | "summary" | "tags" | "custom-field" | "meta";
  visualPriority: "primary" | "secondary" | "supporting";
  field: TaskFieldDefinition;
  value: ReturnType<typeof buildTaskCardRenderModel>["resolvedFields"][number]["value"];
  index: number;
  slotLimit: number;
  occupiedCount: number;
};

type TaskCardFieldDndConfig = {
  id: string;
  data?: Record<string, unknown>;
  disabled?: boolean;
};

interface TaskCardProps {
  task: Task;
  boardConfig: BoardConfig;
  compact?: boolean;
  ignoreSlotLimits?: boolean;
  contextualDisplay?: {
    suppressStatus?: boolean;
    suppressCreatedByWhenAssigneeVisible?: boolean;
  };
  getFieldSlotProps?: (slot: TaskCardFieldSlotContext) => HTMLAttributes<HTMLElement>;
  getFieldDragConfig?: (slot: TaskCardFieldSlotContext) => TaskCardFieldDndConfig | null;
  getFieldDropConfig?: (slot: TaskCardFieldSlotContext) => TaskCardFieldDndConfig | null;
  renderEmptySlot?: (slot: {
    area: TaskCardSlotArea;
    index: number;
    occupiedCount: number;
    slotLimit: number;
    availableCount: number;
  }) => ReactNode;
  membersById?: MembersById;
  displayStatuses?: TaskStatus[];
  onDebugSnapshot?: (snapshot: TaskCardDebugSnapshot) => void;
  creatorName?: string;
  assigneeName?: string;
  statusLabel?: string;
  assigneeSlot?: ReactNode;
  isDragging?: boolean;
  onOpen?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onUpdatePriority?: (taskId: string, priority: TaskPriority) => void;
  onUpdateChecklist?: (taskId: string, checklist: Task["checklist"]) => Promise<void> | void;
  onMoveToStatus?: (taskId: string, statusId: string) => void;
}

function TaskCardFieldSlot({
  element,
  className,
  nativeProps,
  dragConfig,
  dropConfig,
  children
}: {
  element: "span" | "div" | "h4" | "p";
  className?: string;
  nativeProps: HTMLAttributes<HTMLElement>;
  dragConfig?: TaskCardFieldDndConfig | null;
  dropConfig?: TaskCardFieldDndConfig | null;
  children: ReactNode;
}) {
  const fallbackId = useId();
  const drag = useDraggable({
    id: dragConfig?.id ?? `task-card-field-disabled:${fallbackId}`,
    data: dragConfig?.data,
    disabled: !dragConfig || dragConfig.disabled
  });
  const drop = useDroppable({
    id: dropConfig?.id ?? `task-card-field-drop-disabled:${fallbackId}`,
    data: dropConfig?.data,
    disabled: !dropConfig || dropConfig.disabled
  });
  const setSlotNodeRef = useCallback(
    (node: HTMLElement | null) => {
      drag.setNodeRef(node);
      drop.setNodeRef(node);
    },
    [drag.setNodeRef, drop.setNodeRef]
  );
  const { style, ...restNativeProps } = nativeProps;
  const transform = CSS.Translate.toString(drag.transform);

  return createElement(
    element,
    {
      ...restNativeProps,
      ...drag.attributes,
      ...drag.listeners,
      ref: setSlotNodeRef,
      className: cn(
        className,
        dragConfig && "task-card__field-slot--draggable",
        drag.isDragging && "task-card__field-slot--dragging",
        drop.isOver && "task-card__field-slot--over"
      ),
      style: {
        ...style,
        transform: transform || style?.transform
      }
    },
    children
  );
}

export function TaskCard({
  task,
  boardConfig,
  compact = false,
  ignoreSlotLimits = false,
  contextualDisplay,
  getFieldSlotProps,
  getFieldDragConfig,
  getFieldDropConfig,
  renderEmptySlot,
  membersById,
  displayStatuses,
  onDebugSnapshot,
  isDragging = false,
  onOpen,
  onDelete,
  onUpdatePriority,
  onUpdateChecklist,
  onMoveToStatus
}: TaskCardProps) {
  const [isMounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const debugSnapshotKeyRef = useRef("");
  const menuId = useId();
  const canOpen = typeof onOpen === "function";
  const resolvedStatuses = displayStatuses ?? boardConfig.statuses;

  const { resolvedFields, debugSnapshot } = useMemo(
    () =>
      buildTaskCardRenderModel({
        task,
        boardConfig,
        statuses: resolvedStatuses,
        membersById,
        ignoreSlotLimits
      }),
    [boardConfig, ignoreSlotLimits, membersById, resolvedStatuses, task]
  );

  const filteredFields = useMemo(() => {
    const shouldSuppressStatus = contextualDisplay?.suppressStatus === true;
    const shouldSuppressCreatedBy = contextualDisplay?.suppressCreatedByWhenAssigneeVisible === true;
    const hasVisibleAssignee = resolvedFields.some(
      field => matchesTaskFieldStorage(field.definition, { kind: "item_property", property: "assigneeId" })
    );

    return resolvedFields.filter(field => {
      if (
        shouldSuppressStatus &&
        matchesTaskFieldStorage(field.definition, { kind: "item_property", property: "stateSlug" })
      ) {
        return false;
      }

      if (
        shouldSuppressCreatedBy &&
        hasVisibleAssignee &&
        matchesTaskFieldStorage(field.definition, { kind: "item_property", property: "createdBy" })
      ) {
        return false;
      }

      return true;
    });
  }, [contextualDisplay?.suppressCreatedByWhenAssigneeVisible, contextualDisplay?.suppressStatus, resolvedFields]);

  const badgeFields = filteredFields.filter(field => field.area === "badge");
  const titleFields = filteredFields.filter(field => field.area === "title");
  const descriptionFields = filteredFields.filter(field => field.area === "description");
  const summaryFields = filteredFields.filter(field => field.area === "summary");
  const tagFields = filteredFields.filter(field => field.area === "tags");
  const customFields = filteredFields.filter(field => field.area === "custom-field");
  const metaFields = filteredFields.filter(field => field.area === "meta");
  const emptySlotCountByArea = {
    badge: Math.max(0, CARD_SLOT_LIMITS.badge - badgeFields.length),
    title: Math.max(0, CARD_SLOT_LIMITS.title - titleFields.length),
    description: Math.max(0, CARD_SLOT_LIMITS.description - descriptionFields.length),
    summary: Math.max(0, CARD_SLOT_LIMITS.summary - summaryFields.length),
    tags: Math.max(0, CARD_SLOT_LIMITS.tags - tagFields.length),
    "custom-field": Math.max(0, CARD_SLOT_LIMITS["custom-field"] - customFields.length),
    meta: Math.max(0, CARD_SLOT_LIMITS.meta - metaFields.length)
  } satisfies Record<TaskCardSlotArea, number>;
  const priorityLabel = priorityMeta[task.priority]?.label ?? "Prioridade";
  const moveTargets = typeof onMoveToStatus === "function"
    ? resolvedStatuses.filter(status => status.id !== task.status)
    : [];
  const hasMenuActions =
    canOpen ||
    typeof onDelete === "function" ||
    typeof onUpdatePriority === "function" ||
    moveTargets.length > 0;
  const hasHeader = badgeFields.length > 0 || hasMenuActions || emptySlotCountByArea.badge > 0;

  const resolveFieldSlotContext = (
    field: (typeof resolvedFields)[number],
    area: TaskCardSlotArea,
    index: number,
    occupiedCount: number
  ): TaskCardFieldSlotContext => ({
      fieldId: field.definition.id,
      area,
      visualPriority: field.visualPriority,
      field: field.definition,
      value: field.value,
      index,
      slotLimit: CARD_SLOT_LIMITS[area],
      occupiedCount
    });

  const resolveFieldSlotProps = (slot: TaskCardFieldSlotContext): HTMLAttributes<HTMLElement> =>
    getFieldSlotProps?.(slot) ?? {};

  const resolveFieldDragConfig = (slot: TaskCardFieldSlotContext): TaskCardFieldDndConfig | null =>
    getFieldDragConfig?.(slot) ?? null;

  const resolveFieldDropConfig = (slot: TaskCardFieldSlotContext): TaskCardFieldDndConfig | null =>
    getFieldDropConfig?.(slot) ?? null;

  const renderEmptySlots = (area: TaskCardSlotArea, occupiedCount: number) => {
    if (!renderEmptySlot) {
      return null;
    }

    const slotLimit = CARD_SLOT_LIMITS[area];
    const availableCount = Math.max(0, slotLimit - occupiedCount);
    return Array.from({ length: availableCount }, (_, offset) => (
      <Fragment key={`empty-${area}-${occupiedCount + offset}`}>
        {renderEmptySlot({
          area,
          index: occupiedCount + offset,
          occupiedCount,
          slotLimit,
          availableCount
        })}
      </Fragment>
    ));
  };

  const renderFieldValue = (field: (typeof resolvedFields)[number]) => (
    <WorkItemFieldRenderer
      field={field.definition}
      value={field.value}
      mode="display"
      context="card"
      boardConfig={boardConfig}
      statuses={resolvedStatuses}
      task={task}
      membersById={membersById}
      cardArea={field.area}
      onChange={
        typeof onUpdateChecklist === "function" &&
        field.definition.type === "checklist" &&
        matchesTaskFieldStorage(field.definition, { kind: "item_property", property: "checklist" })
          ? value => {
              if (value && typeof value === "object" && !Array.isArray(value) && "items" in value) {
                void onUpdateChecklist(task.id, value as Task["checklist"]);
              }
            }
          : undefined
      }
    />
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!onDebugSnapshot) return;

    const nextKey = JSON.stringify(debugSnapshot);
    if (debugSnapshotKeyRef.current === nextKey) return;

    debugSnapshotKeyRef.current = nextKey;
    onDebugSnapshot(debugSnapshot);
  }, [debugSnapshot, onDebugSnapshot]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target))) {
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

  const renderSummaryField = (field: (typeof resolvedFields)[number], index: number, occupiedCount: number) => {
    const slotContext = resolveFieldSlotContext(field, "summary", index, occupiedCount);
    const slotProps = resolveFieldSlotProps(slotContext);
    const { className, ...nativeProps } = slotProps;

    return (
      <TaskCardFieldSlot
        element="span"
        className={cn("task-card__summary-item", className)}
        key={field.definition.id}
        nativeProps={nativeProps}
        dragConfig={resolveFieldDragConfig(slotContext)}
        dropConfig={resolveFieldDropConfig(slotContext)}
      >
        {renderFieldValue(field)}
      </TaskCardFieldSlot>
    );
  };

  const renderCustomField = (field: (typeof resolvedFields)[number], index: number, occupiedCount: number) => {
    const slotContext = resolveFieldSlotContext(field, "custom-field", index, occupiedCount);
    const slotProps = resolveFieldSlotProps(slotContext);
    const { className, ...nativeProps } = slotProps;

    return (
      <TaskCardFieldSlot
        element="div"
        className={cn("task-card__field", className)}
        key={field.definition.id}
        nativeProps={nativeProps}
        dragConfig={resolveFieldDragConfig(slotContext)}
        dropConfig={resolveFieldDropConfig(slotContext)}
      >
        <span className="task-card__field-value">{renderFieldValue(field)}</span>
      </TaskCardFieldSlot>
    );
  };

  const renderMetaField = (field: (typeof resolvedFields)[number], index: number, occupiedCount: number) => {
    const slotContext = resolveFieldSlotContext(field, "meta", index, occupiedCount);
    const slotProps = resolveFieldSlotProps(slotContext);
    const { className, ...nativeProps } = slotProps;

    return (
      <TaskCardFieldSlot
        element="div"
        className={className}
        key={field.definition.id}
        nativeProps={nativeProps}
        dragConfig={resolveFieldDragConfig(slotContext)}
        dropConfig={resolveFieldDropConfig(slotContext)}
      >
        {renderFieldValue(field)}
      </TaskCardFieldSlot>
    );
  };

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
      {hasHeader ? (
        <header className="task-card__head">
          <div className="task-card__badges">
            {badgeFields.map(field => {
              const slotContext = resolveFieldSlotContext(field, "badge", badgeFields.indexOf(field), badgeFields.length);
              const slotProps = resolveFieldSlotProps(slotContext);
              const { className, ...nativeProps } = slotProps;

              return (
                <TaskCardFieldSlot
                  element="span"
                  className={className}
                  key={field.definition.id}
                  nativeProps={nativeProps}
                  dragConfig={resolveFieldDragConfig(slotContext)}
                  dropConfig={resolveFieldDropConfig(slotContext)}
                >
                  {renderFieldValue(field)}
                </TaskCardFieldSlot>
              );
            })}
            {renderEmptySlots("badge", badgeFields.length)}
          </div>
          {hasMenuActions ? (
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
              <span aria-hidden="true">...</span>
            </button>
          ) : null}
        </header>
      ) : null}

      {titleFields.map(field => {
        const slotContext = resolveFieldSlotContext(field, "title", titleFields.indexOf(field), titleFields.length);
        const slotProps = resolveFieldSlotProps(slotContext);
        const { className, ...nativeProps } = slotProps;

        return (
          <TaskCardFieldSlot
            element="h4"
            className={cn("task-card__title", className)}
            key={field.definition.id}
            nativeProps={nativeProps}
            dragConfig={resolveFieldDragConfig(slotContext)}
            dropConfig={resolveFieldDropConfig(slotContext)}
          >
            {renderFieldValue(field)}
          </TaskCardFieldSlot>
        );
      })}
      {renderEmptySlots("title", titleFields.length)}

      {descriptionFields.map(field => {
        const slotContext = resolveFieldSlotContext(field, "description", descriptionFields.indexOf(field), descriptionFields.length);
        const slotProps = resolveFieldSlotProps(slotContext);
        const { className, ...nativeProps } = slotProps;

        return (
          <TaskCardFieldSlot
            element="p"
            className={cn("task-card__text", className)}
            key={field.definition.id}
            nativeProps={nativeProps}
            dragConfig={resolveFieldDragConfig(slotContext)}
            dropConfig={resolveFieldDropConfig(slotContext)}
          >
            {renderFieldValue(field)}
          </TaskCardFieldSlot>
        );
      })}
      {renderEmptySlots("description", descriptionFields.length)}

      {summaryFields.length > 0 || emptySlotCountByArea.summary > 0 ? (
        <div className="task-card__summary">
          {summaryFields.map((field, index) => renderSummaryField(field, index, summaryFields.length))}
          {renderEmptySlots("summary", summaryFields.length)}
        </div>
      ) : null}

      {tagFields.map(field => {
        const slotContext = resolveFieldSlotContext(field, "tags", tagFields.indexOf(field), tagFields.length);
        const slotProps = resolveFieldSlotProps(slotContext);
        const { className, ...nativeProps } = slotProps;

        return (
          <TaskCardFieldSlot
            element="div"
            className={cn("task-card__tags", className)}
            key={field.definition.id}
            nativeProps={nativeProps}
            dragConfig={resolveFieldDragConfig(slotContext)}
            dropConfig={resolveFieldDropConfig(slotContext)}
          >
            {renderFieldValue(field)}
          </TaskCardFieldSlot>
        );
      })}
      {renderEmptySlots("tags", tagFields.length)}

      {customFields.length > 0 || emptySlotCountByArea["custom-field"] > 0 ? (
        <div className="task-card__fields">
          {customFields.map((field, index) => renderCustomField(field, index, customFields.length))}
          {renderEmptySlots("custom-field", customFields.length)}
        </div>
      ) : null}

      {metaFields.length > 0 || emptySlotCountByArea.meta > 0 ? (
        <footer className="task-card__footer">
          <div className="task-card__meta">
            {metaFields.map((field, index) => renderMetaField(field, index, metaFields.length))}
            {renderEmptySlots("meta", metaFields.length)}
          </div>
        </footer>
      ) : null}

      {hasMenuActions && isMounted && isMenuOpen
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

              {moveTargets.length > 0 ? (
                <div className="task-card__menu-section" role="none">
                  <div className="task-card__menu-group" role="none">
                    <span className="task-card__menu-label">Mover para</span>
                    <div className="task-card__menu-status-list" role="none">
                      {moveTargets.map(status => (
                        <button
                          key={status.id}
                          type="button"
                          className="task-card__menu-action task-card__menu-action--status"
                          role="menuitem"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onMoveToStatus?.(task.id, status.id);
                          }}
                        >
                          <span className="task-card__menu-status-dot" style={{ background: status.dot }} aria-hidden="true" />
                          <span>{status.label}</span>
                        </button>
                      ))}
                    </div>
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

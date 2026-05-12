import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export const FLOW_NODE_SIDEBAR_DRAG_TYPE = "flow-node-sidebar-item";

export interface FlowNodeSidebarDragData<TItem extends string = string> {
  type: typeof FLOW_NODE_SIDEBAR_DRAG_TYPE;
  itemId: TItem;
}

export interface FlowNodeSidebarMenuItem<TItem extends string = string> {
  id: TItem;
  label: string;
  description?: string;
  color?: string;
  disabled?: boolean;
  dragEnabled?: boolean;
}

export interface FlowNodeSidebarMenuSection<TItem extends string = string> {
  id: string;
  title?: string;
  items: FlowNodeSidebarMenuItem<TItem>[];
}

export interface FlowNodeSidebarMenuAction<TAction extends string = string> {
  id: TAction;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface FlowNodeSidebarMenuActionSection<TAction extends string = string> {
  id: string;
  title?: string;
  actions: FlowNodeSidebarMenuAction<TAction>[];
}

export interface FlowNodeSidebarMenuProps<TItem extends string = string, TAction extends string = string> {
  sections: FlowNodeSidebarMenuSection<TItem>[];
  actionSections?: FlowNodeSidebarMenuActionSection<TAction>[];
  onItemSelect?: (item: FlowNodeSidebarMenuItem<TItem>) => void;
  onActionSelect?: (action: FlowNodeSidebarMenuAction<TAction>) => void;
}

function FlowNodeSidebarMenuDraggableItem<TItem extends string = string>({
  item,
  onItemSelect
}: {
  item: FlowNodeSidebarMenuItem<TItem>;
  onItemSelect?: (item: FlowNodeSidebarMenuItem<TItem>) => void;
}) {
  const suppressClickUntilRef = useRef(0);
  const canDrag = item.dragEnabled !== false && !item.disabled;
  const {
    isDragging,
    listeners,
    setNodeRef,
    transform
  } = useDraggable({
    id: `flow-node-sidebar-item:${item.id}`,
    disabled: !canDrag,
    data: {
      type: FLOW_NODE_SIDEBAR_DRAG_TYPE,
      itemId: item.id
    } satisfies FlowNodeSidebarDragData<TItem>
  });
  const style = {
    "--item-color": item.color ?? "var(--text-primary)",
    transform: CSS.Translate.toString(transform)
  } as CSSProperties;

  useEffect(() => {
    if (isDragging) {
      suppressClickUntilRef.current = Date.now() + 400;
    }
  }, [isDragging]);

  return (
    <button
      ref={setNodeRef}
      key={item.id}
      type="button"
      className={`flow-canvas-ui__sidebar-item${isDragging ? " flow-canvas-ui__sidebar-item--dragging" : ""}`}
      style={style}
      onClick={() => {
        if (Date.now() < suppressClickUntilRef.current) return;
        if (!item.disabled) onItemSelect?.(item);
      }}
      disabled={item.disabled}
      aria-label={`Adicionar ${item.label}`}
      title={item.description ?? item.label}
      {...listeners}
    >
      <span className="flow-canvas-ui__sidebar-dot" />
      <div className="flow-canvas-ui__sidebar-text">
        <span className="flow-canvas-ui__sidebar-label">{item.label}</span>
        {item.description ? <span className="flow-canvas-ui__sidebar-desc">{item.description}</span> : null}
      </div>
    </button>
  );
}

export function FlowNodeSidebarMenu<TItem extends string = string, TAction extends string = string>({
  sections,
  actionSections = [],
  onItemSelect,
  onActionSelect
}: FlowNodeSidebarMenuProps<TItem, TAction>) {
  return (
    <div className="flow-canvas-ui__node-menu">
      {actionSections.map((section) => (
        <section key={section.id} className="flow-canvas-ui__sidebar-section">
          {section.title ? <h3 className="flow-canvas-ui__sidebar-section-title">{section.title}</h3> : null}
          <div className="flow-canvas-ui__sidebar-action-list">
            {section.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="flow-canvas-ui__sidebar-action"
                onClick={() => onActionSelect?.(action)}
                disabled={action.disabled}
                title={action.description ?? action.label}
              >
                <span className="flow-canvas-ui__sidebar-label">{action.label}</span>
                {action.description ? <span className="flow-canvas-ui__sidebar-desc">{action.description}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ))}

      {sections.map((section) => (
        <section key={section.id} className="flow-canvas-ui__sidebar-section">
          {section.title ? <h3 className="flow-canvas-ui__sidebar-section-title">{section.title}</h3> : null}
          <div className="flow-canvas-ui__sidebar-node-list">
            {section.items.map((item) => (
              <FlowNodeSidebarMenuDraggableItem key={item.id} item={item} onItemSelect={onItemSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

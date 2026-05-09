import type { CSSProperties, DragEvent, KeyboardEvent } from "react";

export interface FlowNodeSidebarMenuItem<TItem extends string = string> {
  id: TItem;
  label: string;
  description?: string;
  color?: string;
  disabled?: boolean;
  draggable?: boolean;
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
  onItemDragStart?: (event: DragEvent<HTMLElement>, item: FlowNodeSidebarMenuItem<TItem>) => void;
  onActionSelect?: (action: FlowNodeSidebarMenuAction<TAction>) => void;
}

export function FlowNodeSidebarMenu<TItem extends string = string, TAction extends string = string>({
  sections,
  actionSections = [],
  onItemSelect,
  onItemDragStart,
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
            {section.items.map((item) => {
              const isDraggable = item.draggable !== false && !item.disabled;
              const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!item.disabled) onItemSelect?.(item);
                }
              };

              return (
                <div
                  key={item.id}
                  className="flow-canvas-ui__sidebar-item"
                  style={{ "--item-color": item.color ?? "var(--text-primary)" } as CSSProperties}
                  draggable={isDraggable}
                  onDragStart={(event) => {
                    if (!isDraggable) return;
                    onItemDragStart?.(event, item);
                  }}
                  onClick={() => {
                    if (!item.disabled) onItemSelect?.(item);
                  }}
                  role="button"
                  tabIndex={item.disabled ? -1 : 0}
                  aria-disabled={item.disabled}
                  onKeyDown={handleKeyDown}
                  title={item.description ?? item.label}
                >
                  <span className="flow-canvas-ui__sidebar-dot" />
                  <div className="flow-canvas-ui__sidebar-text">
                    <span className="flow-canvas-ui__sidebar-label">{item.label}</span>
                    {item.description ? <span className="flow-canvas-ui__sidebar-desc">{item.description}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

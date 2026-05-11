import type { DragEventHandler, KeyboardEventHandler, MouseEventHandler, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

// ── PanelMenu ─────────────────────────────────────────────────────────────────

export interface PanelMenuProps {
  title: string;
  eyebrow?: string;
  count?: number;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  action?: ReactNode;
  filter?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function PanelMenu({
  title,
  eyebrow,
  count,
  search,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  action,
  filter,
  footer,
  className,
  children,
}: PanelMenuProps) {
  return (
    <div className={cn("panel-menu", className)}>
      <div className="panel-menu__head">
        <div className="panel-menu__head-main">
          <div className="panel-menu__title-block">
            {eyebrow ? <span className="panel-menu__eyebrow">{eyebrow}</span> : null}
            <span className="panel-menu__title">{title}</span>
          </div>
          <div className="panel-menu__head-end">
            {typeof count === "number" ? (
              <span className="panel-menu__count">{count}</span>
            ) : null}
            {action ? <div className="panel-menu__action">{action}</div> : null}
          </div>
        </div>
        {onSearchChange !== undefined ? (
          <label className="panel-menu__search">
            <svg className="panel-menu__search-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              className="panel-menu__search-input"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </label>
        ) : null}
        {filter ? <div className="panel-menu__filter">{filter}</div> : null}
      </div>
      <div className="panel-menu__body">{children}</div>
      {footer ? <div className="panel-menu__footer">{footer}</div> : null}
    </div>
  );
}

// ── PanelMenuGroup ────────────────────────────────────────────────────────────

export interface PanelMenuGroupProps {
  label: string;
  tone?: "default" | "card" | "detail" | "both" | "new";
  className?: string;
  children: ReactNode;
}

export function PanelMenuGroup({ label, tone = "default", className, children }: PanelMenuGroupProps) {
  return (
    <div className={cn("panel-menu-group", `panel-menu-group--${tone}`, className)}>
      <p className="panel-menu-group__label">{label}</p>
      {children}
    </div>
  );
}

// ── PanelMenuItem ─────────────────────────────────────────────────────────────

export type PanelMenuItemVariant = "default" | "chip";

export interface PanelMenuItemProps {
  label: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  actions?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  draggable?: boolean;
  variant?: PanelMenuItemVariant;
  className?: string;
  onDragStart?: DragEventHandler<HTMLElement>;
  onDragEnd?: DragEventHandler<HTMLElement>;
  onClick?: MouseEventHandler<HTMLElement>;
}

export function PanelMenuItem({
  label,
  description,
  meta,
  leading,
  trailing,
  actions,
  selected,
  disabled,
  draggable,
  variant = "default",
  className,
  onDragStart,
  onDragEnd,
  onClick,
}: PanelMenuItemProps) {
  const useDivButton = Boolean(onClick && actions);
  const Tag = onClick || draggable ? "button" : "div";
  const buttonProps = onClick ? { type: "button" as const, onClick, disabled } : undefined;
  const handleDivKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (disabled || !onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(event as unknown as Parameters<typeof onClick>[0]);
    }
  };

  const content = (
    <>
      {leading ? <span className="panel-menu-item__leading">{leading}</span> : null}
      <span className="panel-menu-item__body">
        <span className="panel-menu-item__label-row">
          <span className="panel-menu-item__label">{label}</span>
          {trailing ? <span className="panel-menu-item__trailing">{trailing}</span> : null}
        </span>
        {description ? <span className="panel-menu-item__description">{description}</span> : null}
        {meta ? <span className="panel-menu-item__meta">{meta}</span> : null}
      </span>
      {actions ? <span className="panel-menu-item__actions">{actions}</span> : null}
    </>
  );

  const itemClassName = cn(
    "panel-menu-item",
    `panel-menu-item--${variant}`,
    selected && "panel-menu-item--selected",
    disabled && "panel-menu-item--disabled",
    draggable && "panel-menu-item--draggable",
    className
  );

  if (useDivButton) {
    return (
      <div
        className={itemClassName}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleDivKeyDown}
      >
        {content}
      </div>
    );
  }

  return (
    <Tag
      className={itemClassName}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      {...buttonProps}
    >
      {content}
    </Tag>
  );
}

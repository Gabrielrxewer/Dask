import { cn } from "@/shared/lib/cn";
import { isValidElement, type DragEventHandler, type MouseEventHandler, type ReactNode } from "react";
import { ModuleTabs } from "@/shared/ui/module-tabs/module-tabs";

export interface TabsItem<T extends string> {
  id: T;
  label: string;
  badge?: ReactNode;
  disabled?: boolean;
  locked?: boolean;
  className?: string;
  activeClassName?: string;
  badgeClassName?: string;
  labelClassName?: string;
  title?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onDragOver?: DragEventHandler<HTMLButtonElement>;
  onDragEnter?: DragEventHandler<HTMLButtonElement>;
  onDragLeave?: DragEventHandler<HTMLButtonElement>;
  onDrop?: DragEventHandler<HTMLButtonElement>;
}

export interface TabsProps<T extends string> {
  value: T;
  items: Array<TabsItem<T>>;
  onChange: (id: T) => void;
  ariaLabel?: string;
  className?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  lockedItemClassName?: string;
  disabledItemClassName?: string;
  labelClassName?: string;
  badgeClassName?: string;
  afterItems?: ReactNode;
}

export interface WorkspaceTopNavigationProps<T extends string> extends TabsProps<T> {
  actions?: ReactNode;
  actionsClassName?: string;
  tabsClassName?: string;
}

export function Tabs<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  className = "",
  itemClassName,
  activeItemClassName,
  lockedItemClassName,
  disabledItemClassName,
  labelClassName,
  badgeClassName,
  afterItems
}: TabsProps<T>) {
  return (
    <>
      <div className={cn("shared-tabs", className)} role="tablist" aria-label={ariaLabel}>
        {items.map(item => {
          const active = value === item.id;
          const disabled = item.disabled === true;
          const locked = item.locked === true;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-disabled={disabled || locked ? true : undefined}
              disabled={disabled}
              title={item.title}
              className={cn(
                "shared-tabs__item",
                active && "shared-tabs__item--active",
                locked && "shared-tabs__item--locked",
                disabled && "shared-tabs__item--disabled",
                itemClassName,
                item.className,
                active && activeItemClassName,
                active && item.activeClassName,
                locked && lockedItemClassName,
                disabled && disabledItemClassName
              )}
              onClick={(event) => {
                item.onClick?.(event);
                if (!event.defaultPrevented && !disabled) {
                  onChange(item.id);
                }
              }}
              onDragOver={item.onDragOver}
              onDragEnter={item.onDragEnter}
              onDragLeave={item.onDragLeave}
              onDrop={item.onDrop}
            >
              <span className={cn("shared-tabs__label", labelClassName, item.labelClassName)}>{item.label}</span>
              {item.badge !== undefined && item.badge !== null && isValidElement(item.badge) ? (
                item.badge
              ) : item.badge !== undefined && item.badge !== null ? (
                <span className={cn("shared-tabs__badge", badgeClassName, item.badgeClassName)}>{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {afterItems}
    </>
  );
}

export function WorkspaceTopNavigation<T extends string>({
  actions,
  actionsClassName,
  tabsClassName,
  className,
  ...tabsProps
}: WorkspaceTopNavigationProps<T>) {
  return (
    <section className={cn("shared-top-navigation", className)} aria-label={tabsProps.ariaLabel}>
      <ModuleTabs {...tabsProps} className={tabsClassName} variant="underline" />
      {actions ? <div className={cn("shared-top-navigation__actions", actionsClassName)}>{actions}</div> : null}
    </section>
  );
}

export interface StudioNavHeaderProps {
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function StudioNavHeader({ title, meta, status, actions, className }: StudioNavHeaderProps) {
  return (
    <div className={cn("shared-top-navigation studio-nav-header", className)}>
      <div className="studio-nav-header__identity">
        <div className="studio-nav-header__title">{title}</div>
        {meta ? <div className="studio-nav-header__meta">{meta}</div> : null}
      </div>
      {status ? <div className="studio-nav-header__status">{status}</div> : null}
      {actions ? <div className="studio-nav-header__actions">{actions}</div> : null}
    </div>
  );
}

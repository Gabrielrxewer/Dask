import { isValidElement, type DragEventHandler, type MouseEventHandler, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/shared/lib/cn";

export type ModuleTabsVariant = "underline" | "pill";

export interface ModuleTabsItem<T extends string> {
  id: T;
  label: string;
  to?: string;
  end?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  locked?: boolean;
  className?: string;
  activeClassName?: string;
  badgeClassName?: string;
  labelClassName?: string;
  title?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  onDragOver?: DragEventHandler<HTMLButtonElement>;
  onDragEnter?: DragEventHandler<HTMLButtonElement>;
  onDragLeave?: DragEventHandler<HTMLButtonElement>;
  onDrop?: DragEventHandler<HTMLButtonElement>;
}

export interface ModuleTabsProps<T extends string> {
  value?: T;
  items: Array<ModuleTabsItem<T>>;
  onChange?: (id: T) => void;
  ariaLabel?: string;
  className?: string;
  itemClassName?: string;
  activeItemClassName?: string;
  lockedItemClassName?: string;
  disabledItemClassName?: string;
  labelClassName?: string;
  badgeClassName?: string;
  variant?: ModuleTabsVariant;
  afterItems?: ReactNode;
}

function renderBadge(className: string | undefined, badge: ReactNode) {
  if (badge === undefined || badge === null) {
    return null;
  }

  return isValidElement(badge) ? badge : <span className={cn("module-tabs__badge shared-tabs__badge", className)}>{badge}</span>;
}

export function ModuleTabs<T extends string>({
  value,
  items,
  onChange,
  ariaLabel,
  className,
  itemClassName,
  activeItemClassName,
  lockedItemClassName,
  disabledItemClassName,
  labelClassName,
  badgeClassName,
  variant = "underline",
  afterItems
}: ModuleTabsProps<T>) {
  return (
    <div className={cn("module-tabs shared-tabs", `module-tabs--${variant}`, className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = value === item.id;
        const disabled = item.disabled === true;
        const locked = item.locked === true;
        const itemClasses = cn(
          "module-tabs__item shared-tabs__item",
          active && "module-tabs__item--active shared-tabs__item--active",
          locked && "module-tabs__item--locked shared-tabs__item--locked",
          disabled && "module-tabs__item--disabled shared-tabs__item--disabled",
          itemClassName,
          item.className,
          active && activeItemClassName,
          active && item.activeClassName,
          locked && lockedItemClassName,
          disabled && disabledItemClassName
        );
        const content = (
          <>
            {item.icon ? <span className="module-tabs__icon" aria-hidden="true">{item.icon}</span> : null}
            <span className={cn("module-tabs__label shared-tabs__label", labelClassName, item.labelClassName)}>{item.label}</span>
            {renderBadge(cn(badgeClassName, item.badgeClassName), item.badge)}
          </>
        );

        if (item.to) {
          return (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.end}
              role="tab"
              aria-disabled={disabled || locked ? true : undefined}
              title={item.title}
              className={({ isActive }) =>
                cn(
                  itemClasses,
                  isActive && "module-tabs__item--active shared-tabs__item--active",
                  isActive && activeItemClassName,
                  isActive && item.activeClassName
                )
              }
              onClick={(event) => {
                item.onClick?.(event);
                if (disabled || locked) {
                  event.preventDefault();
                }
              }}
            >
              {content}
            </NavLink>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled || locked ? true : undefined}
            disabled={disabled}
            title={item.title}
            className={itemClasses}
            onClick={(event) => {
              item.onClick?.(event);
              if (!event.defaultPrevented && !disabled && !locked) {
                onChange?.(item.id);
              }
            }}
            onDragOver={item.onDragOver}
            onDragEnter={item.onDragEnter}
            onDragLeave={item.onDragLeave}
            onDrop={item.onDrop}
          >
            {content}
          </button>
        );
      })}
      {afterItems}
    </div>
  );
}

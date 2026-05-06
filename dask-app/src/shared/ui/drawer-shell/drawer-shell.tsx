import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { AppIcon } from "@/shared/ui/icon";
import { ModalShell } from "@/shared/ui/modal-shell";

export interface DrawerShellFrameProps {
  title: ReactNode;
  titleId: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  meta?: ReactNode;
  nav?: ReactNode;
  afterHeader?: ReactNode;
  children: ReactNode;
  error?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  className?: string;
  headerClassName?: string;
  titleWrapperClassName?: string;
  closeButtonClassName?: string;
  navClassName?: string;
  bodyClassName?: string;
  errorClassName?: string;
  footerClassName?: string;
  closeButtonContent?: ReactNode;
  style?: CSSProperties;
}

export interface DrawerShellProps extends DrawerShellFrameProps {
  shellClassName?: string;
}

export function DrawerShellFrame({
  title,
  titleId,
  subtitle,
  leading,
  meta,
  nav,
  afterHeader,
  children,
  error,
  footer,
  onClose,
  className,
  headerClassName,
  titleWrapperClassName,
  closeButtonClassName,
  navClassName,
  bodyClassName,
  errorClassName,
  footerClassName,
  closeButtonContent,
  style
}: DrawerShellFrameProps) {
  return (
    <div className={cn("shared-drawer-shell__frame", className)} style={style}>
      <div className={cn("shared-drawer-shell__header", headerClassName)}>
        {leading}
        <div className={cn("shared-drawer-shell__title", titleWrapperClassName)}>
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {meta}
        <button
          type="button"
          className={cn("shared-drawer-shell__close", closeButtonClassName)}
          onClick={onClose}
          aria-label="Fechar"
        >
          {closeButtonContent ?? <AppIcon name="x" size={14} strokeWidth={2} />}
        </button>
      </div>
      {afterHeader}
      {nav ? <div className={cn("shared-drawer-shell__nav", navClassName)}>{nav}</div> : null}
      <div className={cn("shared-drawer-shell__body", bodyClassName)}>{children}</div>
      {error ? <p className={cn("shared-drawer-shell__error", errorClassName)}>{error}</p> : null}
      {footer ? <div className={cn("shared-drawer-shell__footer", footerClassName)}>{footer}</div> : null}
    </div>
  );
}

export function DrawerShell({ shellClassName, ...props }: DrawerShellProps) {
  return (
    <ModalShell titleId={props.titleId} onClose={props.onClose} className={cn("shared-drawer-shell", shellClassName)}>
      <DrawerShellFrame {...props} />
    </ModalShell>
  );
}

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { AppIcon } from "@/shared/ui/icon";
import { cn } from "@/shared/lib/cn";

export interface AppDialogProps {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  fallbackTitle?: ReactNode;
  trigger?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  contentClassName?: string;
  bodyClassName?: string;
  overlayClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  closeLabel?: string;
  showClose?: boolean;
  modal?: boolean;
  theme?: "light" | "dark";
  themePreference?: string;
}

export function AppDialog({
  children,
  title,
  description,
  fallbackTitle = "Dialogo",
  trigger,
  footer,
  open,
  defaultOpen,
  onOpenChange,
  className,
  contentClassName,
  bodyClassName,
  overlayClassName,
  titleClassName,
  descriptionClassName,
  closeLabel = "Fechar",
  showClose = true,
  modal = true,
  theme,
  themePreference
}: AppDialogProps) {
  const contentA11yProps = description ? {} : { "aria-describedby": undefined };

  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={cn("app-dialog__overlay shared-modal-overlay", overlayClassName)} />
        <DialogPrimitive.Content
          {...contentA11yProps}
          className={cn("app-dialog__content shared-dialog-shell", className)}
          data-theme={theme}
          data-theme-preference={themePreference}
          style={theme ? { colorScheme: theme } : undefined}
        >
          <div className={cn("app-dialog__frame", contentClassName)}>
            {!title ? <DialogPrimitive.Title className="app-dialog__sr-only">{fallbackTitle}</DialogPrimitive.Title> : null}
            {title || description || showClose ? (
              <header className="app-dialog__header">
                <div className="app-dialog__heading">
                  {title ? (
                    <DialogPrimitive.Title className={cn("app-dialog__title", titleClassName)}>
                      {title}
                    </DialogPrimitive.Title>
                  ) : null}
                  {description ? (
                    <DialogPrimitive.Description className={cn("app-dialog__description", descriptionClassName)}>
                      {description}
                    </DialogPrimitive.Description>
                  ) : null}
                </div>
                {showClose ? (
                  <DialogPrimitive.Close className="app-dialog__close" aria-label={closeLabel}>
                    <AppIcon name="x" size={16} strokeWidth={2.2} />
                  </DialogPrimitive.Close>
                ) : null}
              </header>
            ) : null}
            <div className={cn("app-dialog__body", bodyClassName)}>{children}</div>
            {footer ? <footer className="app-dialog__footer">{footer}</footer> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const AppDialogRoot = DialogPrimitive.Root;
export const AppDialogTrigger = DialogPrimitive.Trigger;
export const AppDialogClose = DialogPrimitive.Close;
export const AppDialogPortal = DialogPrimitive.Portal;

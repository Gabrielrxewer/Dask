import type { FormEvent, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { AppIcon } from "@/shared/ui/icon";
import { ModalShell } from "@/shared/ui/modal-shell";

export interface FormModalProps {
  title: string;
  titleId: string;
  subtitle?: string;
  children: ReactNode;
  error?: string | null;
  submitLabel?: string;
  submittingLabel?: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  onSubmit?: () => void;
  onClose: () => void;
  className?: string;
  headerClassName?: string;
  titleWrapperClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  errorClassName?: string;
  closeButtonClassName?: string;
  footer?: ReactNode;
}

export function FormModal({
  title,
  titleId,
  subtitle,
  children,
  error,
  submitLabel,
  submittingLabel,
  cancelLabel,
  isSubmitting = false,
  onSubmit,
  onClose,
  className,
  headerClassName,
  titleWrapperClassName,
  contentClassName,
  footerClassName,
  errorClassName,
  closeButtonClassName,
  footer
}: FormModalProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSubmitting) {
      onSubmit?.();
    }
  };

  const defaultFooter =
    footer === undefined && onSubmit ? (
      <div className={cn("shared-form-modal__footer", footerClassName)}>
        {cancelLabel ? (
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
        ) : null}
        {submitLabel ? (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? submittingLabel ?? submitLabel : submitLabel}
          </Button>
        ) : null}
      </div>
    ) : footer ? (
      <div className={cn("shared-form-modal__footer", footerClassName)}>{footer}</div>
    ) : null;

  const content = (
    <>
      {children}
      {error ? <p className={cn("shared-form-modal__error", errorClassName)}>{error}</p> : null}
      {defaultFooter}
    </>
  );

  return (
    <ModalShell titleId={titleId} className={cn("shared-form-modal", className)} onClose={onClose}>
      <header className={cn("shared-form-modal__header", headerClassName)}>
        <div className={cn("shared-form-modal__title", titleWrapperClassName)}>
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <button
          type="button"
          className={cn("shared-form-modal__close", closeButtonClassName)}
          aria-label="Fechar"
          onClick={onClose}
        >
          <AppIcon name="x" size={14} strokeWidth={2} />
        </button>
      </header>
      {onSubmit ? (
        <form className={cn("shared-form-modal__content", contentClassName)} onSubmit={handleSubmit}>
          {content}
        </form>
      ) : (
        <div className={cn("shared-form-modal__content", contentClassName)}>{content}</div>
      )}
    </ModalShell>
  );
}

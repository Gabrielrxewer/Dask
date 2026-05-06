import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { ModalShell } from "@/shared/ui/modal-shell";

export type ConfirmModalTone = "default" | "danger";

export interface ConfirmModalFrameProps {
  titleId: string;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel?: ReactNode;
  isConfirming?: boolean;
  confirmDisabled?: boolean;
  tone?: ConfirmModalTone;
  className?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export interface ConfirmModalProps extends ConfirmModalFrameProps {
  shellClassName?: string;
}

export function ConfirmModalFrame({
  titleId,
  title,
  description,
  eyebrow,
  icon,
  confirmLabel,
  cancelLabel = "Cancelar",
  isConfirming = false,
  confirmDisabled = false,
  tone = "default",
  className,
  onClose,
  onConfirm
}: ConfirmModalFrameProps) {
  return (
    <div className={cn("shared-confirm-modal__frame", `shared-confirm-modal__frame--${tone}`, className)}>
      <div className="shared-confirm-modal__head">
        {icon ? (
          <span className="shared-confirm-modal__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="shared-confirm-modal__copy">
          {eyebrow ? <span className="shared-confirm-modal__eyebrow">{eyebrow}</span> : null}
          <h2 id={titleId}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="shared-confirm-modal__actions">
        {cancelLabel ? (
          <Button type="button" variant="outline" onClick={onClose} disabled={isConfirming}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          className="shared-confirm-modal__confirm"
          onClick={onConfirm}
          disabled={isConfirming || confirmDisabled}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

export function ConfirmModal({
  shellClassName,
  isConfirming = false,
  onClose,
  ...props
}: ConfirmModalProps) {
  const handleClose = () => {
    if (isConfirming) return;
    onClose();
  };

  return (
    <ModalShell
      titleId={props.titleId}
      className={cn("shared-confirm-modal", shellClassName)}
      onClose={handleClose}
    >
      <ConfirmModalFrame {...props} isConfirming={isConfirming} onClose={handleClose} />
    </ModalShell>
  );
}

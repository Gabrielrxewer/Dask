import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";

interface ModalShellProps {
  titleId: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalShell({ titleId, className = "", onClose, children }: ModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="shared-modal-overlay" role="presentation" onClick={onClose}>
      <aside
        className={cn("shared-modal-shell", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>,
    document.body
  );
}

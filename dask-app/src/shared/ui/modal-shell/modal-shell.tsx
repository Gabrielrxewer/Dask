import { useEffect } from "react";
import type { ReactNode } from "react";

interface ModalShellProps {
  titleId: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalShell({ titleId, className = "", onClose, children }: ModalShellProps) {
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("has-modal-open");
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.classList.remove("has-modal-open");
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="shared-modal-overlay" role="presentation" onClick={onClose}>
      <aside
        className={`shared-modal-shell ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>
  );
}

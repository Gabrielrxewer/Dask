import type { ReactNode } from "react";

interface ModalShellProps {
  titleId: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}

export function ModalShell({ titleId, className = "", onClose, children }: ModalShellProps) {
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

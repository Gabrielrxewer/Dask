import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";

const modalOpenClassName = "shared-modal-open";
const modalCounterDatasetKey = "sharedModalCount";

export interface ModalShellProps {
  titleId: string;
  className?: string;
  theme?: "light" | "dark";
  themePreference?: string;
  onClose: () => void;
  children: ReactNode;
}

function updateBodyModalState(delta: number) {
  const currentCount = Number(document.body.dataset[modalCounterDatasetKey] ?? "0");
  const nextCount = Math.max(0, currentCount + delta);

  document.body.dataset[modalCounterDatasetKey] = String(nextCount);
  document.body.classList.toggle(modalOpenClassName, nextCount > 0);
}

export function ModalShell({ titleId, className = "", theme, themePreference, onClose, children }: ModalShellProps) {
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
    updateBodyModalState(1);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("keydown", onEscape);
      updateBodyModalState(-1);
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
        data-theme={theme}
        data-theme-preference={themePreference}
        style={theme ? { colorScheme: theme } : undefined}
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

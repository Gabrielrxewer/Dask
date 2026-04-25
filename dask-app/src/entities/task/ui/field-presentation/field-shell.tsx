import { useId, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import type { FieldHelpMode, FieldShellKind } from "@/entities/task/ui/field-presentation/presentation-types";

interface FieldShellProps {
  label: string;
  hint?: string | null;
  error?: string | null;
  required?: boolean;
  readonly?: boolean;
  kind?: FieldShellKind;
  helpMode?: FieldHelpMode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function FieldShell({
  label,
  hint,
  error,
  required = false,
  readonly = false,
  kind = "simple",
  helpMode = "hidden",
  className = "",
  bodyClassName = "",
  children
}: FieldShellProps) {
  const hintId = useId();
  const inlineHint = hint && helpMode === "inline" ? hint : null;
  const tooltipHint = hint && helpMode === "tooltip" ? hint : null;

  return (
    <div className={cn("task-field-shell", `task-field-shell--${kind}`, readonly && "task-field-shell--readonly", className)}>
      <div className="task-field-shell__header">
        <div className="task-field-shell__copy">
          <div className="task-field-shell__label-row">
            <h3 className="task-field-shell__label">
              <span>{label}</span>
              {required ? (
                <span className="task-field-shell__required" aria-label="Obrigatorio" title="Obrigatorio">
                  *
                </span>
              ) : null}
            </h3>
            {tooltipHint ? (
              <span className="task-field-shell__tooltip-wrap">
                <button
                  type="button"
                  className="task-field-shell__info"
                  aria-label={`Ajuda sobre ${label}`}
                  aria-describedby={hintId}
                >
                  <span aria-hidden="true">i</span>
                </button>
                <span id={hintId} className="task-field-shell__tooltip" role="tooltip">
                  {tooltipHint}
                </span>
              </span>
            ) : null}
          </div>
          {inlineHint ? <p className="task-field-shell__hint">{inlineHint}</p> : null}
        </div>
        {readonly ? (
          <span className="task-field-shell__meta-state" aria-label="Somente leitura" title="Somente leitura">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
              <path
                d="M5 7V5.5a3 3 0 0 1 6 0V7M4.5 7h7A1.5 1.5 0 0 1 13 8.5v4A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-4A1.5 1.5 0 0 1 4.5 7Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ) : null}
      </div>
      <div className={cn("task-field-shell__body", bodyClassName)}>{children}</div>
      {error ? <p className="task-field-shell__error">{error}</p> : null}
    </div>
  );
}

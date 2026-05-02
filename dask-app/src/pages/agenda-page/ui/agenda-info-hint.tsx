import type { ReactNode } from "react";

export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="agenda-view__info">
      <button type="button" aria-label={label}>i</button>
      <span role="tooltip">{children}</span>
    </span>
  );
}

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import type { WorkspaceBoardMode } from "@/modules/workspace";
import "./board-perspective-tabs.css";

interface Perspective {
  id: string;
  label: string;
}

interface BoardPerspectiveTabsProps {
  perspectives: Perspective[];
  value: WorkspaceBoardMode;
  onChange: (id: WorkspaceBoardMode) => void;
}

const MAX_VISIBLE = 5;

export function BoardPerspectiveTabs({ perspectives, value, onChange }: BoardPerspectiveTabsProps) {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (perspectives.length <= MAX_VISIBLE) {
    return (
      <div className="shared-tabs board-top-nav__tabs">
        {perspectives.map(p => (
          <button
            key={p.id}
            type="button"
            className={cn("shared-tabs__item", value === p.id && "shared-tabs__item--active")}
            onClick={() => onChange(p.id as WorkspaceBoardMode)}
          >
            {p.label}
          </button>
        ))}
      </div>
    );
  }

  const activeIdx = perspectives.findIndex(p => p.id === value);
  const activeIsOverflow = activeIdx >= MAX_VISIBLE;

  let visibleItems: Perspective[];
  let overflowItems: Perspective[];

  if (activeIsOverflow) {
    visibleItems = [...perspectives.slice(0, MAX_VISIBLE - 1), perspectives[activeIdx]];
    overflowItems = perspectives.filter((_, i) => i >= MAX_VISIBLE - 1 && i !== activeIdx);
  } else {
    visibleItems = perspectives.slice(0, MAX_VISIBLE);
    overflowItems = perspectives.slice(MAX_VISIBLE);
  }

  const overflowHasActive = overflowItems.some(p => p.id === value);

  return (
    <div className="shared-tabs board-top-nav__tabs">
      {visibleItems.map(p => (
        <button
          key={p.id}
          type="button"
          className={cn("shared-tabs__item", value === p.id && "shared-tabs__item--active")}
          onClick={() => onChange(p.id as WorkspaceBoardMode)}
        >
          {p.label}
        </button>
      ))}

      <div ref={moreRef} className="board-perspective-tabs__more">
        <button
          type="button"
          className={cn(
            "shared-tabs__item board-perspective-tabs__more-btn",
            (open || overflowHasActive) && "board-perspective-tabs__more-btn--active"
          )}
          onClick={() => setOpen(v => !v)}
          aria-label="Mais perspectivas"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <svg
            className="board-perspective-tabs__more-icon"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <div className="board-perspective-tabs__dropdown" role="listbox">
            {overflowItems.map(p => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={value === p.id}
                className={cn(
                  "board-perspective-tabs__dropdown-item",
                  value === p.id && "board-perspective-tabs__dropdown-item--active"
                )}
                onClick={() => {
                  onChange(p.id as WorkspaceBoardMode);
                  setOpen(false);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

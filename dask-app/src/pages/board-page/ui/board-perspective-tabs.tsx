import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
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
  const [dragHoverId, setDragHoverId] = useState<string>("");
  const moreRef = useRef<HTMLDivElement>(null);

  const activeIdx = perspectives.findIndex(p => p.id === value);
  const canMoveBackward = activeIdx > 0;
  const canMoveForward = activeIdx >= 0 && activeIdx < perspectives.length - 1;

  const changePerspective = (id: string) => {
    if (id !== value) {
      onChange(id as WorkspaceBoardMode);
    }
  };

  const movePerspective = (step: -1 | 1) => {
    if (activeIdx < 0) {
      return;
    }

    const next = perspectives[activeIdx + step];
    if (next) {
      changePerspective(next.id);
    }
  };

  const handlePerspectiveDragOver = (event: DragEvent<HTMLElement>, id: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragHoverId(id);
    changePerspective(id);
  };

  const clearPerspectiveDragHover = (event: DragEvent<HTMLElement>, id: string) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragHoverId(current => (current === id ? "" : current));
    }
  };

  const renderPerspectiveButton = (perspective: Perspective) => (
    <button
      key={perspective.id}
      type="button"
      className={cn(
        "shared-tabs__item",
        value === perspective.id && "shared-tabs__item--active",
        dragHoverId === perspective.id && "board-perspective-tabs__item--drag-hover"
      )}
      onClick={() => changePerspective(perspective.id)}
      onDragOver={event => handlePerspectiveDragOver(event, perspective.id)}
      onDragEnter={event => handlePerspectiveDragOver(event, perspective.id)}
      onDragLeave={event => clearPerspectiveDragHover(event, perspective.id)}
      onDrop={() => setDragHoverId("")}
    >
      {perspective.label}
    </button>
  );

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

  const navigationControls = perspectives.length > 1 ? (
    <div className="board-perspective-tabs__nav" aria-label="Navegar perspectivas">
      <button
        type="button"
        className="board-perspective-tabs__nav-button"
        onClick={() => movePerspective(-1)}
        disabled={!canMoveBackward}
        aria-label="Perspectiva anterior"
        title="Perspectiva anterior"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className="board-perspective-tabs__nav-button"
        onClick={() => movePerspective(1)}
        disabled={!canMoveForward}
        aria-label="Proxima perspectiva"
        title="Proxima perspectiva"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  ) : null;

  if (perspectives.length <= MAX_VISIBLE) {
    return (
      <div className="board-perspective-tabs">
        <div className="shared-tabs board-top-nav__tabs">
          {perspectives.map(renderPerspectiveButton)}
        </div>
        {navigationControls}
      </div>
    );
  }

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
    <div className="board-perspective-tabs">
      <div className="shared-tabs board-top-nav__tabs">
      {visibleItems.map(renderPerspectiveButton)}

      <div ref={moreRef} className="board-perspective-tabs__more">
        <button
          type="button"
          className={cn(
            "shared-tabs__item board-perspective-tabs__more-btn",
            (open || overflowHasActive) && "board-perspective-tabs__more-btn--active"
          )}
          onClick={() => setOpen(v => !v)}
          onDragOver={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOpen(true);
          }}
          onDragEnter={event => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setOpen(true);
          }}
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
                  value === p.id && "board-perspective-tabs__dropdown-item--active",
                  dragHoverId === p.id && "board-perspective-tabs__dropdown-item--drag-hover"
                )}
                onDragOver={event => handlePerspectiveDragOver(event, p.id)}
                onDragEnter={event => handlePerspectiveDragOver(event, p.id)}
                onDragLeave={event => clearPerspectiveDragHover(event, p.id)}
                onDrop={() => {
                  setDragHoverId("");
                  setOpen(false);
                }}
                onClick={() => {
                  changePerspective(p.id);
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
      {navigationControls}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { cn } from "@/shared/lib/cn";
import { AppIcon, Tabs, type TabsItem } from "@/shared/ui";
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

  const buildPerspectiveTabItems = (items: Perspective[]): Array<TabsItem<string>> =>
    items.map((perspective) => ({
      id: perspective.id,
      label: perspective.label,
      className: dragHoverId === perspective.id ? "board-perspective-tabs__item--drag-hover" : undefined,
      onDragOver: event => handlePerspectiveDragOver(event, perspective.id),
      onDragEnter: event => handlePerspectiveDragOver(event, perspective.id),
      onDragLeave: event => clearPerspectiveDragHover(event, perspective.id),
      onDrop: () => setDragHoverId("")
    }));

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
        <AppIcon name="chevron-left" size={16} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className="board-perspective-tabs__nav-button"
        onClick={() => movePerspective(1)}
        disabled={!canMoveForward}
        aria-label="Proxima perspectiva"
        title="Proxima perspectiva"
      >
        <AppIcon name="chevron-right" size={16} strokeWidth={1.8} />
      </button>
    </div>
  ) : null;

  if (perspectives.length <= MAX_VISIBLE) {
    return (
      <div className="board-perspective-tabs">
        <Tabs
          value={value}
          items={buildPerspectiveTabItems(perspectives)}
          onChange={changePerspective}
          ariaLabel="Perspectivas do board"
          className="board-top-nav__tabs"
        />
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

  const overflowMenu = (
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
          <AppIcon className="board-perspective-tabs__more-icon" name="chevron-down" size={16} strokeWidth={1.8} />
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
  );

  return (
    <div className="board-perspective-tabs">
      <Tabs
        value={value}
        items={buildPerspectiveTabItems(visibleItems)}
        onChange={changePerspective}
        ariaLabel="Perspectivas do board"
        className="board-top-nav__tabs"
        afterItems={overflowMenu}
      />
      {navigationControls}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { DndContext, useDroppable, type DragOverEvent } from "@dnd-kit/core";
import { cn } from "@/shared/lib/cn";
import { AppIcon } from "@/shared/ui";
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

interface PerspectiveTabButtonProps {
  perspective: Perspective;
  active: boolean;
  dragHover: boolean;
  onSelect: (id: string) => void;
}

const MAX_VISIBLE = 5;

function getPerspectiveDropId(id: string) {
  return `board-perspective:${id}`;
}

function readPerspectiveDropId(event: DragOverEvent): string {
  const data = event.over?.data.current as { type?: string; perspectiveId?: string } | undefined;
  return data?.type === "board-perspective" && data.perspectiveId ? data.perspectiveId : "";
}

function PerspectiveTabButton({ perspective, active, dragHover, onSelect }: PerspectiveTabButtonProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: getPerspectiveDropId(perspective.id),
    data: {
      type: "board-perspective",
      perspectiveId: perspective.id
    }
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "module-tabs__item shared-tabs__item",
        active && "module-tabs__item--active shared-tabs__item--active",
        (dragHover || isOver) && "board-perspective-tabs__item--drag-hover"
      )}
      onClick={() => onSelect(perspective.id)}
    >
      <span className="module-tabs__label shared-tabs__label">{perspective.label}</span>
    </button>
  );
}

function PerspectiveDropdownItem({ perspective, active, dragHover, onSelect }: PerspectiveTabButtonProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: getPerspectiveDropId(perspective.id),
    data: {
      type: "board-perspective",
      perspectiveId: perspective.id
    }
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        "board-perspective-tabs__dropdown-item",
        active && "board-perspective-tabs__dropdown-item--active",
        (dragHover || isOver) && "board-perspective-tabs__dropdown-item--drag-hover"
      )}
      onClick={() => onSelect(perspective.id)}
    >
      {perspective.label}
    </button>
  );
}

export function BoardPerspectiveTabs({ perspectives, value, onChange }: BoardPerspectiveTabsProps) {
  const [open, setOpen] = useState(false);
  const [dragHoverId, setDragHoverId] = useState("");
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

  const handleDndOver = (event: DragOverEvent) => {
    const nextPerspectiveId = readPerspectiveDropId(event);
    if (!nextPerspectiveId) {
      return;
    }

    setDragHoverId(nextPerspectiveId);
    changePerspective(nextPerspectiveId);
  };

  const clearDndHover = () => {
    setDragHoverId("");
  };

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

  const activeIsOverflow = activeIdx >= MAX_VISIBLE;
  const visibleItems = perspectives.length <= MAX_VISIBLE
    ? perspectives
    : activeIsOverflow
      ? [...perspectives.slice(0, MAX_VISIBLE - 1), perspectives[activeIdx]]
      : perspectives.slice(0, MAX_VISIBLE);
  const overflowItems = perspectives.length <= MAX_VISIBLE
    ? []
    : activeIsOverflow
      ? perspectives.filter((_, i) => i >= MAX_VISIBLE - 1 && i !== activeIdx)
      : perspectives.slice(MAX_VISIBLE);
  const overflowHasActive = overflowItems.some(p => p.id === value);

  const overflowMenu = overflowItems.length > 0 ? (
    <div ref={moreRef} className="board-perspective-tabs__more">
      <button
        type="button"
        className={cn(
          "module-tabs__item shared-tabs__item board-perspective-tabs__more-btn",
          (open || overflowHasActive) && "board-perspective-tabs__more-btn--active"
        )}
        onClick={() => setOpen(v => !v)}
        aria-label="Mais perspectivas"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <AppIcon className="board-perspective-tabs__more-icon" name="chevron-down" size={16} strokeWidth={1.8} />
      </button>

      {open && (
        <div className="board-perspective-tabs__dropdown" role="listbox">
          {overflowItems.map(p => (
            <PerspectiveDropdownItem
              key={p.id}
              perspective={p}
              active={value === p.id}
              dragHover={dragHoverId === p.id}
              onSelect={(id) => {
                changePerspective(id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <DndContext onDragOver={handleDndOver} onDragEnd={clearDndHover} onDragCancel={clearDndHover}>
      <div className="board-perspective-tabs">
        <div
          className="module-tabs shared-tabs module-tabs--underline board-top-nav__tabs board-perspective-tabs__list"
          role="tablist"
          aria-label="Perspectivas do board"
        >
          {visibleItems.map(p => (
            <PerspectiveTabButton
              key={p.id}
              perspective={p}
              active={value === p.id}
              dragHover={dragHoverId === p.id}
              onSelect={changePerspective}
            />
          ))}
          {overflowMenu}
        </div>
        {navigationControls}
      </div>
    </DndContext>
  );
}

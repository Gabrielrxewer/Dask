import { AppIcon, StatusBadge } from "@/shared/ui";
import {
  addDays,
  toWeekRangeLabel
} from "./agenda-page.model";

interface AgendaToolbarProps {
  weekStart: number;
  weekViewDirection: "previous" | "current" | "next";
  tasksOutsideAgendaCount: number;
  onWeekAnchorChange: (updater: (current: number) => number) => void;
  onToday: () => void;
}

export function AgendaToolbar({
  weekStart,
  weekViewDirection,
  tasksOutsideAgendaCount,
  onWeekAnchorChange,
  onToday
}: AgendaToolbarProps) {
  return (
    <div className="agenda-view__topbar">
      <div className="agenda-view__week-nav">
        <button
          type="button"
          className="agenda-view__nav-btn"
          aria-label="Semana anterior"
          onClick={() => onWeekAnchorChange(current => addDays(current, -7))}
        >
          <AppIcon name="chevron-left" size={15} />
        </button>
        <span className="agenda-view__week-label">{toWeekRangeLabel(weekStart)}</span>
        <button
          type="button"
          className="agenda-view__nav-btn"
          aria-label="Proxima semana"
          onClick={() => onWeekAnchorChange(current => addDays(current, 7))}
        >
          <AppIcon name="chevron-right" size={15} />
        </button>
        {weekViewDirection !== "current" && (
          <button type="button" className="agenda-view__today-btn" onClick={onToday}>
            Hoje
          </button>
        )}
      </div>

      <div className="agenda-view__topbar-end">
        <div className="agenda-view__legend" aria-label="Legenda da agenda">
          <span><i className="agenda-view__legend-dot agenda-view__legend-dot--free" />Livre</span>
          <span><i className="agenda-view__legend-dot agenda-view__legend-dot--partial" />Parcial</span>
          <span><i className="agenda-view__legend-dot agenda-view__legend-dot--busy" />Ocupado</span>
          <span><i className="agenda-view__legend-dot agenda-view__legend-dot--conflict" />Conflito</span>
        </div>
        {tasksOutsideAgendaCount > 0 ? <StatusBadge tone="warning">{`${tasksOutsideAgendaCount} fora da janela`}</StatusBadge> : null}
      </div>
    </div>
  );
}

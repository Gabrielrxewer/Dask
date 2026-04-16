import { useEffect, useMemo, useState } from "react";
import { buildTaskChecklistSummary, buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type Task } from "@/entities/task";
import { useWorkspaceTaskPage } from "@/modules/workspace";
import type { AiAgentSummary } from "@/modules/workspace/model";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  LoadingState,
  Section,
  StatusBadge
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { TaskDetailsModal } from "@/widgets/task-details";
import { cn } from "@/shared/lib/cn";
import "./timeline-page.css";

type TimelineMode = "agenda" | "coluna";
type AgendaSegment = {
  task: Task;
  start: number;
  end: number;
  lane: number;
  laneCount: number;
};

const MINUTE_MS = 1000 * 60;
const DAY_MS = 1000 * 60 * 60 * 24;
const AGENDA_START_HOUR = 6;
const AGENDA_END_HOUR = 22;
const AGENDA_ROW_HEIGHT = 56;

function toDateStamp(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function toShortDate(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function toDateTimeLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toHourLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toAgendaDayLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function parseDateTime(value: string | null | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function startOfDay(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfWeek(value: number): number {
  const dayStart = startOfDay(value);
  const weekday = new Date(dayStart).getDay();
  const distanceToMonday = (weekday + 6) % 7;
  return dayStart - distanceToMonday * DAY_MS;
}

function addDays(value: number, days: number): number {
  return value + days * DAY_MS;
}

function resolvePlannedWindow(task: Task): { start: number; end: number; explicit: boolean } | null {
  const plannedStart = parseDateTime(task.plannedStartAt);
  const plannedEnd = parseDateTime(task.plannedEndAt);

  if (plannedStart !== null || plannedEnd !== null) {
    const fallbackStart = plannedStart ?? plannedEnd ?? Date.now();
    const fallbackEnd = plannedEnd ?? fallbackStart + 1000 * 60 * 60;
    const normalizedEnd = fallbackEnd > fallbackStart ? fallbackEnd : fallbackStart + 1000 * 60 * 30;
    return { start: fallbackStart, end: normalizedEnd, explicit: true };
  }

  if (!task.due) {
    return null;
  }

  const due = parseDateTime(`${task.due}T09:00`);
  if (due === null) {
    return null;
  }

  return { start: due, end: due + 1000 * 60 * 60, explicit: false };
}

export function TimelinePage() {
  const {
    isLoading,
    createTask,
    moveTask,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    toggleChecklistItem,
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis,
    filter,
    setFilterQuery,
    toggleMineFilter,
    boardConfig,
    activeMembers,
    filteredTasks,
    metrics,
    selectedTask,
    selectedStatus,
    selectTask,
    clearSelectedTask
  } = useWorkspaceTaskPage();
  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [mode, setMode] = useState<TimelineMode>("agenda");
  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

  useEffect(() => {
    let mounted = true;
    void listAiAgents().then((result) => {
      if (mounted) {
        setAgents(result.filter(agent => agent.isActive));
      }
    });
    return () => {
      mounted = false;
    };
  }, [listAiAgents]);

  const statusLabelById = useMemo(
    () =>
      boardConfig.statuses.reduce<Record<string, string>>((acc, status) => {
        acc[status.id] = status.label;
        return acc;
      }, {}),
    [boardConfig.statuses]
  );

  const tasksWithWindow = useMemo(
    () =>
      filteredTasks
        .map(task => ({
          task,
          window: resolvePlannedWindow(task)
        }))
        .sort((left, right) => {
          const leftStart = left.window?.start ?? toDateStamp(left.task.due || "9999-01-01");
          const rightStart = right.window?.start ?? toDateStamp(right.task.due || "9999-01-01");
          return leftStart - rightStart;
        }),
    [filteredTasks]
  );

  const dateRange = useMemo(() => {
    const windows = tasksWithWindow.flatMap(entry => (entry.window ? [entry.window] : []));

    if (windows.length === 0) {
      const now = Date.now();
      return { min: now - 1000 * 60 * 60 * 6, max: now + 1000 * 60 * 60 * 24 * 3 };
    }

    const min = Math.min(...windows.map(window => window.start));
    const max = Math.max(...windows.map(window => window.end));
    return {
      min: min - 1000 * 60 * 60,
      max: max + 1000 * 60 * 60
    };
  }, [tasksWithWindow]);

  const range = Math.max(dateRange.max - dateRange.min, 1000 * 60 * 60);
  const rangeLabel = `${toDateTimeLabel(dateRange.min)} - ${toDateTimeLabel(dateRange.max)}`;
  const agendaAnchor = tasksWithWindow.find(({ window }) => window?.explicit)?.window?.start ?? dateRange.min;
  const weekStart = startOfWeek(agendaAnchor);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const hourRows = Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR }, (_, index) => AGENDA_START_HOUR + index);
  const agendaStartOffset = AGENDA_START_HOUR * 60 * MINUTE_MS;
  const agendaEndOffset = AGENDA_END_HOUR * 60 * MINUTE_MS;
  const agendaHeight = (AGENDA_END_HOUR - AGENDA_START_HOUR) * AGENDA_ROW_HEIGHT;

  const agendaByDay = useMemo(
    () =>
      weekDays.map((dayStart) => {
        const visibleStart = dayStart + agendaStartOffset;
        const visibleEnd = dayStart + agendaEndOffset;

        const segments: AgendaSegment[] = tasksWithWindow
          .flatMap(({ task, window }) => {
            if (!window) {
              return [];
            }

            if (window.end <= visibleStart || window.start >= visibleEnd) {
              return [];
            }

            const segmentStart = Math.max(window.start, visibleStart);
            const segmentEnd = Math.max(Math.min(window.end, visibleEnd), segmentStart + 20 * MINUTE_MS);

            return [{ task, start: segmentStart, end: segmentEnd, lane: 0, laneCount: 1 }];
          })
          .sort((left, right) => left.start - right.start);

        const laneEndByIndex: number[] = [];
        let laneCount = 1;

        segments.forEach((segment) => {
          const freeLane = laneEndByIndex.findIndex((laneEnd) => segment.start >= laneEnd);
          const lane = freeLane === -1 ? laneEndByIndex.length : freeLane;
          laneEndByIndex[lane] = segment.end;
          laneCount = Math.max(laneCount, lane + 1);
          segment.lane = lane;
        });

        return segments.map((segment) => ({ ...segment, laneCount }));
      }),
    [agendaEndOffset, agendaStartOffset, tasksWithWindow, weekDays]
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Linha do tempo"
    >
      <div className="timeline-view">
        <BoardMetrics metrics={metrics} className="timeline-view__metrics" />

        <Section
          title="Timeline operacional"
          subtitle="Alterne entre coluna e agenda e acompanhe somente suas atividades."
          actions={
            <div className="timeline-view__actions">
              <div className="timeline-view__toggle" role="tablist" aria-label="Modo da timeline">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "coluna" ? "default" : "outline"}
                  className={cn("timeline-view__toggle-btn", mode === "coluna" && "is-active")}
                  onClick={() => setMode("coluna")}
                >
                  Coluna
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "agenda" ? "default" : "outline"}
                  className={cn("timeline-view__toggle-btn", mode === "agenda" && "is-active")}
                  onClick={() => setMode("agenda")}
                >
                  Agenda
                </Button>
              </div>
              <StatusBadge>{rangeLabel}</StatusBadge>
            </div>
          }
          className="timeline-view__section"
        >
          <div className="timeline-view__stack">
            <DataTable
              columns={mode === "agenda" ? "minmax(210px, 1.25fr) minmax(260px, 2.45fr)" : "minmax(210px, 1.15fr) minmax(260px, 2.55fr)"}
              className="timeline-view__table"
              responsiveMinWidth="980px"
              responsiveMinWidthMobile="840px"
            >
              <DataTableHeader>
                <span>Item</span>
                <span>{mode === "agenda" ? "Agenda planejada" : "Coluna atual"}</span>
              </DataTableHeader>

              <DataTableBody>
                {isLoading ? (
                  <LoadingState text="Carregando workspace..." />
                ) : tasksWithWindow.length === 0 ? (
                  <EmptyState>Nenhum item encontrado com os filtros atuais.</EmptyState>
                ) : (
                  tasksWithWindow.map(({ task, window }) => {
                    const checklist = buildTaskChecklistSummary(task);
                    const type = getTaskTypeDisplayMeta(typeMap, task.type);
                    const statusLabel = statusLabelById[task.status] ?? task.status;

                    const leftRaw = window ? ((window.start - dateRange.min) / range) * 100 : 0;
                    const widthRaw = window ? ((window.end - window.start) / range) * 100 : 8;
                    const width = Math.min(Math.max(widthRaw, 6), 92);
                    const left = Math.min(Math.max(leftRaw, 0), 100 - width);

                    return (
                      <DataTableRow key={task.id}>
                        <DataTableCell>
                          <button type="button" className="timeline-view__meta" onClick={() => selectTask(task.id)}>
                            <strong>{task.title}</strong>
                            <p>{`${statusLabel} - ${checklist.done}/${checklist.total} checklist`}</p>
                          </button>
                        </DataTableCell>

                        <DataTableCell>
                          {mode === "agenda" ? (
                            <div className="timeline-view__lane">
                              <div className="timeline-view__track" />
                              {window ? (
                                <button
                                  type="button"
                                  className={cn(
                                    "timeline-view__bar",
                                    !window.explicit && "timeline-view__bar--fallback"
                                  )}
                                  style={{
                                    left: `${left}%`,
                                    width: `${width}%`,
                                    background: type.background,
                                    borderColor: type.border,
                                    color: type.text
                                  }}
                                  onClick={() => selectTask(task.id)}
                                >
                                  <span>{statusLabel}</span>
                                  <span>{`${toShortDate(window.start)} ${toDateTimeLabel(window.start).slice(-5)} - ${toDateTimeLabel(window.end).slice(-5)}`}</span>
                                </button>
                              ) : (
                                <div className="timeline-view__empty-lane">Sem horario planejado</div>
                              )}
                            </div>
                          ) : (
                            <div className="timeline-view__column-flow">
                              {boardConfig.statuses.map(status => (
                                <button
                                  type="button"
                                  key={`${task.id}-${status.id}`}
                                  className={cn(
                                    "timeline-view__column-chip",
                                    status.id === task.status && "is-current"
                                  )}
                                  onClick={() => selectTask(task.id)}
                                >
                                  {status.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })
                )}
              </DataTableBody>
            </DataTable>

            {mode === "agenda" ? (
              <div className="timeline-view__scheduler">
                <header className="timeline-view__scheduler-header">
                  <h3>Agenda semanal</h3>
                  <p>O planejado do board aparece no horario exato da semana.</p>
                </header>

                <div className="timeline-view__scheduler-scroller">
                  <div className="timeline-view__scheduler-grid">
                    <div className="timeline-view__scheduler-time-head" />
                    {weekDays.map(day => (
                      <div key={day} className="timeline-view__scheduler-day-head">
                        {toAgendaDayLabel(day)}
                      </div>
                    ))}

                    <div className="timeline-view__scheduler-time-column">
                      {hourRows.map(hour => (
                        <span key={`hour-${hour}`}>{`${hour.toString().padStart(2, "0")}:00`}</span>
                      ))}
                    </div>

                    {weekDays.map((day, dayIndex) => (
                      <div key={`day-${day}`} className="timeline-view__scheduler-day">
                        <div
                          className="timeline-view__scheduler-canvas"
                          style={{ height: `${agendaHeight}px` }}
                        >
                          {agendaByDay[dayIndex]?.map((segment) => {
                            const statusLabel = statusLabelById[segment.task.status] ?? segment.task.status;
                            const type = getTaskTypeDisplayMeta(typeMap, segment.task.type);
                            const member = activeMembers[segment.task.assignee];
                            const top =
                              (((segment.start - (day + agendaStartOffset)) / MINUTE_MS / 60) * AGENDA_ROW_HEIGHT);
                            const height = Math.max(
                              (((segment.end - segment.start) / MINUTE_MS / 60) * AGENDA_ROW_HEIGHT),
                              24
                            );
                            const width = 100 / segment.laneCount;
                            const left = segment.lane * width;

                            return (
                              <button
                                key={`${segment.task.id}-${segment.start}`}
                                type="button"
                                className="timeline-view__scheduler-event"
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  left: `calc(${left}% + 3px)`,
                                  width: `calc(${width}% - 6px)`,
                                  background: type.background,
                                  borderColor: type.border,
                                  color: type.text
                                }}
                                onClick={() => selectTask(segment.task.id)}
                              >
                                <strong>{toHourLabel(segment.start)}</strong>
                                <span>{segment.task.title}</span>
                                <small>{`${statusLabel} - ${member?.name ?? "Sem responsavel"}`}</small>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      </div>

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          task={selectedTask}
          status={selectedStatus}
          statuses={boardConfig.statuses}
          assignee={activeMembers[selectedTask.assignee]}
          boardConfig={boardConfig}
          onUpdatePriority={(taskId, priority) => void updateTaskPriority(taskId, priority)}
          onUpdateStatus={(taskId, statusId) => void moveTask(taskId, statusId)}
          onUpdateTitle={(taskId, title) => void updateTaskTitle(taskId, title)}
          onUpdateDescription={(taskId, description) => void updateTaskDescription(taskId, description)}
          onUpdateCustomField={(taskId, fieldId, value) => void updateTaskCustomField(taskId, fieldId, value)}
          onUpdateSchedule={(taskId, input) => void updateTaskSchedule(taskId, input)}
          onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
          aiAgents={agents}
          onRunAiAgentOnItem={runAiAgentOnItem}
          onRunAiRiskAnalysis={runAiRiskAnalysis}
          onClose={clearSelectedTask}
        />
      ) : null}
    </AppShell>
  );
}

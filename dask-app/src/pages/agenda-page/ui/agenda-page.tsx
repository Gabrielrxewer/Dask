import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type Task } from "@/entities/task";
import {
  calendarFeedService,
  useWorkspaceTaskPage,
  type AiAgentSummary,
  type CalendarFeedSnapshot
} from "@/modules/workspace";
import { DashboardFilter } from "@/features/dashboard-filter";
import { CreateTaskButton } from "@/features/create-task";
import { EmptyState, LoadingState, Section, StatusBadge } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./agenda-page.css";

type AgendaSegment = {
  id: string;
  start: number;
  end: number;
  title: string;
  subtitle: string;
  tone: {
    background: string;
    border: string;
    text: string;
  };
  taskId?: string;
  lane: number;
  laneCount: number;
};

type PlannedTask = {
  task: Task;
  window: { start: number; end: number; explicit: boolean };
};

type AvailabilityMode = "people" | "resources";

type AvailabilityRow = {
  id: string;
  label: string;
  tasks: PlannedTask[];
  canOpenDetail: boolean;
  subtitle?: string;
};

const MINUTE_MS = 1000 * 60;
const DAY_MS = 1000 * 60 * 60 * 24;
const AGENDA_START_HOUR = 6;
const AGENDA_END_HOUR = 22;
const AGENDA_ROW_HEIGHT = 56;
const RESOURCE_KEYS = ["resource", "resources", "recurso", "recursos", "room", "sala", "equipment", "equipamento"];

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
  if (plannedStart === null && plannedEnd === null) {
    return null;
  }
  const fallbackStart = plannedStart ?? plannedEnd ?? Date.now();
  const fallbackEnd = plannedEnd ?? fallbackStart + 1000 * 60 * 60;
  const normalizedEnd = fallbackEnd > fallbackStart ? fallbackEnd : fallbackStart + 1000 * 60 * 30;
  return { start: fallbackStart, end: normalizedEnd, explicit: true };
}

function extractTaskResources(task: Task): string[] {
  const values = RESOURCE_KEYS.flatMap((key) => {
    const raw = task.customFields[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.split(",").map(part => part.trim()).filter(Boolean);
    }
    if (Array.isArray(raw)) {
      return raw.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean);
    }
    return [];
  });

  if (values.length > 0) {
    return Array.from(new Set(values));
  }

  return task.tags
    .filter(tag => tag.toLowerCase().startsWith("recurso:"))
    .map(tag => tag.split(":")[1]?.trim())
    .filter((value): value is string => Boolean(value));
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return endA > startB && startA < endB;
}

export function AgendaPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const {
    isLoading,
    createTask,
    moveTask,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    updateTask,
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
  const [calendarFeed, setCalendarFeed] = useState<CalendarFeedSnapshot | null>(null);
  const [isCalendarFeedLoading, setCalendarFeedLoading] = useState(true);
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>("people");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

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

  const plannedTasks = useMemo(
    () =>
      filteredTasks
        .map(task => ({ task, window: resolvePlannedWindow(task) }))
        .filter((entry): entry is PlannedTask => Boolean(entry.window))
        .sort((left, right) => left.window.start - right.window.start),
    [filteredTasks]
  );

  const agendaAnchor = plannedTasks[0]?.window.start ?? Date.now();
  const weekStart = startOfWeek(agendaAnchor);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const [selectedDayStart, setSelectedDayStart] = useState(() => startOfDay(Date.now()));

  const hourRows = useMemo(
    () => Array.from({ length: AGENDA_END_HOUR - AGENDA_START_HOUR }, (_, index) => AGENDA_START_HOUR + index),
    []
  );

  const hourSlots = useMemo(
    () =>
      hourRows.map((hour) => {
        const startOffset = hour * 60 * MINUTE_MS;
        return {
          key: `${hour.toString().padStart(2, "0")}:00`,
          startOffset,
          endOffset: startOffset + 60 * MINUTE_MS
        };
      }),
    [hourRows]
  );

  const agendaStartOffset = AGENDA_START_HOUR * 60 * MINUTE_MS;
  const agendaEndOffset = AGENDA_END_HOUR * 60 * MINUTE_MS;
  const agendaHeight = (AGENDA_END_HOUR - AGENDA_START_HOUR) * AGENDA_ROW_HEIGHT;

  useEffect(() => {
    const dayInCurrentWeek = weekDays.some(day => day === selectedDayStart);
    if (!dayInCurrentWeek) {
      setSelectedDayStart(weekDays[0] ?? startOfDay(Date.now()));
    }
  }, [selectedDayStart, weekDays]);

  useEffect(() => {
    let mounted = true;
    setCalendarFeedLoading(true);
    void calendarFeedService
      .listFeed(workspaceSlug, {
        startAt: new Date(weekStart).toISOString(),
        endAt: new Date(addDays(weekStart, 7)).toISOString()
      })
      .then((feed) => {
        if (mounted) {
          setCalendarFeed(feed);
        }
      })
      .finally(() => {
        if (mounted) {
          setCalendarFeedLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [weekStart, workspaceSlug]);

  const availabilityRows = useMemo<AvailabilityRow[]>(() => {
    if (availabilityMode === "people") {
      const byMember = new Map<string, PlannedTask[]>();
      plannedTasks.forEach((entry) => {
        const list = byMember.get(entry.task.assignee) ?? [];
        list.push(entry);
        byMember.set(entry.task.assignee, list);
      });

      return Array.from(byMember.entries())
        .map(([memberId, tasks]) => ({
          id: memberId,
          label: activeMembers[memberId]?.name ?? memberId,
          subtitle: `${tasks.length} atividades planejadas`,
          tasks,
          canOpenDetail: true
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
    }

    const byResource = new Map<string, PlannedTask[]>();
    plannedTasks.forEach((entry) => {
      const resources = extractTaskResources(entry.task);
      resources.forEach((resource) => {
        const list = byResource.get(resource) ?? [];
        list.push(entry);
        byResource.set(resource, list);
      });
    });

    return Array.from(byResource.entries())
      .map(([resource, tasks]) => ({
        id: resource,
        label: resource,
        subtitle: `${tasks.length} atividades usando recurso`,
        tasks,
        canOpenDetail: false
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [activeMembers, availabilityMode, plannedTasks]);

  const selectedPerson = selectedPersonId ? activeMembers[selectedPersonId] : undefined;
  const selectedPersonTasks = useMemo(
    () => plannedTasks.filter(({ task }) => task.assignee === selectedPersonId),
    [plannedTasks, selectedPersonId]
  );

  const weeklyAgendaByDay = useMemo(
    () =>
      weekDays.map((dayStart) => {
        const visibleStart = dayStart + agendaStartOffset;
        const visibleEnd = dayStart + agendaEndOffset;

        const taskSegments: AgendaSegment[] = selectedPersonTasks
          .flatMap(({ task, window }) => {
            if (window.end <= visibleStart || window.start >= visibleEnd) {
              return [];
            }
            const segmentStart = Math.max(window.start, visibleStart);
            const segmentEnd = Math.max(Math.min(window.end, visibleEnd), segmentStart + 20 * MINUTE_MS);
            const type = getTaskTypeDisplayMeta(typeMap, task.type);

            return [{
              id: `${task.id}-${segmentStart}`,
              start: segmentStart,
              end: segmentEnd,
              title: task.title,
              subtitle: type.label,
              tone: { background: type.background, border: type.border, text: type.text },
              taskId: task.id,
              lane: 0,
              laneCount: 1
            }];
          });

        const meetingSegments: AgendaSegment[] = (calendarFeed?.events ?? [])
          .flatMap((event) => {
            const eventStart = parseDateTime(event.startAt);
            const eventEnd = parseDateTime(event.endAt);
            if (eventStart === null || eventEnd === null) {
              return [];
            }
            if (eventEnd <= visibleStart || eventStart >= visibleEnd) {
              return [];
            }

            const segmentStart = Math.max(eventStart, visibleStart);
            const segmentEnd = Math.max(Math.min(eventEnd, visibleEnd), segmentStart + 20 * MINUTE_MS);

            return [{
              id: `meeting-${event.id}-${segmentStart}`,
              start: segmentStart,
              end: segmentEnd,
              title: event.title,
              subtitle: event.provider === "teams" ? "Reuniao Teams" : "Reuniao externa",
              tone: {
                background: "color-mix(in oklab, #1f6feb 18%, white)",
                border: "color-mix(in oklab, #1f6feb 42%, transparent)",
                text: "#0b3d81"
              },
              lane: 0,
              laneCount: 1
            }];
          });

        const segments = [...taskSegments, ...meetingSegments].sort((left, right) => left.start - right.start);
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
    [agendaEndOffset, agendaStartOffset, calendarFeed?.events, selectedPersonTasks, typeMap, weekDays]
  );

  const integrationLabel = (calendarFeed?.integrations ?? [])
    .map(item => `${item.provider}: ${item.isConnected ? "conectado" : "preparado"}`)
    .join(" | ");

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Agenda"
    >
      <div className="agenda-view">
        <BoardMetrics metrics={metrics} className="agenda-view__metrics" />

        <Section
          title={selectedPersonId ? `Agenda semanal de ${selectedPerson?.name ?? "Pessoa"}` : "Disponibilidade da agenda"}
          subtitle={
            selectedPersonId
              ? "Detalhe semanal das atividades planejadas da pessoa selecionada."
              : "Sem selecao de pessoa: Pessoas/Recursos nas linhas e horarios nas colunas."
          }
          actions={
            <div className="agenda-view__actions">
              <DashboardFilter
                query={filter.query}
                mineOnly={filter.mineOnly}
                onQueryChange={setFilterQuery}
                onMineToggle={toggleMineFilter}
              />
              <StatusBadge>{`${plannedTasks.length} atividades planejadas`}</StatusBadge>
              <CreateTaskButton
                className="agenda-view__create-task"
                onCreate={input => void createTask(input)}
                typeOptions={boardConfig.taskTypes.map((taskType) => ({ id: taskType.id, label: taskType.label }))}
              />
            </div>
          }
          className="agenda-view__section"
        >
          {isLoading || isCalendarFeedLoading ? (
            <LoadingState text="Carregando agenda..." />
          ) : plannedTasks.length === 0 ? (
            <EmptyState>Nao ha atividades planejadas para exibir.</EmptyState>
          ) : (
            <div className="agenda-view__surface">
              <div className="agenda-view__integration">
                <strong>Integracoes externas preparadas</strong>
                <span>{integrationLabel || "Teams, Google Calendar e Outlook preparados para conexao futura."}</span>
              </div>

              {selectedPersonId ? (
                <div className="agenda-view__person-shell">
                  <div className="agenda-view__person-toolbar">
                    <button
                      type="button"
                      className="agenda-view__ghost-button"
                      onClick={() => setSelectedPersonId(null)}
                    >
                      Voltar para disponibilidade
                    </button>
                    <span>{`${selectedPersonTasks.length} atividades da pessoa`}</span>
                  </div>

                  {selectedPersonTasks.length === 0 ? (
                    <EmptyState>Essa pessoa nao tem atividades planejadas nessa semana.</EmptyState>
                  ) : (
                    <div className="agenda-view__grid-scroller">
                      <div className="agenda-view__grid">
                        <div className="agenda-view__time-head" />
                        {weekDays.map(day => (
                          <div key={day} className="agenda-view__day-head">
                            {toAgendaDayLabel(day)}
                          </div>
                        ))}

                        <div className="agenda-view__time-column">
                          {hourRows.map(hour => (
                            <span key={`hour-${hour}`}>{`${hour.toString().padStart(2, "0")}:00`}</span>
                          ))}
                        </div>

                        {weekDays.map((day, dayIndex) => (
                          <div key={`day-${day}`} className="agenda-view__day">
                            <div className="agenda-view__canvas" style={{ height: `${agendaHeight}px` }}>
                              {weeklyAgendaByDay[dayIndex]?.map((segment) => {
                                const top = (((segment.start - (day + agendaStartOffset)) / MINUTE_MS / 60) * AGENDA_ROW_HEIGHT);
                                const height = Math.max((((segment.end - segment.start) / MINUTE_MS / 60) * AGENDA_ROW_HEIGHT), 24);
                                const width = 100 / segment.laneCount;
                                const left = segment.lane * width;

                                return (
                                  <button
                                    key={segment.id}
                                    type="button"
                                    className="agenda-view__event"
                                    style={{
                                      top: `${top}px`,
                                      height: `${height}px`,
                                      left: `calc(${left}% + 3px)`,
                                      width: `calc(${width}% - 6px)`,
                                      background: segment.tone.background,
                                      borderColor: segment.tone.border,
                                      color: segment.tone.text
                                    }}
                                    onClick={() => {
                                      if (segment.taskId) {
                                        selectTask(segment.taskId);
                                      }
                                    }}
                                  >
                                    <strong>{`${toHourLabel(segment.start)} - ${toHourLabel(segment.end)}`}</strong>
                                    <span>{segment.title}</span>
                                    <small>{segment.subtitle}</small>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="agenda-view__availability">
                  <div className="agenda-view__availability-toolbar">
                    <div className="agenda-view__switch">
                      <button
                        type="button"
                        className={availabilityMode === "people" ? "is-active" : ""}
                        onClick={() => setAvailabilityMode("people")}
                      >
                        Pessoas
                      </button>
                      <button
                        type="button"
                        className={availabilityMode === "resources" ? "is-active" : ""}
                        onClick={() => setAvailabilityMode("resources")}
                      >
                        Recursos
                      </button>
                    </div>

                    <div className="agenda-view__day-tabs">
                      {weekDays.map((day) => (
                        <button
                          key={`tab-${day}`}
                          type="button"
                          className={selectedDayStart === day ? "is-active" : ""}
                          onClick={() => setSelectedDayStart(day)}
                        >
                          {toAgendaDayLabel(day)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {availabilityRows.length === 0 ? (
                    <EmptyState>
                      {availabilityMode === "people"
                        ? "Nenhuma pessoa com atividade planejada."
                        : "Nenhum recurso identificado nas atividades planejadas."}
                    </EmptyState>
                  ) : (
                    <div className="agenda-view__availability-scroll">
                      <table className="agenda-view__availability-table">
                        <thead>
                          <tr>
                            <th>{availabilityMode === "people" ? "Pessoa" : "Recurso"}</th>
                            {hourSlots.map(slot => (
                              <th key={slot.key}>{slot.key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {availabilityRows.map((row) => (
                            <tr key={row.id}>
                              <th>
                                <div className="agenda-view__row-head">
                                  <button
                                    type="button"
                                    className="agenda-view__row-name"
                                    onClick={() => {
                                      if (row.canOpenDetail) {
                                        setSelectedPersonId(row.id);
                                      }
                                    }}
                                    disabled={!row.canOpenDetail}
                                  >
                                    {row.label}
                                  </button>
                                  <small>{row.subtitle}</small>
                                </div>
                              </th>
                              {hourSlots.map((slot) => {
                                const slotStart = selectedDayStart + slot.startOffset;
                                const slotEnd = selectedDayStart + slot.endOffset;
                                const busy = row.tasks.filter(entry => overlaps(entry.window.start, entry.window.end, slotStart, slotEnd));
                                const isBusy = busy.length > 0;

                                return (
                                  <td key={`${row.id}-${slot.key}`}>
                                    <div className={isBusy ? "agenda-view__cell agenda-view__cell--busy" : "agenda-view__cell agenda-view__cell--free"}>
                                      <span>{isBusy ? `Ocupado (${busy.length})` : "Livre"}</span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
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
          onSaveTask={(taskId, input) => void updateTask(taskId, input)}
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

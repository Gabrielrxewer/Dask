import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type Task } from "@/entities/task";
import {
  calendarFeedService,
  useWorkspaceTaskPage,
  type AiAgentSummary,
  type CalendarFeedSnapshot
} from "@/modules/workspace";
import { EmptyState, LoadingState, ModalShell, Section, StatusBadge } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { TaskDetailsModal } from "@/widgets/task-details";
import "@/pages/timeline-page/ui/timeline-page.css";
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
type DetailKind = "person" | "resource";
type AvailabilityState = "free" | "partial" | "busy" | "conflict";

type AvailabilityRow = {
  id: string;
  label: string;
  tasks: PlannedTask[];
  detailKind: DetailKind;
  subtitle?: string;
};

type AvailabilitySlot = {
  key: string;
  startOffset: number;
  endOffset: number;
  state: AvailabilityState;
  tasks: PlannedTask[];
  slotStart: number;
  slotEnd: number;
};

type AvailabilityRowSnapshot = AvailabilityRow & {
  slots: AvailabilitySlot[];
  occupiedCount: number;
};

type DetailTarget = {
  id: string;
  label: string;
  kind: DetailKind;
};

type SlotInspection = {
  rowLabel: string;
  rowKind: DetailKind;
  state: AvailabilityState;
  tasks: PlannedTask[];
  slotStart: number;
  slotEnd: number;
};

type UnscheduledGroup = {
  assigneeId: string;
  label: string;
  tasks: Task[];
  totalCount: number;
  plannedCount: number;
  doneCount: number;
  unscheduledCount: number;
};

const MINUTE_MS = 1000 * 60;
const DAY_MS = 1000 * 60 * 60 * 24;
const AGENDA_START_HOUR = 6;
const AGENDA_END_HOUR = 22;
const SLOT_MINUTES = 30;
const AGENDA_ROW_HEIGHT = 34;
const RESOURCE_KEYS = ["resource", "resources", "recurso", "recursos", "room", "sala", "equipment", "equipamento"];

function InfoHint({ label, children }: { label: string; children: string }) {
  return (
    <span className="agenda-view__info">
      <button type="button" aria-label={label}>i</button>
      <span role="tooltip">{children}</span>
    </span>
  );
}

function toHourLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function toAgendaDayLabel(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function toWeekRangeLabel(weekStart: number): string {
  const weekEnd = addDays(weekStart, 6);
  return `${toAgendaDayLabel(weekStart)} - ${toAgendaDayLabel(weekEnd)}`;
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

function normalizeResourceKey(value: string): string {
  return value
    .trim()
    .replace(/^recurso:\s*/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

function extractTaskResources(task: Task): Array<{ id: string; label: string }> {
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

  const fallback = task.tags
    .filter(tag => tag.toLowerCase().startsWith("recurso:"))
    .map(tag => tag.split(":")[1]?.trim())
    .filter((value): value is string => Boolean(value));

  const allValues = values.length > 0 ? values : fallback;
  const byId = new Map<string, string>();

  allValues.forEach((value) => {
    const id = normalizeResourceKey(value);
    if (!id) {
      return;
    }
    if (!byId.has(id)) {
      byId.set(id, value.trim());
    }
  });

  return Array.from(byId.entries()).map(([id, label]) => ({ id, label }));
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return endA > startB && startA < endB;
}

function getOverlapDuration(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function getInitialSelectedDayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function getStateLabel(state: AvailabilityState, count: number): string {
  if (state === "conflict") {
    return `Conflito (${count})`;
  }
  if (state === "busy") {
    return "Ocupado";
  }
  if (state === "partial") {
    return "Parcial";
  }
  return "Livre";
}

export function AgendaPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const {
    isLoading,
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
    listWorkspaceDocuments,
    listWorkItemLinkedDocuments,
    linkDocumentToWorkItem,
    unlinkDocumentFromWorkItem,
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
  const [weekAnchor, setWeekAnchor] = useState(() => Date.now());
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => getInitialSelectedDayIndex());
  const [selectedDetailTarget, setSelectedDetailTarget] = useState<DetailTarget | null>(null);
  const [selectedSlotInspection, setSelectedSlotInspection] = useState<SlotInspection | null>(null);
  const [selectedUnscheduledGroup, setSelectedUnscheduledGroup] = useState<UnscheduledGroup | null>(null);

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

  const unscheduledTasks = useMemo(
    () => filteredTasks.filter(task => resolvePlannedWindow(task) === null),
    [filteredTasks]
  );

  const unscheduledGroups = useMemo<UnscheduledGroup[]>(
    () => {
      const byAssignee = new Map<string, Task[]>();

      unscheduledTasks.forEach((task) => {
        const key = task.assignee || "unassigned";
        const current = byAssignee.get(key) ?? [];
        current.push(task);
        byAssignee.set(key, current);
      });

      return Array.from(byAssignee.entries())
        .map(([assigneeId, tasks]) => {
          const memberTasks = filteredTasks.filter((task) => (task.assignee || "unassigned") === assigneeId);
          const plannedCount = memberTasks.filter((task) => resolvePlannedWindow(task) !== null).length;
          const doneCount = memberTasks.filter((task) => task.status === "done").length;

          return {
            assigneeId,
            label: activeMembers[assigneeId]?.name ?? "Sem responsavel",
            tasks: tasks.sort((left, right) => left.title.localeCompare(right.title, "pt-BR")),
            totalCount: memberTasks.length,
            plannedCount,
            doneCount,
            unscheduledCount: tasks.length
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
    },
    [activeMembers, filteredTasks, unscheduledTasks]
  );

  const currentWeekStart = useMemo(() => startOfWeek(Date.now()), []);
  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const selectedDayStart = weekDays[selectedDayIndex] ?? weekStart;
  const weekViewDirection = weekStart < currentWeekStart ? "previous" : weekStart > currentWeekStart ? "next" : "current";

  const weekPlannedTasks = useMemo(
    () => plannedTasks.filter((entry) => overlaps(entry.window.start, entry.window.end, weekStart, weekEnd)),
    [plannedTasks, weekEnd, weekStart]
  );

  const slotRows = useMemo(
    () => Array.from({ length: ((AGENDA_END_HOUR - AGENDA_START_HOUR) * 60) / SLOT_MINUTES }, (_, index) => index),
    []
  );

  const hourSlots = useMemo(
    () =>
      slotRows.map((rowIndex) => {
        const startOffset = (AGENDA_START_HOUR * 60 + rowIndex * SLOT_MINUTES) * MINUTE_MS;
        return {
          key: `${rowIndex}`,
          label: toHourLabel(weekStart + startOffset),
          startOffset,
          endOffset: startOffset + SLOT_MINUTES * MINUTE_MS
        };
      }),
    [slotRows, weekStart]
  );

  const agendaStartOffset = AGENDA_START_HOUR * 60 * MINUTE_MS;
  const agendaEndOffset = AGENDA_END_HOUR * 60 * MINUTE_MS;
  const agendaHeight = hourSlots.length * AGENDA_ROW_HEIGHT;

  useEffect(() => {
    setSelectedSlotInspection(null);
  }, [selectedDayStart, weekStart]);

  useEffect(() => {
    let mounted = true;
    setCalendarFeedLoading(true);
    void calendarFeedService
      .listFeed(workspaceSlug, {
        startAt: new Date(weekStart).toISOString(),
        endAt: new Date(weekEnd).toISOString()
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
  }, [weekEnd, weekStart, workspaceSlug]);

  const availabilityRows = useMemo<AvailabilityRow[]>(() => {
    if (availabilityMode === "people") {
      const byMember = new Map<string, PlannedTask[]>();
      weekPlannedTasks.forEach((entry) => {
        const list = byMember.get(entry.task.assignee) ?? [];
        list.push(entry);
        byMember.set(entry.task.assignee, list);
      });

      return Array.from(byMember.entries())
        .map(([memberId, tasks]) => ({
          id: memberId,
          label: activeMembers[memberId]?.name ?? memberId,
          subtitle: `${tasks.length} atividades planejadas na semana`,
          tasks,
          detailKind: "person" as const
        }))
        .sort((left, right) => left.label.localeCompare(right.label));
    }

    const byResource = new Map<string, AvailabilityRow>();
    weekPlannedTasks.forEach((entry) => {
      extractTaskResources(entry.task).forEach((resource) => {
        const current = byResource.get(resource.id);
        if (current) {
          current.tasks.push(entry);
          return;
        }
        byResource.set(resource.id, {
          id: resource.id,
          label: resource.label,
          subtitle: "",
          tasks: [entry],
          detailKind: "resource"
        });
      });
    });

    return Array.from(byResource.values())
      .map((row) => ({
        ...row,
        subtitle: `${row.tasks.length} atividades usando o recurso na semana`
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [activeMembers, availabilityMode, weekPlannedTasks]);

  const availabilitySnapshots = useMemo<AvailabilityRowSnapshot[]>(
    () =>
      availabilityRows.map((row) => {
        const slots = hourSlots.map((slot) => {
          const slotStart = selectedDayStart + slot.startOffset;
          const slotEnd = selectedDayStart + slot.endOffset;
          const busyTasks = row.tasks
            .filter(entry => overlaps(entry.window.start, entry.window.end, slotStart, slotEnd))
            .sort((left, right) => left.window.start - right.window.start);

          const maxOverlapDuration = busyTasks.reduce(
            (maxDuration, entry) => Math.max(maxDuration, getOverlapDuration(entry.window.start, entry.window.end, slotStart, slotEnd)),
            0
          );

          let state: AvailabilityState = "free";
          if (busyTasks.length > 1) {
            state = "conflict";
          } else if (busyTasks.length === 1) {
            state = maxOverlapDuration >= slotEnd - slotStart - MINUTE_MS ? "busy" : "partial";
          }

          return {
            key: slot.key,
            startOffset: slot.startOffset,
            endOffset: slot.endOffset,
            state,
            tasks: busyTasks,
            slotStart,
            slotEnd
          };
        });

        return {
          ...row,
          slots,
          occupiedCount: slots.filter(slot => slot.state !== "free").length
        };
      }),
    [availabilityRows, hourSlots, selectedDayStart]
  );

  const selectedDetailTasks = useMemo(() => {
    if (!selectedDetailTarget) {
      return [];
    }

    if (selectedDetailTarget.kind === "person") {
      return weekPlannedTasks.filter(({ task }) => task.assignee === selectedDetailTarget.id);
    }

    return weekPlannedTasks.filter(({ task }) =>
      extractTaskResources(task).some(resource => resource.id === selectedDetailTarget.id)
    );
  }, [selectedDetailTarget, weekPlannedTasks]);

  const selectedDetailMember =
    selectedDetailTarget?.kind === "person" ? activeMembers[selectedDetailTarget.id] : undefined;

  const weeklyAgendaByDay = useMemo(
    () =>
      weekDays.map((dayStart) => {
        const visibleStart = dayStart + agendaStartOffset;
        const visibleEnd = dayStart + agendaEndOffset;

        const taskSegments: AgendaSegment[] = selectedDetailTasks
          .flatMap(({ task, window }) => {
            if (window.end <= visibleStart || window.start >= visibleEnd) {
              return [];
            }
            const segmentStart = Math.max(window.start, visibleStart);
            const segmentEnd = Math.max(Math.min(window.end, visibleEnd), segmentStart + 20 * MINUTE_MS);
            const type = getTaskTypeDisplayMeta(typeMap, task.type);
            const assigneeName = activeMembers[task.assignee]?.name;

            return [{
              id: `${task.id}-${segmentStart}`,
              start: segmentStart,
              end: segmentEnd,
              title: task.title,
              subtitle: selectedDetailTarget?.kind === "resource" && assigneeName ? assigneeName : type.label,
              tone: { background: type.background, border: type.border, text: type.text },
              taskId: task.id,
              lane: 0,
              laneCount: 1
            }];
          });

        const meetingSegments: AgendaSegment[] =
          selectedDetailTarget?.kind === "person"
            ? (calendarFeed?.events ?? []).flatMap((event) => {
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
              })
            : [];

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
    [
      activeMembers,
      agendaEndOffset,
      agendaStartOffset,
      calendarFeed?.events,
      selectedDetailTarget?.kind,
      selectedDetailTasks,
      typeMap,
      weekDays
    ]
  );

  const tasksOutsideAgenda = useMemo(
    () =>
      weekPlannedTasks.filter((entry) => {
        const startHour = new Date(entry.window.start).getHours() + new Date(entry.window.start).getMinutes() / 60;
        const endHour = new Date(entry.window.end).getHours() + new Date(entry.window.end).getMinutes() / 60;
        return startHour < AGENDA_START_HOUR || endHour > AGENDA_END_HOUR;
      }),
    [weekPlannedTasks]
  );

  const weeklyConflictCount = useMemo(() => {
    let conflicts = 0;

    availabilityRows.forEach((row) => {
      weekDays.forEach((dayStart) => {
        hourSlots.forEach((slot) => {
          const slotStart = dayStart + slot.startOffset;
          const slotEnd = dayStart + slot.endOffset;
          const overlappingTasks = row.tasks.filter((entry) =>
            overlaps(entry.window.start, entry.window.end, slotStart, slotEnd)
          );

          if (overlappingTasks.length > 1) {
            conflicts += 1;
          }
        });
      });
    });

    return conflicts;
  }, [availabilityRows, hourSlots, weekDays]);

  const selectedDayConflictCount = useMemo(
    () => availabilitySnapshots.reduce((total, row) => total + row.slots.filter((slot) => slot.state === "conflict").length, 0),
    [availabilitySnapshots]
  );

  const agendaMetricCards = useMemo(
    () => [
      {
        label: "Total de cards",
        value: metrics.total,
        description: "É o contexto geral. Não faz parte do fluxo em si, mas ajuda a entender o volume."
      },
      {
        label: "Planejadas",
        value: weekPlannedTasks.length,
        description: "Aqui começa o percurso de verdade: o que já está previsto, mas ainda não entrou em execução."
      },
      {
        label: "Sem horario",
        value: unscheduledTasks.length,
        description: "São itens que ainda não foram devidamente encaixados. Faz sentido vir logo depois de “Planejadas”, porque mostram o que ainda precisa de definição."
      },
      {
        label: selectedDetailTarget ? "Fora da janela" : "Conflitos",
        value: selectedDetailTarget ? tasksOutsideAgenda.length : weeklyConflictCount,
        description: "Antes de executar, o ideal é resolver impedimentos ou choques de agenda. Por isso ele deve aparecer antes da etapa operacional."
      },
      {
        label: selectedDetailTarget ? "Calendario" : "Dia em foco",
        value: selectedDetailTarget ? (calendarFeed?.events?.length ?? 0) : selectedDayConflictCount,
        description: "Depois de planejar e limpar conflitos, entra o que realmente merece atenção agora."
      },
      {
        label: "Em progresso",
        value: metrics.doing,
        description: "É a execução ativa."
      },
      {
        label: "Entrega esta semana",
        value: metrics.dueThisWeek,
        description: "Esse card é mais de urgência/prazo do que de etapa. Ele não representa um estado do fluxo, então não deveria ficar no começo. Perto do final faz mais sentido, como pressão de entrega sobre o que está andando."
      },
      {
        label: "Concluido",
        value: `${metrics.donePercent}%`,
        description: "Sempre no fim, porque é a saída natural do percurso."
      }
    ],
    [
      calendarFeed?.events?.length,
      metrics.doing,
      metrics.donePercent,
      metrics.dueThisWeek,
      metrics.total,
      selectedDayConflictCount,
      selectedDetailTarget,
      tasksOutsideAgenda.length,
      unscheduledTasks.length,
      weekPlannedTasks.length,
      weeklyConflictCount
    ]
  );

  const sectionTitle = "Agenda";
  const sectionSubtitle = selectedDetailTarget
    ? `${toWeekRangeLabel(weekStart)} • ${selectedDetailTarget.kind === "person" ? "Detalhe semanal" : "Uso do recurso"}`
    : "";

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Agenda"
      filter={filter}
      onFilterQueryChange={setFilterQuery}
      onMineToggle={toggleMineFilter}
    >
      <div className="agenda-view timeline-view">
        <BoardMetrics metrics={metrics} cards={agendaMetricCards} className="agenda-view__metrics timeline-view__metrics" />

        <Section
          title={sectionTitle}
          subtitle={sectionSubtitle}
          className="agenda-view__section timeline-view__section"
        >
          {isLoading || isCalendarFeedLoading ? (
            <LoadingState text="Carregando agenda..." />
          ) : filteredTasks.length === 0 ? (
            <EmptyState>Nao ha atividades para exibir com os filtros atuais.</EmptyState>
          ) : (
            <div className="agenda-view__surface">
              <div className="agenda-view__topbar">
                <div className="agenda-view__topbar-copy">
                  <strong>{selectedDetailTarget ? "Detalhe da semana" : "Painel da semana"}</strong>
                  <span>{toWeekRangeLabel(weekStart)}</span>
                </div>
                <div className="agenda-view__period-toolbar">
                  <div className="agenda-view__period-controls agenda-view__switch agenda-view__switch--triple">
                    <button
                      type="button"
                      className={
                        weekViewDirection === "previous"
                          ? "timeline-view__toggle-btn documentation-page__mode-chip agenda-view__period-chip is-active documentation-page__mode-chip--active"
                          : "timeline-view__toggle-btn documentation-page__mode-chip agenda-view__period-chip"
                      }
                      onClick={() => setWeekAnchor(current => addDays(current, -7))}
                    >
                      Semana anterior
                    </button>
                    <button
                      type="button"
                      className={
                        weekViewDirection === "current"
                          ? "timeline-view__toggle-btn documentation-page__mode-chip agenda-view__period-chip is-active documentation-page__mode-chip--active"
                          : "timeline-view__toggle-btn documentation-page__mode-chip agenda-view__period-chip"
                      }
                      onClick={() => setWeekAnchor(Date.now())}
                    >
                      Semana atual
                    </button>
                    <button
                      type="button"
                      className={
                        weekViewDirection === "next"
                          ? "timeline-view__toggle-btn documentation-page__mode-chip agenda-view__period-chip is-active documentation-page__mode-chip--active"
                          : "timeline-view__toggle-btn documentation-page__mode-chip agenda-view__period-chip"
                      }
                      onClick={() => setWeekAnchor(current => addDays(current, 7))}
                    >
                      Proxima semana
                    </button>
                  </div>
                </div>
              </div>

              <div className="agenda-view__legend-strip">
                <div className="agenda-view__legend" aria-label="Legenda da agenda">
                  <span><i className="agenda-view__legend-dot agenda-view__legend-dot--free" />Livre</span>
                  <span><i className="agenda-view__legend-dot agenda-view__legend-dot--partial" />Parcial</span>
                  <span><i className="agenda-view__legend-dot agenda-view__legend-dot--busy" />Ocupado</span>
                  <span><i className="agenda-view__legend-dot agenda-view__legend-dot--conflict" />Conflito</span>
                </div>
                <div className="agenda-view__action-hints">
                  <StatusBadge>{selectedDetailTarget ? "Clique no bloco para abrir atividade" : "Clique na linha para abrir detalhe semanal"}</StatusBadge>
                  {tasksOutsideAgenda.length > 0 ? <StatusBadge tone="warning">{`${tasksOutsideAgenda.length} fora da janela`}</StatusBadge> : null}
                </div>
              </div>

              {selectedDetailTarget ? (
                <div className="agenda-view__person-shell">
                  <div className="agenda-view__person-toolbar">
                    <div className="agenda-view__detail-heading">
                      <button
                        type="button"
                        className="agenda-view__ghost-button"
                        onClick={() => setSelectedDetailTarget(null)}
                      >
                        Voltar para disponibilidade
                      </button>
                      <div>
                        <strong>{selectedDetailTarget.label}</strong>
                        <span>
                          {selectedDetailTarget.kind === "person"
                            ? `${selectedDetailTasks.length} atividades planejadas e ${calendarFeed?.events?.length ?? 0} eventos externos`
                            : `${selectedDetailTasks.length} atividades usando este recurso`}
                        </span>
                      </div>
                    </div>
                    <StatusBadge>{`${AGENDA_START_HOUR}:00 - ${AGENDA_END_HOUR}:00`}</StatusBadge>
                  </div>

                  {selectedDetailTasks.length === 0 ? (
                    <EmptyState>Nao ha atividades planejadas para esse item na semana selecionada.</EmptyState>
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
                          {hourSlots.map(slot => (
                            <span key={`slot-${slot.key}`}>{slot.label}</span>
                          ))}
                        </div>

                        {weekDays.map((day, dayIndex) => (
                          <div key={`day-${day}`} className="agenda-view__day">
                            <div className="agenda-view__canvas" style={{ height: `${agendaHeight}px` }}>
                              {weeklyAgendaByDay[dayIndex]?.map((segment) => {
                                const top = (((segment.start - (day + agendaStartOffset)) / MINUTE_MS / SLOT_MINUTES) * AGENDA_ROW_HEIGHT);
                                const height = Math.max((((segment.end - segment.start) / MINUTE_MS / SLOT_MINUTES) * AGENDA_ROW_HEIGHT), 24);
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
                    <div className="agenda-view__control-group">
                      <span>Ver por</span>
                      <div className="agenda-view__switch timeline-view__toggle documentation-page__modes">
                        <button
                          type="button"
                          className={
                            availabilityMode === "people"
                              ? "timeline-view__toggle-btn documentation-page__mode-chip is-active documentation-page__mode-chip--active"
                              : "timeline-view__toggle-btn documentation-page__mode-chip"
                          }
                          onClick={() => setAvailabilityMode("people")}
                        >
                          Pessoas
                        </button>
                        <button
                          type="button"
                          className={
                            availabilityMode === "resources"
                              ? "timeline-view__toggle-btn documentation-page__mode-chip is-active documentation-page__mode-chip--active"
                              : "timeline-view__toggle-btn documentation-page__mode-chip"
                          }
                          onClick={() => setAvailabilityMode("resources")}
                        >
                          Recursos
                        </button>
                      </div>
                    </div>

                    <div className="agenda-view__control-group agenda-view__control-group--days">
                      <span>Dia da semana</span>
                      <div className="agenda-view__day-tabs">
                        {weekDays.map((day, dayIndex) => (
                          <button
                            key={`tab-${day}`}
                            type="button"
                            className={
                              selectedDayIndex === dayIndex
                                ? "timeline-view__toggle-btn documentation-page__mode-chip is-active documentation-page__mode-chip--active"
                                : "timeline-view__toggle-btn documentation-page__mode-chip"
                            }
                            onClick={() => setSelectedDayIndex(dayIndex)}
                          >
                            {toAgendaDayLabel(day)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {availabilitySnapshots.length === 0 ? (
                    <EmptyState>
                      {availabilityMode === "people"
                        ? "Nenhuma pessoa com atividade planejada na semana selecionada."
                        : "Nenhum recurso identificado nas atividades planejadas da semana selecionada."}
                    </EmptyState>
                  ) : (
                    <>
                      <div className="agenda-view__mobile-list">
                        {availabilitySnapshots.map((row) => (
                          <article key={`mobile-${row.id}`} className="agenda-view__mobile-card">
                            <button
                              type="button"
                              className="agenda-view__mobile-card-title"
                              onClick={() => setSelectedDetailTarget({ id: row.id, label: row.label, kind: row.detailKind })}
                            >
                              {row.label}
                            </button>
                            <span className="agenda-view__mobile-card-subtitle">{row.subtitle}</span>
                            <div className="agenda-view__mobile-card-slots">
                              {row.occupiedCount === 0 ? (
                                <span className="agenda-view__mobile-state agenda-view__mobile-state--free">Livre no dia</span>
                              ) : (
                                row.slots
                                  .filter(slot => slot.state !== "free")
                                  .map((slot) => (
                                    <button
                                      key={`${row.id}-${slot.key}-mobile`}
                                      type="button"
                                      className={`agenda-view__mobile-state agenda-view__mobile-state--${slot.state}`}
                                      onClick={() =>
                                        setSelectedSlotInspection({
                                          rowLabel: row.label,
                                          rowKind: row.detailKind,
                                          state: slot.state,
                                          tasks: slot.tasks,
                                          slotStart: slot.slotStart,
                                          slotEnd: slot.slotEnd
                                        })
                                      }
                                    >
                                      <strong>{`${toHourLabel(slot.slotStart)} - ${toHourLabel(slot.slotEnd)}`}</strong>
                                      <span>{getStateLabel(slot.state, slot.tasks.length)}</span>
                                    </button>
                                  ))
                              )}
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="agenda-view__availability-scroll">
                        <table className="agenda-view__availability-table">
                          <thead>
                            <tr>
                              <th>{availabilityMode === "people" ? "Pessoa" : "Recurso"}</th>
                              {hourSlots.map(slot => (
                                <th key={slot.key}>
                                  {slot.label}
                                  {slot.key === "0" ? (
                                    <InfoHint label="Mais informacoes sobre horarios">
                                      A grade usa intervalos de {SLOT_MINUTES} minutos entre 06:00 e 22:00. Slots parciais e conflitos aparecem com cor propria.
                                    </InfoHint>
                                  ) : null}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {availabilitySnapshots.map((row) => (
                              <tr key={row.id}>
                                <th>
                                  <div className="agenda-view__row-head">
                                    <button
                                      type="button"
                                      className="agenda-view__row-name"
                                      onClick={() => setSelectedDetailTarget({ id: row.id, label: row.label, kind: row.detailKind })}
                                    >
                                      {row.label}
                                    </button>
                                    <small>{row.subtitle}</small>
                                  </div>
                                </th>
                                {row.slots.map((slot) => {
                                  const stateLabel = getStateLabel(slot.state, slot.tasks.length);

                                  return (
                                    <td key={`${row.id}-${slot.key}`}>
                                      <div className={`agenda-view__cell agenda-view__cell--${slot.state}`}>
                                        {slot.state === "free" ? (
                                          <span>Livre</span>
                                        ) : (
                                          <button
                                            type="button"
                                            title={slot.tasks.map(entry => entry.task.title).join(" | ")}
                                            onClick={() =>
                                              setSelectedSlotInspection({
                                                rowLabel: row.label,
                                                rowKind: row.detailKind,
                                                state: slot.state,
                                                tasks: slot.tasks,
                                                slotStart: slot.slotStart,
                                                slotEnd: slot.slotEnd
                                              })
                                            }
                                          >
                                            <strong>{stateLabel}</strong>
                                            <span>{slot.tasks[0]?.task.title ?? "Atividade planejada"}</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {unscheduledTasks.length > 0 ? (
                <div className="agenda-view__unscheduled-strip">
                  <div className="agenda-view__unscheduled-copy">
                    <strong>Atividades sem horario planejado</strong>
                    <span>Resolva aqui o que ainda nao entrou na grade semanal.</span>
                  </div>
                  <div className="agenda-view__unscheduled-list">
                    {unscheduledGroups.map((group) => (
                      <button
                        key={group.assigneeId}
                        type="button"
                        className="agenda-view__unscheduled-item"
                        onClick={() => setSelectedUnscheduledGroup(group)}
                      >
                        <strong>{group.label}</strong>
                        <span>{`${group.totalCount} ${group.totalCount === 1 ? "atividade" : "atividades"} no total`}</span>
                        <small>{`${group.plannedCount} planejadas • ${group.doneCount} concluidas • ${group.unscheduledCount} sem horario`}</small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Section>
      </div>

      {selectedSlotInspection ? (
        <ModalShell titleId="agenda-slot-title" className="agenda-slot-modal" onClose={() => setSelectedSlotInspection(null)}>
          <div className="agenda-slot-modal__content">
            <div className="agenda-slot-modal__header">
              <div>
                <h2 id="agenda-slot-title">{selectedSlotInspection.rowLabel}</h2>
                <p>
                  {selectedSlotInspection.rowKind === "person" ? "Pessoa" : "Recurso"} • {toAgendaDayLabel(selectedSlotInspection.slotStart)} •{" "}
                  {`${toHourLabel(selectedSlotInspection.slotStart)} - ${toHourLabel(selectedSlotInspection.slotEnd)}`}
                </p>
              </div>
              <StatusBadge tone={selectedSlotInspection.state === "conflict" ? "warning" : "default"}>
                {getStateLabel(selectedSlotInspection.state, selectedSlotInspection.tasks.length)}
              </StatusBadge>
            </div>

            <div className="agenda-slot-modal__list">
              {selectedSlotInspection.tasks.map(({ task, window }) => {
                const typeMeta = getTaskTypeDisplayMeta(typeMap, task.type);

                return (
                  <button
                    key={`${task.id}-${window.start}`}
                    type="button"
                    className="agenda-slot-modal__item"
                    style={
                      {
                        "--agenda-slot-item-accent": typeMeta.text,
                        "--agenda-slot-item-accent-soft": typeMeta.background,
                        "--agenda-slot-item-border": typeMeta.border
                      } as CSSProperties
                    }
                    onClick={() => {
                      setSelectedSlotInspection(null);
                      selectTask(task.id);
                    }}
                  >
                    <strong>{task.title}</strong>
                    <span>{`${toHourLabel(window.start)} - ${toHourLabel(window.end)}`}</span>
                    <small>{activeMembers[task.assignee]?.name ?? "Sem responsavel"}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </ModalShell>
      ) : null}

      {selectedUnscheduledGroup ? (
        <ModalShell
          titleId="agenda-unscheduled-title"
          className="agenda-slot-modal"
          onClose={() => setSelectedUnscheduledGroup(null)}
        >
          <div className="agenda-slot-modal__content">
            <div className="agenda-slot-modal__header">
              <div>
                <h2 id="agenda-unscheduled-title">{selectedUnscheduledGroup.label}</h2>
                <p>
                  {`${selectedUnscheduledGroup.totalCount} atividades • ${selectedUnscheduledGroup.plannedCount} planejadas • ${selectedUnscheduledGroup.doneCount} concluidas • ${selectedUnscheduledGroup.unscheduledCount} sem horario`}
                </p>
              </div>
              <StatusBadge tone="warning">Sem horario</StatusBadge>
            </div>

            <div className="agenda-slot-modal__list">
              {selectedUnscheduledGroup.tasks.map((task) => {
                const typeMeta = getTaskTypeDisplayMeta(typeMap, task.type);

                return (
                  <button
                    key={task.id}
                    type="button"
                    className="agenda-slot-modal__item"
                    style={
                      {
                        "--agenda-slot-item-accent": typeMeta.text,
                        "--agenda-slot-item-accent-soft": typeMeta.background,
                        "--agenda-slot-item-border": typeMeta.border
                      } as CSSProperties
                    }
                    onClick={() => {
                      setSelectedUnscheduledGroup(null);
                      selectTask(task.id);
                    }}
                  >
                    <strong>{task.title}</strong>
                    <span>{activeMembers[task.assignee]?.name ?? "Sem responsavel"}</span>
                    <small>{typeMeta.label}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </ModalShell>
      ) : null}

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          mode="edit"
          task={selectedTask}
          status={selectedStatus}
          statuses={boardConfig.statuses}
          assignee={activeMembers[selectedTask.assignee]}
          membersById={activeMembers}
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
          listWorkspaceDocuments={listWorkspaceDocuments}
          listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
          linkDocumentToWorkItem={linkDocumentToWorkItem}
          unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
          onClose={clearSelectedTask}
        />
      ) : null}
    </AppShell>
  );
}

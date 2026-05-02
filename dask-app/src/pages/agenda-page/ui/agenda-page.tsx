import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type Task } from "@/entities/task";
import {
  calendarFeedService,
  useWorkspaceTaskPage,
  type AiAgentSummary,
  type CalendarFeedSnapshot
} from "@/modules/workspace";
import { AppIcon, EmptyState, LoadingState, Section, StatusBadge, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { TaskDetailsModal } from "@/widgets/task-details";
import { InfoHint } from "./agenda-info-hint";
import { AgendaSlotModal } from "./agenda-slot-modal";
import { AgendaToolbar } from "./agenda-toolbar";
import { AgendaTopNavigation } from "./agenda-top-navigation";
import {
  AGENDA_END_HOUR,
  AGENDA_ROW_HEIGHT,
  AGENDA_START_HOUR,
  MINUTE_MS,
  SLOT_MINUTES,
  addDays,
  extractTaskResources,
  getInitialSelectedDayIndex,
  getOverlapDuration,
  getStateLabel,
  overlaps,
  parseDateTime,
  resolvePlannedWindow,
  startOfWeek,
  toAgendaDayLabel,
  toHourLabel,
  toWeekRangeLabel,
  type AgendaSegment,
  type AvailabilityMode,
  type AvailabilityRow,
  type AvailabilityRowSnapshot,
  type AvailabilityState,
  type DetailTarget,
  type PlannedTask,
  type SlotInspection,
  type UnscheduledGroup
} from "./agenda-page.model";
import "./agenda-page.css";

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
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis,
    listWorkspaceDocuments,
    listWorkItemLinkedDocuments,
    linkDocumentToWorkItem,
    unlinkDocumentFromWorkItem,
    listCustomers,
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
                    background: "color-mix(in oklab, var(--primary) 18%, var(--neutral-white))",
                    border: "color-mix(in oklab, var(--primary) 42%, transparent)",
                    text: "var(--primary)"
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

  const sectionTitle = "Agenda";
  const sectionSubtitle = selectedDetailTarget
    ? `${toWeekRangeLabel(weekStart)} • ${selectedDetailTarget.kind === "person" ? "Detalhe semanal" : "Uso do recurso"}`
    : "";
  const topNavigation = (
    <AgendaTopNavigation
      availabilityMode={availabilityMode}
      filter={filter}
      onModeChange={(mode) => {
        setAvailabilityMode(mode);
        setSelectedDetailTarget(null);
      }}
      onQueryChange={setFilterQuery}
      onMineToggle={toggleMineFilter}
    />
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="agenda-view">
        <LoadingState
          text="Carregando agenda..."
          animation="agenda"
          variant="frame"
          visible={isLoading || isCalendarFeedLoading}
        />
        <Section
          title={sectionTitle}
          subtitle={sectionSubtitle}
          className="agenda-view__section"
        >
          {filteredTasks.length === 0 ? (
            <EmptyState>Nao ha atividades para exibir com os filtros atuais.</EmptyState>
          ) : (
            <div className="agenda-view__surface">
              <AgendaToolbar
                weekStart={weekStart}
                weekViewDirection={weekViewDirection}
                tasksOutsideAgendaCount={tasksOutsideAgenda.length}
                onWeekAnchorChange={setWeekAnchor}
                onToday={() => setWeekAnchor(Date.now())}
              />

              {selectedDetailTarget ? (
                <div className="agenda-view__person-shell">
                  <div className="agenda-view__person-toolbar">
                    <button
                      type="button"
                      className="agenda-view__ghost-button"
                      onClick={() => setSelectedDetailTarget(null)}
                    >
                      <AppIcon name="chevron-left" size={15} />
                      Voltar
                    </button>
                    <div className="agenda-view__detail-heading">
                      <strong>{selectedDetailTarget.label}</strong>
                      <span>
                        {selectedDetailTarget.kind === "person"
                          ? `${selectedDetailTasks.length} atividades • ${calendarFeed?.events?.length ?? 0} externos`
                          : `${selectedDetailTasks.length} atividades`}
                      </span>
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
                  <div className="agenda-view__day-strip">
                    {weekDays.map((day, dayIndex) => (
                      <button
                        key={`tab-${day}`}
                        type="button"
                        className={selectedDayIndex === dayIndex ? "agenda-view__mode-btn agenda-view__mode-btn--active" : "agenda-view__mode-btn"}
                        onClick={() => setSelectedDayIndex(dayIndex)}
                      >
                        {toAgendaDayLabel(day)}
                      </button>
                    ))}
                  </div>

                  {availabilitySnapshots.length === 0 ? (
                    <div className="agenda-view__empty-availability">
                      <div className="agenda-view__empty-week">
                        {weekDays.map((day, i) => (
                          <div key={day} className={`agenda-view__empty-day${i === selectedDayIndex ? " is-selected" : ""}`}>
                            <span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(day))}</span>
                            <strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(day))}</strong>
                          </div>
                        ))}
                      </div>
                      <p className="agenda-view__empty-msg">
                        {availabilityMode === "people"
                          ? "Nenhuma atividade com horario definido esta semana."
                          : "Nenhum recurso identificado nas atividades desta semana."}
                      </p>
                      <span className="agenda-view__empty-hint">
                        Abra uma atividade e defina inicio e fim para que ela aparea aqui.
                      </span>
                    </div>
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

            </div>
          )}
        </Section>
      </WorkspaceFrame>

      {selectedSlotInspection ? (
        <AgendaSlotModal
          slotInspection={selectedSlotInspection}
          typeMap={typeMap}
          membersById={activeMembers}
          onClose={() => setSelectedSlotInspection(null)}
          onSelectTask={(taskId) => {
            setSelectedSlotInspection(null);
            selectTask(taskId);
          }}
        />
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
          aiAgents={agents}
          onRunAiAgentOnItem={runAiAgentOnItem}
          onRunAiRiskAnalysis={runAiRiskAnalysis}
          listWorkspaceDocuments={listWorkspaceDocuments}
          listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
          linkDocumentToWorkItem={linkDocumentToWorkItem}
          unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
          listCustomers={listCustomers}
          onClose={clearSelectedTask}
        />
      ) : null}
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { buildTaskTypeMetaMap } from "@/entities/task";
import {
  useWorkspaceTaskPage,
  useWorkspaceWorkItemActions,
  type AiAgentSummary
} from "@/modules/workspace";
import { useAiWorkItemActions } from "@/modules/ai";
import { useWorkspaceDocumentActions } from "@/modules/documentation";
import { useAgendaWorkItemsQuery, useCalendarFeedQuery } from "@/modules/agenda";
import { useCustomerLookupAction } from "@/modules/commercial";
import { AppIcon, Button, EmptyState, InlineAlert, LoadingState, Section, StatusBadge, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { TaskDetailsModal } from "@/widgets/task-details";
import { buildAgendaWeekRange, useAgendaViewModel } from "@/pages/agenda-page/model/agenda-view-model";
import { AgendaSlotModal } from "./agenda-slot-modal";
import { AgendaToolbar } from "./agenda-toolbar";
import { AgendaTopNavigation } from "./agenda-top-navigation";
import { AgendaUnscheduledList } from "./components/agenda-unscheduled-list";
import { AvailabilityGrid } from "./components/availability-grid";
import { MobileAvailabilityList } from "./components/mobile-availability-list";
import { WeeklyDetailGrid } from "./components/weekly-detail-grid";
import {
  AGENDA_END_HOUR,
  AGENDA_START_HOUR,
  SLOT_MINUTES,
  getInitialSelectedDayIndex,
  toAgendaDayLabel,
  toWeekRangeLabel,
  type AvailabilityMode,
  type DetailTarget,
  type SlotInspection
} from "./agenda-page.model";
import "./agenda-page.css";

export function AgendaPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const {
    snapshot,
    isLoading,
    filter,
    setFilterQuery,
    toggleMineFilter,
    boardConfig,
    activeMembers,
    activeUser,
    metrics,
    selectedTask,
    selectedStatus,
    selectTask,
    clearSelectedTask
  } = useWorkspaceTaskPage();
  const {
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis
  } = useAiWorkItemActions(workspaceSlug || null);
  const {
    listWorkspaceDocuments,
    listWorkItemLinkedDocuments,
    linkDocumentToWorkItem,
    unlinkDocumentFromWorkItem
  } = useWorkspaceDocumentActions(workspaceSlug || null);
  const {
    moveTask,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    updateTask
  } = useWorkspaceWorkItemActions(workspaceSlug || null);
  const listCustomers = useCustomerLookupAction(workspaceSlug || null);

  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>("people");
  const [weekAnchor, setWeekAnchor] = useState(() => Date.now());
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => getInitialSelectedDayIndex());
  const [selectedDetailTarget, setSelectedDetailTarget] = useState<DetailTarget | null>(null);
  const [selectedSlotInspection, setSelectedSlotInspection] = useState<SlotInspection | null>(null);

  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);
  const canRescheduleWorkItems =
    !snapshot?.access?.role || !["VIEWER", "CLIENT"].includes(snapshot.access.role);
  const feedWeekRange = useMemo(() => buildAgendaWeekRange(weekAnchor), [weekAnchor]);
  const agendaWorkItemsQuery = useAgendaWorkItemsQuery(workspaceSlug, {
    search: filter.query,
    assigneeId: filter.mineOnly ? activeUser : undefined,
    plannedWindowFrom: new Date(feedWeekRange.weekStart).toISOString(),
    plannedWindowTo: new Date(feedWeekRange.weekEnd).toISOString(),
    pageSize: 80,
    sortBy: "plannedStartAt",
    sortDirection: "asc"
  });
  const agendaTasks = agendaWorkItemsQuery.data;
  const calendarFeedQuery = useCalendarFeedQuery(workspaceSlug, {
    startAt: new Date(feedWeekRange.weekStart).toISOString(),
    endAt: new Date(feedWeekRange.weekEnd).toISOString()
  });
  const calendarFeed = calendarFeedQuery.data ?? null;

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

  const agendaView = useAgendaViewModel({
    tasks: agendaTasks,
    activeMembers,
    availabilityMode,
    weekAnchor,
    selectedDayIndex,
    selectedDetailTarget,
    calendarFeed,
    typeMap
  });
  const {
    weekRange: { weekStart, weekEnd, weekDays, weekViewDirection },
    selectedDayStart,
    hourSlots,
    agendaStartOffset,
    agendaHeight,
    availabilitySnapshots,
    selectedDetailTasks,
    weeklyAgendaByDay,
    tasksOutsideAgenda,
    unscheduledGroups,
    plannedTasksOutsideWeek
  } = agendaView;

  useEffect(() => {
    setSelectedSlotInspection(null);
  }, [selectedDayStart, weekStart]);

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
      <WorkspaceFrame className="agenda-view" variant="table" scroll="none">
        <LoadingState
          text="Carregando agenda..."
          animation="agenda"
          variant="frame"
          visible={isLoading || calendarFeedQuery.isLoading || (agendaWorkItemsQuery.isFetching && agendaTasks.length === 0)}
        />
        <Section
          title={sectionTitle}
          subtitle={sectionSubtitle}
          className="agenda-view__section"
        >
          {agendaWorkItemsQuery.error instanceof Error ? (
            <InlineAlert tone="danger">{agendaWorkItemsQuery.error.message}</InlineAlert>
          ) : null}
          {calendarFeedQuery.error instanceof Error ? (
            <InlineAlert tone="warning">{calendarFeedQuery.error.message}</InlineAlert>
          ) : null}

          <div className="agenda-view__surface">
              <AgendaToolbar
                weekStart={weekStart}
                weekViewDirection={weekViewDirection}
                tasksOutsideAgendaCount={tasksOutsideAgenda.length}
                onWeekAnchorChange={setWeekAnchor}
                onToday={() => setWeekAnchor(Date.now())}
              />
              <AgendaUnscheduledList
                unscheduledGroups={unscheduledGroups}
                tasksOutsideAgenda={tasksOutsideAgenda}
                plannedTasksOutsideWeek={plannedTasksOutsideWeek}
                onSelectTask={selectTask}
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
                    <WeeklyDetailGrid
                      workspaceId={workspaceSlug}
                      canReschedule={canRescheduleWorkItems}
                      weekDays={weekDays}
                      hourSlots={hourSlots}
                      weeklyAgendaByDay={weeklyAgendaByDay}
                      agendaStartOffset={agendaStartOffset}
                      agendaHeight={agendaHeight}
                      onSelectTask={selectTask}
                    />
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
                    <EmptyState
                      className="agenda-view__empty-availability"
                      icon={
                        <span className="agenda-view__empty-week">
                          {weekDays.map((day, i) => (
                            <span key={day} className={`agenda-view__empty-day${i === selectedDayIndex ? " is-selected" : ""}`}>
                              <span>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(day))}</span>
                              <strong>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(new Date(day))}</strong>
                            </span>
                          ))}
                        </span>
                      }
                      title={
                        availabilityMode === "people"
                          ? "Nenhuma atividade com horario definido esta semana."
                          : "Nenhum recurso identificado nas atividades desta semana."
                      }
                      description="Abra uma atividade e defina inicio e fim para que ela aparea aqui."
                    />
                  ) : (
                    <>
                      <MobileAvailabilityList
                        rows={availabilitySnapshots}
                        onOpenDetail={setSelectedDetailTarget}
                        onInspectSlot={setSelectedSlotInspection}
                      />
                      <AvailabilityGrid
                        availabilityMode={availabilityMode}
                        hourSlots={hourSlots}
                        rows={availabilitySnapshots}
                        slotMinutes={SLOT_MINUTES}
                        onOpenDetail={setSelectedDetailTarget}
                        onInspectSlot={setSelectedSlotInspection}
                      />
                    </>
                  )}
                </div>
              )}

              {agendaWorkItemsQuery.hasNextPage ? (
                <div className="agenda-view__pagination">
                  <span className="agenda-view__pagination-status">
                    {`${agendaWorkItemsQuery.loadedCount} de ${agendaWorkItemsQuery.total} atividades carregadas`}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void agendaWorkItemsQuery.fetchNextPage()}
                    disabled={agendaWorkItemsQuery.isFetchingNextPage}
                  >
                    {agendaWorkItemsQuery.isFetchingNextPage ? "Carregando..." : "Carregar mais"}
                  </Button>
                </div>
              ) : null}
            </div>
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

import { useEffect, useMemo, useState } from "react";
import {
  buildTaskTypeMetaMap,
  getTaskTypeDisplayMeta,
  matchesTaskFieldStorage,
  resolveTaskFieldValue,
  type Task
} from "@/entities/task";
import { WorkItemFieldRenderer } from "@/entities/task/ui/field-presentation";
import { DashboardFilter } from "@/features/dashboard-filter";
import { useWorkspaceTaskPage } from "@/modules/workspace";
import type { AiAgentSummary } from "@/modules/workspace/model";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  LoadingState,
  Section,
  WorkspaceFrame
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { TaskDetailsModal } from "@/widgets/task-details";
import { cn } from "@/shared/lib/cn";
import "./timeline-page.css";

type TimelineMode = "agenda" | "coluna";

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

function parseDateTime(value: string | null | undefined): number | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
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

  const titleField = useMemo(
    () => boardConfig.fieldDefinitions.find(field => matchesTaskFieldStorage(field, { kind: "item_property", property: "title" })),
    [boardConfig.fieldDefinitions]
  );

  const statusField = useMemo(
    () => boardConfig.fieldDefinitions.find(field => matchesTaskFieldStorage(field, { kind: "item_property", property: "stateSlug" })),
    [boardConfig.fieldDefinitions]
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
  const topNavigation = (
    <section className="timeline-top-nav" aria-label="Filtro da timeline">
      <div className="timeline-top-nav__tabs" role="tablist" aria-label="Modo da timeline">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "agenda"}
          className={cn("timeline-top-nav__tab", mode === "agenda" && "timeline-top-nav__tab--active")}
          onClick={() => setMode("agenda")}
        >
          Agenda
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "coluna"}
          className={cn("timeline-top-nav__tab", mode === "coluna" && "timeline-top-nav__tab--active")}
          onClick={() => setMode("coluna")}
        >
          Coluna
        </button>
      </div>
      <div className="timeline-top-nav__filter">
        <DashboardFilter
          query={filter.query}
          mineOnly={filter.mineOnly}
          onQueryChange={setFilterQuery}
          onMineToggle={toggleMineFilter}
        />
      </div>
    </section>
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="timeline-view">
        <LoadingState
          text="Carregando timeline..."
          animation="timeline"
          variant="frame"
          visible={isLoading && tasksWithWindow.length === 0}
        />
        <Section
          title={rangeLabel}
          className="timeline-view__section workspace-view__section"
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
                {tasksWithWindow.length === 0 ? (
                  <EmptyState>Nenhum item encontrado com os filtros atuais.</EmptyState>
                ) : (
                  tasksWithWindow.map(({ task, window }) => {
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
                            <strong>
                              {titleField ? (
                                <WorkItemFieldRenderer
                                  field={titleField}
                                  value={resolveTaskFieldValue(task, titleField)}
                                  mode="display"
                                  context="table"
                                  boardConfig={boardConfig}
                                  statuses={boardConfig.statuses}
                                  task={task}
                                />
                              ) : (
                                task.title
                              )}
                            </strong>
                            <div className="timeline-view__meta-support">
                              <span>
                                {statusField ? (
                                  <WorkItemFieldRenderer
                                    field={statusField}
                                    value={resolveTaskFieldValue(task, statusField)}
                                    mode="display"
                                    context="table"
                                    boardConfig={boardConfig}
                                    statuses={boardConfig.statuses}
                                    task={task}
                                  />
                                ) : (
                                  statusLabel
                                )}
                              </span>
                            </div>
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
                              <button
                                type="button"
                                className="timeline-view__column-chip is-current"
                                onClick={() => selectTask(task.id)}
                              >
                                {statusField ? (
                                  <WorkItemFieldRenderer
                                    field={statusField}
                                    value={resolveTaskFieldValue(task, statusField)}
                                    mode="display"
                                    context="table"
                                    boardConfig={boardConfig}
                                    statuses={boardConfig.statuses}
                                    task={task}
                                  />
                                ) : (
                                  statusLabel
                                )}
                              </button>
                            </div>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })
                )}
              </DataTableBody>
            </DataTable>

          </div>
        </Section>
      </WorkspaceFrame>

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

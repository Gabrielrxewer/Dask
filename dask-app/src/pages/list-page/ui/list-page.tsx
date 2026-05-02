import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type TaskStatusId } from "@/entities/task";
import { useAuth } from "@/features/auth";
import { DashboardFilter } from "@/features/dashboard-filter";
import { useWorkspaceTaskPage } from "@/modules/workspace";
import type { AiAgentSummary } from "@/modules/workspace/model";
import { MemberAvatar } from "@/entities/member";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  LoadingState,
  Section,
  Select,
  WorkspaceFrame
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { CreateTaskButton } from "@/features/create-task";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./list-page.css";

function formatDueDate(due: string): { label: string; overdue: boolean; isToday: boolean } {
  if (!due) return { label: "—", overdue: false, isToday: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${due}T00:00:00`);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: "Hoje", overdue: false, isToday: true };
  if (diff === 1) return { label: "Amanhã", overdue: false, isToday: false };
  if (diff === -1) return { label: "Ontem", overdue: true, isToday: false };
  if (diff < 0) return { label: `${Math.abs(diff)}d atraso`, overdue: true, isToday: false };
  const [, month, day] = due.split("-");
  return { label: `${day}/${month}`, overdue: false, isToday: false };
}

export function ListPage() {
  const { user } = useAuth();
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
    activeMembers: rawActiveMembers,
    filteredTasks,
    metrics,
    selectedTask,
    selectedStatus,
    selectTask,
    clearSelectedTask
  } = useWorkspaceTaskPage();

  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [taskOrder, setTaskOrder] = useState<string[]>([]);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, TaskStatusId>>({});
  const taskTypeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

  const activeMembers = useMemo(() => {
    const userAvatarUrl = user?.avatarUrl ?? null;
    if (!userAvatarUrl) return rawActiveMembers;
    const memberId = user?.id;
    const member = memberId ? rawActiveMembers[memberId] : null;
    if (!member) return rawActiveMembers;
    return { ...rawActiveMembers, [memberId!]: { ...member, avatarUrl: userAvatarUrl } };
  }, [rawActiveMembers, user?.avatarUrl, user?.id]);

  useEffect(() => {
    setTaskOrder((currentOrder) => {
      const nextIds = filteredTasks.map(task => task.id);
      const nextIdSet = new Set(nextIds);
      const preservedIds = currentOrder.filter(taskId => nextIdSet.has(taskId));
      const newIds = nextIds.filter(taskId => !currentOrder.includes(taskId));
      const nextOrder = [...preservedIds, ...newIds];
      if (nextOrder.length === currentOrder.length && nextOrder.every((taskId, index) => taskId === currentOrder[index])) {
        return currentOrder;
      }
      return nextOrder;
    });
  }, [filteredTasks]);

  const orderedTasks = useMemo(() => {
    if (taskOrder.length === 0) return filteredTasks;
    const orderIndex = new Map(taskOrder.map((taskId, index) => [taskId, index]));
    return [...filteredTasks].sort((a, b) => {
      const ai = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [filteredTasks, taskOrder]);

  useEffect(() => {
    setPendingStatuses((currentStatuses) => {
      const nextStatuses = { ...currentStatuses };
      let changed = false;
      Object.entries(currentStatuses).forEach(([taskId, pendingStatus]) => {
        const task = filteredTasks.find(item => item.id === taskId);
        if (!task || task.status === pendingStatus) {
          delete nextStatuses[taskId];
          changed = true;
        }
      });
      return changed ? nextStatuses : currentStatuses;
    });
  }, [filteredTasks]);

  useEffect(() => {
    let mounted = true;
    void listAiAgents().then((result) => {
      if (mounted) setAgents(result.filter(agent => agent.isActive));
    });
    return () => { mounted = false; };
  }, [listAiAgents]);

  const handleStatusChange = (taskId: string, statusId: TaskStatusId) => {
    setPendingStatuses(prev => ({ ...prev, [taskId]: statusId }));
    void moveTask(taskId, statusId).catch(() => {
      setPendingStatuses(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    });
  };

  const topNavigation = (
    <section className="list-top-nav" aria-label="Filtro da lista">
      <CreateTaskButton
        className="list-top-nav__create-task"
        onCreate={input => void createTask(input)}
        initialStatusId={boardConfig.statuses[0]?.id ?? "backlog"}
        statuses={boardConfig.statuses}
        boardConfig={boardConfig}
        membersById={activeMembers}
        taskTypes={boardConfig.taskTypes}
        iconOnly
      />
      <div className="list-top-nav__filter">
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
      <WorkspaceFrame className="list-view">
        <LoadingState
          text="Carregando lista..."
          animation="list"
          variant="frame"
          visible={isLoading && filteredTasks.length === 0}
        />
        <Section
          title={`${filteredTasks.length} ${filteredTasks.length === 1 ? "item" : "itens"}`}
          className="list-view__section workspace-view__section"
        >
          <DataTable
            columns="minmax(200px, 2.4fr) minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(80px, 0.65fr) minmax(76px, 0.5fr) 68px"
            className="list-view__table"
            responsiveMinWidth="900px"
            responsiveMinWidthMobile="760px"
          >
            <DataTableHeader>
              <span>Negócio</span>
              <span>Etapa</span>
              <span>Responsável</span>
              <span>Prazo</span>
              <span>Progresso</span>
              <span />
            </DataTableHeader>

            <DataTableBody>
              {filteredTasks.length === 0 ? (
                <EmptyState>Nenhum item encontrado para o filtro atual.</EmptyState>
              ) : (
                orderedTasks.map(task => {
                  const done = task.checklist.items.filter(item => item.done).length;
                  const total = task.checklist.items.length;
                  const type = getTaskTypeDisplayMeta(taskTypeMap, task.type);
                  const owner = activeMembers[task.assignee];
                  const due = task.due ? formatDueDate(task.due) : null;
                  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

                  return (
                    <DataTableRow key={task.id} className="list-view__row">
                      <DataTableCell>
                        <div className="list-view__negocio">
                          <button type="button" className="list-view__title" onClick={() => selectTask(task.id)}>
                            {task.title}
                          </button>
                          {type && (
                            <span
                              className="list-view__type"
                              style={{
                                "--list-type-background": type.background ?? "var(--info-bg)",
                                "--list-type-border": type.border ?? "var(--info-border)",
                                "--list-type-text": type.text ?? "var(--text-primary)"
                              } as CSSProperties}
                            >
                              {type.label}
                            </span>
                          )}
                        </div>
                      </DataTableCell>

                      <DataTableCell>
                        <Select
                          className="list-view__status"
                          value={pendingStatuses[task.id] ?? task.status}
                          onChange={event => handleStatusChange(task.id, event.target.value)}
                        >
                          {boardConfig.statuses.map(status => (
                            <option key={status.id} value={status.id}>{status.label}</option>
                          ))}
                        </Select>
                      </DataTableCell>

                      <DataTableCell>
                        {owner ? (
                          <span className="list-view__owner-wrap">
                            <MemberAvatar member={owner} />
                            <span className="list-view__owner">{owner.name}</span>
                          </span>
                        ) : <span className="list-view__empty-cell">—</span>}
                      </DataTableCell>

                      <DataTableCell>
                        {due ? (
                          <span className={`list-view__due${due.overdue ? " list-view__due--overdue" : due.isToday ? " list-view__due--today" : ""}`}>
                            {due.label}
                          </span>
                        ) : <span className="list-view__empty-cell">—</span>}
                      </DataTableCell>

                      <DataTableCell>
                        {total === 0 ? (
                          <span className="list-view__empty-cell">—</span>
                        ) : (
                          <span className="list-view__progress">
                            <span className="list-view__progress-bar">
                              <span
                                className="list-view__progress-fill"
                                style={{ width: `${progressPct}%` }}
                              />
                            </span>
                            <span className={`list-view__progress-label${done === total ? " list-view__progress-label--done" : ""}`}>
                              {done}/{total}
                            </span>
                          </span>
                        )}
                      </DataTableCell>

                      <DataTableCell>
                        <div className="list-view__row-actions">
                          <button
                            type="button"
                            className="list-view__action-btn"
                            onClick={() => selectTask(task.id)}
                            title="Abrir"
                          >
                            Abrir
                          </button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })
              )}
            </DataTableBody>
          </DataTable>
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

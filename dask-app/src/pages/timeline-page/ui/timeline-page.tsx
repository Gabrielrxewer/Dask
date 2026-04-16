import { useEffect, useMemo, useState } from "react";
import { buildTaskChecklistSummary, buildTaskTypeMetaMap, getTaskTypeDisplayMeta } from "@/entities/task";
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
  StatusBadge
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { CreateTaskButton } from "@/features/create-task";
import { TaskDetailsModal } from "@/widgets/task-details";
import { cn } from "@/shared/lib/cn";
import "./timeline-page.css";

function toDateStamp(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

function toShortDate(value: number): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(value));
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

  const sortedTasks = useMemo(
    () => [...filteredTasks].sort((a, b) => toDateStamp(a.due) - toDateStamp(b.due)),
    [filteredTasks]
  );

  const dateRange = useMemo(() => {
    if (sortedTasks.length === 0) {
      const now = Date.now();
      return { min: now, max: now + 1000 * 60 * 60 * 24 * 14 };
    }

    const min = toDateStamp(sortedTasks[0].due);
    const max = toDateStamp(sortedTasks[sortedTasks.length - 1].due) + 1000 * 60 * 60 * 24 * 5;
    return { min, max };
  }, [sortedTasks]);

  const range = Math.max(dateRange.max - dateRange.min, 1000 * 60 * 60 * 24);
  const rangeLabel = `${toShortDate(dateRange.min)} - ${toShortDate(dateRange.max)}`;

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
          title="Linha do tempo de entregas"
          subtitle="Visualize os itens por prazo para antecipar gargalos e riscos de calendario."
          actions={
            <div className="timeline-view__actions">
              <DashboardFilter
                query={filter.query}
                mineOnly={filter.mineOnly}
                onQueryChange={setFilterQuery}
                onMineToggle={toggleMineFilter}
              />
              <StatusBadge>{rangeLabel}</StatusBadge>
              <CreateTaskButton
                className="timeline-view__create-task"
                onCreate={input => void createTask(input)}
                typeOptions={boardConfig.taskTypes.map((taskType) => ({ id: taskType.id, label: taskType.label }))}
              />
            </div>
          }
          className="timeline-view__section"
        >
          <DataTable
            columns="minmax(220px, 1.3fr) 2.4fr"
            className="timeline-view__table"
            responsiveMinWidth="860px"
            responsiveMinWidthMobile="760px"
          >
            <DataTableHeader>
              <span>Itens</span>
              <span>Janela de entrega</span>
            </DataTableHeader>

            <DataTableBody>
              {isLoading ? (
                <LoadingState text="Carregando workspace..." />
              ) : sortedTasks.length === 0 ? (
                <EmptyState>Nenhum item com prazo encontrado.</EmptyState>
              ) : (
                sortedTasks.map(task => {
                  const taskStamp = toDateStamp(task.due);
                  const offset = ((taskStamp - dateRange.min) / range) * 100;
                  const width = 14;
                  const checklist = buildTaskChecklistSummary(task);
                  const type = getTaskTypeDisplayMeta(typeMap, task.type);
                  const isLate = taskStamp < Date.now();

                  return (
                    <DataTableRow key={task.id}>
                      <DataTableCell>
                        <button type="button" className="timeline-view__meta" onClick={() => selectTask(task.id)}>
                          <strong>{task.title}</strong>
                          <p>{`${checklist.done}/${checklist.total} checklist`}</p>
                        </button>
                      </DataTableCell>

                      <DataTableCell>
                        <div className="timeline-view__lane">
                          <div className="timeline-view__track" />
                          <button
                            type="button"
                            className={cn("timeline-view__bar", isLate && "timeline-view__bar--late")}
                            style={{
                              left: `${Math.min(Math.max(offset, 0), 86)}%`,
                              width: `${width}%`,
                              background: type.background,
                              borderColor: type.border,
                              color: type.text
                            }}
                            onClick={() => selectTask(task.id)}
                          >
                            {type.label}
                            <span>{task.due}</span>
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


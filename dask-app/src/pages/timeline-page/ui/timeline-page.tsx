import { useMemo } from "react";
import { buildTaskChecklistSummary, buildTaskTypeMetaMap, getTaskTypeDisplayMeta } from "@/entities/task";
import { useWorkspaceTaskPage } from "@/modules/workspace";
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
    updateTaskPriority,
    toggleChecklistItem,
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
  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

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
      pageTitle="Linha do tempo"
      filter={filter}
      onFilterQueryChange={setFilterQuery}
      onMineToggle={toggleMineFilter}
      onCreateTask={input => void createTask(input)}
    >
      <div className="timeline-view">
        <BoardMetrics metrics={metrics} className="timeline-view__metrics" />

        <Section
          title="Linha do tempo de entregas"
          subtitle="Visualize os itens por prazo para antecipar gargalos e riscos de calendario."
          actions={<StatusBadge>{rangeLabel}</StatusBadge>}
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
          assignee={activeMembers[selectedTask.assignee]}
          boardConfig={boardConfig}
          onUpdatePriority={(taskId, priority) => void updateTaskPriority(taskId, priority)}
          onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
          onClose={clearSelectedTask}
        />
      ) : null}
    </AppShell>
  );
}


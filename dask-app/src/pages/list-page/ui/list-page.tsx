import { useEffect, useMemo, useState } from "react";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type TaskStatusId } from "@/entities/task";
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
  Select,
  StatusBadge
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { CreateTaskButton } from "@/features/create-task";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./list-page.css";

export function ListPage() {
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
  const taskTypeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

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

  const handleStatusChange = (taskId: string, statusId: TaskStatusId) => {
    void moveTask(taskId, statusId);
  };

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Lista de itens"
    >
      <div className="list-view">
        <BoardMetrics metrics={metrics} className="list-view__metrics" />

        <Section
          title="Itens do workspace"
          subtitle="Acompanhe tarefas, altere status e acesse os detalhes sem sair da lista."
          actions={
            <div className="list-view__actions">
              <DashboardFilter
                query={filter.query}
                mineOnly={filter.mineOnly}
                onQueryChange={setFilterQuery}
                onMineToggle={toggleMineFilter}
              />
              <StatusBadge>{`${filteredTasks.length} itens`}</StatusBadge>
              <CreateTaskButton
                className="list-view__create-task"
                onCreate={input => void createTask(input)}
                initialStatusId={boardConfig.statuses[0]?.id ?? "backlog"}
                statuses={boardConfig.statuses}
                boardConfig={boardConfig}
                membersById={activeMembers}
              />
            </div>
          }
          className="list-view__section"
        >
          <DataTable
            columns="minmax(220px, 2.2fr) 1fr 1fr 1.2fr 0.7fr"
            className="list-view__table"
            responsiveMinWidth="860px"
            responsiveMinWidthMobile="760px"
          >
            <DataTableHeader>
              <span>Titulo</span>
              <span>Tipo</span>
              <span>Status</span>
              <span>Owner</span>
              <span>Checklist</span>
            </DataTableHeader>

            <DataTableBody>
              {isLoading ? (
                <LoadingState text="Carregando workspace..." />
              ) : filteredTasks.length === 0 ? (
                <EmptyState>Nenhum item encontrado para o filtro atual.</EmptyState>
              ) : (
                filteredTasks.map(task => {
                  const done = task.checklist.items.filter(item => item.done).length;
                  const total = task.checklist.items.length;
                  const type = getTaskTypeDisplayMeta(taskTypeMap, task.type);

                  return (
                    <DataTableRow key={task.id}>
                      <DataTableCell>
                        <button type="button" className="list-view__title" onClick={() => selectTask(task.id)}>
                          <strong>{task.title}</strong>
                          <p>{task.text}</p>
                        </button>
                      </DataTableCell>
                      <DataTableCell>
                        <span
                          className="list-view__type"
                          style={{
                            backgroundColor: type?.background ?? "#edf5ff",
                            borderColor: type?.border ?? "#cfe2ff",
                            color: type?.text ?? "#1d4e85"
                          }}
                        >
                          {type?.label ?? task.type}
                        </span>
                      </DataTableCell>
                      <DataTableCell>
                        <Select
                          className="list-view__status"
                          value={task.status}
                          onChange={event => handleStatusChange(task.id, event.target.value)}
                        >
                          {boardConfig.statuses.map(status => (
                            <option key={status.id} value={status.id}>
                              {status.label}
                            </option>
                          ))}
                        </Select>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="list-view__owner">{activeMembers[task.assignee]?.name}</span>
                      </DataTableCell>
                      <DataTableCell>
                        <span className="list-view__checklist">{`${done}/${total}`}</span>
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
          onClose={clearSelectedTask}
        />
      ) : null}
    </AppShell>
  );
}

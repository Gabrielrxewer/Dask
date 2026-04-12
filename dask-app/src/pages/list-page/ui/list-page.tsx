import { useMemo } from "react";
import { buildTaskTypeMetaMap, getTaskTypeDisplayMeta, type TaskStatusId } from "@/entities/task";
import { CreateTaskButton } from "@/features/create-task";
import { SelectedTaskDetailsModal, useWorkspaceTaskPage } from "@/modules/workspace";
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
import "./list-page.css";

export function ListPage() {
  const {
    isLoading,
    createTask,
    moveTask,
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
  const taskTypeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

  const handleStatusChange = (taskId: string, statusId: TaskStatusId) => {
    void moveTask(taskId, statusId);
  };

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageLabel="Planejamento"
      pageTitle="List"
      filter={filter}
      onFilterQueryChange={setFilterQuery}
      onMineToggle={toggleMineFilter}
    >
      <div className="list-view">
        <BoardMetrics metrics={metrics} className="list-view__metrics" />

        <Section
          title="Itens do workspace"
          subtitle="Acompanhe tarefas, altere status e acesse os detalhes sem sair da lista."
          actions={
            <>
              <StatusBadge>{`${filteredTasks.length} itens`}</StatusBadge>
              <CreateTaskButton onCreate={input => void createTask(input)} />
            </>
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

      <SelectedTaskDetailsModal
        selectedTask={selectedTask}
        selectedStatus={selectedStatus}
        activeMembers={activeMembers}
        boardConfig={boardConfig}
        onUpdatePriority={(taskId, priority) => void updateTaskPriority(taskId, priority)}
        onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
        onClose={clearSelectedTask}
      />
    </AppShell>
  );
}


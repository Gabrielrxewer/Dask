import { useMemo, useState } from "react";
import { currentUserId, membersById } from "@/entities/member";
import {
  buildBoardMetrics,
  buildTaskTypeMetaMap,
  factoryBoardConfig,
  type TaskStatusId
} from "@/entities/task";
import {
  applyDashboardFilter,
  initialDashboardFilter,
  type DashboardFilterState
} from "@/features/dashboard-filter";
import { useWorkspace } from "@/modules/workspace";
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
import { TaskDetailsModal } from "@/widgets/task-details";
import "./list-page.css";

export function ListPage() {
  const { snapshot, isLoading, createTask, moveTask, updateTaskPriority, toggleChecklistItem } = useWorkspace();
  const [filter, setFilter] = useState<DashboardFilterState>(initialDashboardFilter);
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const tasks = snapshot?.tasks ?? [];
  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const activeMembers = snapshot?.membersById ?? membersById;
  const activeUser = snapshot?.currentUserId ?? currentUserId;

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, activeMembers, activeUser),
    [tasks, filter, activeMembers, activeUser]
  );

  const metrics = useMemo(() => buildBoardMetrics(filteredTasks), [filteredTasks]);
  const taskTypeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

  const selectedTask = useMemo(
    () => filteredTasks.find(task => task.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId]
  );

  const selectedStatus = useMemo(
    () => (selectedTask ? boardConfig.statuses.find(status => status.id === selectedTask.status) ?? null : null),
    [selectedTask, boardConfig.statuses]
  );

  const handleStatusChange = (taskId: string, statusId: TaskStatusId) => {
    void moveTask(taskId, statusId);
  };

  return (
    <AppShell
      metrics={metrics}
      pageTitle="Lista de itens"
      filter={filter}
      onFilterQueryChange={query => setFilter(prev => ({ ...prev, query }))}
      onMineToggle={() => setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }))}
      onCreateTask={input => void createTask(input)}
    >
      <BoardMetrics metrics={metrics} />

      <Section
        title="Itens do workspace"
        subtitle="Acompanhe tarefas, altere status e acesse os detalhes sem sair da lista."
        actions={<StatusBadge>{`${filteredTasks.length} itens`}</StatusBadge>}
        className="list-view"
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
                const type = taskTypeMap[task.type];

                return (
                  <DataTableRow key={task.id}>
                    <DataTableCell>
                      <button type="button" className="list-view__title" onClick={() => setSelectedTaskId(task.id)}>
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

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          task={selectedTask}
          status={selectedStatus}
          assignee={activeMembers[selectedTask.assignee]}
          boardConfig={boardConfig}
          onUpdatePriority={(taskId, priority) => void updateTaskPriority(taskId, priority)}
          onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
          onClose={() => setSelectedTaskId("")}
        />
      ) : null}
    </AppShell>
  );
}


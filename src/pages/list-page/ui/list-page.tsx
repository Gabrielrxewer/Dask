import { useMemo, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { TaskDetailsModal } from "@/widgets/task-details";
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
import "./list-page.css";

export function ListPage() {
  const { snapshot, isLoading, createTask, moveTask, toggleChecklistItem } = useWorkspace();
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
      pageTitle="Lista de cards"
      filter={filter}
      onFilterQueryChange={query => setFilter(prev => ({ ...prev, query }))}
      onMineToggle={() => setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }))}
      onCreateTask={() => void createTask()}
    >
      <BoardMetrics metrics={metrics} />

      <section className="list-view">
        <header className="list-view__header">
          <span>Titulo</span>
          <span>Tipo</span>
          <span>Status</span>
          <span>Owner</span>
          <span>Checklist</span>
        </header>

        <div className="list-view__rows">
          {isLoading ? (
            <article className="list-view__empty">Carregando workspace...</article>
          ) : filteredTasks.length === 0 ? (
            <article className="list-view__empty">Nenhum card encontrado para o filtro atual.</article>
          ) : (
            filteredTasks.map(task => {
              const done = task.checklist.items.filter(item => item.done).length;
              const total = task.checklist.items.length;
              const type = taskTypeMap[task.type];

              return (
                <article className="list-view__row" key={task.id}>
                  <button type="button" className="list-view__title" onClick={() => setSelectedTaskId(task.id)}>
                    <strong>{task.title}</strong>
                    <p>{task.text}</p>
                  </button>
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
                  <select
                    className="list-view__status"
                    value={task.status}
                    onChange={event => handleStatusChange(task.id, event.target.value)}
                  >
                    {boardConfig.statuses.map(status => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <span className="list-view__owner">{activeMembers[task.assignee]?.name}</span>
                  <span className="list-view__checklist">{`${done}/${total}`}</span>
                </article>
              );
            })
          )}
        </div>
      </section>

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          task={selectedTask}
          status={selectedStatus}
          assignee={activeMembers[selectedTask.assignee]}
          boardConfig={boardConfig}
          onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
          onClose={() => setSelectedTaskId("")}
        />
      ) : null}
    </AppShell>
  );
}

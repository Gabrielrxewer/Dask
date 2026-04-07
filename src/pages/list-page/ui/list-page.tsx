import { useMemo, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { TaskDetailsModal } from "@/widgets/task-details";
import { currentUserId, membersById } from "@/entities/member";
import {
  buildBoardMetrics,
  buildTaskTypeMetaMap,
  factoryBoardConfig,
  initialTasks,
  type Task,
  type TaskStatusId
} from "@/entities/task";
import {
  applyDashboardFilter,
  initialDashboardFilter,
  type DashboardFilterState
} from "@/features/dashboard-filter";
import { createMockTask } from "@/features/create-task";
import { moveTaskToStatus } from "@/features/change-status";
import "./list-page.css";

export function ListPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<DashboardFilterState>(initialDashboardFilter);
  const [createdCount, setCreatedCount] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState("");

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, membersById, currentUserId),
    [tasks, filter]
  );

  const metrics = useMemo(() => buildBoardMetrics(filteredTasks), [filteredTasks]);
  const taskTypeMap = useMemo(() => buildTaskTypeMetaMap(factoryBoardConfig.taskTypes), []);

  const selectedTask = useMemo(
    () => filteredTasks.find(task => task.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId]
  );

  const selectedStatus = useMemo(
    () =>
      selectedTask
        ? factoryBoardConfig.statuses.find(status => status.id === selectedTask.status) ?? null
        : null,
    [selectedTask]
  );

  const handleCreateTask = () => {
    setTasks(prevTasks => [createMockTask(createdCount), ...prevTasks]);
    setCreatedCount(prev => prev + 1);
  };

  const handleToggleChecklistItem = (taskId: string, itemId: string) => {
    setTasks(prevTasks =>
      prevTasks.map(task => {
        if (task.id !== taskId) {
          return task;
        }

        return {
          ...task,
          checklist: {
            items: task.checklist.items.map(item =>
              item.id === itemId ? { ...item, done: !item.done } : item
            )
          }
        };
      })
    );
  };

  const handleStatusChange = (taskId: string, statusId: TaskStatusId) => {
    setTasks(prevTasks => moveTaskToStatus(prevTasks, taskId, statusId));
  };

  return (
    <AppShell
      metrics={metrics}
      pageTitle="Lista de cards"
      filter={filter}
      onFilterQueryChange={query => setFilter(prev => ({ ...prev, query }))}
      onMineToggle={() => setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }))}
      onCreateTask={handleCreateTask}
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
          {filteredTasks.map(task => {
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
                  {factoryBoardConfig.statuses.map(status => (
                    <option key={status.id} value={status.id}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <span className="list-view__owner">{membersById[task.assignee]?.name}</span>
                <span className="list-view__checklist">{`${done}/${total}`}</span>
              </article>
            );
          })}
        </div>
      </section>

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          task={selectedTask}
          status={selectedStatus}
          assignee={membersById[selectedTask.assignee]}
          boardConfig={factoryBoardConfig}
          onToggleChecklistItem={handleToggleChecklistItem}
          onClose={() => setSelectedTaskId("")}
        />
      ) : null}
    </AppShell>
  );
}

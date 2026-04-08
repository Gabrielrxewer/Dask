import { useMemo, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { TaskDetailsModal } from "@/widgets/task-details";
import { currentUserId, membersById } from "@/entities/member";
import {
  buildBoardMetrics,
  buildTaskTypeMetaMap,
  factoryBoardConfig
} from "@/entities/task";
import {
  applyDashboardFilter,
  initialDashboardFilter,
  type DashboardFilterState
} from "@/features/dashboard-filter";
import { useWorkspace } from "@/modules/workspace";
import "./timeline-page.css";

function toDateStamp(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
}

export function TimelinePage() {
  const { snapshot, isLoading, createTask, toggleChecklistItem } = useWorkspace();
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
  const typeMap = useMemo(() => buildTaskTypeMetaMap(boardConfig.taskTypes), [boardConfig.taskTypes]);

  const sortedTasks = useMemo(
    () => [...filteredTasks].sort((a, b) => toDateStamp(a.due) - toDateStamp(b.due)),
    [filteredTasks]
  );

  const selectedTask = useMemo(
    () => filteredTasks.find(task => task.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId]
  );

  const selectedStatus = useMemo(
    () => (selectedTask ? boardConfig.statuses.find(status => status.id === selectedTask.status) ?? null : null),
    [selectedTask, boardConfig.statuses]
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

  return (
    <AppShell
      metrics={metrics}
      pageTitle="Timeline"
      filter={filter}
      onFilterQueryChange={query => setFilter(prev => ({ ...prev, query }))}
      onMineToggle={() => setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }))}
      onCreateTask={() => void createTask()}
    >
      <BoardMetrics metrics={metrics} />

      <section className="timeline-view">
        <header className="timeline-view__head">
          <span>Cards</span>
          <span>Janela de entrega</span>
        </header>

        <div className="timeline-view__rows">
          {isLoading ? (
            <article className="timeline-view__empty">Carregando workspace...</article>
          ) : sortedTasks.length === 0 ? (
            <article className="timeline-view__empty">Nenhum card com prazo encontrado.</article>
          ) : (
            sortedTasks.map(task => {
              const taskStamp = toDateStamp(task.due);
              const offset = ((taskStamp - dateRange.min) / range) * 100;
              const width = 14;
              const done = task.checklist.items.filter(item => item.done).length;
              const total = task.checklist.items.length;
              const type = typeMap[task.type];

              return (
                <article className="timeline-view__row" key={task.id}>
                  <button type="button" className="timeline-view__meta" onClick={() => setSelectedTaskId(task.id)}>
                    <strong>{task.title}</strong>
                    <p>{`${done}/${total} checklist`}</p>
                  </button>

                  <div className="timeline-view__lane">
                    <div className="timeline-view__track" />
                    <button
                      type="button"
                      className="timeline-view__bar"
                      style={{
                        left: `${Math.min(Math.max(offset, 0), 86)}%`,
                        width: `${width}%`,
                        background: type?.background ?? "#edf5ff",
                        borderColor: type?.border ?? "#cfe2ff",
                        color: type?.text ?? "#1d4e85"
                      }}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      {type?.label ?? task.type}
                      <span>{task.due}</span>
                    </button>
                  </div>
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

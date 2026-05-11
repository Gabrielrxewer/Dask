import type { PlannedTask, UnscheduledGroup } from "@/pages/agenda-page/ui/agenda-page.model";
import { toAgendaDayLabel, toHourLabel } from "@/pages/agenda-page/ui/agenda-page.model";

interface AgendaUnscheduledListProps {
  unscheduledGroups: UnscheduledGroup[];
  tasksOutsideAgenda: PlannedTask[];
  plannedTasksOutsideWeek: PlannedTask[];
  onSelectTask: (taskId: string) => void;
}

export function AgendaUnscheduledList({
  unscheduledGroups,
  tasksOutsideAgenda,
  plannedTasksOutsideWeek,
  onSelectTask
}: AgendaUnscheduledListProps) {
  const unscheduledTasks = unscheduledGroups.flatMap(group =>
    group.tasks.map(task => ({ task, groupLabel: group.label }))
  );
  const totalCount = unscheduledTasks.length + tasksOutsideAgenda.length + plannedTasksOutsideWeek.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <section className="agenda-view__unscheduled-strip" aria-label="Itens fora da grade da agenda">
      <span className="agenda-view__unscheduled-label">
        {`${totalCount} itens fora da grade atual`}
      </span>
      <div className="agenda-view__unscheduled-list">
        {tasksOutsideAgenda.map(({ task, window }) => (
          <button
            key={`outside-hours-${task.id}-${window.start}`}
            type="button"
            className="agenda-view__unscheduled-item"
            onClick={() => onSelectTask(task.id)}
          >
            <strong>{task.title}</strong>
            <span>Fora do horario visivel</span>
            <small>{`${toAgendaDayLabel(window.start)} - ${toHourLabel(window.start)} - ${toHourLabel(window.end)}`}</small>
          </button>
        ))}

        {plannedTasksOutsideWeek.map(({ task, window }) => (
          <button
            key={`outside-week-${task.id}-${window.start}`}
            type="button"
            className="agenda-view__unscheduled-item"
            onClick={() => onSelectTask(task.id)}
          >
            <strong>{task.title}</strong>
            <span>Agendado fora da semana</span>
            <small>{`${toAgendaDayLabel(window.start)} - ${toHourLabel(window.start)} - ${toHourLabel(window.end)}`}</small>
          </button>
        ))}

        {unscheduledTasks.map(({ task, groupLabel }) => (
          <button
            key={`unscheduled-${task.id}`}
            type="button"
            className="agenda-view__unscheduled-item"
            onClick={() => onSelectTask(task.id)}
          >
            <strong>{task.title}</strong>
            <span>Sem horario definido</span>
            <small>{groupLabel}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

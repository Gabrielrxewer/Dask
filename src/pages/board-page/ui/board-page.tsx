import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { BoardColumns } from "@/widgets/board-columns";
import {
  buildBoardMetrics,
  factoryBoardConfig,
  type Task,
  type TaskStatus,
  type TaskStatusId
} from "@/entities/task";
import { currentUserId, membersById } from "@/entities/member";
import {
  applyDashboardFilter,
  initialDashboardFilter,
  type DashboardFilterState
} from "@/features/dashboard-filter";
import { useWorkspace, type WorkspaceBoardMode } from "@/modules/workspace";
import "./board-page.css";

const modeOptions: Array<{ id: WorkspaceBoardMode; label: string; caption: string }> = [
  { id: "dev", label: "Dev", caption: "Execucao tecnica" },
  { id: "po", label: "PO", caption: "Planejamento" },
  { id: "manager", label: "Gerente", caption: "Portfolio" },
  { id: "qa", label: "QA", caption: "Qualidade" }
];

const poStatuses: TaskStatus[] = [
  { id: "plan-ideas", label: "Ideias", dot: "#8b9bb0" },
  { id: "plan-committed", label: "Planejado", dot: "#1976d2" },
  { id: "plan-building", label: "Construindo", dot: "#f59e0b" },
  { id: "plan-ready", label: "Pronto para entrega", dot: "#22c55e" }
];

const qaStatuses: TaskStatus[] = [
  { id: "qa-ready", label: "Liberado para teste", dot: "#4f8cff" },
  { id: "qa-testing", label: "Em teste", dot: "#f59e0b" },
  { id: "qa-approved", label: "Aprovado", dot: "#22c55e" },
  { id: "qa-rejected", label: "Reprovado", dot: "#e53935" }
];

const managerStatuses: TaskStatus[] = [
  { id: "mgr-epics", label: "Epicos", dot: "#7c3aed" },
  { id: "mgr-initiatives", label: "Iniciativas", dot: "#0d8df7" },
  { id: "mgr-risks", label: "Riscos", dot: "#ef4444" },
  { id: "mgr-delivery", label: "Entrega", dot: "#16a34a" }
];

function getCustomFieldString(task: Task, fieldId: string): string {
  const value = task.customFields[fieldId];
  return typeof value === "string" ? value : "";
}

function resolvePlanningStatus(task: Task): TaskStatusId {
  const customStatus = getCustomFieldString(task, "planningStatus");
  if (customStatus) {
    return customStatus;
  }

  if (task.status === "done") {
    return "plan-ready";
  }
  if (task.status === "review") {
    return "plan-building";
  }
  if (task.status === "doing") {
    return "plan-committed";
  }
  return "plan-ideas";
}

function resolveQaStatus(task: Task): TaskStatusId {
  const customStatus = getCustomFieldString(task, "qaStatus");
  if (customStatus) {
    return customStatus;
  }

  if (task.status === "done") {
    return "qa-approved";
  }
  if (task.status === "review") {
    return "qa-testing";
  }
  return "qa-ready";
}

function resolveManagerStatus(task: Task): TaskStatusId {
  const customStatus = getCustomFieldString(task, "managerLane");
  if (customStatus) {
    return customStatus;
  }

  if (task.type === "epic") {
    return "mgr-epics";
  }

  if (["user-story", "improvement", "research", "spike"].includes(task.type)) {
    return "mgr-initiatives";
  }

  if (["bug", "incident", "hotfix"].includes(task.type)) {
    return "mgr-risks";
  }

  return "mgr-delivery";
}

function checklistSummary(task: Task): { done: number; total: number; percent: number } {
  const total = task.checklist.items.length;
  const done = task.checklist.items.filter(item => item.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return { done, total, percent };
}

export function BoardPage() {
  const { snapshot, isLoading, createTask, moveTask, updateTaskCustomField, toggleChecklistItem } = useWorkspace();
  const [filter, setFilter] = useState<DashboardFilterState>(initialDashboardFilter);
  const [mode, setMode] = useState<WorkspaceBoardMode>("dev");
  const previousDefaultMode = useRef<WorkspaceBoardMode | null>(null);

  const tasks = snapshot?.tasks ?? [];
  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const activeMembers = snapshot?.membersById ?? membersById;
  const activeUser = snapshot?.currentUserId ?? currentUserId;

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const defaultMode = snapshot.preferences.defaultBoardMode;
    if (previousDefaultMode.current !== defaultMode) {
      previousDefaultMode.current = defaultMode;
      setMode(defaultMode);
    }
  }, [snapshot]);

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, activeMembers, activeUser),
    [tasks, filter, activeMembers, activeUser]
  );

  const devMetrics = useMemo(() => buildBoardMetrics(filteredTasks), [filteredTasks]);

  const planningTasks = useMemo(
    () => filteredTasks.map(task => ({ ...task, status: resolvePlanningStatus(task) })),
    [filteredTasks]
  );

  const qaTasks = useMemo(
    () => filteredTasks.map(task => ({ ...task, status: resolveQaStatus(task) })),
    [filteredTasks]
  );

  const managerTasks = useMemo(
    () =>
      filteredTasks
        .filter(task => ["epic", "user-story", "improvement", "research", "spike", "bug", "incident", "hotfix"].includes(task.type))
        .map(task => ({ ...task, status: resolveManagerStatus(task) })),
    [filteredTasks]
  );

  const activeStatuses =
    mode === "po"
      ? poStatuses
      : mode === "qa"
        ? qaStatuses
        : mode === "manager"
          ? managerStatuses
          : boardConfig.statuses;

  const activeBoardTasks =
    mode === "po" ? planningTasks : mode === "qa" ? qaTasks : mode === "manager" ? managerTasks : filteredTasks;

  const modeCards = useMemo(() => {
    if (mode === "po") {
      return [
        { label: "Backlog de ideias", value: planningTasks.filter(task => task.status === "plan-ideas").length },
        {
          label: "Comprometidos",
          value: planningTasks.filter(task => task.status === "plan-committed").length
        },
        { label: "Em construcao", value: planningTasks.filter(task => task.status === "plan-building").length },
        { label: "Prontos", value: planningTasks.filter(task => task.status === "plan-ready").length }
      ];
    }

    if (mode === "qa") {
      const approved = qaTasks.filter(task => task.status === "qa-approved").length;
      const total = qaTasks.length;
      const approveRate = total === 0 ? 0 : Math.round((approved / total) * 100);

      return [
        { label: "Liberado para teste", value: qaTasks.filter(task => task.status === "qa-ready").length },
        { label: "Em teste", value: qaTasks.filter(task => task.status === "qa-testing").length },
        { label: "Aprovados", value: approved },
        { label: "Taxa de aprovacao", value: `${approveRate}%` }
      ];
    }

    if (mode === "manager") {
      const epics = managerTasks.filter(task => task.status === "mgr-epics").length;
      const activeInitiatives = managerTasks.filter(task => task.status === "mgr-initiatives").length;
      const risks = managerTasks.filter(task => task.status === "mgr-risks").length;
      const avgProgress =
        managerTasks.length === 0
          ? 0
          : Math.round(
              managerTasks.reduce((sum, task) => sum + checklistSummary(task).percent, 0) / managerTasks.length
            );

      return [
        { label: "Epicos", value: epics },
        { label: "Iniciativas", value: activeInitiatives },
        { label: "Riscos", value: risks },
        { label: "Progresso medio", value: `${avgProgress}%` }
      ];
    }

    return [
      { label: "Total de cards", value: devMetrics.total },
      { label: "Em progresso", value: devMetrics.doing },
      { label: "Entrega esta semana", value: devMetrics.dueThisWeek },
      { label: "Concluido", value: `${devMetrics.donePercent}%` }
    ];
  }, [mode, planningTasks, qaTasks, managerTasks, devMetrics]);

  const handleMoveTask = (taskId: string, statusId: TaskStatusId) => {
    if (mode === "dev") {
      void moveTask(taskId, statusId);
      return;
    }

    if (mode === "po") {
      void updateTaskCustomField(taskId, "planningStatus", statusId);
      return;
    }

    if (mode === "qa") {
      void updateTaskCustomField(taskId, "qaStatus", statusId);
      return;
    }

    void updateTaskCustomField(taskId, "managerLane", statusId);
  };

  return (
    <AppShell
      metrics={devMetrics}
      filter={filter}
      onFilterQueryChange={query => setFilter(prev => ({ ...prev, query }))}
      onMineToggle={() => setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }))}
      onCreateTask={() => void createTask()}
    >
      <section className="board-mode-switch" aria-label="Modos do board">
        {modeOptions.map(option => (
          <button
            key={option.id}
            type="button"
            className={`board-mode-switch__button ${mode === option.id ? "is-active" : ""}`}
            onClick={() => setMode(option.id)}
          >
            <strong>{option.label}</strong>
            <span>{option.caption}</span>
          </button>
        ))}
      </section>

      <BoardMetrics metrics={devMetrics} cards={modeCards} />

      {isLoading ? (
        <section className="board-loading">Carregando workspace...</section>
      ) : (
        <BoardColumns
          statuses={activeStatuses}
          boardConfig={boardConfig}
          tasks={activeBoardTasks}
          membersById={activeMembers}
          onMoveTask={handleMoveTask}
          onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
        />
      )}
    </AppShell>
  );
}

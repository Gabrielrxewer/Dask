import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { BoardColumns } from "@/widgets/board-columns";
import {
  buildBoardMetrics,
  factoryBoardConfig,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskStatusId
} from "@/entities/task";
import { currentUserId, membersById } from "@/entities/member";
import {
  applyDashboardFilter,
  useDashboardFilter
} from "@/features/dashboard-filter";
import { useWorkspace, type WorkspaceBoardMode } from "@/modules/workspace";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { LoadingState, Section, StatusBadge, Tabs } from "@/shared/ui";
import "./board-page.css";

/**
 * Constrói as colunas visuais do board a partir das board columns do backend,
 * remapeando o status de cada task para o ID da board column correspondente.
 *
 * Mapping:
 *   task.status (slug) → workflowState.id (UUID) → boardColumn.id (UUID)
 */
function buildBoardColumnsView(
  tasks: Task[],
  boardCols: ApiBoardColumn[],
  workflowStates: ApiWorkflowState[]
): { statuses: TaskStatus[]; tasks: Task[] } | null {
  if (boardCols.length === 0) return null;

  // slug → UUID
  const slugToUUID = new Map(workflowStates.map(s => [s.slug, s.id]));
  // UUID → board column
  const uuidToCol = new Map<string, ApiBoardColumn>();
  for (const col of boardCols) {
    for (const stateId of col.stateIds) {
      uuidToCol.set(stateId, col);
    }
  }

  // Converte board columns em TaskStatus[]
  const statuses: TaskStatus[] = boardCols.map(col => {
    const firstState = workflowStates.find(s => s.id === col.stateIds[0]);
    return {
      id: col.id,
      label: col.name,
      dot: firstState?.color ?? "#64748b"
    };
  });

  // Remapeia o status de cada task para o ID da board column
  const remappedTasks = tasks.map(task => {
    const stateUUID = slugToUUID.get(task.status);
    if (!stateUUID) return task;
    const col = uuidToCol.get(stateUUID);
    if (!col) return task;
    return { ...task, status: col.id };
  });

  return { statuses, tasks: remappedTasks };
}

export function BoardPage() {
  const {
    snapshot,
    isLoading,
    createTask,
    moveTask,
    updateTaskPriority,
    updateTaskCustomField,
    toggleChecklistItem,
    fetchBoardColumns,
    fetchWorkflowStates
  } = useWorkspace();
  const { filter, setQuery, toggleMineOnly } = useDashboardFilter();
  const [mode, setMode] = useState<WorkspaceBoardMode>("dev");
  const previousDefaultMode = useRef<WorkspaceBoardMode | null>(null);

  // Board columns e workflow states para renderização correta
  const [apiBoardCols, setApiBoardCols] = useState<ApiBoardColumn[]>([]);
  const [apiWorkflowStates, setApiWorkflowStates] = useState<ApiWorkflowState[]>([]);

  const loadBoardConfig = useCallback(async () => {
    const [cols, states] = await Promise.all([fetchBoardColumns(), fetchWorkflowStates()]);
    setApiBoardCols(cols.filter(c => c.isActive).sort((a, b) => a.order - b.order));
    setApiWorkflowStates(states.filter(s => s.isActive));
  }, [fetchBoardColumns, fetchWorkflowStates]);

  useEffect(() => {
    void loadBoardConfig();
  }, [loadBoardConfig]);

  const tasks = snapshot?.tasks ?? [];
  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const boardConfig = {
    ...factoryBoardConfig,
    ...rawBoardConfig,
    statuses: Array.isArray(rawBoardConfig?.statuses) ? rawBoardConfig.statuses : factoryBoardConfig.statuses,
    taskTypes: Array.isArray(rawBoardConfig?.taskTypes) ? rawBoardConfig.taskTypes : factoryBoardConfig.taskTypes,
    fieldDefinitions: Array.isArray(rawBoardConfig?.fieldDefinitions)
      ? rawBoardConfig.fieldDefinitions
      : factoryBoardConfig.fieldDefinitions,
    cardLayout: {
      // Preferências do usuário sobrepõem o config do servidor
      visibleFieldIds: snapshot?.preferences.visibleCardFieldIds ??
        (Array.isArray(rawBoardConfig?.cardLayout?.visibleFieldIds)
          ? rawBoardConfig.cardLayout.visibleFieldIds
          : factoryBoardConfig.cardLayout.visibleFieldIds),
      // Visibilidade por tipo de work item
      visibleFieldIdsByType: snapshot?.preferences.visibleFieldsByType ?? {}
    },
    views: Array.isArray(rawBoardConfig?.views) ? rawBoardConfig.views : []
  };
  const activeMembers = snapshot?.membersById ?? membersById;
  const activeUser = snapshot?.currentUserId ?? currentUserId;
  const boardViews =
    boardConfig.views.length > 0
      ? boardConfig.views
      : [{
          id: "dev",
          label: "Perspective",
          caption: "Fluxo operacional principal",
          statuses: boardConfig.statuses,
          statusSource: { kind: "workflow_state" as const }
        }];

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const defaultMode =
      boardViews.find(view => view.id === snapshot.preferences.defaultBoardMode)?.id ??
      boardViews[0]?.id ??
      "dev";

    if (previousDefaultMode.current !== defaultMode) {
      previousDefaultMode.current = defaultMode;
      setMode(defaultMode);
    }
  }, [snapshot, boardViews]);

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, boardConfig, activeMembers, activeUser),
    [tasks, filter, boardConfig, activeMembers, activeUser]
  );

  const devMetrics = useMemo(() => buildBoardMetrics(tasks), [tasks]);
  const activeView = boardViews.find(view => view.id === mode) ?? boardViews[0];

  const mapTasksForView = useMemo(
    () => (sourceTasks: typeof tasks) => {
      if (!activeView) {
        return sourceTasks;
      }

      const filteredByType =
        activeView.allowedTaskTypes && activeView.allowedTaskTypes.length > 0
          ? sourceTasks.filter(task => activeView.allowedTaskTypes?.includes(task.type))
          : sourceTasks;

      return filteredByType.map(task => {
        if (activeView.statusSource.kind === "workflow_state") {
          return task;
        }

        const rawValue = task.customFields[activeView.statusSource.fieldId];
        if (typeof rawValue === "string" && rawValue.trim().length > 0) {
          return { ...task, status: rawValue };
        }

        const fallback =
          activeView.statusSource.fallbackByStatus?.[task.status] ??
          activeView.statuses[0]?.id ??
          task.status;

        return { ...task, status: fallback };
      });
    },
    [activeView]
  );

  // Tenta usar board columns; cai de volta para workflow states do snapshot
  const boardColumnsView = useMemo(
    () => buildBoardColumnsView(mapTasksForView(filteredTasks), apiBoardCols, apiWorkflowStates),
    [apiBoardCols, apiWorkflowStates, filteredTasks, mapTasksForView]
  );
  const boardColumnsViewAll = useMemo(
    () => buildBoardColumnsView(mapTasksForView(tasks), apiBoardCols, apiWorkflowStates),
    [apiBoardCols, apiWorkflowStates, tasks, mapTasksForView]
  );

  const activeStatuses = boardColumnsView?.statuses ?? activeView?.statuses ?? boardConfig.statuses;
  const activeBoardTasks = boardColumnsView?.tasks ?? mapTasksForView(filteredTasks);
  const activeViewTasks = boardColumnsViewAll?.tasks ?? mapTasksForView(tasks);

  const modeCards = useMemo(() => {
    if (!activeView || activeStatuses.length === 0) {
      return [
        { label: "Total de cards", value: devMetrics.total },
        { label: "Em progresso", value: devMetrics.doing },
        { label: "Entrega esta semana", value: devMetrics.dueThisWeek },
        { label: "Concluido", value: `${devMetrics.donePercent}%` }
      ];
    }

    const firstStatus = activeStatuses[0];
    const lastStatus = activeStatuses[activeStatuses.length - 1];
    const firstCount = firstStatus ? activeViewTasks.filter(task => task.status === firstStatus.id).length : 0;
    const doneCount = lastStatus ? activeViewTasks.filter(task => task.status === lastStatus.id).length : 0;
    const donePercent = activeViewTasks.length > 0 ? Math.round((doneCount / activeViewTasks.length) * 100) : 0;

    return [
      { label: "Total de cards", value: activeViewTasks.length },
      { label: firstStatus?.label ?? "Primeira coluna", value: firstCount },
      { label: lastStatus?.label ?? "Ultima coluna", value: doneCount },
      { label: "Concluido", value: `${donePercent}%` }
    ];
  }, [activeView, activeStatuses, activeViewTasks, devMetrics]);

  const handleMoveTask = (taskId: string, statusId: TaskStatusId) => {
    // Se estiver usando board columns, converte o column ID para o slug do
    // primeiro workflow state dessa coluna antes de chamar moveTask
    if (apiBoardCols.length > 0) {
      const col = apiBoardCols.find(c => c.id === statusId);
      if (col && col.stateIds.length > 0) {
        const firstState = apiWorkflowStates.find(s => s.id === col.stateIds[0]);
        if (firstState) {
          void moveTask(taskId, firstState.slug);
          return;
        }
      }
    }

    if (!activeView || activeView.statusSource.kind === "workflow_state") {
      void moveTask(taskId, statusId);
      return;
    }

    void updateTaskCustomField(taskId, activeView.statusSource.fieldId, statusId);
  };

  const handleUpdatePriority = (taskId: string, priority: TaskPriority) => {
    void updateTaskPriority(taskId, priority);
  };

  const boardSubtitle =
    activeBoardTasks.length === 0 && filter.query.trim().length > 0
      ? "Nenhum item encontrado para essa busca."
      : activeView?.caption ?? "Acompanhe o andamento das entregas em colunas.";

  const topNavigation = (
    <section className="board-top-nav" aria-label="Navegacao de visao operacional">
      <Tabs
        value={mode}
        items={boardViews.map(option => ({ id: option.id, label: option.label }))}
        onChange={setMode}
        className="board-top-nav__tabs"
      />
    </section>
  );

  return (
    <AppShell
      metrics={devMetrics}
      noPageScroll
      hideSidebarBrandMark
      topNavigation={topNavigation}
      filter={filter}
      onFilterQueryChange={setQuery}
      onMineToggle={toggleMineOnly}
      onCreateTask={input => void createTask(input)}
      createTaskTypes={boardConfig.taskTypes.map((taskType) => ({ id: taskType.id, label: taskType.label }))}
    >
      <div className="board-view">
        <BoardMetrics metrics={devMetrics} cards={modeCards} className="board-view__metrics" />

        <Section
          title={activeView ? `Quadro ${activeView.label}` : "Quadro"}
          subtitle={boardSubtitle}
          actions={<StatusBadge>{`${activeBoardTasks.length} itens visiveis`}</StatusBadge>}
          className="board-view__canvas"
        >
          {isLoading ? (
            <LoadingState text="Carregando workspace..." />
          ) : (
            <BoardColumns
              statuses={activeStatuses}
              boardConfig={boardConfig}
              tasks={activeBoardTasks}
              membersById={activeMembers}
              compactCards={Boolean(activeView?.compactCards)}
              onMoveTask={handleMoveTask}
              onUpdatePriority={handleUpdatePriority}
              onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
            />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

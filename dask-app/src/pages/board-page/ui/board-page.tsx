import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { BoardColumns } from "@/widgets/board-columns";
import {
  applyFieldCapabilityOverrides,
  buildBoardMetrics,
  factoryBoardConfig,
  mergeCardFieldDefinitions,
  type BoardConfig,
  type Task,
  type TaskCustomFieldValue,
  type TaskPriority,
  type TaskStatus,
  type TaskStatusId
} from "@/entities/task";
import { currentUserId, membersById } from "@/entities/member";
import {
  applyDashboardFilter,
  DashboardFilter,
  useDashboardFilter
} from "@/features/dashboard-filter";
import { useWorkspace, type WorkspaceBoardMode } from "@/modules/workspace";
import type { AiAgentSummary, ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { LoadingState, Section, StatusBadge, Tabs } from "@/shared/ui";
import "./board-page.css";

/**
 * Constroi as colunas visuais do board a partir das board columns do backend,
 * remapeando o status de cada task para o ID da board column correspondente.
 *
 * Mapping:
 *   task.status (slug) -> workflowState.id (UUID) -> boardColumn.id (UUID)
 */
function buildBoardColumnsView(
  tasks: Task[],
  boardCols: ApiBoardColumn[],
  workflowStates: ApiWorkflowState[],
  visibleBoardColumnIds?: string[]
): { statuses: TaskStatus[]; tasks: Task[] } | null {
  if (boardCols.length === 0) return null;

  const visibleSet =
    Array.isArray(visibleBoardColumnIds) && visibleBoardColumnIds.length > 0
      ? new Set(visibleBoardColumnIds)
      : null;
  const scopedColumns = visibleSet ? boardCols.filter(column => visibleSet.has(column.id)) : boardCols;

  if (scopedColumns.length === 0) return null;

  const slugToUUID = new Map(workflowStates.map(s => [s.slug, s.id]));
  const uuidToCol = new Map<string, ApiBoardColumn>();
  for (const col of scopedColumns) {
    for (const stateId of col.stateIds) {
      uuidToCol.set(stateId, col);
    }
  }

  const statuses: TaskStatus[] = scopedColumns.map(col => {
    const firstState = workflowStates.find(s => s.id === col.stateIds[0]);
    return {
      id: col.id,
      label: col.name,
      dot: firstState?.color ?? "#64748b"
    };
  });

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
    moveTaskToColumn,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    toggleChecklistItem,
    fetchBoardColumns,
    fetchWorkflowStates,
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis
  } = useWorkspace();
  const { filter, setQuery, toggleMineOnly } = useDashboardFilter();
  const [mode, setMode] = useState<WorkspaceBoardMode>("dev");
  const previousDefaultMode = useRef<WorkspaceBoardMode | null>(null);

  const [apiBoardCols, setApiBoardCols] = useState<ApiBoardColumn[]>([]);
  const [apiWorkflowStates, setApiWorkflowStates] = useState<ApiWorkflowState[]>([]);
  const [aiAgents, setAiAgents] = useState<AiAgentSummary[]>([]);

  const loadBoardConfig = useCallback(async () => {
    const [cols, states, agents] = await Promise.all([fetchBoardColumns(), fetchWorkflowStates(), listAiAgents()]);
    setApiBoardCols(cols.filter(c => c.isActive).sort((a, b) => a.order - b.order));
    setApiWorkflowStates(states.filter(s => s.isActive));
    setAiAgents(agents.filter(agent => agent.isActive));
  }, [fetchBoardColumns, fetchWorkflowStates, listAiAgents]);

  useEffect(() => {
    void loadBoardConfig();
  }, [loadBoardConfig]);

  const tasks = snapshot?.tasks ?? [];
  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const rawPerspectives: BoardConfig["perspectives"] =
    Array.isArray((rawBoardConfig as { perspectives?: unknown }).perspectives)
      ? (rawBoardConfig as { perspectives: BoardConfig["perspectives"] }).perspectives
      : Array.isArray((rawBoardConfig as { views?: unknown }).views)
        ? (rawBoardConfig as { views: BoardConfig["perspectives"] }).views
        : [];

  const boardConfig = {
    ...factoryBoardConfig,
    ...rawBoardConfig,
    statuses: Array.isArray(rawBoardConfig?.statuses) ? rawBoardConfig.statuses : factoryBoardConfig.statuses,
    taskTypes: Array.isArray(rawBoardConfig?.taskTypes) ? rawBoardConfig.taskTypes : factoryBoardConfig.taskTypes,
    fieldDefinitions: applyFieldCapabilityOverrides(
      mergeCardFieldDefinitions(
        Array.isArray(rawBoardConfig?.fieldDefinitions) ? rawBoardConfig.fieldDefinitions : factoryBoardConfig.fieldDefinitions
      ),
      snapshot?.preferences.settings
    ),
    cardLayout: {
      visibleFieldIds:
        snapshot?.preferences.visibleCardFieldIds ??
        (Array.isArray(rawBoardConfig?.cardLayout?.visibleFieldIds)
          ? rawBoardConfig.cardLayout.visibleFieldIds
          : factoryBoardConfig.cardLayout.visibleFieldIds),
      visibleFieldIdsByType: Object.entries(snapshot?.preferences.visibleFieldsByType ?? {}).reduce<Record<string, string[]>>(
        (acc, [typeId, fieldIds]) => {
          acc[typeId] = fieldIds;
          return acc;
        },
        {}
      ),
      detailVisibleFieldIdsByType: Object.entries(
        snapshot?.preferences.detailVisibleFieldsByType ?? {}
      ).reduce<Record<string, string[]>>((acc, [typeId, fieldIds]) => {
        acc[typeId] = fieldIds;
        return acc;
      }, {})
    },
    perspectives: rawPerspectives
  };

  const activeMembers = snapshot?.membersById ?? membersById;
  const activeUser = snapshot?.currentUserId ?? currentUserId;

  const boardPerspectives =
    boardConfig.perspectives.length > 0
      ? boardConfig.perspectives
      : [{
          id: "dev",
          label: "DEV",
          caption: "Fluxo operacional principal",
          statuses: boardConfig.statuses,
          statusSource: { kind: "workflow_state" as const }
        }];

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const defaultMode =
      boardPerspectives.find(perspective => perspective.id === snapshot.preferences.defaultBoardMode)?.id ??
      boardPerspectives[0]?.id ??
      "dev";

    if (previousDefaultMode.current !== defaultMode) {
      previousDefaultMode.current = defaultMode;
      setMode(defaultMode);
    }
  }, [snapshot, boardPerspectives]);

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, boardConfig, activeMembers, activeUser),
    [tasks, filter, boardConfig, activeMembers, activeUser]
  );

  const devMetrics = useMemo(() => buildBoardMetrics(tasks), [tasks]);
  const activePerspective = boardPerspectives.find(perspective => perspective.id === mode) ?? boardPerspectives[0];

  const mapTasksForPerspective = useMemo(
    () => (sourceTasks: typeof tasks) => {
      if (!activePerspective) {
        return sourceTasks;
      }

      const filteredByType =
        activePerspective.allowedTaskTypes && activePerspective.allowedTaskTypes.length > 0
          ? sourceTasks.filter(task => activePerspective.allowedTaskTypes?.includes(task.type))
          : sourceTasks;

      return filteredByType.map(task => {
        if (activePerspective.statusSource.kind === "workflow_state") {
          return task;
        }

        const rawValue = task.customFields[activePerspective.statusSource.fieldId];
        if (typeof rawValue === "string" && rawValue.trim().length > 0) {
          return { ...task, status: rawValue };
        }

        const fallback =
          activePerspective.statusSource.fallbackByStatus?.[task.status] ??
          activePerspective.statuses[0]?.id ??
          task.status;

        return { ...task, status: fallback };
      });
    },
    [activePerspective]
  );

  const useBoardColumnsProjection = activePerspective?.statusSource.kind === "workflow_state";

  const boardColumnsPerspective = useMemo(
    () =>
      useBoardColumnsProjection
        ? buildBoardColumnsView(
            mapTasksForPerspective(filteredTasks),
            apiBoardCols,
            apiWorkflowStates,
            activePerspective?.visibleBoardColumnIds
          )
        : null,
    [
      useBoardColumnsProjection,
      activePerspective?.visibleBoardColumnIds,
      apiBoardCols,
      apiWorkflowStates,
      filteredTasks,
      mapTasksForPerspective
    ]
  );
  const boardColumnsPerspectiveAll = useMemo(
    () =>
      useBoardColumnsProjection
        ? buildBoardColumnsView(
            mapTasksForPerspective(tasks),
            apiBoardCols,
            apiWorkflowStates,
            activePerspective?.visibleBoardColumnIds
          )
        : null,
    [
      useBoardColumnsProjection,
      activePerspective?.visibleBoardColumnIds,
      apiBoardCols,
      apiWorkflowStates,
      tasks,
      mapTasksForPerspective
    ]
  );

  const activeStatuses = boardColumnsPerspective?.statuses ?? activePerspective?.statuses ?? boardConfig.statuses;
  const activeBoardTasks = boardColumnsPerspective?.tasks ?? mapTasksForPerspective(filteredTasks);
  const activePerspectiveTasks = boardColumnsPerspectiveAll?.tasks ?? mapTasksForPerspective(tasks);

  const modeCards = useMemo(() => {
    if (!activePerspective || activeStatuses.length === 0) {
      return [
        { label: "Total de cards", value: devMetrics.total },
        { label: "Em progresso", value: devMetrics.doing },
        { label: "Entrega esta semana", value: devMetrics.dueThisWeek },
        { label: "Concluido", value: `${devMetrics.donePercent}%` }
      ];
    }

    const firstStatus = activeStatuses[0];
    const lastStatus = activeStatuses[activeStatuses.length - 1];
    const firstCount = firstStatus ? activePerspectiveTasks.filter(task => task.status === firstStatus.id).length : 0;
    const doneCount = lastStatus ? activePerspectiveTasks.filter(task => task.status === lastStatus.id).length : 0;
    const donePercent = activePerspectiveTasks.length > 0 ? Math.round((doneCount / activePerspectiveTasks.length) * 100) : 0;

    return [
      { label: "Total de cards", value: activePerspectiveTasks.length },
      { label: firstStatus?.label ?? "Primeira coluna", value: firstCount },
      { label: lastStatus?.label ?? "Ultima coluna", value: doneCount },
      { label: "Concluido", value: `${donePercent}%` }
    ];
  }, [activePerspective, activeStatuses, activePerspectiveTasks, devMetrics]);

  const handleMoveTask = (taskId: string, statusId: TaskStatusId) => {
    if (useBoardColumnsProjection && apiBoardCols.length > 0) {
      const col = apiBoardCols.find(c => c.id === statusId);
      if (col) {
        return moveTaskToColumn(taskId, col.id, col.stateIds[0]);
      }
    }

    if (!activePerspective || activePerspective.statusSource.kind === "workflow_state") {
      return moveTask(taskId, statusId);
    }

    return updateTaskCustomField(taskId, activePerspective.statusSource.fieldId, statusId);
  };

  const handleUpdatePriority = (taskId: string, priority: TaskPriority) => {
    return updateTaskPriority(taskId, priority);
  };

  const handleUpdateTaskTitle = (taskId: string, title: string) => {
    return updateTaskTitle(taskId, title);
  };

  const handleUpdateTaskDescription = (taskId: string, description: string) => {
    return updateTaskDescription(taskId, description);
  };

  const handleUpdateTaskCustomField = (taskId: string, fieldId: string, value: TaskCustomFieldValue) => {
    return updateTaskCustomField(taskId, fieldId, value);
  };

  const handleUpdateTaskSchedule = (
    taskId: string,
    input: { plannedStartAt?: string | null; plannedEndAt?: string | null }
  ) => {
    return updateTaskSchedule(taskId, input);
  };

  const boardSubtitle =
    activeBoardTasks.length === 0 && filter.query.trim().length > 0
      ? "Nenhum item encontrado para essa busca."
      : activePerspective?.caption ?? "Acompanhe o andamento das entregas em colunas.";

  const topNavigation = (
    <section className="board-top-nav" aria-label="Navegacao de perspectivas">
      <Tabs
        value={mode}
        items={boardPerspectives.map(option => ({ id: option.id, label: option.label }))}
        onChange={setMode}
        className="board-top-nav__tabs"
      />
    </section>
  );

  return (
    <AppShell
      metrics={devMetrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <div className="board-view">
        <BoardMetrics metrics={devMetrics} cards={modeCards} className="board-view__metrics" />

        <Section
          title={activePerspective ? `Quadro ${activePerspective.label}` : "Quadro"}
          subtitle={boardSubtitle}
          actions={
            <div className="board-view__section-actions">
              <DashboardFilter
                query={filter.query}
                mineOnly={filter.mineOnly}
                onQueryChange={setQuery}
                onMineToggle={toggleMineOnly}
              />
              <StatusBadge>{`${activeBoardTasks.length} itens visiveis`}</StatusBadge>
            </div>
          }
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
              compactCards={Boolean(activePerspective?.compactCards)}
              onCreateTask={input => void createTask(input)}
              createTaskTypes={boardConfig.taskTypes.map((taskType) => ({ id: taskType.id, label: taskType.label }))}
              onMoveTask={handleMoveTask}
              onUpdatePriority={handleUpdatePriority}
              onUpdateTaskTitle={handleUpdateTaskTitle}
              onUpdateTaskDescription={handleUpdateTaskDescription}
              onUpdateTaskCustomField={handleUpdateTaskCustomField}
              onUpdateTaskSchedule={handleUpdateTaskSchedule}
              onToggleChecklistItem={(taskId, itemId) => void toggleChecklistItem(taskId, itemId)}
              aiAgents={aiAgents}
              onRunAiAgentOnItem={runAiAgentOnItem}
              onRunAiRiskAnalysis={runAiRiskAnalysis}
            />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

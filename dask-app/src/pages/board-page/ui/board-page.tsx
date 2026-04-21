import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { BoardColumns } from "@/widgets/board-columns";
import { buildBoardColumnsRuntimeView, mapTasksForBoardPerspective } from "@/widgets/board-columns/model/board-runtime";
import {
  applyFieldCapabilityOverrides,
  buildBoardMetrics,
  factoryBoardConfig,
  mergeCardFieldDefinitions,
  type BoardConfig,
  type Task,
  type TaskCustomFieldValue,
  type TaskPriority,
  type TaskStatusId
} from "@/entities/task";
import { currentUserId, membersById } from "@/entities/member";
import {
  applyDashboardFilter,
  DashboardFilter,
  useDashboardFilter
} from "@/features/dashboard-filter";
import { useAuth } from "@/features/auth";
import { useWorkspace, type WorkspaceBoardMode } from "@/modules/workspace";
import type { AiAgentSummary, ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { LoadingState, Section, StatusBadge, Tabs } from "@/shared/ui";
import "./board-page.css";

export function BoardPage() {
  const { user } = useAuth();
  const {
    snapshot,
    isLoading,
    createTask,
    deleteTask,
    moveTask,
    moveTaskToColumn,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    updateTask,
    fetchBoardColumns,
    fetchWorkflowStates,
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis,
    listWorkspaceDocuments,
    listWorkItemLinkedDocuments,
    linkDocumentToWorkItem,
    unlinkDocumentFromWorkItem
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
    fieldBindings: Array.isArray(rawBoardConfig?.fieldBindings) ? rawBoardConfig.fieldBindings : factoryBoardConfig.fieldBindings,
    cardLayout: rawBoardConfig?.cardLayout ?? factoryBoardConfig.cardLayout,
    perspectives: rawPerspectives
  };

  const availableTags = (snapshot?.tags ?? [])
    .filter(tag => tag.isActive !== false)
    .map(tag => ({ id: tag.id, name: tag.name, color: tag.color }));
  const activeUser = snapshot?.currentUserId ?? currentUserId;
  const activeMembers = useMemo(() => {
    const sourceMembers = snapshot?.membersById ?? membersById;
    const userAvatarUrl = user?.avatarUrl ?? null;

    if (!userAvatarUrl) {
      return sourceMembers;
    }

    const authMemberId = user?.id ?? "";
    const memberId = authMemberId && sourceMembers[authMemberId] ? authMemberId : activeUser;
    const member = sourceMembers[memberId];

    if (!member) {
      return sourceMembers;
    }

    return {
      ...sourceMembers,
      [memberId]: {
        ...member,
        name: user?.name ?? member.name,
        avatarUrl: userAvatarUrl
      }
    };
  }, [activeUser, snapshot?.membersById, user?.avatarUrl, user?.id, user?.name]);

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
    () => (sourceTasks: typeof tasks) => mapTasksForBoardPerspective(sourceTasks, activePerspective),
    [activePerspective]
  );

  const useBoardColumnsProjection = activePerspective?.statusSource.kind === "workflow_state";

  const boardColumnsPerspective = useMemo(
    () =>
      useBoardColumnsProjection
        ? buildBoardColumnsRuntimeView(
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
        ? buildBoardColumnsRuntimeView(
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

  const handleMoveTask = (taskId: string, statusId: TaskStatusId, position?: number) => {
    if (useBoardColumnsProjection && apiBoardCols.length > 0) {
      const col = apiBoardCols.find(c => c.id === statusId);
      if (col) {
        return moveTaskToColumn(taskId, col.id, col.stateIds[0], position);
      }
    }

    if (!activePerspective || activePerspective.statusSource.kind === "workflow_state") {
      return moveTask(taskId, statusId);
    }

    return updateTaskCustomField(taskId, activePerspective.statusSource.fieldId, statusId);
  };

  const handleCreateTask = (statusId: TaskStatusId, input: Parameters<NonNullable<typeof createTask>>[0]) => {
    if (useBoardColumnsProjection && apiBoardCols.length > 0) {
      const col = apiBoardCols.find(column => column.id === statusId);
      if (col) {
        return createTask({
          ...input,
          columnId: col.id,
          stateId: col.stateIds[0],
          position: 0
        });
      }
    }

    return createTask({
      ...input,
      statusId,
      position: 0
    });
  };

  const handleUpdatePriority = (taskId: string, priority: TaskPriority) => {
    return updateTaskPriority(taskId, priority);
  };

  const handleDeleteTask = (taskId: string) => {
    return deleteTask(taskId);
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
      : "Controle das atividades com uma visao clara da fila de atendimento.";

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
      <div className="board-view workspace-view">
        <BoardMetrics metrics={devMetrics} cards={modeCards} className="board-view__metrics workspace-view__metrics" />

        <Section
          title="Board"
          subtitle={boardSubtitle}
          actions={
            <div className="board-view__section-actions workspace-view__actions">
              <DashboardFilter
                query={filter.query}
                mineOnly={filter.mineOnly}
                onQueryChange={setQuery}
                onMineToggle={toggleMineOnly}
              />
              <StatusBadge>{`${activeBoardTasks.length} itens visiveis`}</StatusBadge>
            </div>
          }
          className="board-view__canvas workspace-view__section"
        >
          {isLoading && !snapshot ? (
            <LoadingState text="Carregando workspace..." />
          ) : (
            <BoardColumns
              statuses={activeStatuses}
              boardConfig={boardConfig}
              tasks={activeBoardTasks}
              membersById={activeMembers}
              compactCards={Boolean(activePerspective?.compactCards)}
              onCreateTask={(statusId, input) => void handleCreateTask(statusId, input)}
              createTaskTypes={boardConfig.taskTypes.map((taskType) => ({ id: taskType.id, label: taskType.label }))}
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
              onUpdatePriority={handleUpdatePriority}
              onUpdateTaskTitle={handleUpdateTaskTitle}
              onUpdateTaskDescription={handleUpdateTaskDescription}
              onUpdateTaskCustomField={handleUpdateTaskCustomField}
              onUpdateTaskSchedule={handleUpdateTaskSchedule}
              onSaveTask={updateTask}
              aiAgents={aiAgents}
              availableTags={availableTags}
              onRunAiAgentOnItem={runAiAgentOnItem}
              onRunAiRiskAnalysis={runAiRiskAnalysis}
              listWorkspaceDocuments={listWorkspaceDocuments}
              listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
              linkDocumentToWorkItem={linkDocumentToWorkItem}
              unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
            />
          )}
        </Section>
      </div>
    </AppShell>
  );
}

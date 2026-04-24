import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardColumns } from "@/widgets/board-columns";
import { buildBoardColumnsRuntimeView, mapTasksForBoardPerspective } from "@/widgets/board-columns/model/board-runtime";
import {
  applyFieldDefinitionOverrides,
  applyFieldCapabilityOverrides,
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
import { LoadingState } from "@/shared/ui";
import { BoardPerspectiveTabs } from "./board-perspective-tabs";
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
      applyFieldDefinitionOverrides(
        mergeCardFieldDefinitions(
          Array.isArray(rawBoardConfig?.fieldDefinitions) ? rawBoardConfig.fieldDefinitions : factoryBoardConfig.fieldDefinitions
        ),
        snapshot?.preferences.settings
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

  const handleUpdateTaskChecklist = (taskId: string, checklist: Task["checklist"]) => {
    return updateTask(taskId, { checklist });
  };

  const topNavigation = (
    <section className="board-top-nav" aria-label="Navegacao de perspectivas">
      <BoardPerspectiveTabs
        perspectives={boardPerspectives.map(p => ({ id: p.id, label: p.label }))}
        value={mode}
        onChange={setMode}
      />
      <div className="board-top-nav__filter">
        <DashboardFilter
          query={filter.query}
          mineOnly={filter.mineOnly}
          onQueryChange={setQuery}
          onMineToggle={toggleMineOnly}
        />
      </div>
    </section>
  );

  return (
    <AppShell
      metrics={{
        total: 0,
        doing: 0,
        review: 0,
        done: 0,
        dueThisWeek: 0,
        donePercent: 0,
        active: 0
      }}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <div className="board-view workspace-view">
        <div className="board-view__canvas workspace-view__section">
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
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
              onUpdatePriority={handleUpdatePriority}
              onUpdateTaskTitle={handleUpdateTaskTitle}
              onUpdateTaskDescription={handleUpdateTaskDescription}
              onUpdateTaskCustomField={handleUpdateTaskCustomField}
              onUpdateTaskSchedule={handleUpdateTaskSchedule}
              onUpdateTaskChecklist={handleUpdateTaskChecklist}
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
        </div>
      </div>
    </AppShell>
  );
}

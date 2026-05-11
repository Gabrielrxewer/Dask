import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { buildWorkspaceDocumentationPathWithDoc } from "@/app/router";
import { AppShell } from "@/widgets/app-shell";
import { BoardColumns } from "@/widgets/board-columns";
import { buildBoardColumnsRuntimeView, mapTasksForBoardPerspective } from "@/widgets/board-columns/model/board-runtime";
import {
  type Task,
  type TaskCustomFieldValue,
  type TaskPriority,
  type TaskStatusId
} from "@/entities/task";
import { DashboardFilter } from "@/features/dashboard-filter";
import { useAuth } from "@/features/auth";
import {
  useWorkflowStatesQuery,
  useWorkspaceBoardsQuery,
  useWorkspaceTaskPage,
  useWorkspaceWorkItemActions,
  type CreateTaskInput,
  type WorkspaceBoardMode
} from "@/modules/workspace";
import { useCustomerLookupAction } from "@/modules/leads";
import type { AiAgentSummary } from "@/modules/workspace/model";
import { LoadingState, WorkspaceFrame } from "@/shared/ui";
import { BoardPerspectiveTabs } from "./board-perspective-tabs";
import "./board-page.css";

export function BoardPage() {
  const { user } = useAuth();
  const {
    snapshot,
    isLoading,
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis,
    listWorkspaceDocuments,
    createWorkspaceDocument,
    listWorkItemLinkedDocuments,
    linkDocumentToWorkItem,
    unlinkDocumentFromWorkItem,
    filter,
    setFilterQuery,
    toggleMineFilter,
    tasks,
    boardConfig,
    activeMembers,
    filteredTasks,
    metrics
  } = useWorkspaceTaskPage({ currentUser: user });
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const listCustomers = useCustomerLookupAction(workspaceSlug || null);
  const {
    createTask,
    deleteTask,
    moveTask,
    moveTaskToColumn,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    updateTask
  } = useWorkspaceWorkItemActions(workspaceSlug || null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOpenTaskId = searchParams.get("openTaskId") ?? "";
  const initialBoardMode = searchParams.get("boardMode") ?? "";
  const [mode, setMode] = useState<WorkspaceBoardMode>("dev");
  const previousDefaultMode = useRef<WorkspaceBoardMode | null>(null);

  const boardColumnsQuery = useWorkspaceBoardsQuery(workspaceSlug || null);
  const workflowStatesQuery = useWorkflowStatesQuery(workspaceSlug || null);
  const [aiAgents, setAiAgents] = useState<AiAgentSummary[]>([]);
  const isClient = snapshot?.access?.isClient || snapshot?.access?.role === "CLIENT";

  const apiBoardCols = useMemo(
    () => (boardColumnsQuery.data ?? []).filter(c => c.isActive).sort((a, b) => a.order - b.order),
    [boardColumnsQuery.data]
  );
  const apiWorkflowStates = useMemo(
    () => (workflowStatesQuery.data ?? []).filter(s => s.isActive),
    [workflowStatesQuery.data]
  );

  useEffect(() => {
    let mounted = true;
    if (isClient) {
      setAiAgents([]);
      return () => {
        mounted = false;
      };
    }
    void listAiAgents().then((agents) => {
      if (mounted) {
        setAiAgents(agents.filter(agent => agent.isActive));
      }
    });
    return () => {
      mounted = false;
    };
  }, [isClient, listAiAgents]);

  const availableTags = (snapshot?.tags ?? [])
    .filter(tag => tag.isActive !== false)
    .map(tag => ({ id: tag.id, name: tag.name, color: tag.color }));

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
      const modeToApply = (initialBoardMode && boardPerspectives.some(p => p.id === initialBoardMode))
        ? initialBoardMode as WorkspaceBoardMode
        : defaultMode;
      setMode(modeToApply);
    }
  }, [snapshot, boardPerspectives]);

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
  const createTaskStatusIds = useMemo(() => {
    if (!activePerspective || !Array.isArray(activePerspective.createTaskColumnIds)) {
      return undefined;
    }

    return activePerspective.createTaskColumnIds;
  }, [activePerspective]);

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

  const handleCreateTask = (statusId: TaskStatusId, input: CreateTaskInput) => {
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

  const handleOpenDocument = (documentId: string, taskId: string) => {
    if (workspaceSlug) {
      navigate(buildWorkspaceDocumentationPathWithDoc(workspaceSlug, documentId, taskId, mode));
    }
  };

  const topNavigation = (
    <section className="board-top-nav" aria-label="Navegacao de perspectivas">
      <BoardPerspectiveTabs
        perspectives={boardPerspectives.map(p => ({ id: p.id, label: p.label }))}
        value={mode}
        onChange={(nextMode) => {
          setMode(nextMode);
          setSearchParams({ boardMode: nextMode }, { replace: true });
        }}
      />
      <div className="board-top-nav__filter">
        <DashboardFilter
          query={filter.query}
          mineOnly={filter.mineOnly}
          onQueryChange={setFilterQuery}
          onMineToggle={toggleMineFilter}
        />
      </div>
    </section>
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="board-view" variant="kanban" scroll="none">
        <LoadingState text="Carregando quadro..." animation="board" variant="frame" visible={isLoading && !snapshot} />
        <div className="board-view__canvas workspace-view__section">
          {isLoading && !snapshot ? (
            null
          ) : (
            <BoardColumns
              statuses={activeStatuses}
              boardConfig={boardConfig}
              tasks={activeBoardTasks}
              membersById={activeMembers}
              compactCards={Boolean(activePerspective?.compactCards)}
              onCreateTask={(statusId, input) => void handleCreateTask(statusId, input)}
              createTaskStatusIds={createTaskStatusIds}
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
              createWorkspaceDocument={createWorkspaceDocument}
              listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
              linkDocumentToWorkItem={linkDocumentToWorkItem}
              unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
              onOpenDocument={handleOpenDocument}
              listCustomers={listCustomers}
              initialSelectedTaskId={initialOpenTaskId}
            />
          )}
        </div>
      </WorkspaceFrame>
    </AppShell>
  );
}

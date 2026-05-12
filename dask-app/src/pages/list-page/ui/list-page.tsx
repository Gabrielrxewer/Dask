import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { Task, TaskStatusId } from "@/entities/task";
import { useAuth } from "@/features/auth";
import { DashboardFilter } from "@/features/dashboard-filter";
import { CreateTaskButton } from "@/features/create-task";
import { WorkItemDataGrid } from "@/features/work-item-list/ui/WorkItemDataGrid";
import {
  WorkItemListFilterBar,
  type WorkItemListAdvancedFilterState
} from "@/features/work-item-list/ui/WorkItemListFilterBar";
import { WorkItemMobileList } from "@/features/work-item-list/ui/WorkItemMobileList";
import {
  useUpdateWorkItemListConfigMutation,
  useUpdateWorkItemStatusMutation,
  useBulkUpdateWorkItemsMutation,
  readWorkItemListConfigs,
  useWorkItemListConfigQuery,
  useWorkItemListQuery,
  workItemListQueryKeys,
  type WorkItemListConfig,
  type WorkItemListParams
} from "@/modules/work-item-list";
import { useAiWorkItemActions } from "@/modules/ai";
import { useWorkspaceDocumentActions } from "@/modules/documentation";
import {
  useWorkspaceCustomerLookupAction,
  useWorkspaceTaskPage,
  useWorkspaceWorkItemActions,
  type AiAgentSummary,
  type CreateTaskInput,
  type UpdateTaskInput
} from "@/modules/workspace";
import { AppSelect, LoadingState, ResourceListPageTemplate } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { TaskDetailsModal } from "@/widgets/task-details";
import "./list-page.css";

type ListSortBy = NonNullable<WorkItemListParams["sortBy"]>;

interface ListSortState {
  sortBy?: ListSortBy;
  sortDirection?: "asc" | "desc";
}

export function ListPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    snapshot,
    isLoading,
    boardConfig,
    activeMembers,
    metrics
  } = useWorkspaceTaskPage({ currentUser: user });
  const {
    createTask,
    moveTask,
    updateTaskPriority,
    updateTaskTitle,
    updateTaskDescription,
    updateTaskCustomField,
    updateTaskSchedule,
    updateTask
  } = useWorkspaceWorkItemActions(workspaceSlug || null);
  const {
    listAiAgents,
    runAiAgentOnItem,
    runAiRiskAnalysis
  } = useAiWorkItemActions(workspaceSlug || null);
  const {
    listWorkspaceDocuments,
    listWorkItemLinkedDocuments,
    linkDocumentToWorkItem,
    unlinkDocumentFromWorkItem
  } = useWorkspaceDocumentActions(workspaceSlug || null);
  const listCustomers = useWorkspaceCustomerLookupAction(workspaceSlug || null);

  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<WorkItemListAdvancedFilterState>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 });
  const [sorting, setSorting] = useState<ListSortState>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const attemptedConfigPersistenceRef = useRef(new Set<string>());

  const invalidateListQueries = useCallback(() => {
    if (!workspaceSlug) {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: workItemListQueryKeys.lists(workspaceSlug) });
  }, [queryClient, workspaceSlug]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const handleMineToggle = useCallback(() => {
    setMineOnly((current) => !current);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const handleTypeChange = useCallback((value: string) => {
    setSelectedTypeId(value);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const handleAdvancedFiltersChange = useCallback((patch: Partial<WorkItemListAdvancedFilterState>) => {
    setAdvancedFilters((current) => ({ ...current, ...patch }));
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const handleAdvancedFiltersClear = useCallback(() => {
    setAdvancedFilters({});
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const handleSortChange = useCallback((nextSorting: ListSortState) => {
    setSorting(nextSorting);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const configTypeId = useMemo(
    () => selectedTypeId === "all" ? boardConfig.taskTypes[0]?.id ?? "task" : selectedTypeId,
    [boardConfig.taskTypes, selectedTypeId]
  );

  useEffect(() => {
    if (
      selectedTypeId !== "all" &&
      boardConfig.taskTypes.length > 0 &&
      !boardConfig.taskTypes.some((type) => type.id === selectedTypeId)
    ) {
      setSelectedTypeId("all");
    }
  }, [boardConfig.taskTypes, selectedTypeId]);

  const listParams = useMemo<Partial<WorkItemListParams>>(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: query,
      assignedToMe: mineOnly || undefined,
      workflowStateId: advancedFilters.workflowStateId,
      assigneeId: mineOnly ? undefined : advancedFilters.assigneeId,
      dueDateFrom: advancedFilters.dueDateFrom || undefined,
      dueDateTo: advancedFilters.dueDateTo || undefined,
      typeSlug: selectedTypeId !== "all" ? selectedTypeId : undefined,
      ...(sorting.sortBy
        ? {
            sortBy: sorting.sortBy,
            sortDirection: sorting.sortDirection ?? "asc"
          }
        : {})
    }),
    [
      advancedFilters.assigneeId,
      advancedFilters.dueDateFrom,
      advancedFilters.dueDateTo,
      advancedFilters.workflowStateId,
      mineOnly,
      pagination.pageIndex,
      pagination.pageSize,
      query,
      selectedTypeId,
      sorting.sortBy,
      sorting.sortDirection
    ]
  );

  const listQuery = useWorkItemListQuery(workspaceSlug, listParams);
  const configQuery = useWorkItemListConfigQuery(workspaceSlug, {
    workItemTypeId: configTypeId,
    boardConfig,
    settings: snapshot?.preferences.settings
  });
  const updateStatusMutation = useUpdateWorkItemStatusMutation(workspaceSlug);
  const bulkUpdateMutation = useBulkUpdateWorkItemsMutation(workspaceSlug);
  const updateConfigMutation = useUpdateWorkItemListConfigMutation(workspaceSlug);

  const items = listQuery.data?.items ?? [];
  const totalCount = listQuery.data?.totalCount ?? listQuery.data?.total ?? 0;
  const pageCount = listQuery.data?.pageInfo?.totalPages ?? Math.max(1, Math.ceil(totalCount / pagination.pageSize));
  const selectedStatus = useMemo(
    () => selectedTask ? boardConfig.statuses.find((status) => status.id === selectedTask.status) ?? null : null,
    [boardConfig.statuses, selectedTask]
  );

  useEffect(() => {
    const selectedTaskId = selectedTask?.id;
    if (!selectedTaskId) {
      return;
    }
    const nextTask = items.find((item) => item.id === selectedTaskId);
    if (nextTask) {
      setSelectedTask(nextTask);
    }
  }, [items, selectedTask?.id]);

  useEffect(() => {
    let mounted = true;
    void listAiAgents().then((result) => {
      if (mounted) {
        setAgents(result.filter((agent) => agent.isActive));
      }
    });
    return () => {
      mounted = false;
    };
  }, [listAiAgents]);

  const handleCreateTask = useCallback(
    async (input: CreateTaskInput) => {
      await createTask(input);
      invalidateListQueries();
    },
    [createTask, invalidateListQueries]
  );

  const handleStatusChange = useCallback(
    async (taskId: string, statusId: TaskStatusId) => {
      await updateStatusMutation.mutateAsync({ taskId, statusId });
    },
    [updateStatusMutation]
  );

  const handleBulkStatusChange = useCallback(
    async (taskIds: string[], statusId: TaskStatusId) => {
      await bulkUpdateMutation.mutateAsync({ itemIds: taskIds, patch: { statusId } });
    },
    [bulkUpdateMutation]
  );

  const handleBulkAssigneeChange = useCallback(
    async (taskIds: string[], assigneeId: string) => {
      await bulkUpdateMutation.mutateAsync({ itemIds: taskIds, patch: { assigneeId } });
    },
    [bulkUpdateMutation]
  );

  const handleBulkArchive = useCallback(
    async (taskIds: string[]) => {
      await bulkUpdateMutation.mutateAsync({ itemIds: taskIds, patch: { archived: true } });
    },
    [bulkUpdateMutation]
  );

  const handleConfigChange = useCallback(
    (config: WorkItemListConfig) => {
      updateConfigMutation.mutate(config);
    },
    [updateConfigMutation]
  );

  useEffect(() => {
    if (!configQuery.data || updateConfigMutation.isPending) {
      return;
    }

    const persistedConfig = readWorkItemListConfigs(snapshot?.preferences.settings)[configQuery.data.workItemTypeId];
    if (persistedConfig) {
      return;
    }
    if (attemptedConfigPersistenceRef.current.has(configQuery.data.workItemTypeId)) {
      return;
    }

    attemptedConfigPersistenceRef.current.add(configQuery.data.workItemTypeId);
    updateConfigMutation.mutate({ config: configQuery.data, silent: true });
  }, [configQuery.data, snapshot?.preferences.settings, updateConfigMutation]);

  const handleModalStatusChange = useCallback(
    async (taskId: string, statusId: TaskStatusId) => {
      await moveTask(taskId, statusId);
      invalidateListQueries();
    },
    [invalidateListQueries, moveTask]
  );

  const handleModalTaskSave = useCallback(
    async (taskId: string, input: UpdateTaskInput) => {
      await updateTask(taskId, input);
      invalidateListQueries();
    },
    [invalidateListQueries, updateTask]
  );

  const handleOpenTask = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleCloseTask = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const typeOptions = useMemo(
    () => [
      { value: "all", label: "Todos os tipos" },
      ...boardConfig.taskTypes.map((type) => ({ value: type.id, label: type.label }))
    ],
    [boardConfig.taskTypes]
  );

  const topNavigation = (
    <section className="list-top-nav" aria-label="Filtro da lista">
      <CreateTaskButton
        className="list-top-nav__create-task"
        onCreate={handleCreateTask}
        initialStatusId={boardConfig.statuses[0]?.id ?? "backlog"}
        statuses={boardConfig.statuses}
        boardConfig={boardConfig}
        membersById={activeMembers}
        taskTypes={boardConfig.taskTypes}
        iconOnly
      />
      <AppSelect
        className="list-top-nav__type-select"
        value={selectedTypeId}
        items={typeOptions}
        onValueChange={handleTypeChange}
        aria-label="Tipo de work item"
      />
      <div className="list-top-nav__filter">
        <DashboardFilter
          query={query}
          mineOnly={mineOnly}
          onQueryChange={handleQueryChange}
          onMineToggle={handleMineToggle}
        />
      </div>
    </section>
  );

  const loading = (isLoading && items.length === 0) || configQuery.isLoading || listQuery.isLoading;
  const error = listQuery.error ?? configQuery.error;
  const config = configQuery.data;

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <ResourceListPageTemplate
        frameClassName="list-view"
        title={null}
        sectionClassName="list-view__section workspace-view__section"
        loading={
          <LoadingState
            text="Carregando lista..."
            animation="list"
            variant="frame"
            visible={loading && items.length === 0}
          />
        }
      >
        {config ? (
          <>
            <WorkItemListFilterBar
              value={advancedFilters}
              statuses={boardConfig.statuses}
              membersById={activeMembers}
              assigneeDisabled={mineOnly}
              onChange={handleAdvancedFiltersChange}
              onClear={handleAdvancedFiltersClear}
            />
            <div className="list-view__desktop-grid">
              <WorkItemDataGrid
                items={items}
                config={config}
                boardConfig={boardConfig}
                statuses={boardConfig.statuses}
                membersById={activeMembers}
                loading={loading}
                error={error}
                totalCount={totalCount}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                pageCount={pageCount}
                sortBy={sorting.sortBy}
                sortDirection={sorting.sortDirection}
                onOpenTask={handleOpenTask}
                onStatusChange={handleStatusChange}
                onBulkStatusChange={handleBulkStatusChange}
                onBulkAssigneeChange={handleBulkAssigneeChange}
                onBulkArchive={handleBulkArchive}
                onPaginationChange={setPagination}
                onSortChange={handleSortChange}
                onConfigChange={handleConfigChange}
              />
            </div>
            <div className="list-view__mobile-list">
              <WorkItemMobileList
                items={items}
                config={config}
                boardConfig={boardConfig}
                statuses={boardConfig.statuses}
                membersById={activeMembers}
                loading={loading}
                error={error}
                totalCount={totalCount}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                pageCount={pageCount}
                onOpenTask={handleOpenTask}
                onStatusChange={handleStatusChange}
                onPaginationChange={setPagination}
              />
            </div>
          </>
        ) : (
          <LoadingState text="Preparando configuracao da lista..." animation="list" variant="frame" visible />
        )}
      </ResourceListPageTemplate>

      {selectedTask && selectedStatus ? (
        <TaskDetailsModal
          mode="edit"
          task={selectedTask}
          status={selectedStatus}
          statuses={boardConfig.statuses}
          assignee={activeMembers[selectedTask.assignee]}
          membersById={activeMembers}
          boardConfig={boardConfig}
          onUpdatePriority={(taskId, priority) => {
            void updateTaskPriority(taskId, priority).then(invalidateListQueries);
          }}
          onUpdateStatus={(taskId, statusId) => void handleModalStatusChange(taskId, statusId)}
          onUpdateTitle={(taskId, title) => {
            void updateTaskTitle(taskId, title).then(invalidateListQueries);
          }}
          onUpdateDescription={(taskId, description) => {
            void updateTaskDescription(taskId, description).then(invalidateListQueries);
          }}
          onUpdateCustomField={(taskId, fieldId, value) => {
            void updateTaskCustomField(taskId, fieldId, value).then(invalidateListQueries);
          }}
          onUpdateSchedule={(taskId, input) => {
            void updateTaskSchedule(taskId, input).then(invalidateListQueries);
          }}
          onSaveTask={(taskId, input) => void handleModalTaskSave(taskId, input)}
          aiAgents={agents}
          onRunAiAgentOnItem={runAiAgentOnItem}
          onRunAiRiskAnalysis={runAiRiskAnalysis}
          listWorkspaceDocuments={listWorkspaceDocuments}
          listWorkItemLinkedDocuments={listWorkItemLinkedDocuments}
          linkDocumentToWorkItem={linkDocumentToWorkItem}
          unlinkDocumentFromWorkItem={unlinkDocumentFromWorkItem}
          listCustomers={listCustomers}
          onClose={handleCloseTask}
        />
      ) : null}
    </AppShell>
  );
}

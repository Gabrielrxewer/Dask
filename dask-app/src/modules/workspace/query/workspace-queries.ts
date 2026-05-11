import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Task, TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type {
  ApiBoardColumn,
  ApiCustomField,
  ApiWorkflowState,
  CreateBoardColumnInput,
  CreateCustomFieldInput,
  CreateTaskInput,
  CreateWorkflowStateInput,
  TaskScheduleInput,
  UpdateBoardColumnInput,
  UpdateCustomFieldInput,
  UpdateTaskInput,
  UpdateWorkflowStateInput,
  WorkspacePreferences,
  WorkspaceProfile,
  WorkspaceSummary,
  WorkspaceTemplateOption,
  WorkItemsPage,
  WorkspaceAuditEvent,
  WorkspaceSnapshot
} from "@/modules/workspace/model";
import { toast } from "@/shared/ui/toast";
import {
  type WorkspaceAuditLogFilters,
  normalizeWorkspaceWorkItemsFilters,
  workspaceQueryKeys,
  type WorkspaceWorkItemsFilters
} from "@/modules/workspace/query/workspace-query-keys";

export function setWorkspaceSnapshotQueryData(
  queryClient: QueryClient,
  workspaceId: string,
  snapshot: WorkspaceSnapshot
) {
  queryClient.setQueryData(workspaceQueryKeys.workspaceSnapshot(workspaceId), snapshot);

  if (snapshot.boardColumns) {
    queryClient.setQueryData(workspaceQueryKeys.workspaceBoards(workspaceId), snapshot.boardColumns);
  }

  if (snapshot.workflowStates) {
    queryClient.setQueryData(workspaceQueryKeys.workspaceWorkflowStates(workspaceId), snapshot.workflowStates);
  }

  if (snapshot.customFieldDefinitions) {
    queryClient.setQueryData(workspaceQueryKeys.workspaceFieldSchemas(workspaceId), snapshot.customFieldDefinitions);
  }
}

export function invalidateWorkspaceQueries(queryClient: QueryClient, workspaceId: string) {
  return queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspaceId) });
}

export function invalidateWorkspaceProductQueries(queryClient: QueryClient, workspaceId: string) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => {
      const [root, keyWorkspaceId] = queryKey;
      return (
        typeof keyWorkspaceId === "string" &&
        keyWorkspaceId === workspaceId &&
        (root === "workspace-platform" || root === "work-item-list" || root === "agenda" || root === "leads")
      );
    }
  });
}

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

function getMutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Tente novamente.";
}

export interface WorkspaceCompanyProfileInput {
  name?: string;
  legalName?: string;
  document?: string;
  address?: string;
  jurisdictionCity?: string;
  jurisdictionState?: string;
  noticePeriod?: string;
}

export interface ProvisionWorkspaceWithProfileInput {
  kind: WorkspaceSummary["kind"];
  workspaceName: string;
  workspaceKey: string;
  templateKey: WorkspaceTemplateOption["key"];
  organizationName?: string;
  organizationSlug?: string;
  profileInfo?: {
    description?: string;
    company?: string;
    website?: string;
  };
  companyProfile?: WorkspaceCompanyProfileInput;
}

function hasObjectValues(record: object | undefined): boolean {
  return Boolean(record && Object.values(record).some((value) => typeof value === "string" ? value.length > 0 : value !== undefined));
}

export function useWorkspaceListQuery() {
  return useQuery<WorkspaceSummary[]>({
    queryKey: workspaceQueryKeys.workspaceList(),
    queryFn: () => workspaceService.listWorkspaces()
  });
}

export function useWorkspaceTemplatesQuery(options: { enabled?: boolean } = {}) {
  return useQuery<WorkspaceTemplateOption[]>({
    queryKey: workspaceQueryKeys.workspaceTemplates(),
    queryFn: () => workspaceService.listWorkspaceTemplates(),
    enabled: options.enabled ?? true
  });
}

export function useWorkspaceProfileQuery(workspaceSlug: string | null | undefined) {
  return useQuery<WorkspaceProfile>({
    queryKey: [...workspaceQueryKeys.workspace(workspaceSlug ?? "__missing_workspace__"), "profile"] as const,
    queryFn: () => workspaceService.getWorkspaceProfile(requireWorkspace(workspaceSlug)),
    enabled: isWorkspaceReady(workspaceSlug)
  });
}

export function useUpdateWorkspaceProfileMutation(workspaceSlug: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: {
      name?: string;
      key?: string;
      info?: { description?: string; company?: string; website?: string };
    }) => workspaceService.updateWorkspaceProfile(requireWorkspace(workspaceSlug), patch),
    onSuccess: (profile) => {
      const resolvedWorkspace = requireWorkspace(workspaceSlug);
      queryClient.setQueryData([...workspaceQueryKeys.workspace(resolvedWorkspace), "profile"] as const, profile);
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceList() });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(resolvedWorkspace) });
    },
    onError: (error) => {
      toast.error("Nao foi possivel salvar o perfil do workspace.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useProvisionWorkspaceWithProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProvisionWorkspaceWithProfileInput) => {
      const created = await workspaceService.provisionWorkspace({
        kind: input.kind,
        workspaceName: input.workspaceName,
        workspaceKey: input.workspaceKey,
        templateKey: input.templateKey,
        organizationName: input.organizationName,
        organizationSlug: input.organizationSlug
      });

      const postCreateRequests: Promise<unknown>[] = [];
      if (hasObjectValues(input.profileInfo)) {
        postCreateRequests.push(
          workspaceService.updateWorkspaceProfile(created.slug, {
            name: input.workspaceName,
            key: input.workspaceKey,
            info: input.profileInfo
          })
        );
      }

      if (hasObjectValues(input.companyProfile)) {
        postCreateRequests.push(
          workspaceService.updatePreferences(created.slug, {
            settings: {
              companyProfile: input.companyProfile
            }
          } satisfies Partial<WorkspacePreferences>)
        );
      }

      if (postCreateRequests.length > 0) {
        await Promise.all(postCreateRequests);
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<WorkspaceSummary[]>(workspaceQueryKeys.workspaceList(), (current) => {
        if (!current) return [created];
        return [created, ...current.filter((workspace) => workspace.id !== created.id)];
      });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceList() });
    },
    onError: (error) => {
      toast.error("Nao foi possivel criar o workspace.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workspaceSlug: string) => workspaceService.deleteWorkspace(workspaceSlug),
    onSuccess: (_result, workspaceSlug) => {
      queryClient.setQueryData<WorkspaceSummary[]>(workspaceQueryKeys.workspaceList(), (current) =>
        current?.filter((workspace) => workspace.slug !== workspaceSlug)
      );
      queryClient.removeQueries({ queryKey: workspaceQueryKeys.workspace(workspaceSlug) });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceList() });
    },
    onError: (error) => {
      toast.error("Nao foi possivel excluir o workspace.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

function taskMatchesFilters(task: Task, filters: WorkspaceWorkItemsFilters): boolean {
  const normalized = normalizeWorkspaceWorkItemsFilters(filters);
  const search = normalized.search?.toLowerCase();

  if (search) {
    const haystack = `${task.title} ${task.text} ${task.tags.join(" ")}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  if (normalized.workflowStateId && task.status !== normalized.workflowStateId) {
    return false;
  }

  if (normalized.assigneeId && task.assignee !== normalized.assigneeId) {
    return false;
  }

  if (normalized.dateFrom && task.due && task.due < normalized.dateFrom) {
    return false;
  }

  if (normalized.dateTo && task.due && task.due > normalized.dateTo) {
    return false;
  }

  for (const [fieldId, expected] of Object.entries(normalized.customFields)) {
    if (expected === undefined || expected === null) continue;
    const actual = task.customFields[fieldId] ?? task.customFieldValuesById?.[fieldId];
    if (Array.isArray(actual)) {
      if (!actual.includes(String(expected))) return false;
      continue;
    }
    if (actual !== expected) return false;
  }

  return true;
}

export function applyOptimisticMove(
  snapshot: WorkspaceSnapshot,
  input: MoveWorkItemMutationInput
): WorkspaceSnapshot {
  const nextStatus = "nextStatus" in input
    ? input.nextStatus
    : snapshot.workflowStates?.find((state) => state.id === input.stateId)?.slug;

  return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => {
      if (task.id !== input.taskId) return task;
      return {
        ...task,
        status: nextStatus ?? task.status,
        ...(typeof input.position === "number" ? { position: input.position } : {})
      };
    })
  };
}

export function createWorkItemMutationRequest(
  workspaceId: string | null | undefined,
  input: CreateTaskInput
) {
  return workspaceService.createTask(requireWorkspace(workspaceId), input);
}

export function useWorkspaceSnapshotQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceQueryKeys.workspaceSnapshot(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.getSnapshot(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useWorkspaceBoardsQuery(workspaceId: string | null | undefined) {
  return useQuery<ApiBoardColumn[]>({
    queryKey: workspaceQueryKeys.workspaceBoards(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.fetchBoardColumns(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useBoardPerspectiveQuery(workspaceId: string | null | undefined, perspectiveId: string | null | undefined) {
  return useQuery({
    queryKey: [...workspaceQueryKeys.workspaceSnapshot(workspaceId ?? "__missing_workspace__"), "perspective", perspectiveId ?? "default"] as const,
    queryFn: () => workspaceService.getSnapshot(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId),
    select: (snapshot) => snapshot.boardConfig.perspectives.find((perspective) => perspective.id === perspectiveId) ?? null
  });
}

export function useWorkspaceWorkItemsQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceWorkItemsFilters
) {
  return useQuery<Task[]>({
    queryKey: workspaceQueryKeys.workspaceWorkItems(workspaceId ?? "__missing_workspace__", filters),
    queryFn: async () => {
      const page = await workspaceService.listWorkItemsPage(requireWorkspace(workspaceId), {
        limit: 200,
        workflowStateId: filters?.workflowStateId,
        assigneeId: filters?.assigneeId,
        search: filters?.search,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo
      });
      return page.items.filter((task) => taskMatchesFilters(task, filters ?? {}));
    },
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useWorkspaceWorkItemsInfiniteQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceWorkItemsFilters & { limit?: number; boardColumnId?: string }
) {
  return useInfiniteQuery<WorkItemsPage>({
    queryKey: [...workspaceQueryKeys.workspaceWorkItems(workspaceId ?? "__missing_workspace__", filters), "infinite"] as const,
    queryFn: ({ pageParam }) =>
      workspaceService.listWorkItemsPage(requireWorkspace(workspaceId), {
        limit: filters?.limit ?? 80,
        cursor: typeof pageParam === "string" ? pageParam : null,
        boardColumnId: filters?.boardColumnId,
        workflowStateId: filters?.workflowStateId,
        assigneeId: filters?.assigneeId,
        search: filters?.search,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo
      }),
    enabled: isWorkspaceReady(workspaceId),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}

export function useWorkflowStatesQuery(workspaceId: string | null | undefined) {
  return useQuery<ApiWorkflowState[]>({
    queryKey: workspaceQueryKeys.workspaceWorkflowStates(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.fetchWorkflowStates(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFieldSchemasQuery(workspaceId: string | null | undefined) {
  return useQuery<ApiCustomField[]>({
    queryKey: workspaceQueryKeys.workspaceFieldSchemas(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.fetchCustomFields(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useWorkspaceAuditLogQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceAuditLogFilters
) {
  return useQuery<WorkspaceAuditEvent[]>({
    queryKey: workspaceQueryKeys.workspaceAuditLog(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listWorkspaceAuditLog(requireWorkspace(workspaceId), { limit: filters?.limit ?? 100 }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

function useSnapshotMutation<TInput>(
  workspaceId: string | null | undefined,
  mutationFn: (workspaceId: string, input: TInput) => Promise<WorkspaceSnapshot>,
  successMessage?: string
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TInput) => mutationFn(requireWorkspace(workspaceId), input),
    onSuccess: (snapshot) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      setWorkspaceSnapshotQueryData(queryClient, resolvedWorkspaceId, snapshot);
      void invalidateWorkspaceProductQueries(queryClient, resolvedWorkspaceId);
      if (successMessage) toast.success(successMessage);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Nao foi possivel salvar a alteracao.", { description: message });
    }
  });
}

export function useCreateWorkItemMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<CreateTaskInput>(
    workspaceId,
    (resolvedWorkspaceId, input) => createWorkItemMutationRequest(resolvedWorkspaceId, input)
  );
}

export function useUpdateWorkItemMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; input: UpdateTaskInput }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, input }) => workspaceService.updateTask(resolvedWorkspaceId, taskId, input)
  );
}

export function useDeleteWorkItemMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<string>(
    workspaceId,
    (resolvedWorkspaceId, taskId) => workspaceService.deleteTask(resolvedWorkspaceId, taskId)
  );
}

export function useUpdateWorkItemPriorityMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; priority: TaskPriority }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, priority }) => workspaceService.updateTaskPriority(resolvedWorkspaceId, taskId, priority)
  );
}

export function useUpdateWorkItemTitleMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; title: string }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, title }) => workspaceService.updateTaskTitle(resolvedWorkspaceId, taskId, title)
  );
}

export function useUpdateWorkItemDescriptionMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; description: string }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, description }) =>
      workspaceService.updateTaskDescription(resolvedWorkspaceId, taskId, description)
  );
}

export function useUpdateWorkItemCustomFieldMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; fieldId: string; value: TaskCustomFieldValue }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, fieldId, value }) =>
      workspaceService.updateTaskCustomField(resolvedWorkspaceId, taskId, fieldId, value)
  );
}

export function useUpdateWorkItemScheduleMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; input: TaskScheduleInput }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, input }) => workspaceService.updateTaskSchedule(resolvedWorkspaceId, taskId, input)
  );
}

export function useToggleWorkItemChecklistMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ taskId: string; itemId: string }>(
    workspaceId,
    (resolvedWorkspaceId, { taskId, itemId }) => workspaceService.toggleChecklistItem(resolvedWorkspaceId, taskId, itemId)
  );
}

export type MoveWorkItemMutationInput =
  | { taskId: string; nextStatus: string; position?: number }
  | { taskId: string; columnId: string; stateId?: string; position?: number };

export function useMoveWorkItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MoveWorkItemMutationInput) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      return "columnId" in input
        ? workspaceService.moveTaskToColumn(resolvedWorkspaceId, input.taskId, input.columnId, input.stateId, input.position)
        : workspaceService.moveTask(resolvedWorkspaceId, input.taskId, input.nextStatus);
    },
    onMutate: async (input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const snapshotKey = workspaceQueryKeys.workspaceSnapshot(resolvedWorkspaceId);
      await queryClient.cancelQueries({ queryKey: snapshotKey });
      const previousSnapshot = queryClient.getQueryData<WorkspaceSnapshot>(snapshotKey);

      if (previousSnapshot) {
        queryClient.setQueryData(snapshotKey, applyOptimisticMove(previousSnapshot, input));
      }

      return { resolvedWorkspaceId, previousSnapshot };
    },
    onError: (error, _input, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(
          workspaceQueryKeys.workspaceSnapshot(context.resolvedWorkspaceId),
          context.previousSnapshot
        );
      }
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Nao foi possivel mover o item.", { description: message });
    },
    onSuccess: (snapshot, _input, context) => {
      setWorkspaceSnapshotQueryData(queryClient, context.resolvedWorkspaceId, snapshot);
    },
    onSettled: (_snapshot, _error, _input, context) => {
      if (context?.resolvedWorkspaceId) {
        void invalidateWorkspaceProductQueries(queryClient, context.resolvedWorkspaceId);
      }
    }
  });
}

export interface WorkspaceWorkItemActions {
  createTask: (input: CreateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, nextStatus: TaskStatusId) => Promise<void>;
  moveTaskToColumn: (taskId: string, columnId: string, stateId?: string, position?: number) => Promise<void>;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => Promise<void>;
  updateTaskTitle: (taskId: string, title: string) => Promise<void>;
  updateTaskDescription: (taskId: string, description: string) => Promise<void>;
  updateTaskCustomField: (taskId: string, fieldId: string, value: TaskCustomFieldValue) => Promise<void>;
  updateTaskSchedule: (taskId: string, input: TaskScheduleInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<void>;
}

export function useWorkspaceWorkItemActions(workspaceId: string | null | undefined): WorkspaceWorkItemActions {
  const { mutateAsync: createWorkItem } = useCreateWorkItemMutation(workspaceId);
  const { mutateAsync: deleteWorkItem } = useDeleteWorkItemMutation(workspaceId);
  const { mutateAsync: moveWorkItem } = useMoveWorkItemMutation(workspaceId);
  const { mutateAsync: updatePriority } = useUpdateWorkItemPriorityMutation(workspaceId);
  const { mutateAsync: updateTitle } = useUpdateWorkItemTitleMutation(workspaceId);
  const { mutateAsync: updateDescription } = useUpdateWorkItemDescriptionMutation(workspaceId);
  const { mutateAsync: updateCustomField } = useUpdateWorkItemCustomFieldMutation(workspaceId);
  const { mutateAsync: updateSchedule } = useUpdateWorkItemScheduleMutation(workspaceId);
  const { mutateAsync: updateWorkItem } = useUpdateWorkItemMutation(workspaceId);
  const { mutateAsync: toggleChecklistItemMutation } = useToggleWorkItemChecklistMutation(workspaceId);

  return useMemo<WorkspaceWorkItemActions>(
    () => ({
      createTask: async (input) => {
        await createWorkItem(input);
      },
      deleteTask: async (taskId) => {
        await deleteWorkItem(taskId);
      },
      moveTask: async (taskId, nextStatus) => {
        await moveWorkItem({ taskId, nextStatus });
      },
      moveTaskToColumn: async (taskId, columnId, stateId, position) => {
        await moveWorkItem({ taskId, columnId, stateId, position });
      },
      updateTaskPriority: async (taskId, priority) => {
        await updatePriority({ taskId, priority });
      },
      updateTaskTitle: async (taskId, title) => {
        await updateTitle({ taskId, title });
      },
      updateTaskDescription: async (taskId, description) => {
        await updateDescription({ taskId, description });
      },
      updateTaskCustomField: async (taskId, fieldId, value) => {
        await updateCustomField({ taskId, fieldId, value });
      },
      updateTaskSchedule: async (taskId, input) => {
        await updateSchedule({ taskId, input });
      },
      updateTask: async (taskId, input) => {
        await updateWorkItem({ taskId, input });
      },
      toggleChecklistItem: async (taskId, itemId) => {
        await toggleChecklistItemMutation({ taskId, itemId });
      }
    }),
    [
      createWorkItem,
      deleteWorkItem,
      moveWorkItem,
      toggleChecklistItemMutation,
      updateCustomField,
      updateDescription,
      updatePriority,
      updateSchedule,
      updateTitle,
      updateWorkItem
    ]
  );
}

export type UpdateBoardConfigMutationInput =
  | { action: "create-column"; input: CreateBoardColumnInput }
  | { action: "update-column"; columnId: string; input: UpdateBoardColumnInput }
  | { action: "delete-column"; columnId: string };

export function useUpdateBoardConfigMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<UpdateBoardConfigMutationInput>(
    workspaceId,
    (resolvedWorkspaceId, input) => {
      if (input.action === "create-column") {
        return workspaceService.createBoardColumn(resolvedWorkspaceId, input.input);
      }
      if (input.action === "update-column") {
        return workspaceService.updateBoardColumn(resolvedWorkspaceId, input.columnId, input.input);
      }
      return workspaceService.deleteBoardColumn(resolvedWorkspaceId, input.columnId);
    }
  );
}

export function useCreateWorkflowStateMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<CreateWorkflowStateInput>(
    workspaceId,
    (resolvedWorkspaceId, input) => workspaceService.createWorkflowState(resolvedWorkspaceId, input)
  );
}

export function useUpdateWorkflowStateMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ stateId: string; input: UpdateWorkflowStateInput }>(
    workspaceId,
    (resolvedWorkspaceId, { stateId, input }) => workspaceService.updateWorkflowState(resolvedWorkspaceId, stateId, input)
  );
}

export function useUpdateFieldSchemaMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ fieldId: string; input: UpdateCustomFieldInput }>(
    workspaceId,
    (resolvedWorkspaceId, { fieldId, input }) => workspaceService.updateCustomField(resolvedWorkspaceId, fieldId, input)
  );
}

export function useCreateFieldSchemaMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<CreateCustomFieldInput>(
    workspaceId,
    (resolvedWorkspaceId, input) => workspaceService.createCustomField(resolvedWorkspaceId, input)
  );
}

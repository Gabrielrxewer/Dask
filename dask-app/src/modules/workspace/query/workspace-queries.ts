import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Task, TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type {
  ApiBoardColumn,
  ApiCustomField,
  ApiItemType,
  ApiWorkflowState,
  BoardTemplateSummary,
  Customer,
  CustomerStatus,
  CreateBoardColumnInput,
  CreateCustomFieldInput,
  CreateItemTypeInput,
  CreateTaskInput,
  CreateWorkflowStateInput,
  TaskScheduleInput,
  UpdateBoardColumnInput,
  UpdateCustomFieldInput,
  UpdateItemTypeInput,
  UpdateTaskInput,
  UpdateWorkflowStateInput,
  WorkItemFieldBindingInput,
  WorkspaceAccessControlSnapshot,
  WorkspaceAccessGroup,
  WorkspacePreferences,
  WorkspaceProfile,
  WorkspaceInvite,
  WorkspaceModuleKey,
  WorkspacePermissionKey,
  PublicWorkspaceInvite,
  WorkspaceRole,
  WorkspaceSummary,
  WorkspaceTemplateKey,
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

  if (snapshot.itemTypes) {
    queryClient.setQueryData(workspaceQueryKeys.workspaceItemTypes(workspaceId), snapshot.itemTypes);
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
        (root === "workspace-platform" || root === "work-item-list" || root === "agenda" || root === "commercial")
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

export type CreateWorkspaceInviteMutationInput = {
  email: string;
  role: Exclude<WorkspaceRole, "OWNER">;
};

export interface UpdateMemberAccessControlMutationInput {
  memberUserId: string;
  role?: WorkspaceRole;
  permissions?: {
    allow?: WorkspacePermissionKey[];
    deny?: WorkspacePermissionKey[];
    groupIds?: string[];
    allowedModules?: WorkspaceModuleKey[];
    allowedBoardViewKeys?: string[];
    ownCardsOnly?: boolean;
  };
}

export interface SaveWorkspaceAccessGroupMutationInput {
  groupId?: string;
  input: {
    name: string;
    description?: string;
    allow?: WorkspacePermissionKey[];
    deny?: WorkspacePermissionKey[];
    allowedModules?: WorkspaceModuleKey[];
    allowedBoardViewKeys?: string[];
    ownCardsOnly?: boolean;
  };
}

export type SaveWorkflowStateMutationInput =
  | {
      action: "create";
      input: CreateWorkflowStateInput;
      successMessage?: string;
    }
  | {
      action: "update";
      stateId: string;
      input: UpdateWorkflowStateInput;
      successMessage?: string;
    };

export interface WorkspaceSettingsPermissions {
  role: WorkspaceRole | null;
  isLoading: boolean;
  canManageWorkspace: boolean;
  canManageMembers: boolean;
  canManageAccessGroups: boolean;
  canManageModuleEntitlements: boolean;
  canManageWorkflowStates: boolean;
  canReadAudit: boolean;
  readOnlyReason: string | null;
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

export function findWorkspaceSummaryBySlug(workspaces: WorkspaceSummary[], workspaceSlug: string | null | undefined) {
  const normalizedSlug = workspaceSlug?.trim().toLowerCase();
  if (!normalizedSlug) {
    return null;
  }

  return workspaces.find((workspace) => workspace.slug === normalizedSlug) ?? null;
}

export function useWorkspaceSummaryQuery(workspaceSlug: string | null | undefined) {
  return useQuery<WorkspaceSummary | null>({
    queryKey: workspaceQueryKeys.workspaceSummary(workspaceSlug ?? "__missing_workspace__"),
    queryFn: async () => findWorkspaceSummaryBySlug(await workspaceService.listWorkspaces(), workspaceSlug),
    enabled: isWorkspaceReady(workspaceSlug)
  });
}

export function resolveWorkspaceSettingsPermissions(
  role: WorkspaceRole | null | undefined,
  isLoading = false
): WorkspaceSettingsPermissions {
  const canManage = role === "OWNER" || role === "ADMIN";

  return {
    role: role ?? null,
    isLoading,
    canManageWorkspace: canManage,
    canManageMembers: canManage,
    canManageAccessGroups: canManage,
    canManageModuleEntitlements: canManage,
    canManageWorkflowStates: canManage,
    canReadAudit: canManage,
    readOnlyReason: canManage || isLoading ? null : "Apenas proprietarios e admins podem alterar estas configuracoes."
  };
}

export function useWorkspaceSettingsPermissions(
  workspaceSlug: string | null | undefined,
  snapshot?: WorkspaceSnapshot | null
) {
  const workspaceSummaryQuery = useWorkspaceSummaryQuery(workspaceSlug);
  const role = snapshot?.access?.role ?? workspaceSummaryQuery.data?.role ?? null;

  return useMemo(
    () => resolveWorkspaceSettingsPermissions(role, workspaceSummaryQuery.isLoading),
    [role, workspaceSummaryQuery.isLoading]
  );
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
    queryKey: workspaceQueryKeys.workspaceProfile(workspaceSlug ?? "__missing_workspace__"),
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
      queryClient.setQueryData(workspaceQueryKeys.workspaceProfile(resolvedWorkspace), profile);
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

export function useWorkspaceBoardTemplatesQuery(workspaceId: string | null | undefined) {
  return useQuery<BoardTemplateSummary[]>({
    queryKey: workspaceQueryKeys.workspaceBoardTemplates(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.listBoardTemplates(requireWorkspace(workspaceId)),
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

export function useWorkspaceItemTypesQuery(workspaceId: string | null | undefined) {
  return useQuery<ApiItemType[]>({
    queryKey: workspaceQueryKeys.workspaceItemTypes(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.fetchItemTypes(requireWorkspace(workspaceId)),
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

export function useWorkspaceCustomersQuery(
  workspaceId: string | null | undefined,
  input?: { search?: string; status?: CustomerStatus },
  options: { enabled?: boolean } = {}
) {
  return useQuery<Customer[]>({
    queryKey: workspaceQueryKeys.workspaceCustomers(workspaceId ?? "__missing_workspace__", input),
    queryFn: () => workspaceService.listCustomers(requireWorkspace(workspaceId), input),
    enabled: isWorkspaceReady(workspaceId) && (options.enabled ?? true),
    staleTime: 30_000
  });
}

export function useWorkspaceCustomerLookupAction(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMemo(
    () => (input?: { search?: string; status?: CustomerStatus }) => {
      if (!isWorkspaceReady(workspaceId)) {
        return Promise.resolve([] as Customer[]);
      }

      return queryClient.fetchQuery({
        queryKey: workspaceQueryKeys.workspaceCustomers(workspaceId, input),
        queryFn: () => workspaceService.listCustomers(workspaceId, input),
        staleTime: 30_000
      });
    },
    [queryClient, workspaceId]
  );
}

export function useWorkspaceAuditLogQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceAuditLogFilters,
  options: { enabled?: boolean } = {}
) {
  return useQuery<WorkspaceAuditEvent[]>({
    queryKey: workspaceQueryKeys.workspaceAuditLog(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listWorkspaceAuditLog(requireWorkspace(workspaceId), { limit: filters?.limit ?? 100 }),
    enabled: isWorkspaceReady(workspaceId) && (options.enabled ?? true)
  });
}

export function useWorkspaceAccessControlQuery(
  workspaceId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery<WorkspaceAccessControlSnapshot>({
    queryKey: workspaceQueryKeys.workspaceAccessControl(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.getAccessControl(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId) && (options.enabled ?? true)
  });
}

export function useWorkspaceInvitesQuery(
  workspaceId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery<WorkspaceInvite[]>({
    queryKey: workspaceQueryKeys.workspaceInvites(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.listWorkspaceInvites(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId) && (options.enabled ?? true)
  });
}

export function useWorkspacePendingInvitesQuery(
  workspaceId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  return useQuery<WorkspaceInvite[]>({
    queryKey: workspaceQueryKeys.workspaceInvites(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.listWorkspaceInvites(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId) && (options.enabled ?? true),
    select: (invites) => invites.filter((invite) => invite.status === "PENDING")
  });
}

export function usePublicWorkspaceInviteQuery(inviteToken: string | null | undefined) {
  return useQuery<PublicWorkspaceInvite>({
    queryKey: ["workspace-platform", "public-invite", inviteToken ?? "__missing_invite__"] as const,
    queryFn: () => workspaceService.getWorkspaceInviteByToken(inviteToken ?? ""),
    enabled: Boolean(inviteToken?.trim())
  });
}

function invalidateWorkspaceAccessState(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceAccessControl(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceSnapshot(workspaceId) });
}

export function useCreateWorkspaceInviteMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkspaceInviteMutationInput) =>
      workspaceService.createWorkspaceInvite(requireWorkspace(workspaceId), input),
    onSuccess: (invite) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData<WorkspaceInvite[]>(
        workspaceQueryKeys.workspaceInvites(resolvedWorkspaceId),
        (current) => [invite, ...(current ?? []).filter((item) => item.id !== invite.id)]
      );
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceInvites(resolvedWorkspaceId) });
      toast.success("Convite enviado com sucesso.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel enviar o convite.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useResendWorkspaceInviteMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => workspaceService.resendWorkspaceInvite(requireWorkspace(workspaceId), inviteId),
    onSuccess: (invite) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData<WorkspaceInvite[]>(
        workspaceQueryKeys.workspaceInvites(resolvedWorkspaceId),
        (current) => current?.map((item) => (item.id === invite.id ? invite : item)) ?? [invite]
      );
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceInvites(resolvedWorkspaceId) });
      toast.success("Convite reenviado.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel reenviar o convite.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useRevokeWorkspaceInviteMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => workspaceService.revokeWorkspaceInvite(requireWorkspace(workspaceId), inviteId),
    onSuccess: (_result, inviteId) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData<WorkspaceInvite[]>(
        workspaceQueryKeys.workspaceInvites(resolvedWorkspaceId),
        (current) => current?.filter((item) => item.id !== inviteId) ?? []
      );
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceInvites(resolvedWorkspaceId) });
      toast.success("Convite removido.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel remover o convite.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useUpdateWorkspaceModuleEntitlementsMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (moduleEntitlements: Partial<Record<WorkspaceModuleKey, boolean>>) =>
      workspaceService.updateWorkspaceModuleEntitlements(requireWorkspace(workspaceId), moduleEntitlements),
    onSuccess: (_result, moduleEntitlements) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData<WorkspaceAccessControlSnapshot>(
        workspaceQueryKeys.workspaceAccessControl(resolvedWorkspaceId),
        (current) => current
          ? {
              ...current,
              moduleEntitlements: {
                ...(current.moduleEntitlements ?? {}),
                ...moduleEntitlements
              }
            }
          : current
      );
      invalidateWorkspaceAccessState(queryClient, resolvedWorkspaceId);
      toast.success("Modulos atualizados.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel atualizar os modulos.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useUpdateMemberAccessControlMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateMemberAccessControlMutationInput) =>
      workspaceService.updateMemberAccessControl(requireWorkspace(workspaceId), input.memberUserId, {
        role: input.role,
        permissions: input.permissions
      }),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkspaceAccessState(queryClient, resolvedWorkspaceId);
      toast.success("Acesso do membro atualizado.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel salvar as alteracoes de acesso.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useSaveWorkspaceAccessGroupMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveWorkspaceAccessGroupMutationInput) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      return input.groupId
        ? workspaceService.updateWorkspaceAccessGroup(resolvedWorkspaceId, input.groupId, input.input)
        : workspaceService.createWorkspaceAccessGroup(resolvedWorkspaceId, input.input);
    },
    onSuccess: (_result, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkspaceAccessState(queryClient, resolvedWorkspaceId);
      toast.success(input.groupId ? "Grupo atualizado." : "Grupo criado.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel salvar o grupo.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
}

export function useDeleteWorkspaceAccessGroupMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: WorkspaceAccessGroup["id"]) =>
      workspaceService.deleteWorkspaceAccessGroup(requireWorkspace(workspaceId), groupId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkspaceAccessState(queryClient, resolvedWorkspaceId);
      toast.success("Grupo removido.");
    },
    onError: (error) => {
      toast.error("Nao foi possivel remover o grupo.", {
        description: getMutationErrorMessage(error)
      });
    }
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

export function useUpdateWorkspacePreferencesMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<Partial<WorkspacePreferences>>(
    workspaceId,
    (resolvedWorkspaceId, patch) => workspaceService.updatePreferences(resolvedWorkspaceId, patch)
  );
}

export function useResetWorkspaceTemplateMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<WorkspaceTemplateKey | undefined>(
    workspaceId,
    (resolvedWorkspaceId, templateKey) => workspaceService.resetWorkspaceTemplate(resolvedWorkspaceId, templateKey)
  );
}

export function useCreateBoardTemplateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      rules?: Record<string, unknown>;
    }) => workspaceService.createBoardTemplate(requireWorkspace(workspaceId), input),
    onSuccess: (template) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData<BoardTemplateSummary[]>(
        workspaceQueryKeys.workspaceBoardTemplates(resolvedWorkspaceId),
        (current) => [template, ...(current ?? []).filter((item) => item.id !== template.id)]
      );
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceBoardTemplates(resolvedWorkspaceId) });
    },
    onError: (error) => {
      toast.error("Nao foi possivel salvar o template.", {
        description: getMutationErrorMessage(error)
      });
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

export function useSaveWorkflowStateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveWorkflowStateMutationInput) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      return input.action === "create"
        ? workspaceService.createWorkflowState(resolvedWorkspaceId, input.input)
        : workspaceService.updateWorkflowState(resolvedWorkspaceId, input.stateId, input.input);
    },
    onSuccess: (snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      setWorkspaceSnapshotQueryData(queryClient, resolvedWorkspaceId, snapshot);
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspaceWorkflowStates(resolvedWorkspaceId) });
      void invalidateWorkspaceProductQueries(queryClient, resolvedWorkspaceId);
      toast.success(input.successMessage ?? (input.action === "create" ? "Estado criado." : "Estado atualizado."));
    },
    onError: (error) => {
      toast.error("Nao foi possivel salvar o estado.", {
        description: getMutationErrorMessage(error)
      });
    }
  });
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

export function useDeleteFieldSchemaMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<string>(
    workspaceId,
    (resolvedWorkspaceId, fieldId) => workspaceService.deleteCustomField(resolvedWorkspaceId, fieldId)
  );
}

export function useCreateItemTypeMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<CreateItemTypeInput>(
    workspaceId,
    (resolvedWorkspaceId, input) => workspaceService.createItemType(resolvedWorkspaceId, input)
  );
}

export function useUpdateItemTypeMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ typeId: string; input: UpdateItemTypeInput }>(
    workspaceId,
    (resolvedWorkspaceId, { typeId, input }) => workspaceService.updateItemType(resolvedWorkspaceId, typeId, input)
  );
}

export function useDeleteItemTypeMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<string>(
    workspaceId,
    (resolvedWorkspaceId, typeId) => workspaceService.deleteItemType(resolvedWorkspaceId, typeId)
  );
}

export function useReplaceItemTypeFieldBindingsMutation(workspaceId: string | null | undefined) {
  return useSnapshotMutation<{ typeId: string; bindings: WorkItemFieldBindingInput[] }>(
    workspaceId,
    (resolvedWorkspaceId, { typeId, bindings }) =>
      workspaceService.replaceItemTypeFieldBindings(resolvedWorkspaceId, typeId, bindings)
  );
}

export interface WorkspaceSettingsActions {
  updatePreferences: (patch: Partial<WorkspacePreferences>) => Promise<void>;
  resetWorkspaceTemplate: (templateKey?: WorkspaceTemplateKey) => Promise<void>;
}

export function useWorkspaceSettingsActions(workspaceId: string | null | undefined): WorkspaceSettingsActions {
  const { mutateAsync: updatePreferences } = useUpdateWorkspacePreferencesMutation(workspaceId);
  const { mutateAsync: resetWorkspaceTemplate } = useResetWorkspaceTemplateMutation(workspaceId);

  return useMemo(
    () => ({
      updatePreferences: async (patch) => {
        await updatePreferences(patch);
      },
      resetWorkspaceTemplate: async (templateKey) => {
        await resetWorkspaceTemplate(templateKey);
      }
    }),
    [resetWorkspaceTemplate, updatePreferences]
  );
}

export interface WorkspaceBoardConfigActions extends WorkspaceSettingsActions {
  fetchBoardColumns: () => Promise<ApiBoardColumn[]>;
  fetchWorkflowStates: () => Promise<ApiWorkflowState[]>;
  listBoardTemplates: () => Promise<BoardTemplateSummary[]>;
  createBoardTemplate: (input: {
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }) => Promise<BoardTemplateSummary>;
  createBoardColumn: (input: CreateBoardColumnInput) => Promise<void>;
  updateBoardColumn: (columnId: string, input: UpdateBoardColumnInput) => Promise<void>;
  deleteBoardColumn: (columnId: string) => Promise<void>;
}

export function useWorkspaceBoardConfigActions(workspaceId: string | null | undefined): WorkspaceBoardConfigActions {
  const queryClient = useQueryClient();
  const settingsActions = useWorkspaceSettingsActions(workspaceId);
  const { mutateAsync: updateBoardConfig } = useUpdateBoardConfigMutation(workspaceId);
  const { mutateAsync: createBoardTemplateMutation } = useCreateBoardTemplateMutation(workspaceId);

  return useMemo(
    () => ({
      ...settingsActions,
      fetchBoardColumns: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceBoards(workspaceId),
          queryFn: () => workspaceService.fetchBoardColumns(workspaceId)
        });
      },
      fetchWorkflowStates: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceWorkflowStates(workspaceId),
          queryFn: () => workspaceService.fetchWorkflowStates(workspaceId)
        });
      },
      listBoardTemplates: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceBoardTemplates(workspaceId),
          queryFn: () => workspaceService.listBoardTemplates(workspaceId)
        });
      },
      createBoardTemplate: (input) => createBoardTemplateMutation(input),
      createBoardColumn: async (input) => {
        await updateBoardConfig({ action: "create-column", input });
      },
      updateBoardColumn: async (columnId, input) => {
        await updateBoardConfig({ action: "update-column", columnId, input });
      },
      deleteBoardColumn: async (columnId) => {
        await updateBoardConfig({ action: "delete-column", columnId });
      }
    }),
    [createBoardTemplateMutation, queryClient, settingsActions, updateBoardConfig, workspaceId]
  );
}

export interface WorkspaceWorkItemConfigActions extends WorkspaceSettingsActions {
  fetchBoardColumns: () => Promise<ApiBoardColumn[]>;
  fetchWorkflowStates: () => Promise<ApiWorkflowState[]>;
  fetchItemTypes: () => Promise<ApiItemType[]>;
  fetchCustomFields: () => Promise<ApiCustomField[]>;
  createItemType: (input: CreateItemTypeInput) => Promise<void>;
  updateItemType: (typeId: string, input: UpdateItemTypeInput) => Promise<void>;
  deleteItemType: (typeId: string) => Promise<void>;
  replaceItemTypeFieldBindings: (typeId: string, bindings: WorkItemFieldBindingInput[]) => Promise<void>;
  createCustomField: (input: CreateCustomFieldInput) => Promise<void>;
  updateCustomField: (fieldId: string, input: UpdateCustomFieldInput) => Promise<void>;
  deleteCustomField: (fieldId: string) => Promise<void>;
}

export function useWorkspaceWorkItemConfigActions(workspaceId: string | null | undefined): WorkspaceWorkItemConfigActions {
  const queryClient = useQueryClient();
  const settingsActions = useWorkspaceSettingsActions(workspaceId);
  const { mutateAsync: createItemTypeMutation } = useCreateItemTypeMutation(workspaceId);
  const { mutateAsync: updateItemTypeMutation } = useUpdateItemTypeMutation(workspaceId);
  const { mutateAsync: deleteItemTypeMutation } = useDeleteItemTypeMutation(workspaceId);
  const { mutateAsync: replaceBindingsMutation } = useReplaceItemTypeFieldBindingsMutation(workspaceId);
  const { mutateAsync: createCustomFieldMutation } = useCreateFieldSchemaMutation(workspaceId);
  const { mutateAsync: updateCustomFieldMutation } = useUpdateFieldSchemaMutation(workspaceId);
  const { mutateAsync: deleteCustomFieldMutation } = useDeleteFieldSchemaMutation(workspaceId);

  return useMemo(
    () => ({
      ...settingsActions,
      fetchBoardColumns: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceBoards(workspaceId),
          queryFn: () => workspaceService.fetchBoardColumns(workspaceId)
        });
      },
      fetchWorkflowStates: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceWorkflowStates(workspaceId),
          queryFn: () => workspaceService.fetchWorkflowStates(workspaceId)
        });
      },
      fetchItemTypes: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceItemTypes(workspaceId),
          queryFn: () => workspaceService.fetchItemTypes(workspaceId)
        });
      },
      fetchCustomFields: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: workspaceQueryKeys.workspaceFieldSchemas(workspaceId),
          queryFn: () => workspaceService.fetchCustomFields(workspaceId)
        });
      },
      createItemType: async (input) => {
        await createItemTypeMutation(input);
      },
      updateItemType: async (typeId, input) => {
        await updateItemTypeMutation({ typeId, input });
      },
      deleteItemType: async (typeId) => {
        await deleteItemTypeMutation(typeId);
      },
      replaceItemTypeFieldBindings: async (typeId, bindings) => {
        await replaceBindingsMutation({ typeId, bindings });
      },
      createCustomField: async (input) => {
        await createCustomFieldMutation(input);
      },
      updateCustomField: async (fieldId, input) => {
        await updateCustomFieldMutation({ fieldId, input });
      },
      deleteCustomField: async (fieldId) => {
        await deleteCustomFieldMutation(fieldId);
      }
    }),
    [
      createCustomFieldMutation,
      createItemTypeMutation,
      deleteCustomFieldMutation,
      deleteItemTypeMutation,
      queryClient,
      replaceBindingsMutation,
      settingsActions,
      updateCustomFieldMutation,
      updateItemTypeMutation,
      workspaceId
    ]
  );
}

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Task, TaskStatusId } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type { BulkUpdateWorkItemsInput, BulkUpdateWorkItemsResult, WorkItemsPage, WorkspaceSnapshot } from "@/modules/workspace";
import { setWorkspaceSnapshotQueryData } from "@/modules/workspace/query";
import { workspaceQueryKeys } from "@/modules/workspace/query/workspace-query-keys";
import { agendaQueryKeys } from "@/modules/agenda/query/agenda-query-keys";
import { readWorkItemListConfigs } from "@/modules/work-item-list/model/work-item-list-config";
import type { WorkItemListConfig } from "@/modules/work-item-list/model/types";
import { workItemListQueryKeys } from "@/modules/work-item-list/query/work-item-list-query-keys";
import { toast } from "@/shared/ui/toast";

function hasWorkspace(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!hasWorkspace(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

function updateTaskStatus(task: Task, taskId: string, statusId: string): Task {
  return task.id === taskId ? { ...task, status: statusId } : task;
}

function updateListPages(queryClient: QueryClient, workspaceId: string, taskId: string, statusId: string) {
  const entries = queryClient.getQueriesData<WorkItemsPage>({
    queryKey: workItemListQueryKeys.lists(workspaceId)
  });

  for (const [queryKey, page] of entries) {
    if (!page) continue;
    queryClient.setQueryData(queryKey, {
      ...page,
      items: page.items.map((task) => updateTaskStatus(task, taskId, statusId))
    });
  }

  return entries;
}

type BulkMutationPatch = BulkUpdateWorkItemsInput["patch"] & {
  statusId?: TaskStatusId;
};

function normalizeBulkPatch(patch: BulkMutationPatch): BulkUpdateWorkItemsInput["patch"] {
  return {
    ...(patch.stateId !== undefined ? { stateId: patch.stateId } : {}),
    ...(patch.stateSlug !== undefined ? { stateSlug: patch.stateSlug } : {}),
    ...(patch.statusId !== undefined ? { stateSlug: patch.statusId } : {}),
    ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.archived !== undefined ? { archived: patch.archived } : {})
  };
}

function applyBulkPatchToTask(task: Task, patch: BulkMutationPatch): Task | null {
  if (patch.archived === true) {
    return null;
  }

  return {
    ...task,
    ...(patch.statusId || patch.stateSlug ? { status: (patch.statusId ?? patch.stateSlug) as TaskStatusId } : {}),
    ...(patch.assigneeId ? { assignee: patch.assigneeId } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {})
  };
}

function updateListPagesWithBulkPatch(
  queryClient: QueryClient,
  workspaceId: string,
  taskIds: string[],
  patch: BulkMutationPatch
) {
  const taskIdSet = new Set(taskIds);
  const entries = queryClient.getQueriesData<WorkItemsPage>({
    queryKey: workItemListQueryKeys.lists(workspaceId)
  });

  for (const [queryKey, page] of entries) {
    if (!page) continue;
    const items = page.items.flatMap((task) => {
      if (!taskIdSet.has(task.id)) {
        return [task];
      }
      const nextTask = applyBulkPatchToTask(task, patch);
      return nextTask ? [nextTask] : [];
    });
    const removedCount = page.items.length - items.length;
    queryClient.setQueryData(queryKey, {
      ...page,
      items,
      total: Math.max(0, page.total - removedCount),
      totalCount: Math.max(0, (page.totalCount ?? page.total) - removedCount)
    });
  }

  return entries;
}

function replaceUpdatedItemsInListPages(queryClient: QueryClient, workspaceId: string, updatedItems: Task[]) {
  if (updatedItems.length === 0) {
    return;
  }

  const updatedById = new Map(updatedItems.map((task) => [task.id, task]));
  const entries = queryClient.getQueriesData<WorkItemsPage>({
    queryKey: workItemListQueryKeys.lists(workspaceId)
  });

  for (const [queryKey, page] of entries) {
    if (!page) continue;
    queryClient.setQueryData(queryKey, {
      ...page,
      items: page.items.map((task) => updatedById.get(task.id) ?? task)
    });
  }
}

export function useUpdateWorkItemStatusMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    retry: 1,
    mutationFn: (input: { taskId: string; statusId: string }) =>
      workspaceService.moveTask(requireWorkspace(workspaceId), input.taskId, input.statusId),
    onMutate: async (input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const snapshotKey = workspaceQueryKeys.workspaceSnapshot(resolvedWorkspaceId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: snapshotKey }),
        queryClient.cancelQueries({ queryKey: workItemListQueryKeys.lists(resolvedWorkspaceId) })
      ]);

      const previousSnapshot = queryClient.getQueryData<WorkspaceSnapshot>(snapshotKey);
      const previousPages = updateListPages(queryClient, resolvedWorkspaceId, input.taskId, input.statusId);

      if (previousSnapshot) {
        queryClient.setQueryData(snapshotKey, {
          ...previousSnapshot,
          tasks: previousSnapshot.tasks.map((task) => updateTaskStatus(task, input.taskId, input.statusId))
        });
      }

      return { resolvedWorkspaceId, previousSnapshot, previousPages };
    },
    onError: (error, _input, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(
          workspaceQueryKeys.workspaceSnapshot(context.resolvedWorkspaceId),
          context.previousSnapshot
        );
      }
      for (const [queryKey, page] of context?.previousPages ?? []) {
        queryClient.setQueryData(queryKey, page);
      }
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Nao foi possivel alterar o status.", { description: message });
    },
    onSuccess: (snapshot, _input, context) => {
      setWorkspaceSnapshotQueryData(queryClient, context.resolvedWorkspaceId, snapshot);
      toast.success("Status atualizado.");
    },
    onSettled: (_snapshot, _error, _input, context) => {
      if (!context?.resolvedWorkspaceId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: workItemListQueryKeys.lists(context.resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(context.resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: agendaQueryKeys.workspace(context.resolvedWorkspaceId) });
    }
  });
}

export function useBulkUpdateWorkItemsMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { itemIds: string[]; patch: BulkMutationPatch }) =>
      workspaceService.bulkUpdateWorkItems(requireWorkspace(workspaceId), {
        itemIds: input.itemIds,
        patch: normalizeBulkPatch(input.patch)
      }),
    onMutate: async (input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const snapshotKey = workspaceQueryKeys.workspaceSnapshot(resolvedWorkspaceId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: snapshotKey }),
        queryClient.cancelQueries({ queryKey: workItemListQueryKeys.lists(resolvedWorkspaceId) })
      ]);

      const previousSnapshot = queryClient.getQueryData<WorkspaceSnapshot>(snapshotKey);
      const previousPages = updateListPagesWithBulkPatch(queryClient, resolvedWorkspaceId, input.itemIds, input.patch);

      if (previousSnapshot) {
        const itemIdSet = new Set(input.itemIds);
        queryClient.setQueryData(snapshotKey, {
          ...previousSnapshot,
          tasks: previousSnapshot.tasks.flatMap((task) => {
            if (!itemIdSet.has(task.id)) {
              return [task];
            }
            const nextTask = applyBulkPatchToTask(task, input.patch);
            return nextTask ? [nextTask] : [];
          })
        });
      }

      return { resolvedWorkspaceId, previousSnapshot, previousPages };
    },
    onError: (error, _input, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(
          workspaceQueryKeys.workspaceSnapshot(context.resolvedWorkspaceId),
          context.previousSnapshot
        );
      }
      for (const [queryKey, page] of context?.previousPages ?? []) {
        queryClient.setQueryData(queryKey, page);
      }
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Nao foi possivel atualizar os itens selecionados.", { description: message });
    },
    onSuccess: (result: BulkUpdateWorkItemsResult, input, context) => {
      if (input.patch.archived !== true) {
        replaceUpdatedItemsInListPages(queryClient, context.resolvedWorkspaceId, result.items);
      }

      if (result.failedCount > 0) {
        toast.error("Alguns itens nao foram atualizados.", {
          description: `${result.updatedCount} atualizados, ${result.failedCount} com erro.`
        });
        return;
      }

      toast.success(`${result.updatedCount} ${result.updatedCount === 1 ? "item atualizado" : "itens atualizados"}.`);
    },
    onSettled: (_result, _error, _input, context) => {
      if (!context?.resolvedWorkspaceId) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: workItemListQueryKeys.lists(context.resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(context.resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: agendaQueryKeys.workspace(context.resolvedWorkspaceId) });
    }
  });
}

export function useUpdateWorkItemListConfigMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: WorkItemListConfig | { config: WorkItemListConfig; silent?: boolean }) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const config = "config" in input ? input.config : input;
      return workspaceService.updateWorkItemListConfig(resolvedWorkspaceId, config.workItemTypeId, { ...config });
    },
    onSuccess: (snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const config = "config" in input ? input.config : input;
      const silent = "config" in input ? Boolean(input.silent) : false;
      const savedConfig = readWorkItemListConfigs(snapshot.preferences.settings)[config.workItemTypeId] ?? config;
      setWorkspaceSnapshotQueryData(queryClient, resolvedWorkspaceId, snapshot);
      queryClient.setQueryData(workItemListQueryKeys.config(resolvedWorkspaceId, config.workItemTypeId), savedConfig);
      void queryClient.invalidateQueries({ queryKey: workItemListQueryKeys.config(resolvedWorkspaceId, config.workItemTypeId) });
      void queryClient.invalidateQueries({ queryKey: workItemListQueryKeys.columns(resolvedWorkspaceId, config.workItemTypeId) });
      if (!silent) {
        toast.success("Configuracao da lista salva.");
      }
    },
    onError: (error, input) => {
      const silent = typeof input === "object" && "config" in input ? Boolean(input.silent) : false;
      if (silent) {
        return;
      }
      const message = error instanceof Error ? error.message : "Tente novamente.";
      toast.error("Nao foi possivel salvar as colunas.", { description: message });
    }
  });
}

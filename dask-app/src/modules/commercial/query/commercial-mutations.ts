import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { commercialService } from "@/modules/commercial/api";
import type {
  CreateCommercialWorkItemInput,
  ConvertWorkItemToCustomerInput,
  CustomerMutationInput,
  LinkCustomerToWorkItemInput,
  TransformWorkItemTypeInput,
  UpdateCommercialWorkItemInput
} from "@/modules/commercial/model/types";
import { commercialQueryKeys } from "@/modules/commercial/query/commercial-query-keys";
import { workspaceQueryKeys } from "@/modules/workspace/query";
import { toast } from "@/shared/ui/toast";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

function invalidateWorkItemCollections(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workspace(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspaceId) });
}

interface WorkItemMutationOptions {
  silent?: boolean;
}

function handleMutationError(title: string, options?: WorkItemMutationOptions) {
  return (error: unknown) => {
    if (options?.silent) return;
    toast.error(title, { description: error instanceof Error ? error.message : "Tente novamente." });
  };
}

function notifyMutationSuccess(message: string, options?: WorkItemMutationOptions) {
  if (!options?.silent) {
    toast.success(message);
  }
}

export function useCreateCommercialWorkItemMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommercialWorkItemInput) => createCommercialWorkItemMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      notifyMutationSuccess("WorkItem comercial criado.", options);
    },
    onError: handleMutationError("Nao foi possivel criar o WorkItem comercial.", options)
  });
}

export function createCommercialWorkItemMutationRequest(
  workspaceId: string | null | undefined,
  input: CreateCommercialWorkItemInput
) {
  return commercialService.createCommercialWorkItem(requireWorkspace(workspaceId), input);
}

export function useCreateSignalWorkItemMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommercialWorkItemInput) => createCommercialWorkItemMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      notifyMutationSuccess("Sinal criado como WorkItem comercial.", options);
    },
    onError: handleMutationError("Nao foi possivel criar o sinal.", options)
  });
}

export function useCreateSignalMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  return useCreateSignalWorkItemMutation(workspaceId, options);
}

export function moveCommercialWorkItemInFlowMutationRequest(
  workspaceId: string | null | undefined,
  input: { workItemId: string; stateSlug?: string; stateId?: string }
) {
  return commercialService.moveCommercialWorkItem(requireWorkspace(workspaceId), input);
}

export function useUpdateCommercialWorkItemMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCommercialWorkItemInput) =>
      commercialService.updateCommercialWorkItem(requireWorkspace(workspaceId), input),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workItem(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("WorkItem comercial atualizado.", options);
    },
    onError: handleMutationError("Nao foi possivel atualizar o WorkItem comercial.", options)
  });
}

export function useMoveCommercialWorkItemInFlowMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { workItemId: string; stateSlug?: string; stateId?: string }) =>
      moveCommercialWorkItemInFlowMutationRequest(workspaceId, input),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.flow(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workItem(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("WorkItem movido no fluxo comercial.", options);
    },
    onError: handleMutationError("Nao foi possivel mover o WorkItem comercial.", options)
  });
}

export function useLinkCustomerToWorkItemMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkCustomerToWorkItemInput) =>
      commercialService.updateCommercialWorkItem(requireWorkspace(workspaceId), {
        workItemId: input.workItemId,
        fields: input.fields,
        customFieldValues: input.customFieldValues
      }),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workItem(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Cliente vinculado ao WorkItem.", options);
    },
    onError: handleMutationError("Nao foi possivel vincular o cliente.", options)
  });
}

export function useUnlinkCustomerFromWorkItemMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkCustomerToWorkItemInput) =>
      commercialService.updateCommercialWorkItem(requireWorkspace(workspaceId), {
        workItemId: input.workItemId,
        fields: input.fields,
        customFieldValues: input.customFieldValues
      }),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workItem(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Vinculo de cliente removido.", options);
    },
    onError: handleMutationError("Nao foi possivel remover o vinculo.", options)
  });
}

export function useCreateCustomerMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CustomerMutationInput["customer"]) =>
      commercialService.createCustomer(requireWorkspace(workspaceId), input as Parameters<typeof commercialService.createCustomer>[1]),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      notifyMutationSuccess("Cliente criado.", options);
    },
    onError: handleMutationError("Nao foi possivel criar o cliente.", options)
  });
}

export function useUpdateCustomerMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, customer }: Required<CustomerMutationInput>) =>
      commercialService.updateCustomer(requireWorkspace(workspaceId), customerId, customer),
    onSuccess: (_customer, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.customer(resolvedWorkspaceId, input.customerId) });
      notifyMutationSuccess("Cliente atualizado.", options);
    },
    onError: handleMutationError("Nao foi possivel atualizar o cliente.", options)
  });
}

export function useConvertWorkItemToCustomerMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConvertWorkItemToCustomerInput) =>
      commercialService.convertWorkItemToCustomer(requireWorkspace(workspaceId), input.workItemId, {
        customerId: input.customerId,
        customer: input.customer,
        fields: input.fields,
        customFieldValues: input.customFieldValues
      }),
    onSuccess: (_customer, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workItem(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("WorkItem convertido em cliente.", options);
    },
    onError: handleMutationError("Nao foi possivel converter o WorkItem em cliente.", options)
  });
}

export function useTransformWorkItemTypeMutation(workspaceId: string | null | undefined, options?: WorkItemMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransformWorkItemTypeInput) =>
      commercialService.transformWorkItemType(requireWorkspace(workspaceId), input.workItemId, {
        transformationId: input.transformationId,
        toTypeId: input.toTypeId,
        toTypeSlug: input.toTypeSlug,
        stateId: input.stateId,
        stateSlug: input.stateSlug,
        customFieldValues: input.customFieldValues,
        defaultValuesForNewFields: input.defaultValuesForNewFields
      }),
    onSuccess: (_item, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateWorkItemCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.signals(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.workItem(resolvedWorkspaceId, input.workItemId) });
      void queryClient.invalidateQueries({ queryKey: commercialQueryKeys.transformations(resolvedWorkspaceId) });
      notifyMutationSuccess("Signal transformado em WorkItem comercial sem perder dados.", options);
    },
    onError: handleMutationError("Nao foi possivel transformar o WorkItem.", options)
  });
}

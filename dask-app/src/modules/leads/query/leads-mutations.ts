import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { leadsService } from "@/modules/leads/api";
import type {
  CreateCommercialWorkItemInput,
  ConvertLeadToCustomerInput,
  CustomerMutationInput,
  LinkCustomerToLeadInput,
  TransformWorkItemTypeInput,
  UpdateCommercialWorkItemInput
} from "@/modules/leads/model/types";
import { leadsQueryKeys } from "@/modules/leads/query/leads-query-keys";
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

function invalidateLeadCollections(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.workspace(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspaceId) });
}

function handleMutationError(title: string) {
  return (error: unknown) => {
    toast.error(title, { description: error instanceof Error ? error.message : "Tente novamente." });
  };
}

interface LeadMutationOptions {
  silent?: boolean;
}

function notifyMutationSuccess(message: string, options?: LeadMutationOptions) {
  if (!options?.silent) {
    toast.success(message);
  }
}

export function useCreateLeadMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommercialWorkItemInput) => createCommercialWorkItemMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      notifyMutationSuccess("Lead criado como WorkItem comercial.", options);
    },
    onError: handleMutationError("Nao foi possivel criar o lead.")
  });
}

export function createCommercialWorkItemMutationRequest(
  workspaceId: string | null | undefined,
  input: CreateCommercialWorkItemInput
) {
  return leadsService.createCommercialWorkItem(requireWorkspace(workspaceId), input);
}

export function useCreateSignalMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommercialWorkItemInput) => createCommercialWorkItemMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      notifyMutationSuccess("Sinal criado como WorkItem comercial.", options);
    },
    onError: handleMutationError("Nao foi possivel criar o sinal.")
  });
}

export function moveLeadInFlowMutationRequest(
  workspaceId: string | null | undefined,
  input: { workItemId: string; stateSlug?: string; stateId?: string }
) {
  return leadsService.moveCommercialWorkItem(requireWorkspace(workspaceId), input);
}

export function useUpdateLeadMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCommercialWorkItemInput) =>
      leadsService.updateCommercialWorkItem(requireWorkspace(workspaceId), input),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lead(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Lead atualizado.", options);
    },
    onError: handleMutationError("Nao foi possivel atualizar o lead.")
  });
}

export function useMoveLeadInFlowMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { workItemId: string; stateSlug?: string; stateId?: string }) =>
      moveLeadInFlowMutationRequest(workspaceId, input),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.flow(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lead(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Lead movido no fluxo comercial.", options);
    },
    onError: handleMutationError("Nao foi possivel mover o lead.")
  });
}

export function useLinkCustomerToLeadMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkCustomerToLeadInput) =>
      leadsService.updateCommercialWorkItem(requireWorkspace(workspaceId), {
        workItemId: input.workItemId,
        fields: input.fields,
        customFieldValues: input.customFieldValues
      }),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lead(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Cliente vinculado ao lead.", options);
    },
    onError: handleMutationError("Nao foi possivel vincular o cliente.")
  });
}

export function useUnlinkCustomerFromLeadMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkCustomerToLeadInput) =>
      leadsService.updateCommercialWorkItem(requireWorkspace(workspaceId), {
        workItemId: input.workItemId,
        fields: input.fields,
        customFieldValues: input.customFieldValues
      }),
    onSuccess: (_snapshot, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lead(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Vinculo de cliente removido.", options);
    },
    onError: handleMutationError("Nao foi possivel remover o vinculo.")
  });
}

export function useCreateCustomerMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CustomerMutationInput["customer"]) =>
      leadsService.createCustomer(requireWorkspace(workspaceId), input as Parameters<typeof leadsService.createCustomer>[1]),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      notifyMutationSuccess("Cliente criado.", options);
    },
    onError: handleMutationError("Nao foi possivel criar o cliente.")
  });
}

export function useUpdateCustomerMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, customer }: Required<CustomerMutationInput>) =>
      leadsService.updateCustomer(requireWorkspace(workspaceId), customerId, customer),
    onSuccess: (_customer, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.customer(resolvedWorkspaceId, input.customerId) });
      notifyMutationSuccess("Cliente atualizado.", options);
    },
    onError: handleMutationError("Nao foi possivel atualizar o cliente.")
  });
}

export function useConvertLeadToCustomerMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ConvertLeadToCustomerInput) =>
      leadsService.convertLeadToCustomer(requireWorkspace(workspaceId), input.workItemId, {
        customerId: input.customerId,
        customer: input.customer,
        fields: input.fields,
        customFieldValues: input.customFieldValues
      }),
    onSuccess: (_customer, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lead(resolvedWorkspaceId, input.workItemId) });
      notifyMutationSuccess("Lead convertido em cliente.", options);
    },
    onError: handleMutationError("Nao foi possivel converter o lead.")
  });
}

export function useTransformWorkItemTypeMutation(workspaceId: string | null | undefined, options?: LeadMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransformWorkItemTypeInput) =>
      leadsService.transformWorkItemType(requireWorkspace(workspaceId), input.workItemId, {
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
      invalidateLeadCollections(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.signals(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lead(resolvedWorkspaceId, input.workItemId) });
      void queryClient.invalidateQueries({ queryKey: leadsQueryKeys.transformations(resolvedWorkspaceId) });
      notifyMutationSuccess("Signal transformado em Lead sem perder dados.", options);
    },
    onError: handleMutationError("Nao foi possivel transformar o WorkItem.")
  });
}

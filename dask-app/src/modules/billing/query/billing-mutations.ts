import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { billingService } from "@/modules/billing/api/billing-service";
import type {
  ConnectCatalogBillingType,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder,
  CreateConnectCheckoutSessionInput,
  SubscriptionPlan
} from "@/modules/billing/model/types";
import { billingQueryKeys } from "@/modules/billing/query/billing-query-keys";
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

function handleMutationError(title: string) {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : "Tente novamente.";
    toast.error(title, { description: message });
  };
}

function invalidateBillingWorkspace(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: billingQueryKeys.workspace(workspaceId) });
}

interface BillingPaymentOrdersPage {
  items: ConnectPaymentOrder[];
  nextCursor?: string | null;
}

function upsertPaymentOrderInCache(queryClient: QueryClient, workspaceId: string, order: ConnectPaymentOrder) {
  queryClient.setQueryData(billingQueryKeys.paymentOrder(workspaceId, order.id), order);
  queryClient.setQueriesData<BillingPaymentOrdersPage>(
    { queryKey: [...billingQueryKeys.workspace(workspaceId), "payment-orders"] },
    (current) => {
      if (!current) return current;
      const existingIndex = current.items.findIndex((item) => item.id === order.id);
      if (existingIndex < 0) {
        return { ...current, items: [order, ...current.items] };
      }
      return {
        ...current,
        items: current.items.map((item) => (item.id === order.id ? order : item))
      };
    }
  );
}

function markPaymentOrderCanceledInCache(queryClient: QueryClient, workspaceId: string, orderId: string) {
  const now = new Date().toISOString();
  const markCanceled = (order: ConnectPaymentOrder): ConnectPaymentOrder => ({
    ...order,
    status: "CANCELED",
    customerStatus: "canceled",
    canceledAt: order.canceledAt ?? now,
    updatedAt: now
  });

  queryClient.setQueryData<ConnectPaymentOrder | undefined>(
    billingQueryKeys.paymentOrder(workspaceId, orderId),
    (current) => (current ? markCanceled(current) : current)
  );
  queryClient.setQueriesData<BillingPaymentOrdersPage>(
    { queryKey: [...billingQueryKeys.workspace(workspaceId), "payment-orders"] },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) => (item.id === orderId ? markCanceled(item) : item))
      };
    }
  );
}

export function useCreateConnectAccountMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: { refreshUrl?: string; returnUrl?: string }) =>
      billingService.createConnectOnboardingLink(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateBillingWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Onboarding Connect iniciado.");
    },
    onError: handleMutationError("Nao foi possivel iniciar o onboarding Connect.")
  });
}

export function useCreateSubscriptionCheckoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planCode: SubscriptionPlan) => billingService.createCheckoutSession(planCode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.subscription() });
    },
    onError: handleMutationError("Nao foi possivel iniciar o checkout.")
  });
}

export function useCreateBillingPortalSessionMutation() {
  return useMutation({
    mutationFn: () => billingService.createPortalSession(),
    onError: handleMutationError("Nao foi possivel abrir a gestao da assinatura.")
  });
}

export function useRefreshConnectAccountMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => billingService.getConnectAccountStatus(requireWorkspace(workspaceId)),
    onSuccess: (status) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(billingQueryKeys.connectAccount(resolvedWorkspaceId), status);
      toast.success("Status Connect atualizado.");
    },
    onError: handleMutationError("Nao foi possivel atualizar o status Connect.")
  });
}

export interface SaveBillingCatalogItemInput {
  itemId?: string;
  kind: ConnectCatalogItemKind;
  billingType?: ConnectCatalogBillingType;
  recurringInterval?: ConnectCatalogRecurringInterval;
  recurringIntervalCount?: number;
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export type BillingConnectCapability = "boleto_payments";

export function useCreateCatalogItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveBillingCatalogItemInput) =>
      billingService.createConnectCatalogItem(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: [...billingQueryKeys.workspace(resolvedWorkspaceId), "catalog"] });
      toast.success("Item de catalogo criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o item de catalogo.")
  });
}

export function useUpdateCatalogItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveBillingCatalogItemInput & { itemId: string }) =>
      billingService.updateConnectCatalogItem(requireWorkspace(workspaceId), input.itemId, input),
    onSuccess: (item) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(billingQueryKeys.catalogItem(resolvedWorkspaceId, item.id), item);
      void queryClient.invalidateQueries({ queryKey: [...billingQueryKeys.workspace(resolvedWorkspaceId), "catalog"] });
      toast.success("Item de catalogo atualizado.");
    },
    onError: handleMutationError("Nao foi possivel atualizar o item de catalogo.")
  });
}

export function useArchiveCatalogItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      billingService.deleteConnectCatalogItem(requireWorkspace(workspaceId), itemId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: [...billingQueryKeys.workspace(resolvedWorkspaceId), "catalog"] });
      toast.success("Item de catalogo arquivado.");
    },
    onError: handleMutationError("Nao foi possivel arquivar o item de catalogo.")
  });
}

export function useCreatePaymentOrderMutation(workspaceId: string | null | undefined) {
  return useCreateCheckoutSessionMutation(workspaceId);
}

export function useCreateCheckoutSessionMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConnectCheckoutSessionInput) =>
      billingService.createConnectCheckoutSession(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: [...billingQueryKeys.workspace(resolvedWorkspaceId), "payment-orders"] });
      toast.success("Cobranca criada.");
    },
    onError: handleMutationError("Nao foi possivel criar a cobranca.")
  });
}

export function useSyncPostCheckoutMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) =>
      billingService.syncConnectPaymentOrderStatus(requireWorkspace(workspaceId), sessionId),
    onSuccess: (order) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      upsertPaymentOrderInCache(queryClient, resolvedWorkspaceId, order);
      void queryClient.invalidateQueries({ queryKey: [...billingQueryKeys.workspace(resolvedWorkspaceId), "payment-orders"] });
    },
    onError: handleMutationError("Nao foi possivel sincronizar o checkout.")
  });
}

export function useRequestConnectCapabilityMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (capability: BillingConnectCapability) =>
      billingService.requestConnectPaymentCapability(requireWorkspace(workspaceId), capability),
    onSuccess: (status) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(billingQueryKeys.connectAccount(resolvedWorkspaceId), status);
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.connectAccount(resolvedWorkspaceId) });
      toast.success("Solicitacao enviada ao Stripe Connect.");
    },
    onError: handleMutationError("Nao foi possivel solicitar essa forma de pagamento.")
  });
}

export function useResendConnectEmailMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) =>
      billingService.resendConnectPaymentOrderEmail(requireWorkspace(workspaceId), orderId),
    onSuccess: (_result, orderId) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.paymentOrder(resolvedWorkspaceId, orderId) });
      void queryClient.invalidateQueries({ queryKey: [...billingQueryKeys.workspace(resolvedWorkspaceId), "payment-orders"] });
      toast.success("Lembrete reenviado.");
    },
    onError: handleMutationError("Nao foi possivel reenviar o lembrete.")
  });
}

export function useCancelPaymentOrderMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) =>
      billingService.cancelConnectPaymentOrder(requireWorkspace(workspaceId), orderId),
    onSuccess: (_result, orderId) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      markPaymentOrderCanceledInCache(queryClient, resolvedWorkspaceId, orderId);
      toast.success("Cobranca cancelada.");
    },
    onError: handleMutationError("Nao foi possivel cancelar a cobranca.")
  });
}

export function useCreatePortalTokenMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, expiresInSeconds }: { orderId: string; expiresInSeconds?: number }) =>
      billingService.createPaymentOrderPortalToken(requireWorkspace(workspaceId), orderId, { expiresInSeconds }),
    onSuccess: (_token, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.portalToken(resolvedWorkspaceId, input.orderId) });
      toast.success("Token do portal criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o token do portal.")
  });
}

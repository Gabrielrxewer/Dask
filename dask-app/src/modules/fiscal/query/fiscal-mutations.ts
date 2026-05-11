import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fiscalService } from "@/modules/fiscal/api/fiscal-service";
import type {
  CreateFiscalDocumentInput,
  FiscalCatalogProfile,
  FiscalCompanyConfig,
  FiscalDocument,
  FiscalDocumentDetails,
  FiscalDocumentType,
  FiscalOperationTemplate,
  FiscalReceivedType
} from "@/modules/fiscal/model/types";
import { fiscalQueryKeys } from "@/modules/fiscal/query/fiscal-query-keys";
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

function invalidateFiscalWorkspace(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.workspace(workspaceId) });
}

type FiscalDocumentCollection = FiscalDocument[] | { items: FiscalDocument[]; nextCursor?: string | null };

function replaceFiscalDocument(items: FiscalDocument[], document: FiscalDocument) {
  const index = items.findIndex((item) => item.id === document.id);
  if (index < 0) return items;
  const nextItems = [...items];
  nextItems[index] = document;
  return nextItems;
}

function syncFiscalDocumentCache(queryClient: QueryClient, workspaceId: string, document: FiscalDocument) {
  queryClient.setQueryData<FiscalDocumentDetails | undefined>(
    fiscalQueryKeys.document(workspaceId, document.id),
    (current) => ({ document, integrationLogs: current?.integrationLogs ?? [] })
  );
  queryClient.setQueriesData<FiscalDocumentCollection>(
    { queryKey: [...fiscalQueryKeys.workspace(workspaceId), "documents"] },
    (current) => {
      if (!current) return current;
      if (Array.isArray(current)) {
        const items = replaceFiscalDocument(current, document);
        return items === current ? current : items;
      }
      const items = replaceFiscalDocument(current.items, document);
      return items === current.items ? current : { ...current, items };
    }
  );
}

export function useCreateFiscalCompanyMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<FiscalCompanyConfig> & {
      displayName: string;
      legalName: string;
      cnpj: string;
      focusToken: string;
    }) => fiscalService.createCompany(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.companies(resolvedWorkspaceId) });
      toast.success("Empresa fiscal criada.");
    },
    onError: handleMutationError("Nao foi possivel criar a empresa fiscal.")
  });
}

export function useUpdateFiscalCompanyMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ companyId, patch }: { companyId: string; patch: Partial<FiscalCompanyConfig> }) =>
      fiscalService.updateCompany(requireWorkspace(workspaceId), companyId, patch),
    onSuccess: (company) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(fiscalQueryKeys.company(resolvedWorkspaceId, company.id), company);
      void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.companies(resolvedWorkspaceId) });
      toast.success("Empresa fiscal atualizada.");
    },
    onError: handleMutationError("Nao foi possivel atualizar a empresa fiscal.")
  });
}

export function useValidateFiscalCompanyMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (companyId: string) => fiscalService.validateCompany(requireWorkspace(workspaceId), companyId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.companies(resolvedWorkspaceId) });
      toast.success("Empresa fiscal validada.");
    },
    onError: handleMutationError("Nao foi possivel validar a empresa fiscal.")
  });
}

export function useCreateFiscalDraftMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateFiscalDocumentInput) =>
      fiscalService.createDocument(requireWorkspace(workspaceId), input),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      syncFiscalDocumentCache(queryClient, resolvedWorkspaceId, document);
      invalidateFiscalWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Rascunho fiscal criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o rascunho fiscal.")
  });
}

export function useUpdateFiscalDraftMutation() {
  return useMutation({
    mutationFn: async () => {
      // TODO(fiscal): wire this to a dedicated draft update endpoint when the review flow is split from document creation.
      throw new Error("Atualizacao de draft fiscal sera conectada ao endpoint dedicado.");
    },
    onError: handleMutationError("Nao foi possivel atualizar o draft fiscal.")
  });
}

export function useIssueFiscalDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => fiscalService.issueDocument(requireWorkspace(workspaceId), documentId),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      syncFiscalDocumentCache(queryClient, resolvedWorkspaceId, document);
      invalidateFiscalWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Emissao fiscal enviada.");
    },
    onError: handleMutationError("Nao foi possivel emitir o documento fiscal.")
  });
}

export function useRetryFiscalDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => fiscalService.retryDocument(requireWorkspace(workspaceId), documentId),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      syncFiscalDocumentCache(queryClient, resolvedWorkspaceId, document);
      invalidateFiscalWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Retry fiscal solicitado.");
    },
    onError: handleMutationError("Nao foi possivel solicitar retry fiscal.")
  });
}

export function useEmitFiscalDraftMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (draftId: string) => fiscalService.emitDraft(requireWorkspace(workspaceId), draftId),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      syncFiscalDocumentCache(queryClient, resolvedWorkspaceId, document);
      invalidateFiscalWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Draft fiscal emitido.");
    },
    onError: handleMutationError("Nao foi possivel emitir o draft fiscal.")
  });
}

export function useCancelFiscalDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ documentId, justification }: { documentId: string; justification?: string }) =>
      fiscalService.cancelDocument(requireWorkspace(workspaceId), documentId, justification),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      syncFiscalDocumentCache(queryClient, resolvedWorkspaceId, document);
      invalidateFiscalWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Cancelamento fiscal solicitado.");
    },
    onError: handleMutationError("Nao foi possivel cancelar o documento fiscal.")
  });
}

export function useSyncReceivedDocumentsMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { companyConfigId: string; type: FiscalReceivedType; trigger?: "MANUAL" | "SCHEDULED" | "WEBHOOK" | "RETRY" }) =>
      fiscalService.syncReceived(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateFiscalWorkspace(queryClient, resolvedWorkspaceId);
      toast.success("Sincronizacao fiscal iniciada.");
    },
    onError: handleMutationError("Nao foi possivel iniciar a sincronizacao fiscal.")
  });
}

export function useUpdateFiscalEmissionPolicyMutation() {
  return useMutation({
    mutationFn: async () => {
      // TODO(fiscal): connect this mutation after the backend FiscalEmissionPolicy model/route is introduced.
      throw new Error("Politica fiscal sera conectada na fase de policy dedicada.");
    },
    onError: handleMutationError("Nao foi possivel atualizar a politica fiscal.")
  });
}

export function useCreateFiscalProfileMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<FiscalCatalogProfile> & { name: string; itemType: "PRODUCT" | "SERVICE" }) =>
      fiscalService.upsertCatalogProfile(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.profiles(resolvedWorkspaceId) });
      toast.success("Perfil fiscal criado.");
    },
    onError: handleMutationError("Nao foi possivel salvar o perfil fiscal.")
  });
}

export const useUpdateFiscalProfileMutation = useCreateFiscalProfileMutation;

export function useCreateFiscalOperationTemplateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<FiscalOperationTemplate> & { name: string; documentType: FiscalDocumentType }) =>
      fiscalService.upsertOperationTemplate(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.operationTemplates(resolvedWorkspaceId) });
      toast.success("Template fiscal salvo.");
    },
    onError: handleMutationError("Nao foi possivel salvar o template fiscal.")
  });
}

export const useUpdateFiscalOperationTemplateMutation = useCreateFiscalOperationTemplateMutation;

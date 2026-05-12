import { useMemo } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  publicCommercialDocumentService,
  type PublicCommercialDocumentDecision
} from "@/pages/proposal-public-page/api/public-commercial-document-service";
import { workspaceService } from "@/modules/workspace/api";
import type {
  DocumentAssetType,
  DocumentLinkedEntityType,
  DocumentKind,
  WorkspaceDocument,
  WorkspaceDocumentMetadata,
  RunDocumentationAssistantInput,
  RunDocumentationAssistantResult,
  WorkItemLinkedDocument
} from "@/modules/workspace";
import { workspaceQueryKeys } from "@/modules/workspace/query";
import { toast } from "@/shared/ui/toast";
import { documentationQueryKeys } from "@/modules/documentation/query/documentation-query-keys";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

function invalidateDocumentation(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workspace(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspaceId) });
}

function setDocumentQueryData(queryClient: QueryClient, workspaceId: string, document: WorkspaceDocument) {
  queryClient.setQueryData(documentationQueryKeys.document(workspaceId, document.id), document);
}

function handleMutationError(title: string) {
  return (error: unknown) => {
    toast.error(title, { description: error instanceof Error ? error.message : "Tente novamente." });
  };
}

export function useCreateDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      title: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType;
      linkedEntityId?: string;
      tags?: string[];
      metadata?: WorkspaceDocumentMetadata;
      position?: number;
    }) => workspaceService.createWorkspaceDocument(requireWorkspace(workspaceId), input),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      setDocumentQueryData(queryClient, resolvedWorkspaceId, document);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Documento criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o documento.")
  });
}

export function useUpdateDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      documentId: string;
      patch: {
        title?: string;
        content?: string;
        kind?: DocumentKind;
        linkedEntityType?: DocumentLinkedEntityType | null;
        linkedEntityId?: string | null;
        tags?: string[];
        metadata?: WorkspaceDocumentMetadata;
        position?: number;
        expectedUpdatedAt?: string;
      };
    }) => workspaceService.updateWorkspaceDocument(requireWorkspace(workspaceId), input.documentId, input.patch),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      setDocumentQueryData(queryClient, resolvedWorkspaceId, document);
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.documents(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.tags(resolvedWorkspaceId) });
    },
    onError: handleMutationError("Nao foi possivel salvar o documento.")
  });
}

export function useDeleteDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => workspaceService.deleteWorkspaceDocument(requireWorkspace(workspaceId), documentId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Documento excluido.");
    },
    onError: handleMutationError("Nao foi possivel excluir o documento.")
  });
}

export function useCreateFolderMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; parentId?: string | null; position?: number }) =>
      workspaceService.createWorkspaceDocumentFolder(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Pasta criada.");
    },
    onError: handleMutationError("Nao foi possivel criar a pasta.")
  });
}

export function useUpdateFolderMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { folderId: string; patch: { name?: string; parentId?: string | null; position?: number } }) =>
      workspaceService.updateWorkspaceDocumentFolder(requireWorkspace(workspaceId), input.folderId, input.patch),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Pasta atualizada.");
    },
    onError: handleMutationError("Nao foi possivel atualizar a pasta.")
  });
}

export function useDeleteFolderMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (folderId: string) => workspaceService.deleteWorkspaceDocumentFolder(requireWorkspace(workspaceId), folderId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Pasta excluida.");
    },
    onError: handleMutationError("Nao foi possivel excluir a pasta.")
  });
}

export function useMoveDocumentMutation(workspaceId: string | null | undefined) {
  const updateDocument = useUpdateDocumentMutation(workspaceId);

  return {
    ...updateDocument,
    mutateAsync: (input: { document: WorkspaceDocument; folderId: string | null }) => {
      const metadata = { ...(input.document.metadata ?? {}) };
      if (input.folderId) {
        metadata.folderId = input.folderId;
      } else {
        delete metadata.folderId;
      }
      return updateDocument.mutateAsync({
        documentId: input.document.id,
        patch: { metadata, expectedUpdatedAt: input.document.updatedAt }
      });
    }
  };
}

export function useMoveFolderMutation(workspaceId: string | null | undefined) {
  return useUpdateFolderMutation(workspaceId);
}

export function useUpdateDocumentTagsMutation(workspaceId: string | null | undefined) {
  const updateDocument = useUpdateDocumentMutation(workspaceId);

  return {
    ...updateDocument,
    mutateAsync: (input: { document: WorkspaceDocument; tags: string[] }) =>
      updateDocument.mutateAsync({
        documentId: input.document.id,
        patch: { tags: input.tags, expectedUpdatedAt: input.document.updatedAt }
      })
  };
}

export function useLinkDocumentWorkItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { workItemId: string; documentId: string }) =>
      workspaceService.linkDocumentToWorkItem(requireWorkspace(workspaceId), input.workItemId, input.documentId),
    onSuccess: (_documents, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workItemContext(resolvedWorkspaceId, input.workItemId) });
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workItemDocuments(resolvedWorkspaceId, input.workItemId) });
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Documento vinculado ao card.");
    },
    onError: handleMutationError("Nao foi possivel vincular o card.")
  });
}

export function useUnlinkDocumentWorkItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { workItemId: string; documentId: string }) =>
      workspaceService.unlinkDocumentFromWorkItem(requireWorkspace(workspaceId), input.workItemId, input.documentId),
    onSuccess: (_void, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workItemContext(resolvedWorkspaceId, input.workItemId) });
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.workItemDocuments(resolvedWorkspaceId, input.workItemId) });
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Vinculo removido.");
    },
    onError: handleMutationError("Nao foi possivel remover o vinculo.")
  });
}

export function useSendCommercialDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      documentId: string;
      email?: string;
      emails?: string[];
      subject?: string;
      message?: string;
      includeAttachments?: boolean;
      selectedAssetIds?: string[];
      expirationDate?: string | null;
      requireLogin?: boolean;
      allowAcceptReject?: boolean;
      linkedWorkItemId?: string | null;
      resolvedPreviewSnapshot?: string;
    }) =>
      workspaceService.sendWorkspaceDocument(requireWorkspace(workspaceId), input.documentId, {
        email: input.email,
        emails: input.emails,
        subject: input.subject,
        message: input.message,
        includeAttachments: input.includeAttachments,
        selectedAssetIds: input.selectedAssetIds,
        expirationDate: input.expirationDate,
        requireLogin: input.requireLogin,
        allowAcceptReject: input.allowAcceptReject,
        linkedWorkItemId: input.linkedWorkItemId,
        resolvedPreviewSnapshot: input.resolvedPreviewSnapshot
      }),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      setDocumentQueryData(queryClient, resolvedWorkspaceId, document);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Documento enviado para cliente.");
    },
    onError: handleMutationError("Nao foi possivel enviar o documento.")
  });
}

export function useDecideCommercialDocumentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      documentId: string;
      decision: "approve" | "accept" | "sign" | "reject";
      reason?: string | null;
    }) =>
      workspaceService.decideWorkspaceDocument(requireWorkspace(workspaceId), input.documentId, {
        decision: input.decision,
        reason: input.reason
      }),
    onSuccess: (document) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      setDocumentQueryData(queryClient, resolvedWorkspaceId, document);
      invalidateDocumentation(queryClient, resolvedWorkspaceId);
      toast.success("Decisao registrada.");
    },
    onError: handleMutationError("Nao foi possivel registrar a decisao.")
  });
}

export function usePublicCommercialDocumentDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: decidePublicCommercialDocumentMutationRequest,
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.publicDocument(input.publicAccessId) });
    }
  });
}

export function decidePublicCommercialDocumentMutationRequest(input: {
  publicAccessId: string;
  decision: PublicCommercialDocumentDecision;
}) {
  return publicCommercialDocumentService.decide(input.publicAccessId, input.decision);
}

export function useAcceptCommercialDocumentMutation() {
  return useMutation({
    mutationFn: (input: { publicAccessId: string; decision?: "approve" | "accept" | "sign" }) =>
      decidePublicCommercialDocumentMutationRequest({
        publicAccessId: input.publicAccessId,
        decision: input.decision ?? "accept"
      }),
    onError: handleMutationError("Nao foi possivel registrar o aceite.")
  });
}

export function useRejectCommercialDocumentMutation() {
  return useMutation({
    mutationFn: (input: { publicAccessId: string }) =>
      decidePublicCommercialDocumentMutationRequest({ publicAccessId: input.publicAccessId, decision: "reject" }),
    onError: handleMutationError("Nao foi possivel registrar a recusa.")
  });
}

export function useUploadDocumentAssetMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      documentId: string;
      type: DocumentAssetType;
      file: File;
      filename?: string;
      contentType?: string;
      onProgress?: (progress: { loaded: number; total: number | null; percent: number | null }) => void;
    }) =>
      workspaceService.uploadDocumentAsset(requireWorkspace(workspaceId), input.documentId, {
        type: input.type,
        filename: input.filename,
        contentType: input.contentType,
        file: input.file,
        onProgress: input.onProgress
      }),
    onSuccess: (asset) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.assets(resolvedWorkspaceId, asset.documentId) });
      toast.success("Asset enviado.");
    },
    onError: handleMutationError("Nao foi possivel enviar o asset.")
  });
}

export function useDeleteDocumentAssetMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { documentId: string; assetId: string }) =>
      workspaceService.deleteDocumentAsset(requireWorkspace(workspaceId), input.documentId, input.assetId),
    onSuccess: (_void, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: documentationQueryKeys.assets(resolvedWorkspaceId, input.documentId) });
      toast.success("Asset removido.");
    },
    onError: handleMutationError("Nao foi possivel remover o asset.")
  });
}

export function useRunDocumentationAssistantMutation(workspaceId: string | null | undefined) {
  return useMutation({
    mutationFn: (input: RunDocumentationAssistantInput) =>
      workspaceService.runDocumentationAssistant(requireWorkspace(workspaceId), input),
    onError: handleMutationError("Nao foi possivel processar a IA de documentacao.")
  });
}

export interface WorkspaceDocumentActions {
  listWorkspaceDocuments: () => Promise<WorkspaceDocument[]>;
  createWorkspaceDocument: (input: {
    title: string;
    content?: string;
    kind?: DocumentKind;
    linkedEntityType?: DocumentLinkedEntityType;
    linkedEntityId?: string;
    tags?: string[];
    metadata?: WorkspaceDocumentMetadata;
    position?: number;
  }) => Promise<WorkspaceDocument>;
  listWorkItemLinkedDocuments: (itemId: string) => Promise<WorkItemLinkedDocument[]>;
  linkDocumentToWorkItem: (itemId: string, documentId: string) => Promise<WorkItemLinkedDocument[]>;
  unlinkDocumentFromWorkItem: (itemId: string, documentId: string) => Promise<void>;
  runDocumentationAssistant: (input: RunDocumentationAssistantInput) => Promise<RunDocumentationAssistantResult>;
}

export function useWorkspaceDocumentActions(workspaceId: string | null | undefined): WorkspaceDocumentActions {
  const queryClient = useQueryClient();
  const { mutateAsync: createDocument } = useCreateDocumentMutation(workspaceId);
  const { mutateAsync: linkDocument } = useLinkDocumentWorkItemMutation(workspaceId);
  const { mutateAsync: unlinkDocument } = useUnlinkDocumentWorkItemMutation(workspaceId);
  const { mutateAsync: runAssistant } = useRunDocumentationAssistantMutation(workspaceId);

  return useMemo(
    () => ({
      listWorkspaceDocuments: () => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: documentationQueryKeys.documents(workspaceId),
          queryFn: () => workspaceService.listWorkspaceDocuments(workspaceId)
        });
      },
      createWorkspaceDocument: (input) => createDocument(input),
      listWorkItemLinkedDocuments: (itemId) => {
        if (!isWorkspaceReady(workspaceId)) return Promise.resolve([]);
        return queryClient.fetchQuery({
          queryKey: documentationQueryKeys.workItemDocuments(workspaceId, itemId),
          queryFn: () => workspaceService.listWorkItemLinkedDocuments(workspaceId, itemId)
        });
      },
      linkDocumentToWorkItem: (itemId, documentId) => linkDocument({ workItemId: itemId, documentId }),
      unlinkDocumentFromWorkItem: async (itemId, documentId) => {
        await unlinkDocument({ workItemId: itemId, documentId });
      },
      runDocumentationAssistant: (input) => runAssistant(input)
    }),
    [createDocument, linkDocument, queryClient, runAssistant, unlinkDocument, workspaceId]
  );
}

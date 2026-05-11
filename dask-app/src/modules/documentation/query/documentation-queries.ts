import { useQuery } from "@tanstack/react-query";
import { publicCommercialDocumentService } from "@/pages/proposal-public-page/api/public-commercial-document-service";
import { workspaceService } from "@/modules/workspace/api";
import type { WorkspaceDocument, WorkspaceDocumentFilters } from "@/modules/workspace";
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

export function useDocumentsQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceDocumentFilters
) {
  return useQuery({
    queryKey: documentationQueryKeys.documents(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listWorkspaceDocuments(requireWorkspace(workspaceId), filters),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useDocumentsPageQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceDocumentFilters
) {
  return useQuery({
    queryKey: [...documentationQueryKeys.documents(workspaceId ?? "__missing_workspace__", filters), "page"] as const,
    queryFn: () => workspaceService.listWorkspaceDocumentsPage(requireWorkspace(workspaceId), filters),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useDocumentQuery(workspaceId: string | null | undefined, documentId: string | null | undefined) {
  return useQuery<WorkspaceDocument | null>({
    queryKey: documentationQueryKeys.document(workspaceId ?? "__missing_workspace__", documentId),
    queryFn: async () => {
      const documents = await workspaceService.listWorkspaceDocuments(requireWorkspace(workspaceId));
      return documents.find((document) => document.id === documentId) ?? null;
    },
    enabled: isWorkspaceReady(workspaceId) && Boolean(documentId)
  });
}

export function useFoldersQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: documentationQueryKeys.folders(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.listWorkspaceDocumentFolders(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useDocumentAssetsQuery(
  workspaceId: string | null | undefined,
  documentId: string | null | undefined
) {
  return useQuery({
    queryKey: documentationQueryKeys.assets(workspaceId ?? "__missing_workspace__", documentId),
    queryFn: () => workspaceService.listDocumentAssets(requireWorkspace(workspaceId), documentId ?? ""),
    enabled: isWorkspaceReady(workspaceId) && Boolean(documentId)
  });
}

export function useDocumentTagsQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: documentationQueryKeys.tags(workspaceId ?? "__missing_workspace__"),
    queryFn: async () => {
      const documents = await workspaceService.listWorkspaceDocuments(requireWorkspace(workspaceId));
      return Array.from(new Set(documents.flatMap((document) => document.tags ?? []))).sort((left, right) =>
        left.localeCompare(right)
      );
    },
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useWorkItemDocumentContextQuery(
  workspaceId: string | null | undefined,
  workItemId: string | null | undefined
) {
  return useQuery({
    queryKey: documentationQueryKeys.workItemContext(workspaceId ?? "__missing_workspace__", workItemId),
    queryFn: async () => {
      const snapshot = await workspaceService.getSnapshot(requireWorkspace(workspaceId));
      return {
        workItem: snapshot.tasks.find((task) => task.id === workItemId) ?? null,
        workspace: snapshot
      };
    },
    enabled: isWorkspaceReady(workspaceId) && Boolean(workItemId)
  });
}

export function usePublicCommercialDocumentQuery(publicAccessId: string | null | undefined) {
  return useQuery({
    queryKey: documentationQueryKeys.publicDocument(publicAccessId),
    queryFn: () => publicCommercialDocumentService.getByToken(publicAccessId ?? ""),
    enabled: Boolean(publicAccessId)
  });
}

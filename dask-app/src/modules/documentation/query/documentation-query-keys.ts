import type { WorkspaceDocumentFilters } from "@/modules/workspace";

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | ""> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as Record<string, TValue>;
}

export function normalizeDocumentationFilters(filters?: WorkspaceDocumentFilters) {
  return {
    ...cleanRecord<string | number>({
      search: filters?.search?.trim(),
      type: filters?.type,
      kind: filters?.kind,
      folderId: filters?.folderId ?? undefined,
      status: filters?.status,
      commercialStatus: filters?.commercialStatus,
      linkedWorkItemId: filters?.linkedWorkItemId,
      createdBy: filters?.createdBy,
      updatedAtFrom: filters?.updatedAtFrom,
      updatedAtTo: filters?.updatedAtTo,
      visibility: filters?.visibility,
      page: filters?.page,
      pageSize: filters?.pageSize,
      limit: filters?.limit,
      cursor: filters?.cursor ?? undefined,
      sort: filters?.sort
    }),
    tags: filters?.tags?.filter(Boolean) ?? []
  };
}

export const documentationQueryKeys = {
  all: ["documentation"] as const,
  workspace: (workspaceId: string) => [...documentationQueryKeys.all, workspaceId] as const,
  documents: (workspaceId: string, filters?: WorkspaceDocumentFilters) =>
    [...documentationQueryKeys.workspace(workspaceId), "documents", normalizeDocumentationFilters(filters)] as const,
  document: (workspaceId: string, documentId: string | null | undefined) =>
    [...documentationQueryKeys.workspace(workspaceId), "documents", documentId ?? "__missing_document__"] as const,
  folders: (workspaceId: string, filters?: Pick<WorkspaceDocumentFilters, "search" | "visibility">) =>
    [...documentationQueryKeys.workspace(workspaceId), "folders", cleanRecord(filters)] as const,
  folderTree: (workspaceId: string, filters?: Pick<WorkspaceDocumentFilters, "search" | "visibility">) =>
    [...documentationQueryKeys.workspace(workspaceId), "folder-tree", cleanRecord(filters)] as const,
  tags: (workspaceId: string) => [...documentationQueryKeys.workspace(workspaceId), "tags"] as const,
  assets: (workspaceId: string, documentId: string | null | undefined) =>
    [...documentationQueryKeys.document(workspaceId, documentId), "assets"] as const,
  commercialStatus: (workspaceId: string, documentId: string | null | undefined) =>
    [...documentationQueryKeys.document(workspaceId, documentId), "commercial-status"] as const,
  publicDocument: (publicAccessId: string | null | undefined) =>
    [...documentationQueryKeys.all, "public", publicAccessId ?? "__missing_public_access__"] as const,
  workItemContext: (workspaceId: string, workItemId: string | null | undefined) =>
    [...documentationQueryKeys.workspace(workspaceId), "work-item-context", workItemId ?? "__missing_work_item__"] as const,
  workItemDocuments: (workspaceId: string, workItemId: string | null | undefined) =>
    [...documentationQueryKeys.workspace(workspaceId), "work-item-documents", workItemId ?? "__missing_work_item__"] as const
};

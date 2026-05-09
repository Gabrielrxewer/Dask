import { interpolateDocumentTemplate } from "@/modules/workspace/model/document-variables";
import type { DocumentationAssistantMode, WorkspaceDocument, WorkspaceDocumentFolder } from "@/modules/workspace";
import {
  buildRenderVariables,
  createMessage,
  normalizeDocumentKind,
  type AssistantMessage,
  type DocumentKindFilter
} from "./documentation-page.local";

export function filterDocumentationDocs(input: {
  docs: WorkspaceDocument[];
  documentKindFilter: DocumentKindFilter;
  fromCard: boolean;
  initialDocId: string | null;
}): WorkspaceDocument[] {
  const { docs, documentKindFilter, fromCard, initialDocId } = input;

  if (fromCard && initialDocId) {
    return docs.filter((doc) => doc.id === initialDocId);
  }
  if (documentKindFilter === "all") {
    return docs;
  }
  return docs.filter((doc) => normalizeDocumentKind(doc.kind) === documentKindFilter);
}

export function countDocumentWords(document: WorkspaceDocument | null): number {
  if (!document) return 0;
  const trimmed = document.content.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function getDocumentFolderId(document: WorkspaceDocument): string | null {
  const folderId = document.metadata?.folderId;
  return typeof folderId === "string" && folderId.length > 0 ? folderId : null;
}

export function getFolderDescendantIds(
  folders: WorkspaceDocumentFolder[],
  folderId: string
): string[] {
  const childIds = folders.filter((folder) => folder.parentId === folderId).map((folder) => folder.id);
  return childIds.flatMap((childId) => [childId, ...getFolderDescendantIds(folders, childId)]);
}

export function getFolderDocuments(
  docs: WorkspaceDocument[],
  folders: WorkspaceDocumentFolder[],
  folderId: string
): WorkspaceDocument[] {
  const folderIds = new Set([folderId, ...getFolderDescendantIds(folders, folderId)]);
  return docs.filter((doc) => {
    const docFolderId = getDocumentFolderId(doc);
    return docFolderId ? folderIds.has(docFolderId) : false;
  });
}

export function buildFolderAssistantContent(input: {
  folder: WorkspaceDocumentFolder;
  docs: WorkspaceDocument[];
}): string {
  if (input.docs.length === 0) {
    return `Pasta: ${input.folder.name}\n\nEsta pasta esta vazia.`;
  }

  return input.docs
    .map((doc, index) => [
      `## ${index + 1}. ${doc.title}`,
      `Tipo: ${normalizeDocumentKind(doc.kind)}`,
      doc.content || "(doc vazia)"
    ].join("\n\n"))
    .join("\n\n---\n\n");
}

export function renderWorkspaceDocumentMarkdown(
  document: WorkspaceDocument | null,
  snapshot: Parameters<typeof buildRenderVariables>[1]
): string {
  if (!document) {
    return "";
  }

  const variables = buildRenderVariables(document, snapshot);
  const interpolated = interpolateDocumentTemplate(document.content, variables);
  return interpolated.replace(/!\[Logo do cliente\]\(\s*\)\s*/g, "");
}

export function buildAssistantConversationHistory(input: {
  activeMessages: AssistantMessage[];
  mode: DocumentationAssistantMode;
  instruction: string;
}) {
  return [...input.activeMessages, createMessage("user", input.mode, input.instruction)]
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-8)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content.slice(0, 1800)
    }));
}

export function resolveDocumentationAssistantStatus(input: {
  isRunning: boolean;
  activeDocId: string | null;
  isSavingDocId: string | null;
}) {
  const isSavingActiveDoc = Boolean(input.activeDocId && input.isSavingDocId === input.activeDocId);

  return {
    status: input.isRunning ? "Pensando" : isSavingActiveDoc ? "Salvando" : "Pronta",
    tone: input.isRunning || isSavingActiveDoc ? "warning" : "success"
  } as const;
}

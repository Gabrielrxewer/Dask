import { interpolateDocumentTemplate } from "@/modules/workspace/model/document-variables";
import type { DocumentationAssistantMode, WorkspaceDocument } from "@/modules/workspace";
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

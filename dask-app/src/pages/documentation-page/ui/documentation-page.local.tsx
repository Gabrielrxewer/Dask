import type { CommercialDocumentStatus, DocumentationAssistantMode, DocumentKind, WorkspaceDocument } from "@/modules/workspace";
import { resolveDocumentVariables } from "@/modules/workspace/model/document-variables";
import { AppIcon } from "@/shared/ui";

export { markdownUrlTransform } from "@/modules/documentation";

export type AssistantRole = "user" | "assistant" | "system";

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  mode: DocumentationAssistantMode;
  content: string;
  createdAt: string;
}

export type EditorViewMode = "write" | "split" | "preview";
export type DocumentKindFilter = DocumentKind | "all";

export const DEFAULT_INSTRUCTIONS: Record<DocumentationAssistantMode, string> = {
  chat: "Converse comigo sobre esta doc e responda objetivamente.",
  write: "Escreva documentacao em markdown pronta para uso.",
  maintain: "Revise e atualize esta documentacao mantendo o contexto."
};

export const MODE_LABELS: Record<DocumentationAssistantMode, string> = {
  chat: "Chat",
  write: "Escrita",
  maintain: "Manutencao"
};

export const EDITOR_VIEW_LABELS: Record<EditorViewMode, string> = {
  write: "Editar",
  split: "Dividido",
  preview: "Preview"
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  wiki: "Wiki",
  proposal: "Proposta",
  contract: "Contrato"
};

export const DOCUMENT_KIND_DESCRIPTIONS: Record<DocumentKind, string> = {
  wiki: "Documente processos, regras internas e conhecimento para IA.",
  proposal: "Crie uma proposta comercial com escopo, valores, prazos e aceite.",
  contract: "Crie um contrato com clausulas basicas, partes, objeto e condicoes."
};

export const DOCUMENT_KIND_OPTIONS: DocumentKind[] = ["wiki", "proposal", "contract"];
export const DOCUMENT_KIND_FILTERS: Array<{ value: DocumentKindFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "wiki", label: "Wiki" },
  { value: "proposal", label: "Propostas" },
  { value: "contract", label: "Contratos" }
];

export const COMMERCIAL_DOCUMENT_STATUSES: CommercialDocumentStatus[] = [
  "draft",
  "sent",
  "viewed",
  "approved",
  "rejected",
  "accepted",
  "signed"
];

export function getCommercialDocumentStatus(document: WorkspaceDocument): CommercialDocumentStatus {
  const status = document.metadata?.status;
  return COMMERCIAL_DOCUMENT_STATUSES.includes(status as CommercialDocumentStatus)
    ? (status as CommercialDocumentStatus)
    : "draft";
}

export function hasCommercialDocumentBeenSent(document: WorkspaceDocument): boolean {
  const status = getCommercialDocumentStatus(document);
  return status !== "draft" || Boolean(document.metadata?.sentAt || document.metadata?.sentToEmail);
}

export function normalizeDocumentKind(kind: WorkspaceDocument["kind"] | undefined): DocumentKind {
  return kind ?? "wiki";
}

export function buildRenderVariables(
  document: WorkspaceDocument,
  workspace: Parameters<typeof resolveDocumentVariables>[0]["workspace"]
): Record<string, string> {
  const contextVars = resolveDocumentVariables({ document, workspace });
  const metadataVars = Object.entries(document.metadata ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
    if ((typeof value === "string" || typeof value === "number" || typeof value === "boolean") && String(value).trim().length > 0) {
      acc[key] = String(value);
    }
    return acc;
  }, {});
  return { ...contextVars, ...metadataVars };
}

export function renderDocumentKindIcon(kind: DocumentKind) {
  if (kind === "proposal") {
    return <AppIcon name="briefcase" size={20} />;
  }

  if (kind === "contract") {
    return <AppIcon name="receipt" size={20} />;
  }

  return <AppIcon name="documentation" size={20} />;
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function createMessage(role: AssistantRole, mode: DocumentationAssistantMode, content: string): AssistantMessage {
  return {
    id: createId(),
    role,
    mode,
    content,
    createdAt: new Date().toISOString()
  };
}

export function inferIntentMode(prompt: string, fallback: DocumentationAssistantMode): DocumentationAssistantMode {
  const normalized = prompt.toLowerCase();
  const rewritePattern = /(reescrev|reescreva|editar|edite|revise|melhore|corrija|atualize|refatore|reorganize)/;
  if (rewritePattern.test(normalized)) {
    return "maintain";
  }

  const writingPattern = /(escreva|crie|gere|adicione uma secao|nova secao|novo topico|documente)/;
  if (writingPattern.test(normalized)) {
    return "write";
  }

  return fallback;
}

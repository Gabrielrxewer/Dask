import type { Task } from "@/entities/task";
import type { WorkspaceDocument, WorkspaceSnapshot } from "@/modules/workspace";
import { resolveDocumentVariables } from "@/modules/workspace/model/document-variables";

export interface DocumentVariableContext {
  document: WorkspaceDocument;
  workItem?: Task | null;
  workspace?: WorkspaceSnapshot | null;
}

export interface DocumentVariableDefinition {
  key: string;
  label: string;
  description: string;
  resolve: (context: DocumentVariableContext) => unknown;
  publicSafe?: boolean;
}

function readField(workItem: Task | null | undefined, key: string): unknown {
  if (!workItem) return undefined;
  return (
    workItem.customFields?.[key] ??
    workItem.customFieldValuesById?.[key]
  );
}

function getAssigneeName(context: DocumentVariableContext): string {
  const assigneeId = context.workItem?.assignee;
  if (!assigneeId) return "";
  return context.workspace?.membersById?.[assigneeId]?.name ?? "";
}

export const documentVariableRegistry: DocumentVariableDefinition[] = [
  {
    key: "workItem.title",
    label: "Titulo do card",
    description: "Titulo do WorkItem vinculado.",
    resolve: ({ workItem }) => workItem?.title
  },
  {
    key: "workItem.status",
    label: "Status do card",
    description: "Status atual do WorkItem vinculado.",
    resolve: ({ workItem }) => workItem?.status
  },
  {
    key: "workItem.assignee.name",
    label: "Responsavel",
    description: "Nome do responsavel pelo WorkItem.",
    resolve: getAssigneeName
  },
  {
    key: "workItem.createdAt",
    label: "Criado em",
    description: "Data de criacao do WorkItem.",
    resolve: ({ workItem }) => (workItem as { createdAt?: string } | null | undefined)?.createdAt
  },
  {
    key: "fields.estimatedValue",
    label: "Valor estimado",
    description: "Campo comercial de valor estimado.",
    resolve: ({ workItem }) => readField(workItem, "estimatedValue")
  },
  {
    key: "fields.customerName",
    label: "Nome do cliente",
    description: "Campo de cliente do WorkItem.",
    resolve: ({ workItem }) => readField(workItem, "customerName") ?? readField(workItem, "clientName")
  },
  {
    key: "customer.name",
    label: "Cliente",
    description: "Nome do cliente vinculado ao WorkItem.",
    resolve: ({ workItem }) => readField(workItem, "customerName") ?? readField(workItem, "clientName")
  },
  {
    key: "workspace.name",
    label: "Workspace",
    description: "Nome do workspace atual.",
    resolve: ({ workspace }) => workspace?.name,
    publicSafe: true
  }
];

export function buildLegacyDocumentVariables(context: DocumentVariableContext): Record<string, string> {
  return resolveDocumentVariables({
    document: context.document,
    workItem: context.workItem ?? null,
    workspace: context.workspace ?? null
  });
}

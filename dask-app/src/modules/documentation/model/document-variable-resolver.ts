import {
  buildLegacyDocumentVariables,
  documentVariableRegistry,
  type DocumentVariableContext
} from "@/modules/documentation/model/document-variable-registry";
import { parseDocumentVariables } from "@/modules/documentation/model/document-variable-parser";

export interface DocumentVariableDiagnostic {
  key: string;
  message: string;
  severity: "warning" | "error";
}

export interface ResolvedDocumentMarkdown {
  markdown: string;
  diagnostics: DocumentVariableDiagnostic[];
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (typeof value === "string") {
    const date = /^\d{4}-\d{2}-\d{2}/.test(value) ? new Date(value) : null;
    if (date && !Number.isNaN(date.getTime())) return date.toLocaleDateString("pt-BR");
    return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  }
  return "";
}

function buildAllowedVariables(context: DocumentVariableContext): Map<string, string> {
  const variables = new Map<string, string>();
  const legacyVariables = buildLegacyDocumentVariables(context);

  for (const [key, value] of Object.entries(legacyVariables)) {
    variables.set(key, value);
  }

  for (const definition of documentVariableRegistry) {
    variables.set(definition.key, formatValue(definition.resolve(context)));
  }

  if (context.workItem) {
    for (const [key, value] of Object.entries(context.workItem.customFields ?? {})) {
      if (/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key)) {
        variables.set(`fields.${key}`, formatValue(value));
      }
    }
  }

  return variables;
}

export function resolveDocumentMarkdown(
  content: string,
  context: DocumentVariableContext
): ResolvedDocumentMarkdown {
  const variables = buildAllowedVariables(context);
  const diagnostics: DocumentVariableDiagnostic[] = [];
  const parsedVariables = parseDocumentVariables(content);

  if (!context.workItem && parsedVariables.some((variable) => variable.key.startsWith("workItem.") || variable.key.startsWith("fields."))) {
    diagnostics.push({
      key: "workItem",
      message: "Este documento usa variaveis de card, mas nao ha WorkItem vinculado.",
      severity: "warning"
    });
  }

  const markdown = content.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_.]{0,119})\s*\}\}/g, (match, key: string) => {
    if (!variables.has(key)) {
      diagnostics.push({
        key,
        message: `Variavel nao permitida ou inexistente: ${key}`,
        severity: "error"
      });
      return match;
    }

    return variables.get(key) ?? "";
  });

  return {
    markdown,
    diagnostics
  };
}

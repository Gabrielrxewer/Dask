import type { AppIconName } from "@/shared/ui";
import type { StudioTab, FieldOption } from "./automation-page.types";

export const studioTabs: Array<{ id: StudioTab; label: string; icon: AppIconName }> = [
  { id: "flows", label: "Fluxos", icon: "automation" },
  { id: "runs", label: "Execucoes", icon: "list-ordered" },
  { id: "approvals", label: "Aprovacoes", icon: "square-check" },
  { id: "inbox", label: "Inbox", icon: "message" },
  { id: "templates", label: "Templates", icon: "template" },
  { id: "contacts", label: "Contatos", icon: "users" },
  { id: "settings", label: "Configuracoes", icon: "settings" }
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function statusTone(status: string): "default" | "muted" | "success" | "warning" | "danger" | "info" {
  if (["active", "published", "completed", "approved", "sent", "delivered"].includes(status)) return "success";
  if (["paused", "waiting", "pending", "draft", "queued", "running"].includes(status)) return "warning";
  if (["archived", "cancelled", "rejected"].includes(status)) return "muted";
  if (["failed", "expired", "blocked"].includes(status)) return "danger";
  return "default";
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function summarizeConfig(config: Record<string, unknown>) {
  const entries = Object.entries(config).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) return "Sem configuracao";
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" | ");
}

export function toOptionValue(option: FieldOption) {
  return option.slug ?? option.key ?? option.id ?? "";
}

export function toOptionLabel(option: FieldOption) {
  return option.name ?? option.label ?? option.slug ?? option.key ?? option.id ?? "";
}

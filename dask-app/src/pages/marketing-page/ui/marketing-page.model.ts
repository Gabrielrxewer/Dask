import type {
  MarketingAiCampaignComposerFormValues,
  MarketingCampaignComposerFormValues,
  MarketingCampaignAnalytics,
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingSegmentComposerFormValues,
  MarketingSignal,
  MarketingSignalPriority
} from "@/modules/marketing";

export type MarketingTab = "overview" | "inbox" | "campaigns" | "audience" | "journeys" | "templates" | "analytics";

export type CampaignFormState = MarketingCampaignComposerFormValues;
export type SegmentFormState = MarketingSegmentComposerFormValues;
export type AiFormState = MarketingAiCampaignComposerFormValues;

export interface SegmentPreviewState {
  segmentName: string;
  estimatedContacts: number;
  sample: Array<{ id: string; fullName: string | null; email: string | null; companyName: string | null }>;
}

export interface SegmentFilterRule {
  field: string;
  operator: string;
  value: string;
}

export const MARKETING_TABS: Array<{ id: MarketingTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "inbox", label: "Sinais" },
  { id: "campaigns", label: "Campanhas" },
  { id: "audience", label: "Audiência" },
  { id: "journeys", label: "Jornadas" },
  { id: "templates", label: "Templates" },
  { id: "analytics", label: "Analytics" }
];

export const OBJECTIVE_OPTIONS: Array<{ value: MarketingCampaignObjective; label: string }> = [
  { value: "COMMERCIAL_NURTURE", label: "Nutrição comercial" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "REACTIVATION", label: "Reativação" },
  { value: "BILLING_REMINDER", label: "Lembrete de cobrança" },
  { value: "RENEWAL", label: "Renovação" },
  { value: "EXPANSION", label: "Expansão" },
  { value: "PRODUCT_UPDATE", label: "Atualização de produto" },
  { value: "NEWSLETTER", label: "Newsletter" },
  { value: "CUSTOM", label: "Personalizado" }
];

export const STATUS_OPTIONS: Array<MarketingCampaignStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED"
];

export const STATUS_LABELS: Record<MarketingCampaignStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  APPROVED: "Aprovada",
  SCHEDULED: "Agendada",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  ARCHIVED: "Arquivada"
};

export const TEMPLATE_GOAL_FILTERS = [
  "Todos",
  "Onboarding",
  "Reativação",
  "Conversão",
  "Renovação",
  "Expansão",
  "Cobrança",
  "Atualização de produto"
] as const;

export const INITIAL_SEGMENT_FILTERS = JSON.stringify(
  {
    logic: "AND",
    rules: [{ field: "score", operator: "gte", value: 60 }]
  },
  null,
  2
);

export const SEGMENT_FILTER_FIELDS = [
  { value: "score", label: "Score" },
  { value: "status", label: "Status do workItem" },
  { value: "captureSource", label: "Origem" },
  { value: "companyName", label: "Empresa" }
];

export const SEGMENT_FILTER_OPERATORS = [
  { value: "gte", label: "maior ou igual" },
  { value: "lte", label: "menor ou igual" },
  { value: "eq", label: "igual a" },
  { value: "contains", label: "contem" }
];

export const SIGNAL_INBOX_TYPES = [
  "EMAIL_CLICKED",
  "EMAIL_OPENED",
  "EMAIL_BOUNCED",
  "EMAIL_COMPLAINT",
  "EMAIL_UNSUBSCRIBED",
  "COMMERCIAL_SCORE_CHANGED"
] as const;

export const SIGNAL_TYPE_LABELS: Record<string, string> = {
  EMAIL_CLICKED: "Clicou no email",
  EMAIL_OPENED: "Abriu o email",
  EMAIL_BOUNCED: "Bounce",
  EMAIL_COMPLAINT: "Marcou como spam",
  EMAIL_UNSUBSCRIBED: "Descadastrou",
  COMMERCIAL_SCORE_CHANGED: "Score alterado"
};

export const SIGNAL_TYPE_FILTER_LABELS: Record<string, string> = {
  ALL: "Todos",
  EMAIL_CLICKED: "Cliques",
  EMAIL_OPENED: "Aberturas",
  EMAIL_BOUNCED: "Bounces",
  EMAIL_COMPLAINT: "Reclamações",
  EMAIL_UNSUBSCRIBED: "Cancelamentos",
  COMMERCIAL_SCORE_CHANGED: "Score"
};

export function stringifyObject(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

export function buildSegmentFilters(field: string, operator: string, value: string | number | boolean): string {
  return stringifyObject({
    logic: "AND",
    rules: [{ field, operator, value }]
  });
}

export function toLocalDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-BR");
}

export function statusTone(
  status: string
): "default" | "success" | "warning" {
  if (status === "ACTIVE" || status === "APPROVED" || status === "COMPLETED") {
    return "success";
  }
  if (status === "PAUSED" || status === "ARCHIVED") {
    return "warning";
  }
  return "default";
}

export function campaignStatusLabel(status: string | null | undefined): string {
  return STATUS_LABELS[status as MarketingCampaignStatus] ?? status ?? "-";
}

export function campaignObjectiveLabel(objective: string | null | undefined): string {
  return OBJECTIVE_OPTIONS.find((option) => option.value === objective)?.label ?? objective?.replace(/_/g, " ") ?? "-";
}

export function safeString(input: unknown): string {
  return typeof input === "string" ?input : "";
}

export function fmtRevenue(value: number | undefined | null): string {
  if (value == null || value === 0) return "—";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export function fmtPct(value: number | undefined | null, decimals = 1): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function fmtNum(value: number | undefined | null): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR");
}

export function signalPriority(signal: MarketingSignal): MarketingSignalPriority {
  if (signal.type === "EMAIL_COMPLAINT" || signal.type === "EMAIL_BOUNCED") return "urgent";
  if (signal.type === "EMAIL_UNSUBSCRIBED") return "high";
  if (signal.type === "COMMERCIAL_SCORE_CHANGED") {
    const nextScore = typeof signal.payload?.nextScore === "number" ?signal.payload.nextScore : 0;
    if (nextScore >= 75) return "high";
    return "medium";
  }
  if (signal.type === "EMAIL_CLICKED") return "medium";
  return "low";
}

export function signalPriorityLabel(priority: MarketingSignalPriority): string {
  if (priority === "urgent") return "Urgente";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Média";
  return "Info";
}

export function signalSuggestion(signal: MarketingSignal): string {
  const name = signal.workItem?.contactName ?? signal.workItem?.email ?? "Contato";
  switch (signal.type) {
    case "EMAIL_CLICKED":
      return `${name} demonstrou interesse — crie uma tarefa de follow-up agora.`;
    case "EMAIL_OPENED":
      return `${name} está engajado — boa hora para um contato direto.`;
    case "EMAIL_BOUNCED":
      return `Email de ${name} com bounce — atualize o contato ou remova do funil.`;
    case "EMAIL_COMPLAINT":
      return `${name} marcou como spam — remova do funil e verifique o segmento.`;
    case "EMAIL_UNSUBSCRIBED":
      return `${name} descadastrou — respeite a preferência e atualize o CRM.`;
    case "COMMERCIAL_SCORE_CHANGED": {
      const score = typeof signal.payload?.nextScore === "number" ?signal.payload.nextScore : "?";
      return `Score de ${name} chegou a ${score} — qualifique e distribua para o comercial.`;
    }
    default:
      return `Verifique a atividade de ${name}.`;
  }
}

export function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function analyticsEventTotal(analytics: MarketingCampaignAnalytics | undefined, type: string): number {
  return analytics?.byType.find((e) => e.type === type)?.total ?? 0;
}

export function campaignName(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.name) || "Campanha";
}

export function campaignStatus(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.status) || "-";
}

export function campaignId(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.id);
}

export function sanitizeJson(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON payload precisa ser um objeto.");
  }

  return parsed as Record<string, unknown>;
}

import type {
  ConnectCatalogBillingType,
  ConnectCatalogItemKind,
  ConnectPaymentOrder,
  ConnectPaymentOrderStatus
} from "@/modules/billing";

export type ConnectLoadState = "loading" | "missing" | "ready" | "error";
export type StatusTone = "active" | "attention" | "blocked";
export type PaymentOrdersLoadState = "idle" | "loading" | "loaded" | "error";
export type CatalogLoadState = "idle" | "loading" | "loaded" | "error";
export type CustomersLoadState = "idle" | "loading" | "loaded" | "error";
export type ChargeSource = "catalog" | "manual";
export type ReviewStep = "closed" | "preparing" | "ready";
export type ActiveTab = "conta" | "catalogo" | "cobrar" | "historico";
export type HistoryAction = "copy" | "resend" | "cancel";
export type PaymentCapability = "boleto_payments";
export type BillingOnboardingStage = "Cadastro" | "Cobrança" | "Repasse" | "Concluído";

export interface BillingStatusCard {
  key: string;
  label: string;
  value: string;
  tone: StatusTone;
}

export interface BillingOnboardingSummary {
  title: string;
  subtitle: string;
  progress: number;
}

export interface BillingChecklistItem {
  key: string;
  title: string;
  description: string;
  done: boolean;
}

export interface CatalogCommercialMetadataInput {
  unit: string;
  defaultQuantity: string;
  scope: string;
  deliverables: string;
  deliveryTerms: string;
  paymentTerms: string;
  proposalValidity: string;
  contractTerm: string;
  cancellationTerms: string;
  clientResponsibilities: string;
  acceptanceCriteria: string;
  contractNotes: string;
}

export const HISTORY_PAGE_SIZE = 5;

export const ORDER_STATUS_LABEL: Record<ConnectPaymentOrderStatus, string> = {
  DRAFT: "Rascunho",
  CHECKOUT_OPEN: "Checkout aberto",
  CHECKOUT_COMPLETED: "Checkout concluído",
  PENDING: "Pendente",
  OVERDUE: "Em atraso",
  PAID: "Pago",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
  SUBSCRIPTION_ACTIVE: "Assinatura ativa",
  SUBSCRIPTION_CANCELED: "Assinatura cancelada"
};

export const CATALOG_KIND_LABEL: Record<ConnectCatalogItemKind, string> = {
  PRODUCT: "Produto",
  SERVICE: "Serviço"
};

export const CATALOG_BILLING_LABEL: Record<ConnectCatalogBillingType, string> = {
  ONE_TIME: "Avulso",
  ASSINATURA: "Assinatura (cartão)",
  SUBSCRIPTION: "Assinatura (cartão)"
};

export function isRecurringCatalogBillingType(billingType: ConnectCatalogBillingType): boolean {
  return billingType === "ASSINATURA" || billingType === "SUBSCRIPTION";
}

export function formatCapabilityStatus(status: string | null | undefined): string {
  if (status === "active") return "Ativo";
  if (status === "enabled") return "Habilitado";
  if (status === "pending") return "Pendente";
  if (status === "inactive") return "Inativo";
  return "Nao solicitado";
}

export function isLocalPaymentMethodEnabled(status: string | null | undefined): boolean {
  return status === "active" || status === "enabled" || status === "pending";
}

export function parseAmountInCents(rawAmount: string): number | null {
  const normalized = rawAmount.trim().replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export function buildCatalogCommercialMetadata(input: CatalogCommercialMetadataInput): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [key, value.trim()])
      .filter(([, value]) => value.length > 0)
  );
}

export const BADGE_TONE_BY_STATUS: Record<StatusTone, "default" | "success" | "warning"> = {
  active: "success",
  attention: "warning",
  blocked: "default"
};

export function mapOrderStatusTone(status: ConnectPaymentOrderStatus): StatusTone {
  if (status === "PAID" || status === "SUBSCRIPTION_ACTIVE") return "active";
  if (["PENDING", "CHECKOUT_OPEN", "CHECKOUT_COMPLETED", "DRAFT"].includes(status)) return "attention";
  return "blocked";
}

export function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function formatAmount(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountInCents / 100);
}

function isTerminalOrderStatus(status: ConnectPaymentOrderStatus): boolean {
  return ["PAID", "REFUNDED", "CANCELED", "SUBSCRIPTION_ACTIVE", "SUBSCRIPTION_CANCELED"].includes(status);
}

export function canResendOrder(order: ConnectPaymentOrder): boolean {
  return Boolean(order.checkoutUrl && order.customerEmail && !isTerminalOrderStatus(order.status));
}

export function canCancelOrder(order: ConnectPaymentOrder): boolean {
  return !isTerminalOrderStatus(order.status);
}

export function formatOrderCustomerLabel(order: ConnectPaymentOrder): string {
  return order.customerName ?? order.customerEmail ?? "Nao informado";
}

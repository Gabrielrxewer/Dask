import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics } from "@/entities/task";
import { billingService, buildOnboardingChecklist, getNextOnboardingAction } from "@/modules/billing";
import type {
  ConnectAccountStatus,
  ConnectCatalogBillingType,
  ConnectCatalogItem,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder,
  ConnectPaymentOrderStatus
} from "@/modules/billing";
import { useWorkspace } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  LoadingState,
  ModalShell,
  Section,
  Select,
  StatusBadge,
  TextInput
} from "@/shared/ui";
import { BoardMetrics } from "@/widgets/board-metrics";
import { AppShell } from "@/widgets/app-shell";
import "./billing-page.css";

type ConnectLoadState = "loading" | "missing" | "ready" | "error";
type StatusTone = "active" | "attention" | "blocked";
type PaymentOrdersLoadState = "idle" | "loading" | "loaded" | "error";
type CatalogLoadState = "idle" | "loading" | "loaded" | "error";
type ChargeSource = "catalog" | "manual";
type ReviewStep = "closed" | "preparing" | "ready";
type ActiveTab = "conta" | "catalogo" | "cobrar" | "historico";
type HistoryAction = "copy" | "resend" | "cancel";
type PaymentCapability = "boleto_payments";

const HISTORY_PAGE_SIZE = 5;

const ORDER_STATUS_LABEL: Record<ConnectPaymentOrderStatus, string> = {
  DRAFT: "Rascunho",
  CHECKOUT_OPEN: "Checkout aberto",
  CHECKOUT_COMPLETED: "Checkout concluído",
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado"
};

const CATALOG_KIND_LABEL: Record<ConnectCatalogItemKind, string> = {
  PRODUCT: "Produto",
  SERVICE: "Serviço"
};

const CATALOG_BILLING_LABEL: Record<ConnectCatalogBillingType, string> = {
  ONE_TIME: "Avulso",
  ASSINATURA: "Assinatura (cartão)",
  SUBSCRIPTION: "Assinatura (cartão)"
};

function isRecurringCatalogBillingType(billingType: ConnectCatalogBillingType): boolean {
  return billingType === "ASSINATURA" || billingType === "SUBSCRIPTION";
}

const BADGE_TONE_BY_STATUS: Record<StatusTone, "default" | "success" | "warning"> = {
  active: "success",
  attention: "warning",
  blocked: "default"
};

function mapOrderStatusTone(status: ConnectPaymentOrderStatus): StatusTone {
  if (status === "PAID") return "active";
  if (["PENDING", "CHECKOUT_OPEN", "CHECKOUT_COMPLETED", "DRAFT"].includes(status)) return "attention";
  return "blocked";
}

function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatAmount(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountInCents / 100);
}

function isTerminalOrderStatus(status: ConnectPaymentOrderStatus): boolean {
  return ["PAID", "REFUNDED", "CANCELED"].includes(status);
}

function canResendOrder(order: ConnectPaymentOrder): boolean {
  return Boolean(order.checkoutUrl && order.customerEmail && !isTerminalOrderStatus(order.status));
}

function canCancelOrder(order: ConnectPaymentOrder): boolean {
  return !isTerminalOrderStatus(order.status);
}

function BillingLoader({ visible }: { visible: boolean }) {
  return (
    <div className={`billing-loader${visible ? "" : " billing-loader--out"}`} aria-hidden="true">
      <div className="billing-loader__stage">
        <span className="billing-loader__particle billing-loader__particle--1">R$</span>
        <span className="billing-loader__particle billing-loader__particle--2">$</span>
        <span className="billing-loader__particle billing-loader__particle--3">€</span>
        <span className="billing-loader__particle billing-loader__particle--4">R$</span>
        <span className="billing-loader__particle billing-loader__particle--5">$</span>
        <span className="billing-loader__particle billing-loader__particle--6">€</span>

        <div className="billing-loader__card">
          <div className="billing-loader__card-face">
            <div className="billing-loader__card-top">
              <div className="billing-loader__card-chip" />
              <div className="billing-loader__card-wifi" />
            </div>
            <div className="billing-loader__card-number">•••• •••• •••• ••••</div>
            <div className="billing-loader__card-meta">
              <div className="billing-loader__card-meta-group">
                <span className="billing-loader__card-label">Titular</span>
                <span className="billing-loader__card-value">DASK USER</span>
              </div>
              <div className="billing-loader__card-meta-group">
                <span className="billing-loader__card-label">Validade</span>
                <span className="billing-loader__card-value">••/••</span>
              </div>
            </div>
          </div>
          <div className="billing-loader__card-shimmer" />
        </div>

        <div className="billing-loader__bar-wrap">
          <div className="billing-loader__bar" />
        </div>
        <p className="billing-loader__label">
          Carregando cobrança<span className="billing-loader__dots" />
        </p>
      </div>
    </div>
  );
}

function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const KPI_ICONS: Record<string, () => JSX.Element> = {
  stripe: IconCard,
  charges: IconBolt,
  payouts: IconArrowUp,
  requirements: IconAlertCircle
};

function formatCapabilityStatus(status: string | null | undefined): string {
  if (status === "active") return "Ativo";
  if (status === "enabled") return "Habilitado";
  if (status === "pending") return "Pendente";
  if (status === "inactive") return "Inativo";
  return "Nao solicitado";
}

function isLocalPaymentMethodEnabled(status: string | null | undefined): boolean {
  return status === "active" || status === "enabled" || status === "pending";
}

export function BillingPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const [searchParams] = useSearchParams();
  const { snapshot } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = buildBoardMetrics(snapshot?.tasks ?? []);

  const [activeTab, setActiveTab] = useState<ActiveTab>("conta");
  const [connectState, setConnectState] = useState<ConnectLoadState>("loading");
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isOpeningOnboarding, setIsOpeningOnboarding] = useState(false);
  const [requestingCapability, setRequestingCapability] = useState<PaymentCapability | null>(null);
  const [paymentOrdersLoadState, setPaymentOrdersLoadState] = useState<PaymentOrdersLoadState>("idle");
  const [paymentOrders, setPaymentOrders] = useState<ConnectPaymentOrder[]>([]);
  const [paymentOrdersError, setPaymentOrdersError] = useState<string | null>(null);
  const [catalogLoadState, setCatalogLoadState] = useState<CatalogLoadState>("idle");
  const [catalogItems, setCatalogItems] = useState<ConnectCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCreatingCatalogItem, setIsCreatingCatalogItem] = useState(false);
  const [deletingCatalogItemId, setDeletingCatalogItemId] = useState<string | null>(null);
  const [catalogItemPendingDelete, setCatalogItemPendingDelete] = useState<ConnectCatalogItem | null>(null);
  const [isCatalogFormOpen, setIsCatalogFormOpen] = useState(false);
  const [catalogCreatedNotice, setCatalogCreatedNotice] = useState(false);
  const [chargeSource, setChargeSource] = useState<ChargeSource>("catalog");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
  const [catalogItemKind, setCatalogItemKind] = useState<ConnectCatalogItemKind>("SERVICE");
  const [catalogItemBillingType, setCatalogItemBillingType] = useState<ConnectCatalogBillingType>("ONE_TIME");
  const [catalogItemRecurringInterval, setCatalogItemRecurringInterval] =
    useState<ConnectCatalogRecurringInterval>("MONTH");
  const [catalogItemRecurringIntervalCount, setCatalogItemRecurringIntervalCount] = useState(1);
  const [catalogItemName, setCatalogItemName] = useState("");
  const [catalogItemDescription, setCatalogItemDescription] = useState("");
  const [catalogItemAmount, setCatalogItemAmount] = useState("");
  const [amount, setAmount] = useState("100.00");
  const [description, setDescription] = useState("Serviço prestado via Dask");
  const [customerEmail, setCustomerEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [sendEmailToCustomer, setSendEmailToCustomer] = useState(true);
  const [emailSentNotice, setEmailSentNotice] = useState(false);
  const [reviewStep, setReviewStep] = useState<ReviewStep>("closed");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [historyCopiedOrderId, setHistoryCopiedOrderId] = useState<string | null>(null);
  const [historyActionOrderId, setHistoryActionOrderId] = useState<string | null>(null);
  const [historyActionType, setHistoryActionType] = useState<HistoryAction | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const checkoutResult = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");

  useEffect(() => {
    if (checkoutResult === "success" || checkoutResult === "cancel") {
      setActiveTab("historico");
    }
  }, [checkoutResult]);

  useEffect(() => {
    if (!workspaceId) return;
    let mounted = true;
    setConnectState("loading");
    setConnectError(null);

    billingService
      .getConnectAccountStatus(workspaceId)
      .then((status) => {
        if (!mounted) return;
        setConnectStatus(status);
        setConnectState("ready");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (isApiError(error) && error.status === 404) {
          setConnectStatus(null);
          setConnectState("missing");
          return;
        }
        setConnectStatus(null);
        setConnectState("error");
        setConnectError("Não foi possível carregar o status da conta Connect.");
      });

    return () => { mounted = false; };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || checkoutResult !== "success" || !checkoutSessionId) {
      return;
    }

    let cancelled = false;

    void billingService
      .syncConnectPaymentOrderStatus(workspaceId, checkoutSessionId)
      .then((order) => {
        if (cancelled) return;
        setPaymentOrders((current) => {
          const existing = current.find((item) => item.id === order.id);
          if (!existing) {
            return [order, ...current];
          }
          return current.map((item) => (item.id === order.id ? order : item));
        });
      })
      .catch(() => {
        if (cancelled) return;
        setHistoryNotice("Pagamento concluído, mas ainda estamos atualizando o status da cobrança.");
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, checkoutResult, checkoutSessionId]);

  useEffect(() => {
    if (!workspaceId) return;
    let mounted = true;
    setCatalogLoadState("loading");
    setCatalogError(null);

    billingService
      .listConnectCatalogItems(workspaceId, false)
      .then((response) => {
        if (!mounted) return;
        setCatalogItems(response.items);
        setCatalogLoadState("loaded");
      })
      .catch(() => {
        if (!mounted) return;
        setCatalogItems([]);
        setCatalogLoadState("error");
        setCatalogError("Não foi possível carregar o catálogo de cobrança.");
      });

    return () => { mounted = false; };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    let mounted = true;
    setPaymentOrdersLoadState("loading");
    setPaymentOrdersError(null);

    billingService
      .listConnectPaymentOrders(workspaceId, 30)
      .then((response) => {
        if (!mounted) return;
        setPaymentOrders(response.items);
        setPaymentOrdersLoadState("loaded");
      })
      .catch(() => {
        if (!mounted) return;
        setPaymentOrders([]);
        setPaymentOrdersLoadState("error");
        setPaymentOrdersError("Não foi possível carregar o histórico de cobranças.");
      });

    return () => { mounted = false; };
  }, [workspaceId]);

  const hasRequirementsDue = Boolean(connectStatus && connectStatus.requirementsDue.length > 0);
  const onboardingPending = Boolean(
    connectStatus && (!connectStatus.onboardingComplete || !connectStatus.chargesEnabled)
  );

  const amountInCents = useMemo(() => {
    const normalized = amount.trim().replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
  }, [amount]);

  const catalogItemAmountInCents = useMemo(() => {
    const normalized = catalogItemAmount.trim().replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value * 100);
  }, [catalogItemAmount]);

  const catalogItemDisplayName = useMemo(() => {
    const explicitName = catalogItemName.trim();
    if (explicitName.length >= 2) return explicitName;
    const fallbackName = catalogItemDescription.trim();
    return fallbackName.length >= 2 ? fallbackName : "";
  }, [catalogItemDescription, catalogItemName]);

  const canCreateCheckout = connectState === "ready" && connectStatus?.chargesEnabled === true;
  const onboardingChecklist = useMemo(() => buildOnboardingChecklist(connectStatus), [connectStatus]);
  const nextOnboardingAction = useMemo(
    () => getNextOnboardingAction(connectStatus, onboardingChecklist),
    [connectStatus, onboardingChecklist]
  );

  const statusCards = useMemo<Array<{ key: string; label: string; value: string; tone: StatusTone }>>(
    () => [
      {
        key: "stripe",
        label: "Conta Stripe",
        value:
          connectState === "ready" && connectStatus
            ? "Conectada"
            : connectState === "loading"
              ? "Carregando"
              : "Não conectada",
        tone:
          connectState === "ready" && connectStatus
            ? ((connectStatus.detailsSubmitted ? "active" : "attention") as StatusTone)
            : ("blocked" as StatusTone)
      },
      {
        key: "charges",
        label: "Cobrança",
        value: connectStatus?.chargesEnabled ? "Ativa" : connectStatus?.detailsSubmitted ? "Bloqueada" : "Pendente",
        tone: connectStatus?.chargesEnabled ? "active" : connectStatus?.detailsSubmitted ? "blocked" : "attention"
      },
      {
        key: "payouts",
        label: "Repasse",
        value: connectStatus?.payoutsEnabled ? "Ativo" : connectStatus?.detailsSubmitted ? "Bloqueado" : "Pendente",
        tone: connectStatus?.payoutsEnabled ? "active" : connectStatus?.detailsSubmitted ? "blocked" : "attention"
      },
      {
        key: "requirements",
        label: "Pendências",
        value: `${connectStatus?.requirementsDue.length ?? 0} itens`,
        tone:
          (connectStatus?.requirementsDue.length ?? 0) === 0
            ? "active"
            : (connectStatus?.requirementsDue.length ?? 0) <= 3
              ? "attention"
              : "blocked"
      }
    ],
    [connectState, connectStatus]
  );

  const pendingItems = onboardingChecklist.filter((item) => !item.done);
  const activeCatalogItems = useMemo(() => catalogItems.filter((item) => item.isActive), [catalogItems]);
  const selectedCatalogItem = useMemo(
    () => activeCatalogItems.find((item) => item.id === selectedCatalogItemId) ?? null,
    [activeCatalogItems, selectedCatalogItemId]
  );

  const onboardingSummary = useMemo(() => {
    if (!connectStatus) {
      return { title: "Conta Stripe Connect não iniciada", subtitle: "Conecte e complete o cadastro para liberar cobranças e repasses.", progress: 0 };
    }
    const doneCount = onboardingChecklist.filter((item) => item.done).length;
    const progress = Math.round((doneCount / onboardingChecklist.length) * 100);
    if (canCreateCheckout) {
      return { title: "Conta pronta para cobrar", subtitle: "Cobranças e repasses estão habilitados.", progress };
    }
    return {
      title: "Cadastro incompleto",
      subtitle: `Faltam ${connectStatus.requirementsDue.length} informações para liberar cobranças.`,
      progress
    };
  }, [canCreateCheckout, connectStatus, onboardingChecklist]);

  useEffect(() => {
    if (activeCatalogItems.length === 0 && chargeSource === "catalog") {
      setChargeSource("manual");
      setSelectedCatalogItemId("");
    }
  }, [activeCatalogItems, chargeSource]);

  useEffect(() => {
    if (!historyNotice) return;
    const timeoutId = window.setTimeout(() => setHistoryNotice(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [historyNotice]);

  useEffect(() => {
    setHistoryPage(1);
  }, [workspaceId]);

  async function handleOpenOnboarding() {
    if (!workspaceId || isOpeningOnboarding) return;
    setIsOpeningOnboarding(true);
    setCheckoutError(null);
    try {
      const response = await billingService.createConnectOnboardingLink(workspaceId);
      window.location.href = response.url;
    } catch {
      setCheckoutError("Não foi possível abrir o fluxo de cadastro do Stripe Connect.");
      setIsOpeningOnboarding(false);
    }
  }

  async function handleRequestPaymentCapability(capability: PaymentCapability) {
    if (!workspaceId || requestingCapability) return;

    setRequestingCapability(capability);
    setConnectError(null);
    try {
      const status = await billingService.requestConnectPaymentCapability(workspaceId, capability);
      setConnectStatus(status);
      setConnectState("ready");
    } catch (error) {
      const reason =
        isApiError(error) &&
        error.details &&
        typeof error.details === "object" &&
        "reason" in error.details &&
        typeof error.details.reason === "string"
          ? ` Motivo: ${error.details.reason}`
          : "";
      setConnectError(`Nao foi possivel solicitar essa forma de pagamento agora.${reason}`);
    } finally {
      setRequestingCapability(null);
    }
  }

  async function handlePrepareCheckout() {
    if (!workspaceId) return;
    if (chargeSource === "catalog" && !selectedCatalogItem) return;
    if (chargeSource === "manual" && (!amountInCents || !description.trim())) return;

    setReviewStep("preparing");
    setCheckoutError(null);
    try {
      const trimmedEmail = customerEmail.trim();
      const shouldSendEmail = sendEmailToCustomer && trimmedEmail.length > 0;

      const response = await billingService.createConnectCheckoutSession(workspaceId, {
        amount: chargeSource === "manual" ? amountInCents ?? undefined : undefined,
        currency: "brl",
        description: chargeSource === "manual" ? description.trim() : undefined,
        catalogItemId: chargeSource === "catalog" ? selectedCatalogItem?.id : undefined,
        customerEmail: trimmedEmail || undefined,
        sendEmail: shouldSendEmail,
        successUrl: workspaceSlug.length > 0
          ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
          : undefined,
        cancelUrl: workspaceSlug.length > 0
          ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=cancel`
          : undefined
      });
      setCheckoutUrl(response.url);
      setEmailSentNotice(shouldSendEmail);
      setReviewStep("ready");
    } catch (error) {
      const reason =
        isApiError(error) &&
        error.details &&
        typeof error.details === "object" &&
        "reason" in error.details &&
        typeof error.details.reason === "string"
          ? ` Motivo: ${error.details.reason}`
          : "";
      setCheckoutError(`Não foi possível gerar o link de cobrança. Revise os dados e tente novamente.${reason}`);
      setReviewStep("closed");
    }
  }

  async function copyText(value: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  function updatePaymentOrder(orderId: string, updater: (current: ConnectPaymentOrder) => ConnectPaymentOrder) {
    setPaymentOrders((current) =>
      current.map((order) => (order.id === orderId ? updater(order) : order))
    );
  }

  async function handleCopyCheckoutUrl() {
    if (!checkoutUrl) return;
    const copied = await copyText(checkoutUrl);
    if (!copied) {
      setCheckoutError("Não foi possível copiar o link agora.");
      return;
    }

    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2500);
  }

  function handleCancelReview() {
    setReviewStep("closed");
    setCheckoutUrl(null);
    setLinkCopied(false);
    setEmailSentNotice(false);
  }

  async function handleCreateCatalogItem() {
    if (!workspaceId || isCreatingCatalogItem || !catalogItemAmountInCents || catalogItemDisplayName.length < 2) return;

    setIsCreatingCatalogItem(true);
    setCatalogError(null);
    try {
      const created = await billingService.createConnectCatalogItem(workspaceId, {
        kind: catalogItemKind,
        billingType: catalogItemBillingType,
        recurringInterval: isRecurringCatalogBillingType(catalogItemBillingType) ? catalogItemRecurringInterval : undefined,
        recurringIntervalCount: isRecurringCatalogBillingType(catalogItemBillingType)
          ? catalogItemRecurringIntervalCount
          : undefined,
        name: catalogItemDisplayName,
        description: catalogItemDescription.trim() || undefined,
        amount: catalogItemAmountInCents,
        currency: "brl"
      });
      setCatalogItems((current) => [created, ...current]);
      setSelectedCatalogItemId(created.id);
      setChargeSource("catalog");
      setCatalogItemName("");
      setCatalogItemDescription("");
      setCatalogItemAmount("");
      setIsCatalogFormOpen(false);
      setCatalogCreatedNotice(true);
      setTimeout(() => setCatalogCreatedNotice(false), 5000);
    } catch {
      setCatalogError("Não foi possível criar item no catálogo agora.");
    } finally {
      setIsCreatingCatalogItem(false);
    }
  }

  function handleUseCatalogItem(item: ConnectCatalogItem) {
    setChargeSource("catalog");
    setSelectedCatalogItemId(item.id);
    setAmount((item.amount / 100).toFixed(2));
    setDescription(item.name);
  }

  function handleRequestDeleteCatalogItem(item: ConnectCatalogItem) {
    if (!item.isActive || deletingCatalogItemId) return;
    setCatalogItemPendingDelete(item);
  }

  async function handleDeleteCatalogItem(item: ConnectCatalogItem) {
    if (!workspaceId || deletingCatalogItemId) return;
    setDeletingCatalogItemId(item.id);
    setCatalogError(null);
    try {
      await billingService.deleteConnectCatalogItem(workspaceId, item.id);
      setCatalogItems((current) => current.filter((entry) => entry.id !== item.id));
      setCatalogItemPendingDelete((current) => (current?.id === item.id ? null : current));
      if (selectedCatalogItemId === item.id) {
        setSelectedCatalogItemId("");
        if (chargeSource === "catalog") {
          setChargeSource("manual");
        }
      }
    } catch {
      setCatalogError("NÃ£o foi possÃ­vel excluir este item do catÃ¡logo agora.");
    } finally {
      setDeletingCatalogItemId(null);
    }
    return;
  }

  async function handleCopyHistoryLink(order: ConnectPaymentOrder) {
    if (!order.checkoutUrl) return;
    const copied = await copyText(order.checkoutUrl);
    if (!copied) {
      setHistoryNotice("Não foi possível copiar o link dessa cobrança.");
      return;
    }

    setHistoryCopiedOrderId(order.id);
    setHistoryNotice("Link copiado para a área de transferência.");
    window.setTimeout(() => {
      setHistoryCopiedOrderId((current) => (current === order.id ? null : current));
    }, 2500);
  }

  async function handleResendOrder(order: ConnectPaymentOrder) {
    if (!workspaceId || !canResendOrder(order)) return;

    setHistoryActionOrderId(order.id);
    setHistoryActionType("resend");
    try {
      await billingService.resendConnectPaymentOrderEmail(workspaceId, order.id);
      setHistoryNotice(`Lembrete reenviado para ${order.customerEmail}.`);
    } catch {
      setHistoryNotice("Não foi possível reenviar o lembrete dessa cobrança.");
    } finally {
      setHistoryActionOrderId(null);
      setHistoryActionType(null);
    }
  }

  async function handleCancelOrder(order: ConnectPaymentOrder) {
    if (!workspaceId || !canCancelOrder(order)) return;

    setHistoryActionOrderId(order.id);
    setHistoryActionType("cancel");
    try {
      const now = new Date().toISOString();
      await billingService.cancelConnectPaymentOrder(workspaceId, order.id);
      updatePaymentOrder(order.id, (current) => ({
        ...current,
        status: "CANCELED",
        canceledAt: now,
        updatedAt: now
      }));
      setHistoryNotice("Cobrança cancelada com sucesso.");
    } catch {
      setHistoryNotice("Não foi possível cancelar essa cobrança agora.");
    } finally {
      setHistoryActionOrderId(null);
      setHistoryActionType(null);
    }
  }

  const canReviewCharge =
    canCreateCheckout &&
    (chargeSource === "catalog"
      ? Boolean(selectedCatalogItem)
      : Boolean(amountInCents && description.trim().length >= 3));

  const historyTotalPages = Math.max(1, Math.ceil(paymentOrders.length / HISTORY_PAGE_SIZE));
  const paginatedPaymentOrders = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return paymentOrders.slice(start, start + HISTORY_PAGE_SIZE);
  }, [historyPage, paymentOrders]);

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, historyTotalPages));
  }, [historyTotalPages]);

  const metricCards = [
    { label: "Conta Stripe", value: connectState === "ready" && connectStatus ? "Conectada" : "Pendente" },
    { label: "Cobranças", value: paymentOrders.length },
    { label: "Catálogo", value: catalogItems.length },
    { label: "Pendências", value: pendingItems.length }
  ];

  return (
    <AppShell metrics={metrics} hideSidebarBrandMark pageTitle="Cobrança" pageLabel="Financeiro">
      <BillingLoader visible={connectState === "loading"} />
      <div className="billing-view workspace-view">
        <BoardMetrics metrics={metrics} cards={metricCards} className="billing-view__metrics workspace-view__metrics" />

        {checkoutResult === "success" ? (
          <div className="billing-view__result billing-view__result--success">
            Pagamento concluído. A Stripe confirmou o checkout com sucesso.
          </div>
        ) : null}
        {checkoutResult === "cancel" ? (
          <div className="billing-view__result billing-view__result--warning">
            Checkout cancelado. Revise os dados e tente novamente quando quiser.
          </div>
        ) : null}

        <Section
          title="Cobrança Connect"
          subtitle="Gerencie cadastro, cobrança e repasses com o mesmo estilo visual da timeline."
          actions={
            <div className="billing-view__toolbar workspace-view__actions">
              <StatusBadge>{canCreateCheckout ? "Checkout liberado" : "Cadastro pendente"}</StatusBadge>
              {!canCreateCheckout ? (
                <Button type="button" onClick={() => void handleOpenOnboarding()} disabled={isOpeningOnboarding}>
                  {isOpeningOnboarding ? "Abrindo..." : "Completar cadastro"}
                </Button>
              ) : null}
            </div>
          }
          className="billing-view__section workspace-view__section"
        >
          <div className="billing-view__stack">
            {/* Tab navigation */}
            <nav className="billing-view__tabs" role="tablist">
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === "conta"}
                className={`billing-view__tab ${activeTab === "conta" ? "is-active" : ""}`}
                onClick={() => setActiveTab("conta")}
              >
                Conta
                {pendingItems.length > 0 ? (
                  <span className="billing-view__tab-badge">{pendingItems.length}</span>
                ) : null}
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === "catalogo"}
                className={`billing-view__tab ${activeTab === "catalogo" ? "is-active" : ""}`}
                onClick={() => setActiveTab("catalogo")}
              >
                Catálogo
                {catalogItems.length > 0 ? (
                  <span className="billing-view__tab-count">{catalogItems.length}</span>
                ) : null}
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === "cobrar"}
                className={`billing-view__tab ${activeTab === "cobrar" ? "is-active" : ""} ${!canCreateCheckout ? "is-locked" : ""}`}
                onClick={() => setActiveTab("cobrar")}
              >
                Cobrar
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === "historico"}
                className={`billing-view__tab ${activeTab === "historico" ? "is-active" : ""}`}
                onClick={() => setActiveTab("historico")}
              >
                Histórico
                {paymentOrders.length > 0 ? (
                  <span className="billing-view__tab-count">{paymentOrders.length}</span>
                ) : null}
              </button>
            </nav>

            {/* Tab: Conta */}
            {activeTab === "conta" ? (
              <div className="billing-view__panel" role="tabpanel">
                {/* KPI cards */}
                <div className="billing-view__kpi-row">
                  {statusCards.map((card) => {
                    const Icon = KPI_ICONS[card.key];
                    return (
                      <div
                        key={card.key}
                        className={`billing-view__kpi-card billing-view__kpi-card--${card.tone}`}
                      >
                        <div className="billing-view__kpi-icon">
                          <Icon />
                        </div>
                        <p className="billing-view__kpi-label">{card.label}</p>
                        <p className="billing-view__kpi-value">{card.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Onboarding progress */}
                <div className="billing-view__onboarding-card">
                  <div className="billing-view__onboarding-copy">
                    <div className={`billing-view__onboarding-status-dot billing-view__onboarding-status-dot--${canCreateCheckout ? "active" : "pending"}`} />
                    <div>
                      <h2 className="billing-view__onboarding-title">{onboardingSummary.title}</h2>
                      <p className="billing-view__onboarding-subtitle">{onboardingSummary.subtitle}</p>
                    </div>
                  </div>

                  <div className="billing-view__progress-wrap">
                    <div className="billing-view__progress">
                      <span style={{ width: `${onboardingSummary.progress}%` }} />
                    </div>
                    <span className="billing-view__progress-label">{onboardingSummary.progress}%</span>
                  </div>

                  <div className="billing-view__steps">
                    <div className={`billing-view__step ${connectStatus?.detailsSubmitted ? "is-done" : "is-pending"}`}>
                      <span className="billing-view__step-check"><IconCheck /></span>
                      <span>Cadastro</span>
                    </div>
                    <div className={`billing-view__step ${connectStatus?.chargesEnabled ? "is-done" : "is-blocked"}`}>
                      <span className="billing-view__step-check"><IconCheck /></span>
                      <span>Cobrança</span>
                    </div>
                    <div className={`billing-view__step ${connectStatus?.payoutsEnabled ? "is-done" : "is-blocked"}`}>
                      <span className="billing-view__step-check"><IconCheck /></span>
                      <span>Repasse</span>
                    </div>
                  </div>

                  <p className="billing-view__next-step">
                    <strong>Próximo passo:</strong> {nextOnboardingAction}
                  </p>
                </div>

                <div className="billing-view__card">
                  <div className="billing-view__card-head">
                    <h3>Formas de pagamento locais</h3>
                    <StatusBadge>Brasil</StatusBadge>
                  </div>
                  <div className="billing-view__capability-grid">
                    <div className="billing-view__capability-row">
                      <div>
                        <strong>Boleto</strong>
                        <p>Status: {formatCapabilityStatus(connectStatus?.boletoPaymentsStatus)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleRequestPaymentCapability("boleto_payments")}
                        disabled={!connectStatus || isLocalPaymentMethodEnabled(connectStatus.boletoPaymentsStatus) || requestingCapability !== null}
                      >
                        {requestingCapability === "boleto_payments" ? "Solicitando..." : "Habilitar boleto"}
                      </Button>
                    </div>
                  </div>
                  <p className="billing-view__capability-hint">
                    Depois de solicitar, a Stripe pode pedir dados extras no cadastro da conta conectada antes de liberar a forma de pagamento.
                  </p>
                  {connectError ? <p className="billing-view__error">{connectError}</p> : null}
                </div>

                {/* Pendências */}
                {pendingItems.length > 0 ? (
                  <div className="billing-view__card">
                    <div className="billing-view__card-head">
                      <h3>Pendências de cadastro</h3>
                      <StatusBadge tone="warning">{pendingItems.length} itens</StatusBadge>
                    </div>
                    <ul className="billing-view__pending-list">
                      {pendingItems.map((item) => (
                        <li key={item.key}>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  canCreateCheckout ? (
                    <div className="billing-view__all-good">
                      <span className="billing-view__all-good-icon"><IconCheck /></span>
                      Nenhuma pendência. Sua conta está pronta para cobrar.
                    </div>
                  ) : null
                )}
              </div>
            ) : null}

            {/* Tab: Catálogo */}
            {activeTab === "catalogo" ? (
              <div className="billing-view__panel" role="tabpanel">
                <div className="billing-view__panel-head">
                  <div>
                    <h3 className="billing-view__panel-title">Catálogo</h3>
                    <p className="billing-view__panel-subtitle">
                      Produtos e serviços prontos para cobrar em um clique.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCatalogFormOpen((open) => !open)}
                  >
                    {isCatalogFormOpen ? "Cancelar" : "+ Novo item"}
                  </Button>
                </div>

                {catalogCreatedNotice ? (
                  <div className="billing-view__notice billing-view__notice--success">
                    Item criado e selecionado.{" "}
                    <button
                      type="button"
                      className="billing-view__notice-link"
                      onClick={() => setActiveTab("cobrar")}
                    >
                      Cobrar agora →
                    </button>
                  </div>
                ) : null}

                {isCatalogFormOpen ? (
                  <div className="billing-view__catalog-create">
                    <div className="billing-view__form-grid">
                      <FormField label="Tipo" className="billing-view__field">
                        <Select
                          value={catalogItemKind}
                          onChange={(e) => setCatalogItemKind(e.target.value as ConnectCatalogItemKind)}
                        >
                          <option value="SERVICE">Serviço</option>
                          <option value="PRODUCT">Produto</option>
                        </Select>
                      </FormField>

                      <FormField label="Modelo" className="billing-view__field">
                        <Select
                          value={catalogItemBillingType}
                          onChange={(e) => setCatalogItemBillingType(e.target.value as ConnectCatalogBillingType)}
                        >
                          <option value="ONE_TIME">Cobrança avulsa</option>
                          <option value="ASSINATURA">Assinatura (cartão)</option>
                        </Select>
                      </FormField>
                    </div>

                    <div className="billing-view__form-grid">
                      <FormField label="Nome" className="billing-view__field">
                        <TextInput
                          value={catalogItemName}
                          onChange={(e) => setCatalogItemName(e.target.value)}
                          placeholder="Ex.: Consultoria mensal"
                        />
                      </FormField>

                      {isRecurringCatalogBillingType(catalogItemBillingType) ? (
                        <FormField label="Recorrência" className="billing-view__field">
                          <Select
                            value={`${catalogItemRecurringInterval}:${catalogItemRecurringIntervalCount}`}
                            onChange={(e) => {
                              const [interval, intervalCount] = e.target.value.split(":");
                              setCatalogItemRecurringInterval(interval as ConnectCatalogRecurringInterval);
                              setCatalogItemRecurringIntervalCount(Number(intervalCount));
                            }}
                          >
                            <option value="MONTH:1">Mensal</option>
                            <option value="MONTH:6">Semestral</option>
                            <option value="YEAR:1">Anual</option>
                            <option value="WEEK:1">Semanal</option>
                            <option value="DAY:1">Diária</option>
                          </Select>
                        </FormField>
                      ) : (
                        <FormField label="Recorrência" className="billing-view__field">
                          <TextInput value="Não recorrente" readOnly />
                        </FormField>
                      )}
                    </div>

                    <div className="billing-view__form-grid">
                      <FormField label="Valor (R$)" className="billing-view__field">
                        <TextInput
                          value={catalogItemAmount}
                          onChange={(e) => setCatalogItemAmount(e.target.value)}
                          placeholder="249.90"
                        />
                      </FormField>

                      <FormField label="Descrição (opcional)" className="billing-view__field">
                        <TextInput
                          value={catalogItemDescription}
                          onChange={(e) => setCatalogItemDescription(e.target.value)}
                          placeholder="Escopo resumido do item"
                        />
                      </FormField>
                    </div>

                    <div className="billing-view__actions">
                      <Button
                        type="button"
                        onClick={() => void handleCreateCatalogItem()}
                        disabled={
                          isCreatingCatalogItem || !catalogItemAmountInCents || catalogItemDisplayName.length < 2
                        }
                      >
                        {isCreatingCatalogItem ? "Salvando..." : "Adicionar ao catálogo"}
                      </Button>
                    </div>
                    {catalogError ? <p className="billing-view__error">{catalogError}</p> : null}
                  </div>
                ) : null}

                {catalogLoadState === "loading" ? <LoadingState text="Carregando catálogo..." /> : null}

                {catalogLoadState === "loaded" && catalogItems.length === 0 ? (
                  <EmptyState>
                    Nenhum item cadastrado. Crie produtos ou serviços para cobrar em um clique.
                  </EmptyState>
                ) : null}

                {catalogLoadState === "loaded" && catalogItems.length > 0 ? (
                  <div className="billing-view__catalog-grid">
                    {catalogItems.map((item) => (
                      <div key={item.id} className="billing-view__catalog-card">
                        <div className="billing-view__catalog-card-top">
                          <div className="billing-view__catalog-card-badges">
                            <span className="billing-view__badge">{CATALOG_KIND_LABEL[item.kind]}</span>
                            <span className="billing-view__badge">{CATALOG_BILLING_LABEL[item.billingType]}</span>
                          </div>
                          <p className="billing-view__catalog-card-price">
                            {formatAmount(item.amount, item.currency)}
                          </p>
                        </div>
                        <p className="billing-view__catalog-card-name">{item.name}</p>
                        {item.description ? (
                          <p className="billing-view__catalog-card-desc">{item.description}</p>
                        ) : null}
                        <div className="billing-view__catalog-card-actions">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => { handleUseCatalogItem(item); setActiveTab("cobrar"); }}
                            disabled={!item.isActive}
                          >
                          Cobrar este item →
                        </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleRequestDeleteCatalogItem(item)}
                            disabled={!item.isActive || deletingCatalogItemId !== null}
                          >
                            {deletingCatalogItemId === item.id ? "Excluindo..." : "Excluir"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {catalogItemPendingDelete ? (
              <ModalShell
                titleId="billing-delete-catalog-item-title"
                className="billing-view__delete-modal"
                onClose={() => {
                  if (deletingCatalogItemId) return;
                  setCatalogItemPendingDelete(null);
                }}
              >
                <>
                  <div className="billing-view__delete-modal-copy">
                    <span className="billing-view__delete-modal-eyebrow">Excluir item</span>
                    <h2 id="billing-delete-catalog-item-title">Remover "{catalogItemPendingDelete.name}"?</h2>
                    <p>
                      Esse item ficará inativo e não poderá mais ser usado em novas cobranças. O histórico anterior
                      continua preservado.
                    </p>
                  </div>
                  <div className="billing-view__delete-modal-actions">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCatalogItemPendingDelete(null)}
                      disabled={deletingCatalogItemId !== null}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void handleDeleteCatalogItem(catalogItemPendingDelete)}
                      disabled={deletingCatalogItemId !== null}
                    >
                      {deletingCatalogItemId === catalogItemPendingDelete.id ? "Excluindo..." : "Excluir item"}
                    </Button>
                  </div>
                </>
              </ModalShell>
            ) : null}

            {/* Tab: Cobrar */}
            {activeTab === "cobrar" ? (
              <div className="billing-view__panel" role="tabpanel">
                {!canCreateCheckout ? (
                  <div className="billing-view__charge-blocked">
                    <div className="billing-view__charge-blocked-icon">
                      <IconLock />
                    </div>
                    <p className="billing-view__charge-blocked-title">Cadastro incompleto</p>
                    <p className="billing-view__charge-blocked-desc">
                      Complete o cadastro Stripe Connect para liberar cobranças nesta conta.
                    </p>
                    <Button
                      type="button"
                      onClick={() => { setActiveTab("conta"); void handleOpenOnboarding(); }}
                      disabled={isOpeningOnboarding}
                    >
                      {isOpeningOnboarding ? "Abrindo..." : "Completar cadastro"}
                    </Button>
                  </div>
                ) : (
                  <>
                    <fieldset
                      disabled={reviewStep === "preparing"}
                      className="billing-view__fieldset billing-view__charge-form"
                    >
                      {activeCatalogItems.length > 0 ? (
                        <>
                          <div className="billing-view__source-toggle">
                            <button
                              type="button"
                              className={`billing-view__source-btn ${chargeSource === "catalog" ? "is-active" : ""}`}
                              onClick={() => setChargeSource("catalog")}
                            >
                              Do catálogo
                            </button>
                            <button
                              type="button"
                              className={`billing-view__source-btn ${chargeSource === "manual" ? "is-active" : ""}`}
                              onClick={() => { setChargeSource("manual"); setSelectedCatalogItemId(""); }}
                            >
                              Avulsa
                            </button>
                          </div>

                          {chargeSource === "catalog" ? (
                            <div className="billing-view__charge-items">
                              {activeCatalogItems.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`billing-view__charge-item ${selectedCatalogItemId === item.id ? "is-selected" : ""}`}
                                  onClick={() => handleUseCatalogItem(item)}
                                >
                                  <span className="billing-view__charge-item-name">{item.name}</span>
                                  <span className="billing-view__charge-item-price">
                                    {formatAmount(item.amount, item.currency)}
                                  </span>
                                  <span className="billing-view__charge-item-type">
                                    {CATALOG_BILLING_LABEL[item.billingType]}
                                  </span>
                                  {selectedCatalogItemId === item.id ? (
                                    <span className="billing-view__charge-item-check"><IconCheck /></span>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {chargeSource === "manual" || activeCatalogItems.length === 0 ? (
                        <div className="billing-view__form-grid">
                          <FormField label="Valor (R$)" className="billing-view__field">
                            <TextInput
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              placeholder="100.00"
                            />
                          </FormField>
                          <FormField label="Descrição" className="billing-view__field">
                            <TextInput
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Descrição da cobrança"
                            />
                          </FormField>
                        </div>
                      ) : null}

                      <div className="billing-view__email-row">
                        <FormField label="E-mail do cliente (opcional)" className="billing-view__field billing-view__field--grow">
                          <TextInput
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            placeholder="cliente@empresa.com"
                          />
                        </FormField>
                        <label className={`billing-view__send-email-toggle ${!customerEmail.trim() ? "is-disabled" : ""}`}>
                          <input
                            type="checkbox"
                            checked={sendEmailToCustomer && customerEmail.trim().length > 0}
                            disabled={!customerEmail.trim()}
                            onChange={(e) => setSendEmailToCustomer(e.target.checked)}
                          />
                          Enviar link por e-mail
                        </label>
                      </div>

                      <div className="billing-view__actions">
                        <Button
                          type="button"
                          onClick={() => void handlePrepareCheckout()}
                          disabled={!canReviewCharge || reviewStep === "preparing"}
                        >
                          {reviewStep === "preparing" ? "Gerando link..." : "Gerar cobrança"}
                        </Button>
                      </div>
                    </fieldset>

                    {checkoutError ? <p className="billing-view__error">{checkoutError}</p> : null}

                    {reviewStep !== "closed" ? (
                      <div className="billing-view__card billing-view__card--review">
                        <div className="billing-view__card-head">
                          <h3>Link de cobrança</h3>
                          <StatusBadge tone="success">Pronto para enviar</StatusBadge>
                        </div>

                        {reviewStep === "preparing" ? (
                          <div className="billing-view__review-loading">
                            <span className="billing-view__review-spinner" />
                            Gerando link seguro via Stripe...
                          </div>
                        ) : (
                          <>
                            <div className="billing-view__review-grid">
                              <span>
                                <strong>Valor</strong>
                                {chargeSource === "catalog" && selectedCatalogItem
                                  ? formatAmount(selectedCatalogItem.amount, selectedCatalogItem.currency)
                                  : `R$ ${((amountInCents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                              </span>
                              <span>
                                <strong>Descrição</strong>
                                {chargeSource === "catalog" && selectedCatalogItem
                                  ? selectedCatalogItem.description || selectedCatalogItem.name
                                  : description}
                              </span>
                              <span>
                                <strong>Cliente</strong>
                                {customerEmail.trim() || "Não informado"}
                              </span>
                              <span>
                                <strong>Origem</strong>
                                {chargeSource === "catalog"
                                  ? `Catálogo (${selectedCatalogItem ? CATALOG_BILLING_LABEL[selectedCatalogItem.billingType] : "item"})`
                                  : "Cobrança avulsa"}
                              </span>
                            </div>

                            <div className="billing-view__checkout-link">
                              <div className="billing-view__checkout-link-head">
                                <span className="billing-view__checkout-link-label">Link de pagamento</span>
                                {linkCopied ? (
                                  <span className="billing-view__checkout-link-state">Copiado!</span>
                                ) : null}
                              </div>
                              <div
                                className={`billing-view__checkout-link-row ${linkCopied ? "is-copied" : ""}`}
                                onClick={() => void handleCopyCheckoutUrl()}
                                title={checkoutUrl ?? undefined}
                              >
                                <span className="billing-view__checkout-link-url">{checkoutUrl}</span>
                                <button
                                  type="button"
                                  className={`billing-view__copy-btn ${linkCopied ? "is-copied" : ""}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleCopyCheckoutUrl();
                                  }}
                                >
                                  {linkCopied ? "Copiado!" : "Copiar link"}
                                </button>
                              </div>
                              <span className="billing-view__checkout-link-hint">
                                Clique no bloco para copiar. Avulsa aceita cartão e boleto; assinatura aceita só cartão.
                              </span>
                            </div>

                            {emailSentNotice ? (
                              <div className="billing-view__email-sent-notice">
                                <span className="billing-view__email-sent-icon"><IconCheck /></span>
                                Link enviado por e-mail para <strong>{customerEmail.trim()}</strong>
                              </div>
                            ) : null}

                            <div className="billing-view__actions">
                              <Button type="button" variant="outline" onClick={handleCancelReview}>
                                Fechar
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  if (checkoutUrl) window.location.href = checkoutUrl;
                                }}
                              >
                                Abrir checkout
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            {/* Tab: Histórico */}
            {activeTab === "historico" ? (
              <div className="billing-view__panel" role="tabpanel">
                <div className="billing-view__panel-head">
                  <div>
                    <h3 className="billing-view__panel-title">Histórico de cobranças</h3>
                    <p className="billing-view__panel-subtitle">Últimas 30 cobranças criadas neste workspace.</p>
                  </div>
                  <StatusBadge>{paymentOrders.length} itens</StatusBadge>
                </div>

                {paymentOrdersLoadState === "loading" ? <LoadingState text="Carregando histórico..." /> : null}
                {paymentOrdersLoadState === "error" ? (
                  <p className="billing-view__error">{paymentOrdersError}</p>
                ) : null}
                {paymentOrdersLoadState === "loaded" && paymentOrders.length === 0 ? (
                  <div className="billing-view__history-empty">
                    <p>Nenhuma cobrança criada ainda.</p>
                    <Button type="button" variant="outline" onClick={() => setActiveTab("cobrar")}>
                      Criar primeira cobrança →
                    </Button>
                  </div>
                ) : null}
                {paymentOrdersLoadState === "loaded" && paymentOrders.length > 0 ? (
                  <>
                    <DataTable
                    className="billing-view__table"
                    columns="0.8fr 0.9fr 1.1fr 1fr 0.95fr 1.35fr"
                    responsiveMinWidth="1080px"
                  >
                    <DataTableHeader>
                      <DataTableCell>Status</DataTableCell>
                      <DataTableCell>Valor</DataTableCell>
                      <DataTableCell>Descrição</DataTableCell>
                      <DataTableCell>Cliente</DataTableCell>
                      <DataTableCell>Criada em</DataTableCell>
                      <DataTableCell>Ações</DataTableCell>
                    </DataTableHeader>
                    <DataTableBody>
                      {paginatedPaymentOrders.map((order) => (
                        <DataTableRow key={order.id}>
                          <DataTableCell>
                            <StatusBadge tone={BADGE_TONE_BY_STATUS[mapOrderStatusTone(order.status)]}>
                              {ORDER_STATUS_LABEL[order.status]}
                            </StatusBadge>
                          </DataTableCell>
                          <DataTableCell>{formatAmount(order.amount, order.currency)}</DataTableCell>
                          <DataTableCell>{order.description}</DataTableCell>
                          <DataTableCell>{order.customerEmail ?? "Não informado"}</DataTableCell>
                          <DataTableCell>{formatOrderDate(order.createdAt)}</DataTableCell>
                          <DataTableCell>
                            <div className="billing-view__table-actions">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="billing-view__table-action"
                                onClick={() => void handleCopyHistoryLink(order)}
                                disabled={!order.checkoutUrl}
                              >
                                {historyCopiedOrderId === order.id ? "Copiado!" : "Copiar link"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="billing-view__table-action"
                                onClick={() => void handleResendOrder(order)}
                                disabled={
                                  !canResendOrder(order) ||
                                  (historyActionOrderId === order.id && historyActionType === "resend")
                                }
                              >
                                {historyActionOrderId === order.id && historyActionType === "resend"
                                  ? "Reenviando..."
                                  : "Reenviar e-mail"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="billing-view__table-action billing-view__table-action--danger"
                                onClick={() => void handleCancelOrder(order)}
                                disabled={
                                  !canCancelOrder(order) ||
                                  (historyActionOrderId === order.id && historyActionType === "cancel")
                                }
                              >
                                {historyActionOrderId === order.id && historyActionType === "cancel"
                                  ? "Cancelando..."
                                  : "Cancelar"}
                              </Button>
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                  <div className="billing-view__pagination">
                    <span className="billing-view__pagination-label">
                      Página {historyPage} de {historyTotalPages}
                    </span>
                    <div className="billing-view__pagination-actions">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                        disabled={historyPage === 1}
                      >
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((current) => Math.min(historyTotalPages, current + 1))}
                        disabled={historyPage === historyTotalPages}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}


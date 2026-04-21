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

const ORDER_STATUS_LABEL: Record<ConnectPaymentOrderStatus, string> = {
  DRAFT: "Rascunho",
  CHECKOUT_OPEN: "Checkout aberto",
  CHECKOUT_COMPLETED: "Checkout concluido",
  PENDING: "Pendente",
  PAID: "Pago",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado"
};

const CATALOG_KIND_LABEL: Record<ConnectCatalogItemKind, string> = {
  PRODUCT: "Produto",
  SERVICE: "Servico"
};

const CATALOG_BILLING_LABEL: Record<ConnectCatalogBillingType, string> = {
  ONE_TIME: "Avulso",
  SUBSCRIPTION: "Assinatura"
};

const BADGE_TONE_BY_STATUS: Record<StatusTone, "default" | "success" | "warning"> = {
  active: "success",
  attention: "warning",
  blocked: "default"
};

function mapOrderStatusTone(status: ConnectPaymentOrderStatus): StatusTone {
  if (status === "PAID") {
    return "active";
  }
  if (status === "PENDING" || status === "CHECKOUT_OPEN" || status === "CHECKOUT_COMPLETED" || status === "DRAFT") {
    return "attention";
  }
  return "blocked";
}

function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatAmount(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(amountInCents / 100);
}

export function BillingPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const [searchParams] = useSearchParams();
  const { snapshot } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = buildBoardMetrics(snapshot?.tasks ?? []);

  const [connectState, setConnectState] = useState<ConnectLoadState>("loading");
  const [connectStatus, setConnectStatus] = useState<ConnectAccountStatus | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isOpeningOnboarding, setIsOpeningOnboarding] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [paymentOrdersLoadState, setPaymentOrdersLoadState] = useState<PaymentOrdersLoadState>("idle");
  const [paymentOrders, setPaymentOrders] = useState<ConnectPaymentOrder[]>([]);
  const [paymentOrdersError, setPaymentOrdersError] = useState<string | null>(null);
  const [catalogLoadState, setCatalogLoadState] = useState<CatalogLoadState>("idle");
  const [catalogItems, setCatalogItems] = useState<ConnectCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCreatingCatalogItem, setIsCreatingCatalogItem] = useState(false);
  const [chargeSource, setChargeSource] = useState<ChargeSource>("catalog");
  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState("");
  const [catalogItemKind, setCatalogItemKind] = useState<ConnectCatalogItemKind>("SERVICE");
  const [catalogItemBillingType, setCatalogItemBillingType] = useState<ConnectCatalogBillingType>("ONE_TIME");
  const [catalogItemRecurringInterval, setCatalogItemRecurringInterval] =
    useState<ConnectCatalogRecurringInterval>("MONTH");
  const [catalogItemName, setCatalogItemName] = useState("");
  const [catalogItemDescription, setCatalogItemDescription] = useState("");
  const [catalogItemAmount, setCatalogItemAmount] = useState("");
  const [amount, setAmount] = useState("100.00");
  const [description, setDescription] = useState("Servico prestado via Dask");
  const [customerEmail, setCustomerEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let mounted = true;
    setConnectState("loading");
    setConnectError(null);

    billingService
      .getConnectAccountStatus(workspaceId)
      .then((status) => {
        if (!mounted) {
          return;
        }
        setConnectStatus(status);
        setConnectState("ready");
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }
        if (isApiError(error) && error.status === 404) {
          setConnectStatus(null);
          setConnectState("missing");
          return;
        }

        setConnectStatus(null);
        setConnectState("error");
        setConnectError("Nao foi possivel carregar o status da conta Connect.");
      });

    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let mounted = true;
    setCatalogLoadState("loading");
    setCatalogError(null);

    billingService
      .listConnectCatalogItems(workspaceId, false)
      .then((response) => {
        if (!mounted) {
          return;
        }
        setCatalogItems(response.items);
        setCatalogLoadState("loaded");
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setCatalogItems([]);
        setCatalogLoadState("error");
        setCatalogError("Nao foi possivel carregar o catalogo de cobranca.");
      });

    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    let mounted = true;
    setPaymentOrdersLoadState("loading");
    setPaymentOrdersError(null);

    billingService
      .listConnectPaymentOrders(workspaceId, 30)
      .then((response) => {
        if (!mounted) {
          return;
        }
        setPaymentOrders(response.items);
        setPaymentOrdersLoadState("loaded");
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setPaymentOrders([]);
        setPaymentOrdersLoadState("error");
        setPaymentOrdersError("Nao foi possivel carregar o historico de cobrancas.");
      });

    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  const hasRequirementsDue = Boolean(connectStatus && connectStatus.requirementsDue.length > 0);
  const onboardingPending = Boolean(
    connectStatus && (!connectStatus.onboardingComplete || !connectStatus.chargesEnabled)
  );

  const alertMessage = useMemo(() => {
    if (connectState === "loading") {
      return "Carregando status da cobranca Connect...";
    }
    if (connectState === "missing") {
      return "Conecte sua conta Stripe para comecar a cobrar seus clientes dentro da plataforma.";
    }
    if (connectState === "error") {
      return connectError ?? "Falha ao carregar status de cobranca.";
    }
    if (!connectStatus) {
      return null;
    }
    if (hasRequirementsDue || onboardingPending) {
      return "Seu cadastro Stripe Connect ainda tem pendencias. Complete os dados para liberar cobrancas.";
    }
    return "Conta Connect pronta. Voce ja pode cobrar seus clientes por aqui.";
  }, [connectState, connectError, connectStatus, hasRequirementsDue, onboardingPending]);

  const alertTone =
    connectState === "error" || hasRequirementsDue || onboardingPending || connectState === "missing"
      ? "warning"
      : "success";

  const amountInCents = useMemo(() => {
    const normalized = amount.trim().replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.round(value * 100);
  }, [amount]);

  const catalogItemAmountInCents = useMemo(() => {
    const normalized = catalogItemAmount.trim().replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      return null;
    }
    return Math.round(value * 100);
  }, [catalogItemAmount]);

  const catalogItemDisplayName = useMemo(() => {
    const explicitName = catalogItemName.trim();
    if (explicitName.length >= 2) {
      return explicitName;
    }
    const fallbackName = catalogItemDescription.trim();
    return fallbackName.length >= 2 ? fallbackName : "";
  }, [catalogItemDescription, catalogItemName]);

  const canCreateCheckout = connectState === "ready" && connectStatus?.chargesEnabled === true;
  const checkoutResult = searchParams.get("checkout");
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
          connectState === "ready" && connectStatus ? "Conectada" : connectState === "loading" ? "Carregando" : "Nao conectada",
        tone:
          connectState === "ready" && connectStatus
            ? ((connectStatus.detailsSubmitted ? "active" : "attention") as StatusTone)
            : ("blocked" as StatusTone)
      },
      {
        key: "charges",
        label: "Cobranca",
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
        label: "Pendencias",
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

  useEffect(() => {
    if (activeCatalogItems.length === 0 && chargeSource === "catalog") {
      setChargeSource("manual");
      setSelectedCatalogItemId("");
    }
  }, [activeCatalogItems, chargeSource]);

  useEffect(() => {
    if (chargeSource !== "catalog" || !selectedCatalogItem) {
      return;
    }

    setAmount((selectedCatalogItem.amount / 100).toFixed(2));
    setDescription(selectedCatalogItem.name);
  }, [chargeSource, selectedCatalogItem]);

  const onboardingSummary = useMemo(() => {
    if (!connectStatus) {
      return {
        title: "Sua conta Stripe Connect ainda nao foi iniciada",
        subtitle: "Conecte e complete o cadastro para liberar cobrancas e repasses.",
        progress: 0
      };
    }

    const doneCount = onboardingChecklist.filter((item) => item.done).length;
    const progress = Math.round((doneCount / onboardingChecklist.length) * 100);

    if (canCreateCheckout) {
      return {
        title: "Conta pronta para cobrar",
        subtitle: "Cobrancas e repasses estao habilitados.",
        progress
      };
    }

    return {
      title: "Sua conta ainda nao esta pronta para cobrar",
      subtitle: `Faltam ${connectStatus.requirementsDue.length} informacoes para liberar cobrancas e repasses.`,
      progress
    };
  }, [canCreateCheckout, connectStatus, onboardingChecklist]);

  async function handleOpenOnboarding() {
    if (!workspaceId || isOpeningOnboarding) {
      return;
    }

    setIsOpeningOnboarding(true);
    setCheckoutError(null);
    try {
      const response = await billingService.createConnectOnboardingLink(workspaceId);
      window.location.href = response.url;
    } catch {
      setCheckoutError("Nao foi possivel abrir o fluxo de cadastro do Stripe Connect.");
      setIsOpeningOnboarding(false);
    }
  }

  async function handleCreateCheckout() {
    if (!workspaceId) {
      return;
    }
    if (chargeSource === "catalog" && !selectedCatalogItem) {
      return;
    }
    if (chargeSource === "manual" && (!amountInCents || !description.trim())) {
      return;
    }

    setIsCreatingCheckout(true);
    setCheckoutError(null);
    try {
      const response = await billingService.createConnectCheckoutSession(workspaceId, {
        amount: chargeSource === "manual" ? amountInCents ?? undefined : undefined,
        currency: "brl",
        description: chargeSource === "manual" ? description.trim() : undefined,
        catalogItemId: chargeSource === "catalog" ? selectedCatalogItem?.id : undefined,
        customerEmail: customerEmail.trim() || undefined,
        successUrl:
          workspaceSlug.length > 0
            ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=success`
            : undefined,
        cancelUrl:
          workspaceSlug.length > 0
            ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=cancel`
            : undefined
      });
      window.location.href = response.url;
    } catch {
      setCheckoutError("Nao foi possivel criar a cobranca agora. Revise os dados e tente novamente.");
      setIsCreatingCheckout(false);
    }
  }

  async function handleCreateCatalogItem() {
    if (!workspaceId || isCreatingCatalogItem || !catalogItemAmountInCents || catalogItemDisplayName.length < 2) {
      return;
    }

    setIsCreatingCatalogItem(true);
    setCatalogError(null);
    try {
      const created = await billingService.createConnectCatalogItem(workspaceId, {
        kind: catalogItemKind,
        billingType: catalogItemBillingType,
        recurringInterval: catalogItemBillingType === "SUBSCRIPTION" ? catalogItemRecurringInterval : undefined,
        recurringIntervalCount: catalogItemBillingType === "SUBSCRIPTION" ? 1 : undefined,
        name: catalogItemDisplayName,
        description: catalogItemDescription.trim() || undefined,
        amount: catalogItemAmountInCents,
        currency: "brl"
      });
      setCatalogItems((current) => [created, ...current]);
      setSelectedCatalogItemId(created.id);
      setChargeSource("catalog");
      setAmount((created.amount / 100).toFixed(2));
      setDescription(created.name);
      setCatalogItemName("");
      setCatalogItemDescription("");
      setCatalogItemAmount("");
    } catch {
      setCatalogError("Nao foi possivel criar item no catalogo agora.");
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

  const hasPaymentOrders = paymentOrders.length > 0;
  const canReviewCharge =
    canCreateCheckout &&
    (chargeSource === "catalog"
      ? Boolean(selectedCatalogItem)
      : Boolean(amountInCents && description.trim().length >= 3));

  const metricCards = [
    { label: "Conta Stripe", value: connectState === "ready" && connectStatus ? "Conectada" : "Pendente" },
    { label: "Cobrancas", value: paymentOrders.length },
    { label: "Catalogo", value: catalogItems.length },
    { label: "Pendencias", value: pendingItems.length }
  ];

  return (
    <AppShell metrics={metrics} hideSidebarBrandMark pageTitle="Cobranca" pageLabel="Financeiro">
      <div className="billing-view workspace-view">
        <BoardMetrics metrics={metrics} cards={metricCards} className="billing-view__metrics workspace-view__metrics" />

        {checkoutResult === "success" ? (
          <div className="billing-view__result billing-view__result--success">
            Pagamento concluido. A Stripe confirmou o checkout com sucesso.
          </div>
        ) : null}
        {checkoutResult === "cancel" ? (
          <div className="billing-view__result billing-view__result--warning">
            Checkout cancelado. Revise os dados e tente novamente quando quiser.
          </div>
        ) : null}

        <Section
          title="Cobranca Connect"
          subtitle="Gerencie cadastro, cobranca e repasses com o mesmo estilo visual da timeline."
          actions={
            <div className="billing-view__toolbar workspace-view__actions">
              <StatusBadge>{canCreateCheckout ? "Checkout liberado" : "Cadastro pendente"}</StatusBadge>
              <Button type="button" onClick={() => void handleOpenOnboarding()} disabled={isOpeningOnboarding}>
                {isOpeningOnboarding ? "Abrindo..." : "Completar cadastro"}
              </Button>
            </div>
          }
          className="billing-view__section workspace-view__section"
        >
          <div className="billing-view__stack">
            <div className="billing-view__status-row">
              {statusCards.map((item) => (
                <article key={item.key} className="billing-view__status-tile">
                  <StatusBadge tone={BADGE_TONE_BY_STATUS[item.tone]}>{item.value}</StatusBadge>
                  <p>{item.label}</p>
                </article>
              ))}
            </div>

            <div className="billing-view__onboarding-card">
              <div className="billing-view__onboarding-copy">
                <h2>{onboardingSummary.title}</h2>
                <p>{onboardingSummary.subtitle}</p>
                <div className="billing-view__progress">
                  <span style={{ width: `${onboardingSummary.progress}%` }} />
                </div>
                <div className="billing-view__steps">
                  <span className={connectStatus?.detailsSubmitted ? "is-done" : "is-pending"}>Cadastro</span>
                  <span className={connectStatus?.chargesEnabled ? "is-done" : "is-blocked"}>Cobranca</span>
                  <span className={connectStatus?.payoutsEnabled ? "is-done" : "is-blocked"}>Repasse</span>
                </div>
                <p className="billing-view__next-step"><strong>Proximo passo:</strong> {nextOnboardingAction}</p>
              </div>
              <div className="billing-view__onboarding-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("billing-pendencias")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Ver pendencias
                </Button>
              </div>
            </div>

            <div className="billing-view__card" id="billing-pendencias">
              <div className="billing-view__card-head">
                <h3>Pendencias de cadastro</h3>
                {alertMessage ? <StatusBadge tone={alertTone}>{alertMessage}</StatusBadge> : null}
              </div>
              {pendingItems.length === 0 ? (
                <EmptyState>Nenhuma pendencia. Sua conta esta pronta.</EmptyState>
              ) : (
                <ul className="billing-view__pending-list">
                  {pendingItems.map((item) => (
                    <li key={item.key}>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="billing-view__card">
              <div className="billing-view__card-head">
                <h3>Catalogo de produtos e servicos</h3>
                <StatusBadge>{catalogItems.length} itens</StatusBadge>
              </div>

              <div className="billing-view__catalog-create">
                <div className="billing-view__form-grid">
                  <FormField label="Tipo" className="billing-view__field">
                    <Select
                      value={catalogItemKind}
                      onChange={(event) => setCatalogItemKind(event.target.value as ConnectCatalogItemKind)}
                    >
                      <option value="SERVICE">Servico</option>
                      <option value="PRODUCT">Produto</option>
                    </Select>
                  </FormField>

                  <FormField label="Modelo" className="billing-view__field">
                    <Select
                      value={catalogItemBillingType}
                      onChange={(event) => setCatalogItemBillingType(event.target.value as ConnectCatalogBillingType)}
                    >
                      <option value="ONE_TIME">Cobranca avulsa</option>
                      <option value="SUBSCRIPTION">Assinatura recorrente</option>
                    </Select>
                  </FormField>
                </div>

                <div className="billing-view__form-grid">
                  <FormField label="Nome" className="billing-view__field">
                    <TextInput
                      value={catalogItemName}
                      onChange={(event) => setCatalogItemName(event.target.value)}
                      placeholder="Ex.: Consultoria mensal"
                    />
                  </FormField>

                  {catalogItemBillingType === "SUBSCRIPTION" ? (
                    <FormField label="Recorrencia" className="billing-view__field">
                      <Select
                        value={catalogItemRecurringInterval}
                        onChange={(event) =>
                          setCatalogItemRecurringInterval(event.target.value as ConnectCatalogRecurringInterval)
                        }
                      >
                        <option value="MONTH">Mensal</option>
                        <option value="YEAR">Anual</option>
                        <option value="WEEK">Semanal</option>
                        <option value="DAY">Diaria</option>
                      </Select>
                    </FormField>
                  ) : (
                    <FormField label="Recorrencia" className="billing-view__field">
                      <TextInput value="Nao recorrente" readOnly />
                    </FormField>
                  )}
                </div>

                <div className="billing-view__form-grid">
                  <FormField label="Valor (R$)" className="billing-view__field">
                    <TextInput
                      value={catalogItemAmount}
                      onChange={(event) => setCatalogItemAmount(event.target.value)}
                      placeholder="249.90"
                    />
                  </FormField>

                  <FormField label="Descricao (opcional)" className="billing-view__field">
                    <TextInput
                      value={catalogItemDescription}
                      onChange={(event) => setCatalogItemDescription(event.target.value)}
                      placeholder="Escopo resumido do item"
                    />
                  </FormField>
                </div>

                <div className="billing-view__actions">
                  <Button
                    type="button"
                    onClick={() => void handleCreateCatalogItem()}
                    disabled={isCreatingCatalogItem || !catalogItemAmountInCents || catalogItemDisplayName.length < 2}
                  >
                    {isCreatingCatalogItem ? "Salvando item..." : "Adicionar ao catalogo"}
                  </Button>
                </div>
                {catalogError ? <p className="billing-view__error">{catalogError}</p> : null}
              </div>

              {catalogLoadState === "loading" ? <LoadingState text="Carregando catalogo..." /> : null}
              {catalogLoadState === "loaded" && catalogItems.length === 0 ? (
                <EmptyState>Nenhum item cadastrado. Crie produtos ou servicos para cobrar em um clique.</EmptyState>
              ) : null}
              {catalogLoadState === "loaded" && catalogItems.length > 0 ? (
                <ul className="billing-view__catalog-list">
                  {catalogItems.map((item) => (
                    <li key={item.id}>
                      <div>
                        <p>
                          <strong>{item.name}</strong>
                          <span>{CATALOG_KIND_LABEL[item.kind]} - {CATALOG_BILLING_LABEL[item.billingType]}</span>
                        </p>
                        <small>
                          {formatAmount(item.amount, item.currency)}
                          {item.description ? ` - ${item.description}` : ""}
                        </small>
                      </div>
                      <Button type="button" variant="outline" onClick={() => handleUseCatalogItem(item)}>
                        Usar para cobrar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className={`billing-view__card ${!canCreateCheckout ? "is-disabled" : ""}`}>
              <div className="billing-view__card-head">
                <h3>Nova cobranca</h3>
                {!canCreateCheckout ? <StatusBadge>Complete o cadastro para liberar cobrancas</StatusBadge> : null}
              </div>

              <fieldset disabled={!canCreateCheckout} className="billing-view__fieldset">
                <div className="billing-view__form-grid">
                  <FormField label="Produto/servico do catalogo" className="billing-view__field">
                    <Select
                      value={selectedCatalogItemId}
                      onChange={(event) => {
                        const nextCatalogItemId = event.target.value;
                        setSelectedCatalogItemId(nextCatalogItemId);
                        if (!nextCatalogItemId) {
                          setChargeSource("manual");
                          return;
                        }

                        const item = activeCatalogItems.find((catalogItem) => catalogItem.id === nextCatalogItemId);
                        if (!item) {
                          setChargeSource("manual");
                          return;
                        }

                        setChargeSource("catalog");
                        setAmount((item.amount / 100).toFixed(2));
                        setDescription(item.name);
                      }}
                    >
                      <option value="">Cobranca avulsa (sem produto)</option>
                      {activeCatalogItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} - {formatAmount(item.amount, item.currency)}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="E-mail do cliente (opcional)" className="billing-view__field">
                    <TextInput
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      placeholder="cliente@empresa.com"
                    />
                  </FormField>
                </div>

                {chargeSource === "catalog" ? (
                  selectedCatalogItem ? (
                    <div className="billing-view__review-grid">
                      <span>
                        <strong>Valor</strong>
                        {formatAmount(selectedCatalogItem.amount, selectedCatalogItem.currency)}
                      </span>
                      <span>
                        <strong>Descricao</strong>
                        {selectedCatalogItem.description || selectedCatalogItem.name}
                      </span>
                      <span>
                        <strong>Tipo</strong>
                        {CATALOG_BILLING_LABEL[selectedCatalogItem.billingType]}
                      </span>
                    </div>
                  ) : (
                    <EmptyState>Selecione um produto ou servico do catalogo para preencher os dados automaticamente.</EmptyState>
                  )
                ) : (
                  <>
                    <div className="billing-view__form-grid">
                      <FormField label="Valor (R$)" className="billing-view__field">
                        <TextInput
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder="100.00"
                        />
                      </FormField>
                    </div>

                    <FormField label="Descricao" className="billing-view__field">
                      <TextInput
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Descricao da cobranca"
                      />
                    </FormField>
                  </>
                )}

                <div className="billing-view__actions">
                  <Button type="button" onClick={() => setIsReviewOpen(true)} disabled={!canReviewCharge}>
                    Revisar cobranca
                  </Button>
                </div>
              </fieldset>

              {checkoutError ? <p className="billing-view__error">{checkoutError}</p> : null}
            </div>

            {isReviewOpen ? (
              <div className="billing-view__card">
                <div className="billing-view__card-head">
                  <h3>Revisao antes do checkout</h3>
                  <StatusBadge>Pagamento final na Stripe</StatusBadge>
                </div>
                <div className="billing-view__review-grid">
                  <span>
                    <strong>Valor</strong>
                    {chargeSource === "catalog" && selectedCatalogItem
                      ? formatAmount(selectedCatalogItem.amount, selectedCatalogItem.currency)
                      : `R$ ${((amountInCents ?? 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </span>
                  <span>
                    <strong>Descricao</strong>
                    {chargeSource === "catalog" && selectedCatalogItem
                      ? selectedCatalogItem.description || selectedCatalogItem.name
                      : description}
                  </span>
                  <span>
                    <strong>Cliente</strong>
                    {customerEmail.trim() || "Nao informado"}
                  </span>
                  <span>
                    <strong>Origem</strong>
                    {chargeSource === "catalog"
                      ? `Catalogo (${selectedCatalogItem ? CATALOG_BILLING_LABEL[selectedCatalogItem.billingType] : "item"})`
                      : "Cobranca avulsa"}
                  </span>
                  <span>
                    <strong>Taxa plataforma</strong>
                    Aplicada automaticamente
                  </span>
                </div>
                <div className="billing-view__actions">
                  <Button type="button" variant="outline" onClick={() => setIsReviewOpen(false)}>
                    Voltar e editar
                  </Button>
                  <Button type="button" onClick={() => void handleCreateCheckout()} disabled={isCreatingCheckout}>
                    {isCreatingCheckout ? "Redirecionando..." : "Continuar para Stripe"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="billing-view__card">
              <div className="billing-view__card-head">
                <h3>Cobrancas recentes</h3>
                <StatusBadge>{paymentOrders.length} itens</StatusBadge>
              </div>

              {paymentOrdersLoadState === "loading" ? (
                <LoadingState text="Carregando historico de cobrancas..." />
              ) : null}
              {paymentOrdersLoadState === "error" ? (
                <p className="billing-view__error">{paymentOrdersError}</p>
              ) : null}
              {paymentOrdersLoadState === "loaded" && !hasPaymentOrders ? (
                <EmptyState>Nenhuma cobranca criada ainda.</EmptyState>
              ) : null}
              {paymentOrdersLoadState === "loaded" && hasPaymentOrders ? (
                <DataTable className="billing-view__table" columns="0.9fr 0.9fr 1.25fr 1fr 1fr" responsiveMinWidth="880px">
                  <DataTableHeader>
                    <DataTableCell>Status</DataTableCell>
                    <DataTableCell>Valor</DataTableCell>
                    <DataTableCell>Descricao</DataTableCell>
                    <DataTableCell>Cliente</DataTableCell>
                    <DataTableCell>Criada em</DataTableCell>
                  </DataTableHeader>
                  <DataTableBody>
                    {paymentOrders.map((order) => (
                      <DataTableRow key={order.id}>
                        <DataTableCell>
                          <StatusBadge tone={BADGE_TONE_BY_STATUS[mapOrderStatusTone(order.status)]}>
                            {ORDER_STATUS_LABEL[order.status]}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell>{formatAmount(order.amount, order.currency)}</DataTableCell>
                        <DataTableCell>{order.description}</DataTableCell>
                        <DataTableCell>{order.customerEmail ?? "Nao informado"}</DataTableCell>
                        <DataTableCell>{formatOrderDate(order.createdAt)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              ) : null}
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

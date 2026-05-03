import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics } from "@/entities/task";
import { billingService, buildOnboardingChecklist } from "@/modules/billing";
import type {
  ConnectAccountStatus,
  ConnectCatalogBillingType,
  ConnectCatalogItem,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder
} from "@/modules/billing";
import { getCustomerDisplayName, useWorkspace, type Customer } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import {
  buildCatalogCommercialMetadata,
  canCancelOrder,
  canResendOrder,
  HISTORY_PAGE_SIZE,
  isRecurringCatalogBillingType,
  parseAmountInCents,
  type ActiveTab,
  type BillingOnboardingStage,
  type CatalogLoadState,
  type ChargeSource,
  type ConnectLoadState,
  type CustomersLoadState,
  type HistoryAction,
  type PaymentCapability,
  type PaymentOrdersLoadState,
  type ReviewStep,
  type StatusTone
} from "./billing-page.model";

export function useBillingPageModel() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const [searchParams] = useSearchParams();
  const { snapshot, listCustomers } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = buildBoardMetrics(snapshot?.tasks ?? []);
  const isClient = snapshot?.access?.isClient || snapshot?.access?.role === "CLIENT";

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
  const [catalogItemUnit, setCatalogItemUnit] = useState("servico");
  const [catalogItemQuantity, setCatalogItemQuantity] = useState("1");
  const [catalogItemScope, setCatalogItemScope] = useState("");
  const [catalogItemDeliverables, setCatalogItemDeliverables] = useState("");
  const [catalogItemDeliveryTerms, setCatalogItemDeliveryTerms] = useState("");
  const [catalogItemPaymentTerms, setCatalogItemPaymentTerms] = useState("");
  const [catalogItemProposalValidity, setCatalogItemProposalValidity] = useState("");
  const [catalogItemContractTerm, setCatalogItemContractTerm] = useState("");
  const [catalogItemCancellationTerms, setCatalogItemCancellationTerms] = useState("");
  const [catalogItemClientResponsibilities, setCatalogItemClientResponsibilities] = useState("");
  const [catalogItemAcceptanceCriteria, setCatalogItemAcceptanceCriteria] = useState("");
  const [catalogItemContractNotes, setCatalogItemContractNotes] = useState("");
  const [amount, setAmount] = useState("100.00");
  const [description, setDescription] = useState("Serviço prestado via Dask");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoadState, setCustomersLoadState] = useState<CustomersLoadState>("idle");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
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
  const focusedOrderId = searchParams.get("orderId");

  useEffect(() => {
    if (checkoutResult === "success" || checkoutResult === "cancel" || focusedOrderId) {
      setActiveTab("historico");
    }
  }, [checkoutResult, focusedOrderId]);

  useEffect(() => {
    if (isClient) {
      setActiveTab("historico");
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient) {
      setConnectState("missing");
      setConnectStatus(null);
      setConnectError(null);
      return;
    }

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
  }, [isClient, workspaceId]);

  useEffect(() => {
    if (!workspaceId || isClient || checkoutResult !== "success" || !checkoutSessionId) {
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
  }, [workspaceId, isClient, checkoutResult, checkoutSessionId]);

  useEffect(() => {
    if (isClient) {
      setCatalogItems([]);
      setCatalogLoadState("loaded");
      setCatalogError(null);
      return;
    }

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
  }, [isClient, workspaceId]);

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

  useEffect(() => {
    if (!workspaceId) return;

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void billingService
        .listConnectPaymentOrders(workspaceId, 30)
        .then((response) => {
          if (cancelled) return;
          setPaymentOrders(response.items);
          setPaymentOrdersLoadState("loaded");
        })
        .catch(() => {
          if (cancelled) return;
          setPaymentOrdersError("Nao foi possivel atualizar o status das cobrancas em tempo real.");
        });
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [workspaceId]);

  useEffect(() => {
    if (isClient) {
      setCustomers([]);
      setCustomersLoadState("loaded");
      return;
    }

    if (!workspaceId) return;
    let mounted = true;
    setCustomersLoadState("loading");

    listCustomers()
      .then((items) => {
        if (!mounted) return;
        setCustomers(items);
        setCustomersLoadState("loaded");
      })
      .catch(() => {
        if (!mounted) return;
        setCustomers([]);
        setCustomersLoadState("error");
      });

    return () => { mounted = false; };
  }, [isClient, listCustomers, workspaceId]);

  const amountInCents = useMemo(() => {
    return parseAmountInCents(amount);
  }, [amount]);

  const catalogItemAmountInCents = useMemo(() => {
    return parseAmountInCents(catalogItemAmount);
  }, [catalogItemAmount]);

  const catalogItemDisplayName = useMemo(() => {
    const explicitName = catalogItemName.trim();
    if (explicitName.length >= 2) return explicitName;
    const fallbackName = catalogItemDescription.trim();
    return fallbackName.length >= 2 ? fallbackName : "";
  }, [catalogItemDescription, catalogItemName]);

  const catalogItemCommercialMetadata = useMemo<Record<string, string>>(() => {
    return buildCatalogCommercialMetadata({
      unit: catalogItemUnit,
      defaultQuantity: catalogItemQuantity,
      scope: catalogItemScope,
      deliverables: catalogItemDeliverables,
      deliveryTerms: catalogItemDeliveryTerms,
      paymentTerms: catalogItemPaymentTerms,
      proposalValidity: catalogItemProposalValidity,
      contractTerm: catalogItemContractTerm,
      cancellationTerms: catalogItemCancellationTerms,
      clientResponsibilities: catalogItemClientResponsibilities,
      acceptanceCriteria: catalogItemAcceptanceCriteria,
      contractNotes: catalogItemContractNotes
    });
  }, [
    catalogItemAcceptanceCriteria,
    catalogItemCancellationTerms,
    catalogItemClientResponsibilities,
    catalogItemContractNotes,
    catalogItemContractTerm,
    catalogItemDeliverables,
    catalogItemDeliveryTerms,
    catalogItemPaymentTerms,
    catalogItemProposalValidity,
    catalogItemQuantity,
    catalogItemScope,
    catalogItemUnit
  ]);

  const canCreateCatalogItem =
    Boolean(catalogItemAmountInCents) &&
    catalogItemDisplayName.length >= 2 &&
    catalogItemDescription.trim().length >= 3 &&
    catalogItemUnit.trim().length > 0 &&
    catalogItemQuantity.trim().length > 0 &&
    catalogItemScope.trim().length >= 3 &&
    catalogItemDeliverables.trim().length >= 3 &&
    catalogItemDeliveryTerms.trim().length >= 3 &&
    catalogItemPaymentTerms.trim().length >= 3 &&
    catalogItemProposalValidity.trim().length >= 3 &&
    catalogItemContractTerm.trim().length >= 3 &&
    catalogItemCancellationTerms.trim().length >= 3 &&
    catalogItemClientResponsibilities.trim().length >= 3 &&
    catalogItemAcceptanceCriteria.trim().length >= 3;

  const canCreateCheckout = !isClient && connectState === "ready" && connectStatus?.chargesEnabled === true;
  const onboardingChecklist = useMemo(() => buildOnboardingChecklist(connectStatus), [connectStatus]);

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
  const completedItems = onboardingChecklist.filter((item) => item.done);
  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const selectedCustomer = selectedCustomerId ? customersById.get(selectedCustomerId) ?? null : null;
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

  const currentOnboardingStage = useMemo<BillingOnboardingStage>(() => {
    if (!connectStatus || !connectStatus.detailsSubmitted) return "Cadastro";
    if (!connectStatus.chargesEnabled) return "Cobrança";
    if (!connectStatus.payoutsEnabled) return "Repasse";
    return "Concluído";
  }, [connectStatus]);

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
      if (!response.url) {
        throw new Error("missing_onboarding_url");
      }
      window.location.assign(response.url);
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

  function handleCustomerSelect(customerId: string) {
    setSelectedCustomerId(customerId);
    const customer = customersById.get(customerId);
    if (customer?.email) {
      setCustomerEmail(customer.email);
    }
  }

  async function handlePrepareCheckout() {
    if (!workspaceId) return;
    if (chargeSource === "catalog" && !selectedCatalogItem) return;
    if (chargeSource === "manual" && (!amountInCents || !description.trim())) return;
    const trimmedEmail = customerEmail.trim() || selectedCustomer?.email?.trim() || "";
    if (!selectedCustomer && !trimmedEmail) {
      setCheckoutError("Informe o e-mail do cliente ou selecione um cliente cadastrado para gerar a cobranca.");
      return;
    }

    setReviewStep("preparing");
    setCheckoutError(null);
    try {
      const shouldSendEmail = sendEmailToCustomer && trimmedEmail.length > 0;

      const response = await billingService.createConnectCheckoutSession(workspaceId, {
        amount: chargeSource === "manual" ? amountInCents ?? undefined : undefined,
        currency: "brl",
        description: chargeSource === "manual" ? description.trim() : undefined,
        catalogItemId: chargeSource === "catalog" ? selectedCatalogItem?.id : undefined,
        customerId: selectedCustomer?.id,
        customerName: getCustomerDisplayName(selectedCustomer) || undefined,
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
    if (!workspaceId || isCreatingCatalogItem || !canCreateCatalogItem || !catalogItemAmountInCents) return;

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
        currency: "brl",
        metadata: catalogItemCommercialMetadata
      });
      setCatalogItems((current) => [created, ...current]);
      setSelectedCatalogItemId(created.id);
      setChargeSource("catalog");
      setCatalogItemName("");
      setCatalogItemDescription("");
      setCatalogItemAmount("");
      setCatalogItemUnit("servico");
      setCatalogItemQuantity("1");
      setCatalogItemScope("");
      setCatalogItemDeliverables("");
      setCatalogItemDeliveryTerms("");
      setCatalogItemPaymentTerms("");
      setCatalogItemProposalValidity("");
      setCatalogItemContractTerm("");
      setCatalogItemCancellationTerms("");
      setCatalogItemClientResponsibilities("");
      setCatalogItemAcceptanceCriteria("");
      setCatalogItemContractNotes("");
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
      setCatalogError("Não foi possível excluir este item do catálogo agora.");
    } finally {
      setDeletingCatalogItemId(null);
    }
  }

  async function handleCopyHistoryLink(order: ConnectPaymentOrder) {
    const link = order.customerPortalUrl ?? order.checkoutUrl;
    if (!link) return;
    const copied = await copyText(link);
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
    Boolean(selectedCustomer || customerEmail.trim()) &&
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

  useEffect(() => {
    if (!focusedOrderId) {
      return;
    }

    const index = paymentOrders.findIndex((order) => order.id === focusedOrderId);
    if (index < 0) {
      return;
    }

    setHistoryPage(Math.floor(index / HISTORY_PAGE_SIZE) + 1);
  }, [focusedOrderId, paymentOrders]);

  const metricCards = [
    { label: "Conta Stripe", value: connectState === "ready" && connectStatus ? "Conectada" : "Pendente" },
    { label: "Cobranças", value: paymentOrders.length },
    { label: "Catálogo", value: catalogItems.length },
    { label: "Pendências", value: pendingItems.length }
  ];
  const isBillingFrameLoading =
    (!isClient && (connectState === "loading" || catalogLoadState === "loading")) || paymentOrdersLoadState === "loading";

  const catalogFormProps = {
    catalogItemKind,
    catalogItemBillingType,
    catalogItemRecurringInterval,
    catalogItemRecurringIntervalCount,
    catalogItemName,
    catalogItemDescription,
    catalogItemAmount,
    catalogItemUnit,
    catalogItemQuantity,
    catalogItemScope,
    catalogItemDeliverables,
    catalogItemDeliveryTerms,
    catalogItemPaymentTerms,
    catalogItemProposalValidity,
    catalogItemContractTerm,
    catalogItemCancellationTerms,
    catalogItemClientResponsibilities,
    catalogItemAcceptanceCriteria,
    catalogItemContractNotes,
    isCreatingCatalogItem,
    canCreateCatalogItem,
    catalogError,
    onCatalogItemKindChange: setCatalogItemKind,
    onCatalogItemBillingTypeChange: setCatalogItemBillingType,
    onCatalogItemRecurringChange: (
      interval: ConnectCatalogRecurringInterval,
      intervalCount: number
    ) => {
      setCatalogItemRecurringInterval(interval);
      setCatalogItemRecurringIntervalCount(intervalCount);
    },
    onCatalogItemNameChange: setCatalogItemName,
    onCatalogItemDescriptionChange: setCatalogItemDescription,
    onCatalogItemAmountChange: setCatalogItemAmount,
    onCatalogItemUnitChange: setCatalogItemUnit,
    onCatalogItemQuantityChange: setCatalogItemQuantity,
    onCatalogItemScopeChange: setCatalogItemScope,
    onCatalogItemDeliverablesChange: setCatalogItemDeliverables,
    onCatalogItemDeliveryTermsChange: setCatalogItemDeliveryTerms,
    onCatalogItemPaymentTermsChange: setCatalogItemPaymentTerms,
    onCatalogItemProposalValidityChange: setCatalogItemProposalValidity,
    onCatalogItemContractTermChange: setCatalogItemContractTerm,
    onCatalogItemCancellationTermsChange: setCatalogItemCancellationTerms,
    onCatalogItemClientResponsibilitiesChange: setCatalogItemClientResponsibilities,
    onCatalogItemAcceptanceCriteriaChange: setCatalogItemAcceptanceCriteria,
    onCatalogItemContractNotesChange: setCatalogItemContractNotes,
    onSubmit: handleCreateCatalogItem
  };

  return {
    activeTab,
    isClient,
    canCreateCheckout,
    catalogItemPendingDelete,
    checkoutResult,
    deletingCatalogItemId,
    isBillingFrameLoading,
    isOpeningOnboarding,
    metricCards,
    metrics,
    paymentOrders,
    pendingItems,
    setActiveTab,
    setCatalogItemPendingDelete,
    accountPanelProps: {
      statusCards,
      canCreateCheckout,
      onboardingSummary,
      currentOnboardingStage,
      connectStatus,
      pendingItems,
      completedItems,
      connectError,
      isOpeningOnboarding,
      requestingCapability,
      onOpenOnboarding: handleOpenOnboarding,
      onRequestPaymentCapability: handleRequestPaymentCapability
    },
    catalogSectionProps: {
      catalogItems,
      catalogLoadState,
      catalogCreatedNotice,
      isCatalogFormOpen,
      deletingCatalogItemId,
      formProps: catalogFormProps,
      onToggleCatalogForm: () => setIsCatalogFormOpen((open) => !open),
      onChargeNow: () => setActiveTab("cobrar"),
      onUseCatalogItem: handleUseCatalogItem,
      onRequestDeleteCatalogItem: handleRequestDeleteCatalogItem
    },
    chargePanelProps: {
      canCreateCheckout,
      isOpeningOnboarding,
      reviewStep,
      activeCatalogItems,
      chargeSource,
      selectedCatalogItemId,
      selectedCatalogItem,
      amount,
      amountInCents,
      description,
      customers,
      customersLoadState,
      selectedCustomerId,
      selectedCustomer,
      customerEmail,
      sendEmailToCustomer,
      canReviewCharge,
      checkoutError,
      checkoutUrl,
      linkCopied,
      emailSentNotice,
      onGoToAccount: () => setActiveTab("conta"),
      onOpenOnboarding: handleOpenOnboarding,
      onChargeSourceChange: setChargeSource,
      onSelectedCatalogItemClear: () => setSelectedCatalogItemId(""),
      onUseCatalogItem: handleUseCatalogItem,
      onAmountChange: setAmount,
      onDescriptionChange: setDescription,
      onCustomerSelect: handleCustomerSelect,
      onCustomerEmailChange: setCustomerEmail,
      onSendEmailToCustomerChange: setSendEmailToCustomer,
      onPrepareCheckout: handlePrepareCheckout,
      onCopyCheckoutUrl: handleCopyCheckoutUrl,
      onCancelReview: handleCancelReview
    },
    historyPanelProps: {
      customerMode: isClient,
      paymentOrders,
      paginatedPaymentOrders,
      paymentOrdersLoadState,
      paymentOrdersError,
      focusedOrderId,
      historyCopiedOrderId,
      historyActionOrderId,
      historyActionType,
      historyPage,
      historyTotalPages,
      setHistoryPage,
      onCreateFirstCharge: () => setActiveTab("cobrar"),
      onCopyHistoryLink: (order: ConnectPaymentOrder) => void handleCopyHistoryLink(order),
      onResendOrder: (order: ConnectPaymentOrder) => void handleResendOrder(order),
      onCancelOrder: (order: ConnectPaymentOrder) => void handleCancelOrder(order)
    },
    onConfirmDeleteCatalogItem: (item: ConnectCatalogItem) => void handleDeleteCatalogItem(item)
  };
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics } from "@/entities/task";
import {
  billingCatalogItemFormSchema,
  billingCheckoutFormSchema,
  buildOnboardingChecklist,
  canManageSensitiveConnectSettings as canManageSensitiveConnectSettingsForRole,
  formatCentsToMoneyInput,
  hasBrazilianFiscalDocument,
  parseMoneyToCents,
  sensitiveConnectSettingsPermissionMessage,
  toBillingCatalogItemPayload,
  useArchiveCatalogItemMutation,
  useBillingCatalogQuery,
  useBillingPaymentOrdersQuery,
  useCancelPaymentOrderMutation,
  useConnectAccountQuery,
  useCreateCatalogItemMutation,
  useCreateCheckoutSessionMutation,
  useCreateConnectAccountMutation,
  useRequestConnectCapabilityMutation,
  useResendConnectEmailMutation,
  useSyncPostCheckoutMutation,
  useUpdateCatalogItemMutation
} from "@/modules/billing";
import type {
  BillingCatalogItemFormValues,
  BillingConnectCapability,
  BillingCheckoutFormValues,
  ConnectCatalogItem,
  ConnectPaymentOrder,
  ConnectPaymentOrderStatus
} from "@/modules/billing";
import { getCustomerDisplayName, useWorkspace } from "@/modules/workspace";
import { useWorkspaceCustomersQuery } from "@/modules/workspace";
import { isApiError } from "@/shared/api/http-client";
import { toast } from "@/shared/ui/toast";
import {
  canCancelOrder,
  canResendOrder,
  CATALOG_PAGE_SIZE,
  HISTORY_PAGE_SIZE,
  isRecurringCatalogBillingType,
  type ActiveTab,
  type BillingOnboardingStage,
  type CatalogBillingFilter,
  type CatalogKindFilter,
  type CatalogLoadState,
  type ChargeSource,
  type ConnectLoadState,
  type CustomersLoadState,
  type HistoryAction,
  type PaymentOrdersLoadState,
  type ReviewStep,
  type StatusTone
} from "./billing-page.model";

function createEmptyCatalogFormValues(): BillingCatalogItemFormValues {
  return {
    kind: "SERVICE",
    billingType: "ONE_TIME",
    name: "",
    description: "",
    amount: "",
    currency: "brl",
    unit: "servico",
    defaultQuantity: "1",
    scope: "",
    deliverables: "",
    deliveryTerms: "",
    paymentTerms: "",
    proposalValidity: "",
    contractTerm: "",
    cancellationTerms: "",
    clientResponsibilities: "",
    acceptanceCriteria: "",
    contractNotes: ""
  };
}

function catalogItemToFormValues(item: ConnectCatalogItem): BillingCatalogItemFormValues {
  const metadata = item.metadata ?? {};
  return {
    kind: item.kind,
    billingType: item.billingType,
    recurringInterval: isRecurringCatalogBillingType(item.billingType) ? item.recurringInterval ?? "MONTH" : undefined,
    recurringIntervalCount: isRecurringCatalogBillingType(item.billingType) ? item.recurringIntervalCount ?? 1 : undefined,
    name: item.name,
    description: item.description ?? "",
    amount: formatCentsToMoneyInput(item.amount),
    currency: item.currency ?? "brl",
    unit: metadata.unit ?? "servico",
    defaultQuantity: metadata.defaultQuantity ?? "1",
    scope: metadata.scope ?? "",
    deliverables: metadata.deliverables ?? "",
    deliveryTerms: metadata.deliveryTerms ?? "",
    paymentTerms: metadata.paymentTerms ?? "",
    proposalValidity: metadata.proposalValidity ?? "",
    contractTerm: metadata.contractTerm ?? "",
    cancellationTerms: metadata.cancellationTerms ?? "",
    clientResponsibilities: metadata.clientResponsibilities ?? "",
    acceptanceCriteria: metadata.acceptanceCriteria ?? "",
    contractNotes: metadata.contractNotes ?? ""
  };
}

function createEmptyChargeFormValues(): BillingCheckoutFormValues {
  return {
    chargeSource: "catalog",
    catalogItemId: "",
    amount: "100.00",
    description: "Serviço prestado via Dask",
    customerId: "",
    customerEmail: "",
    customerDocument: "",
    sendEmail: true
  };
}

const checkoutFormFieldNames = [
  "chargeSource",
  "catalogItemId",
  "amount",
  "description",
  "customerId",
  "customerEmail",
  "customerDocument",
  "sendEmail"
] as const;

function isCheckoutFormFieldName(value: unknown): value is keyof BillingCheckoutFormValues {
  return typeof value === "string" && checkoutFormFieldNames.includes(value as keyof BillingCheckoutFormValues);
}

function getCurrentCursor(cursorStack: string[]): string | null {
  return cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : null;
}

export function useBillingPageModel() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const [searchParams] = useSearchParams();
  const { snapshot } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = buildBoardMetrics(snapshot?.tasks ?? []);
  const workspaceRole = snapshot?.access?.role ?? null;
  const isClient = snapshot?.access?.isClient || workspaceRole === "CLIENT";
  const canManageSensitiveConnectSettings = canManageSensitiveConnectSettingsForRole(workspaceRole);
  const checkoutResultToastKeyRef = useRef<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>("conta");
  const [catalogItemPendingDelete, setCatalogItemPendingDelete] = useState<ConnectCatalogItem | null>(null);
  const [isCatalogFormOpen, setIsCatalogFormOpen] = useState(false);
  const [editingCatalogItemId, setEditingCatalogItemId] = useState<string | null>(null);
  const [catalogFormInitialValues, setCatalogFormInitialValues] = useState<BillingCatalogItemFormValues>(() =>
    createEmptyCatalogFormValues()
  );
  const [reviewStep, setReviewStep] = useState<ReviewStep>("closed");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [historyActionOrderId, setHistoryActionOrderId] = useState<string | null>(null);
  const [historyActionType, setHistoryActionType] = useState<HistoryAction | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogKindFilter, setCatalogKindFilter] = useState<CatalogKindFilter>("ALL");
  const [catalogBillingFilter, setCatalogBillingFilter] = useState<CatalogBillingFilter>("ALL");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ConnectPaymentOrderStatus | "ALL">("ALL");
  const [catalogCursorStack, setCatalogCursorStack] = useState<string[]>([]);
  const [historyCursorStack, setHistoryCursorStack] = useState<string[]>([]);
  const chargeForm = useForm<BillingCheckoutFormValues>({
    resolver: zodResolver(billingCheckoutFormSchema) as Resolver<BillingCheckoutFormValues>,
    defaultValues: createEmptyChargeFormValues(),
    mode: "onChange"
  });

  const checkoutResult = searchParams.get("checkout");
  const checkoutSessionId = searchParams.get("session_id");
  const focusedOrderId = searchParams.get("orderId");
  const catalogCursor = getCurrentCursor(catalogCursorStack);
  const historyCursor = getCurrentCursor(historyCursorStack);
  const connectAccountQuery = useConnectAccountQuery(isClient ? null : workspaceId);
  const catalogQuery = useBillingCatalogQuery(isClient ? null : workspaceId, {
    includeInactive: false,
    search: catalogSearch.trim() || undefined,
    kind: catalogKindFilter === "ALL" ? undefined : catalogKindFilter,
    billingType: catalogBillingFilter === "ALL" ? undefined : catalogBillingFilter,
    pageSize: CATALOG_PAGE_SIZE,
    cursor: catalogCursor
  });
  const catalogOptionsQuery = useBillingCatalogQuery(isClient ? null : workspaceId, {
    includeInactive: false,
    pageSize: 100
  });
  const paymentOrdersQuery = useBillingPaymentOrdersQuery(workspaceId, {
    status: historyStatusFilter === "ALL" ? undefined : historyStatusFilter,
    search: historySearch.trim() || undefined,
    pageSize: HISTORY_PAGE_SIZE,
    cursor: historyCursor
  });
  const customersQuery = useWorkspaceCustomersQuery(workspaceSlug || null, undefined, {
    enabled: !isClient && Boolean(workspaceId)
  });
  const createConnectAccountMutation = useCreateConnectAccountMutation(canManageSensitiveConnectSettings ? workspaceId : null);
  const createCatalogItemMutation = useCreateCatalogItemMutation(isClient ? null : workspaceId);
  const updateCatalogItemMutation = useUpdateCatalogItemMutation(isClient ? null : workspaceId);
  const archiveCatalogItemMutation = useArchiveCatalogItemMutation(isClient ? null : workspaceId);
  const createCheckoutSessionMutation = useCreateCheckoutSessionMutation(isClient ? null : workspaceId);
  const syncPostCheckoutMutation = useSyncPostCheckoutMutation(isClient ? null : workspaceId);
  const requestConnectCapabilityMutation = useRequestConnectCapabilityMutation(canManageSensitiveConnectSettings ? workspaceId : null);
  const resendConnectEmailMutation = useResendConnectEmailMutation(workspaceId);
  const cancelPaymentOrderMutation = useCancelPaymentOrderMutation(workspaceId);
  const chargeSource = chargeForm.watch("chargeSource");
  const selectedCatalogItemId = chargeForm.watch("catalogItemId") ?? "";
  const amount = chargeForm.watch("amount") ?? "";
  const description = chargeForm.watch("description") ?? "";
  const selectedCustomerId = chargeForm.watch("customerId") ?? "";
  const customerEmail = chargeForm.watch("customerEmail") ?? "";
  const sendEmailToCustomer = chargeForm.watch("sendEmail");
  const isOpeningOnboarding = createConnectAccountMutation.isPending;
  const requestingCapability = requestConnectCapabilityMutation.isPending
    ? requestConnectCapabilityMutation.variables ?? null
    : null;
  const isCreatingCatalogItem = createCatalogItemMutation.isPending || updateCatalogItemMutation.isPending;
  const deletingCatalogItemId = archiveCatalogItemMutation.isPending
    ? archiveCatalogItemMutation.variables ?? null
    : null;

  useEffect(() => {
    if (checkoutResult === "success" || checkoutResult === "cancel" || focusedOrderId) {
      setActiveTab("historico");
    }
  }, [checkoutResult, focusedOrderId]);

  useEffect(() => {
    if (checkoutResult !== "success" && checkoutResult !== "cancel") {
      return;
    }
    const toastKey = `${checkoutResult}:${checkoutSessionId ?? ""}`;
    if (checkoutResultToastKeyRef.current === toastKey) {
      return;
    }
    checkoutResultToastKeyRef.current = toastKey;
    if (checkoutResult === "success") {
      toast.success("Pagamento concluído.", {
        description: "A Stripe confirmou o checkout com sucesso."
      });
      return;
    }
    toast.warning("Checkout cancelado.", {
      description: "Revise os dados e tente novamente quando quiser."
    });
  }, [checkoutResult, checkoutSessionId]);

  useEffect(() => {
    if (isClient) {
      setActiveTab("historico");
    }
  }, [isClient]);

  const isConnectMissing =
    isClient ||
    (connectAccountQuery.isError && isApiError(connectAccountQuery.error) && connectAccountQuery.error.status === 404);
  const connectState: ConnectLoadState = isConnectMissing
    ? "missing"
    : !workspaceId || connectAccountQuery.isLoading
      ? "loading"
      : connectAccountQuery.isError
        ? "error"
        : connectAccountQuery.data
          ? "ready"
          : "loading";
  const connectStatus = connectState === "ready" ? connectAccountQuery.data ?? null : null;
  const connectError = connectState === "error" ? "Não foi possível carregar o status da conta Connect." : null;

  useEffect(() => {
    if (!workspaceId || isClient || checkoutResult !== "success" || !checkoutSessionId) {
      return;
    }

    let cancelled = false;

    void syncPostCheckoutMutation
      .mutateAsync(checkoutSessionId)
      .then(() => undefined)
      .catch(() => {
        if (cancelled) return;
        toast.warning("Pagamento concluído, mas ainda estamos atualizando o status da cobrança.");
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, isClient, checkoutResult, checkoutSessionId, syncPostCheckoutMutation.mutateAsync]);

  const catalogItems = useMemo(() => (isClient ? [] : catalogQuery.data?.items ?? []), [catalogQuery.data, isClient]);
  const catalogOptionItems = useMemo(
    () => (isClient ? [] : catalogOptionsQuery.data?.items ?? []),
    [catalogOptionsQuery.data, isClient]
  );
  const catalogNextCursor = catalogQuery.data?.nextCursor ?? null;
  const catalogLoadState: CatalogLoadState = isClient
    ? "loaded"
    : !workspaceId
      ? "idle"
      : catalogQuery.isLoading
        ? "loading"
        : catalogQuery.isError
          ? "error"
          : "loaded";
  const paymentOrders = paymentOrdersQuery.data?.items ?? [];
  const paymentOrdersNextCursor = paymentOrdersQuery.data?.nextCursor ?? null;
  const paymentOrdersLoadState: PaymentOrdersLoadState = !workspaceId
    ? "idle"
    : paymentOrdersQuery.isLoading
      ? "loading"
      : paymentOrdersQuery.isError
        ? "error"
        : "loaded";
  const paymentOrdersError =
    paymentOrdersLoadState === "error" ? "Não foi possível carregar o histórico de cobranças." : null;

  const customers = isClient ? [] : customersQuery.data ?? [];
  const customersLoadState: CustomersLoadState = isClient
    ? "loaded"
    : !workspaceId
      ? "idle"
      : customersQuery.isLoading
        ? "loading"
        : customersQuery.isError
          ? "error"
          : "loaded";

  const amountInCents = useMemo(() => {
    return parseMoneyToCents(amount);
  }, [amount]);

  const canCreateCheckout = !isClient && connectState === "ready" && connectStatus?.chargesEnabled === true;
  const onboardingChecklist = useMemo(() => buildOnboardingChecklist(connectStatus), [connectStatus]);
  const blockingConnectRequirementsCount =
    (connectStatus?.requirementsDue.length ?? 0) + (connectStatus?.requirementsPastDue.length ?? 0);
  const isConnectReady = Boolean(
    connectStatus?.detailsSubmitted &&
    connectStatus?.chargesEnabled &&
    connectStatus?.payoutsEnabled &&
    blockingConnectRequirementsCount === 0
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
        value: `${blockingConnectRequirementsCount} itens`,
        tone:
          blockingConnectRequirementsCount === 0
            ? "active"
            : blockingConnectRequirementsCount <= 3
              ? "attention"
              : "blocked"
      }
    ],
    [blockingConnectRequirementsCount, connectState, connectStatus]
  );

  const pendingItems = onboardingChecklist.filter((item) => !item.done);
  const completedItems = onboardingChecklist.filter((item) => item.done);
  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const selectedCustomer = selectedCustomerId ? customersById.get(selectedCustomerId) ?? null : null;
  const activeCatalogItems = useMemo(() => catalogOptionItems.filter((item) => item.isActive), [catalogOptionItems]);
  const selectedCatalogItem = useMemo(
    () => activeCatalogItems.find((item) => item.id === selectedCatalogItemId) ?? null,
    [activeCatalogItems, selectedCatalogItemId]
  );

  const onboardingSummary = useMemo(() => {
    if (!connectStatus) {
      return {
        title: "Cobranca Connect ainda nao iniciada",
        subtitle: "Usaremos os dados legais do workspace para iniciar sua conta Stripe Connect.",
        progress: 0
      };
    }
    const doneCount = onboardingChecklist.filter((item) => item.done).length;
    const progress = Math.round((doneCount / onboardingChecklist.length) * 100);
    if (isConnectReady) {
      return { title: "Conta Connect pronta", subtitle: "Cobrancas e repasses habilitados.", progress };
    }
    return {
      title: "Verificacao Stripe pendente",
      subtitle: `A Stripe ainda precisa validar ${blockingConnectRequirementsCount} pendencia(s) bloqueante(s).`,
      progress
    };
  }, [blockingConnectRequirementsCount, connectStatus, isConnectReady, onboardingChecklist]);

  const currentOnboardingStage = useMemo<BillingOnboardingStage>(() => {
    if (!connectStatus || !connectStatus.detailsSubmitted) return "Cadastro";
    if (!connectStatus.chargesEnabled) return "Cobrança";
    if (!connectStatus.payoutsEnabled) return "Repasse";
    return "Concluído";
  }, [connectStatus]);

  useEffect(() => {
    if (activeCatalogItems.length === 0 && chargeSource === "catalog") {
      chargeForm.setValue("chargeSource", "manual", { shouldValidate: true });
      chargeForm.setValue("catalogItemId", "", { shouldValidate: true });
    }
  }, [activeCatalogItems.length, chargeForm, chargeSource]);

  useEffect(() => {
    setCatalogCursorStack([]);
  }, [workspaceId, catalogSearch, catalogKindFilter, catalogBillingFilter]);

  useEffect(() => {
    setHistoryCursorStack([]);
  }, [workspaceId, historySearch, historyStatusFilter]);

  async function handleOpenOnboarding() {
    if (!workspaceId || isOpeningOnboarding) return;
    if (!canManageSensitiveConnectSettings) {
      toast.warning(sensitiveConnectSettingsPermissionMessage);
      return;
    }
    try {
      const response = await createConnectAccountMutation.mutateAsync(undefined);
      if (!response.url) {
        throw new Error("missing_onboarding_url");
      }
      window.location.assign(response.url);
    } catch {
      toast.error("Não foi possível abrir o fluxo de cadastro do Stripe Connect.");
    }
  }

  async function handleRequestPaymentCapability(capability: BillingConnectCapability) {
    if (!workspaceId || requestingCapability) return;
    if (!canManageSensitiveConnectSettings) {
      toast.warning("Apenas o proprietario do workspace pode alterar formas de pagamento do Stripe Connect.");
      return;
    }

    try {
      await requestConnectCapabilityMutation.mutateAsync(capability);
    } catch {
      return;
    }
  }

  function handleCustomerSelect(customerId: string) {
    chargeForm.setValue("customerId", customerId, { shouldDirty: true, shouldValidate: true });
    const customer = customersById.get(customerId);
    chargeForm.setValue("customerDocument", customer?.document ?? "", { shouldDirty: true, shouldValidate: true });
    if (customer?.email) {
      chargeForm.setValue("customerEmail", customer.email, { shouldDirty: true, shouldValidate: true });
    }
  }

  async function handlePrepareCheckout(values: BillingCheckoutFormValues) {
    if (!workspaceId) return;
    if (values.chargeSource === "catalog" && !selectedCatalogItem) return;
    if (values.chargeSource === "manual" && (!amountInCents || !values.description?.trim())) return;
    const trimmedEmail = values.customerEmail.trim() || selectedCustomer?.email?.trim() || "";
    const validation = billingCheckoutFormSchema.safeParse({
      chargeSource: values.chargeSource,
      catalogItemId: selectedCatalogItem?.id,
      amount: values.amount,
      description: values.description,
      customerId: selectedCustomer?.id ?? "",
      customerEmail: trimmedEmail,
      customerDocument: selectedCustomer?.document ?? "",
      sendEmail: values.sendEmail
    });

    if (!validation.success) {
      validation.error.issues.forEach((issue) => {
        const fieldName = issue.path[0];
        if (isCheckoutFormFieldName(fieldName)) {
          chargeForm.setError(fieldName, { type: "manual", message: issue.message });
        }
      });
      toast.error(validation.error.issues[0]?.message ?? "Revise os dados fiscais do cliente antes do checkout.");
      return;
    }

    setReviewStep("preparing");
    try {
      const shouldSendEmail = validation.data.sendEmail && validation.data.customerEmail.length > 0;

      const response = await createCheckoutSessionMutation.mutateAsync({
        amount: values.chargeSource === "manual" ? amountInCents ?? undefined : undefined,
        currency: "brl",
        description: values.chargeSource === "manual" ? values.description?.trim() : undefined,
        catalogItemId: values.chargeSource === "catalog" ? selectedCatalogItem?.id : undefined,
        customerId: validation.data.customerId,
        customerName: getCustomerDisplayName(selectedCustomer) || undefined,
        customerEmail: validation.data.customerEmail,
        sendEmail: shouldSendEmail,
        successUrl: workspaceSlug.length > 0
          ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
          : undefined,
        cancelUrl: workspaceSlug.length > 0
          ? `${window.location.origin}/w/${workspaceSlug}/billing?checkout=cancel`
          : undefined
      });
      setCheckoutUrl(response.url);
      setReviewStep("ready");
      if (shouldSendEmail) {
        toast.success("Link enviado por e-mail.", {
          description: validation.data.customerEmail
        });
      }
    } catch (error) {
      const reason =
        isApiError(error) &&
        error.details &&
        typeof error.details === "object" &&
        "reason" in error.details &&
        typeof error.details.reason === "string"
          ? ` Motivo: ${error.details.reason}`
          : "";
      toast.error("Não foi possível gerar o link de cobrança.", {
        description: `Revise os dados e tente novamente.${reason}`
      });
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

  async function handleCopyCheckoutUrl() {
    if (!checkoutUrl) return;
    const copied = await copyText(checkoutUrl);
    if (!copied) {
      toast.error("Não foi possível copiar o link agora.");
      return;
    }

    toast.success("Link copiado para a área de transferência.");
  }

  function handleCancelReview() {
    setReviewStep("closed");
    setCheckoutUrl(null);
  }

  function resetCatalogItemForm() {
    setCatalogFormInitialValues(createEmptyCatalogFormValues());
  }

  function fillCatalogItemForm(item: ConnectCatalogItem) {
    setCatalogFormInitialValues(catalogItemToFormValues(item));
  }

  function handleOpenCatalogForm() {
    resetCatalogItemForm();
    setEditingCatalogItemId(null);
    setIsCatalogFormOpen(true);
  }

  function handleCloseCatalogForm() {
    setIsCatalogFormOpen(false);
    setEditingCatalogItemId(null);
  }

  function handleEditCatalogItem(item: ConnectCatalogItem) {
    fillCatalogItemForm(item);
    setEditingCatalogItemId(item.id);
    setIsCatalogFormOpen(true);
  }

  async function handleSaveCatalogItem(values: BillingCatalogItemFormValues) {
    if (!workspaceId || isCreatingCatalogItem) return;

    try {
      const parsed = billingCatalogItemFormSchema.safeParse(values);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Revise os campos do item de catalogo.");
        return;
      }

      const payload = toBillingCatalogItemPayload(parsed.data);
      if (editingCatalogItemId) {
        const updated = await updateCatalogItemMutation.mutateAsync({ ...payload, itemId: editingCatalogItemId });
        if (selectedCatalogItemId === updated.id) {
          chargeForm.setValue("amount", (updated.amount / 100).toFixed(2), { shouldValidate: true });
          chargeForm.setValue("description", updated.name, { shouldValidate: true });
        }
      } else {
        const created = await createCatalogItemMutation.mutateAsync(payload);
        chargeForm.setValue("catalogItemId", created.id, { shouldValidate: true });
        chargeForm.setValue("chargeSource", "catalog", { shouldValidate: true });
      }

      resetCatalogItemForm();
      setEditingCatalogItemId(null);
      setIsCatalogFormOpen(false);
    } catch {
      return;
    }
  }

  function handleUseCatalogItem(item: ConnectCatalogItem) {
    chargeForm.setValue("chargeSource", "catalog", { shouldDirty: true, shouldValidate: true });
    chargeForm.setValue("catalogItemId", item.id, { shouldDirty: true, shouldValidate: true });
    chargeForm.setValue("amount", formatCentsToMoneyInput(item.amount), { shouldDirty: true, shouldValidate: true });
    chargeForm.setValue("description", item.name, { shouldDirty: true, shouldValidate: true });
  }

  function handleRequestDeleteCatalogItem(item: ConnectCatalogItem) {
    if (!item.isActive || deletingCatalogItemId) return;
    setCatalogItemPendingDelete(item);
  }

  async function handleDeleteCatalogItem(item: ConnectCatalogItem) {
    if (!workspaceId || deletingCatalogItemId) return;
    try {
      await archiveCatalogItemMutation.mutateAsync(item.id);
      setCatalogItemPendingDelete((current) => (current?.id === item.id ? null : current));
      if (selectedCatalogItemId === item.id) {
        chargeForm.setValue("catalogItemId", "", { shouldValidate: true });
        if (chargeSource === "catalog") {
          chargeForm.setValue("chargeSource", "manual", { shouldValidate: true });
        }
      }
    } catch {
      return;
    }
  }

  async function handleCopyHistoryLink(order: ConnectPaymentOrder) {
    const link = order.customerPortalUrl ?? order.checkoutUrl;
    if (!link) return;
    const copied = await copyText(link);
    if (!copied) {
      toast.error("Não foi possível copiar o link dessa cobrança.");
      return;
    }

    toast.success("Link copiado para a área de transferência.");
  }

  async function handleResendOrder(order: ConnectPaymentOrder) {
    if (!workspaceId || !canResendOrder(order)) return;

    setHistoryActionOrderId(order.id);
    setHistoryActionType("resend");
    try {
      await resendConnectEmailMutation.mutateAsync(order.id);
    } catch {
      return;
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
      await cancelPaymentOrderMutation.mutateAsync(order.id);
    } catch {
      return;
    } finally {
      setHistoryActionOrderId(null);
      setHistoryActionType(null);
    }
  }

  const canReviewCharge =
    canCreateCheckout &&
    Boolean(selectedCustomer) &&
    hasBrazilianFiscalDocument(selectedCustomer?.document) &&
    Boolean((customerEmail.trim() || selectedCustomer?.email?.trim())) &&
    (chargeSource === "catalog"
      ? Boolean(selectedCatalogItem)
      : Boolean(amountInCents && description.trim().length >= 3));

  const catalogPage = catalogCursorStack.length + 1;
  const historyPage = historyCursorStack.length + 1;
  const paginatedPaymentOrders = paymentOrders;

  const metricCards = [
    { label: "Conta Stripe", value: connectState === "ready" && connectStatus ? "Conectada" : "Pendente" },
    { label: "Cobranças", value: paymentOrders.length },
    { label: "Catálogo", value: catalogItems.length },
    { label: "Pendências", value: pendingItems.length }
  ];
  const isBillingFrameLoading =
    (!isClient && (connectState === "loading" || catalogLoadState === "loading")) || paymentOrdersLoadState === "loading";

  const catalogFormProps = {
    mode: editingCatalogItemId ? "edit" as const : "create" as const,
    initialValues: catalogFormInitialValues,
    isCreatingCatalogItem,
    onCancel: handleCloseCatalogForm,
    onSubmit: handleSaveCatalogItem
  };

  return {
    activeTab,
    isClient,
    canCreateCheckout,
    canManageSensitiveConnectSettings,
    catalogItemPendingDelete,
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
      canManageSensitiveConnectSettings,
      requestingCapability,
      onOpenOnboarding: handleOpenOnboarding,
      onRequestPaymentCapability: handleRequestPaymentCapability
    },
    catalogSectionProps: {
      catalogItems,
      catalogLoadState,
      catalogSearch,
      catalogKindFilter,
      catalogBillingFilter,
      catalogPage,
      catalogHasPrevious: catalogCursorStack.length > 0,
      catalogHasNext: Boolean(catalogNextCursor),
      catalogIsFetching: catalogQuery.isFetching,
      isCatalogFormOpen,
      deletingCatalogItemId,
      formProps: catalogFormProps,
      onCatalogSearchChange: setCatalogSearch,
      onCatalogKindFilterChange: setCatalogKindFilter,
      onCatalogBillingFilterChange: setCatalogBillingFilter,
      onCatalogPrevious: () => setCatalogCursorStack((current) => current.slice(0, -1)),
      onCatalogNext: () => {
        if (catalogNextCursor) setCatalogCursorStack((current) => [...current, catalogNextCursor]);
      },
      onOpenCatalogForm: handleOpenCatalogForm,
      onCloseCatalogForm: handleCloseCatalogForm,
      onChargeNow: () => setActiveTab("cobrar"),
      onUseCatalogItem: handleUseCatalogItem,
      onEditCatalogItem: handleEditCatalogItem,
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
      chargeForm,
      checkoutUrl,
      onGoToAccount: () => setActiveTab("conta"),
      onOpenOnboarding: handleOpenOnboarding,
      onChargeSourceChange: (value: ChargeSource) => chargeForm.setValue("chargeSource", value, { shouldDirty: true, shouldValidate: true }),
      onSelectedCatalogItemClear: () => chargeForm.setValue("catalogItemId", "", { shouldDirty: true, shouldValidate: true }),
      onUseCatalogItem: handleUseCatalogItem,
      onCustomerSelect: handleCustomerSelect,
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
      historySearch,
      historyStatusFilter,
      focusedOrderId,
      historyActionOrderId,
      historyActionType,
      historyPage,
      historyHasPrevious: historyCursorStack.length > 0,
      historyHasNext: Boolean(paymentOrdersNextCursor),
      historyIsFetching: paymentOrdersQuery.isFetching,
      onHistorySearchChange: setHistorySearch,
      onHistoryStatusFilterChange: setHistoryStatusFilter,
      onHistoryPrevious: () => setHistoryCursorStack((current) => current.slice(0, -1)),
      onHistoryNext: () => {
        if (paymentOrdersNextCursor) setHistoryCursorStack((current) => [...current, paymentOrdersNextCursor]);
      },
      onCreateFirstCharge: () => setActiveTab("cobrar"),
      onCopyHistoryLink: (order: ConnectPaymentOrder) => void handleCopyHistoryLink(order),
      onResendOrder: (order: ConnectPaymentOrder) => void handleResendOrder(order),
      onCancelOrder: (order: ConnectPaymentOrder) => void handleCancelOrder(order)
    },
    onConfirmDeleteCatalogItem: (item: ConnectCatalogItem) => void handleDeleteCatalogItem(item)
  };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { useParams } from "react-router-dom";
import { buildBoardMetrics } from "@/entities/task";
import {
  fiscalQueryKeys,
  fiscalCompanySchema,
  fiscalReceivedSyncSchema,
  fiscalWizardSchema,
  normalizeFiscalStripePolicy,
  useCancelFiscalDocumentMutation,
  useCreateFiscalCompanyMutation,
  useCreateFiscalDraftMutation,
  useEmitFiscalDraftMutation,
  useFiscalCompaniesQuery,
  useFiscalCustomerDocumentsQuery,
  useFiscalDashboardQuery,
  useFiscalDocumentQuery,
  useFiscalDocumentsQuery,
  useFiscalDraftsQuery,
  useFiscalReceivedDocumentsQuery,
  useFiscalSyncRunsQuery,
  useIssueFiscalDocumentMutation,
  useRetryFiscalDocumentMutation,
  useSyncReceivedDocumentsMutation,
  useUpdateFiscalCompanyMutation,
  useValidateFiscalCompanyMutation
} from "@/modules/fiscal";
import type {
  FiscalCompanyConfig,
  FiscalCompanyFormValues,
  FiscalDocument,
  FiscalDocumentType,
  FiscalEmissionDraft,
  FiscalReceivedDocument,
  FiscalReceivedSyncValues,
  FiscalWizardFormValues,
  FiscalSyncRun
} from "@/modules/fiscal";
import {
  formatCustomerOptionDetail,
  getCustomerDisplayName,
  useWorkspace,
  useWorkspaceCustomersQuery,
  type Customer
} from "@/modules/workspace";
import { formatDateTime as formatDate } from "@/shared/lib/date";
import { formatMoney } from "@/shared/lib/money";
import {
  AppForm,
  AppFormActions,
  AppFormGrid,
  AppSelect,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button,
  DrawerShell,
  EmptyState,
  FormField,
  InlineAlert,
  LoadingState,
  MetricCard,
  ModuleTabs,
  PageToolbar,
  ResourceTable,
  type ResourceTableColumn,
  SectionCard,
  StatusBadge,
  TextInput,
  Textarea,
  WorkspaceActionButton,
  WorkspaceFrame,
  toast
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./fiscal-page.css";

type FiscalTab = "dashboard" | "issued" | "received" | "stripe" | "sync" | "wizard" | "settings" | "portal";

const TAB_ITEMS: Array<{ id: FiscalTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "issued", label: "Emitidas" },
  { id: "received", label: "Recebidas" },
  { id: "stripe", label: "Stripe" },
  { id: "sync", label: "Sincronizacoes" },
  { id: "wizard", label: "Wizard" },
  { id: "settings", label: "Configuracoes" }
];

const TAB_ITEMS_CLIENT: Array<{ id: FiscalTab; label: string }> = [
  { id: "portal", label: "Portal do cliente" }
];

const FISCAL_LIST_PAGE_SIZE = 50;
const FISCAL_SYNC_PAGE_SIZE = 25;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  READY_TO_ISSUE: "Pronta",
  ISSUING: "Emitindo",
  AUTHORIZED: "Autorizada",
  PROCESSING: "Processando",
  PENDING_REVIEW: "Em revisao",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  FAILED: "Falhou",
  RECEIVED: "Recebida",
  MANIFEST_PENDING: "Manifestar",
  MANIFESTED: "Manifestada",
  SYNCED: "Sincronizada",
  READY: "Pronta",
  ISSUED: "Emitida"
};

const REFRESH_ICON = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function mapTone(status: string): "default" | "success" | "warning" {
  if (["AUTHORIZED", "ISSUED", "SYNCED", "MANIFESTED"].includes(status)) {
    return "success";
  }
  if (["REJECTED", "FAILED", "CANCELLED"].includes(status)) {
    return "warning";
  }
  return "default";
}

function canCancelFiscalDocument(document: FiscalDocument) {
  return document.direction === "OUTBOUND" && document.status !== "CANCELLED" && document.issueStatus === "AUTHORIZED";
}

function toNumber(value: string): number {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return "Payload indisponivel";
  }
}

function getCustomerAddressRecord(customer: Customer): Record<string, unknown> | null {
  if (!customer.address) return null;
  const entries = Object.entries(customer.address).filter(([, value]) => typeof value === "string" && value.trim());
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function getCurrentCursor(cursorStack: string[]): string | null {
  return cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : null;
}

function mapCompanyFormToPayload(values: FiscalCompanyFormValues): FiscalCompanyFormValues {
  return {
    ...values,
    emitAutomatically: values.stripePolicy === "automatic_after_payment"
  };
}

function initialWizardState(): FiscalWizardFormValues {
  return {
    documentType: "NFE",
    companyConfigId: "",
    customerId: "",
    customerName: "",
    customerDocument: "",
    itemName: "",
    quantity: "1",
    unitPrice: "0.00",
    discount: "0.00",
    reference: `manual-${Date.now()}`,
    notes: ""
  };
}

function initialSyncState(): FiscalReceivedSyncValues {
  return {
    companyConfigId: "",
    type: "NFE_MDE",
    trigger: "MANUAL"
  };
}

export function FiscalPage() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = snapshot?.id ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const isClient = snapshot?.access?.isClient || snapshot?.access?.role === "CLIENT";
  const isFiscalOwner = snapshot?.access?.role === "OWNER";
  const customerIds = useMemo(() => snapshot?.access?.customerIds ?? [], [snapshot?.access?.customerIds]);
  const availableTabs = useMemo(
    () => (isClient ? TAB_ITEMS_CLIENT : TAB_ITEMS.filter((item) => item.id !== "settings" || isFiscalOwner)),
    [isClient, isFiscalOwner]
  );

  const [tab, setTab] = useState<FiscalTab>("dashboard");

  const [issuedSearch, setIssuedSearch] = useState("");
  const [receivedSearch, setReceivedSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [issuedCursorStack, setIssuedCursorStack] = useState<string[]>([]);
  const [receivedCursorStack, setReceivedCursorStack] = useState<string[]>([]);
  const [draftsCursorStack, setDraftsCursorStack] = useState<string[]>([]);
  const [syncRunsCursorStack, setSyncRunsCursorStack] = useState<string[]>([]);
  const [companiesCursorStack, setCompaniesCursorStack] = useState<string[]>([]);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  const wizardForm = useForm<FiscalWizardFormValues>({
    resolver: zodResolver(fiscalWizardSchema) as Resolver<FiscalWizardFormValues>,
    defaultValues: initialWizardState(),
    mode: "onChange"
  });
  const wizard = wizardForm.watch();
  const companyForm = useForm<FiscalCompanyFormValues>({
    resolver: zodResolver(fiscalCompanySchema) as Resolver<FiscalCompanyFormValues>,
    defaultValues: {
      displayName: "",
      legalName: "",
      cnpj: "",
      focusToken: "",
      focusEnvironment: "homologacao",
      emitAutomatically: false,
      stripePolicy: "manual_review"
    }
  });
  const syncForm = useForm<FiscalReceivedSyncValues>({
    resolver: zodResolver(fiscalReceivedSyncSchema) as Resolver<FiscalReceivedSyncValues>,
    defaultValues: initialSyncState(),
    mode: "onSubmit"
  });
  const syncCompanyConfigId = syncForm.watch("companyConfigId");

  const [detailDocumentId, setDetailDocumentId] = useState<string | null>(null);
  const dashboardQuery = useFiscalDashboardQuery(isClient ? null : workspaceId);
  const issuedCursor = getCurrentCursor(issuedCursorStack);
  const receivedCursor = getCurrentCursor(receivedCursorStack);
  const draftsCursor = getCurrentCursor(draftsCursorStack);
  const syncRunsCursor = getCurrentCursor(syncRunsCursorStack);
  const companiesCursor = getCurrentCursor(companiesCursorStack);
  const issuedDocumentsQuery = useFiscalDocumentsQuery(isClient ? null : workspaceId, {
    direction: "OUTBOUND",
    search: issuedSearch || undefined,
    pageSize: FISCAL_LIST_PAGE_SIZE,
    cursor: issuedCursor
  });
  const clientDocumentsQuery = useFiscalCustomerDocumentsQuery(isClient ? workspaceId : null, customerIds, {
    direction: "OUTBOUND",
    pageSize: FISCAL_LIST_PAGE_SIZE
  });
  const receivedDocumentsQuery = useFiscalReceivedDocumentsQuery(isClient ? null : workspaceId, {
    search: receivedSearch || undefined,
    pageSize: FISCAL_LIST_PAGE_SIZE,
    cursor: receivedCursor
  });
  const draftsQuery = useFiscalDraftsQuery(isClient ? null : workspaceId, {
    pageSize: FISCAL_LIST_PAGE_SIZE,
    cursor: draftsCursor
  });
  const syncRunsQuery = useFiscalSyncRunsQuery(isClient ? null : workspaceId, {
    pageSize: FISCAL_SYNC_PAGE_SIZE,
    cursor: syncRunsCursor
  });
  const customersQuery = useWorkspaceCustomersQuery(workspaceSlug || null, undefined, { enabled: !isClient });
  const companiesQuery = useFiscalCompaniesQuery(!isClient && isFiscalOwner ? workspaceId : null, {
    search: companySearch || undefined,
    pageSize: FISCAL_LIST_PAGE_SIZE,
    cursor: companiesCursor
  });
  const detailQuery = useFiscalDocumentQuery(workspaceId, detailDocumentId);

  const createFiscalCompanyMutation = useCreateFiscalCompanyMutation(workspaceId);
  const updateFiscalCompanyMutation = useUpdateFiscalCompanyMutation(workspaceId);
  const createFiscalDraftMutation = useCreateFiscalDraftMutation(workspaceId);
  const issueFiscalDocumentMutation = useIssueFiscalDocumentMutation(workspaceId);
  const retryFiscalDocumentMutation = useRetryFiscalDocumentMutation(workspaceId);
  const cancelFiscalDocumentMutation = useCancelFiscalDocumentMutation(workspaceId);
  const syncReceivedDocumentsMutation = useSyncReceivedDocumentsMutation(workspaceId);
  const emitFiscalDraftMutation = useEmitFiscalDraftMutation(workspaceId);
  const validateFiscalCompanyMutation = useValidateFiscalCompanyMutation(workspaceId);

  const dashboard = dashboardQuery.data ?? null;
  const documents = isClient
    ? clientDocumentsQuery.data ?? []
    : issuedDocumentsQuery.data?.items ?? [];
  const received = receivedDocumentsQuery.data?.items ?? [];
  const drafts = draftsQuery.data?.items ?? [];
  const syncRuns = syncRunsQuery.data?.items ?? [];
  const customers = customersQuery.data ?? [];
  const companies = isFiscalOwner ? companiesQuery.data?.items ?? [] : [];
  const issuedNextCursor = issuedDocumentsQuery.data?.nextCursor ?? null;
  const receivedNextCursor = receivedDocumentsQuery.data?.nextCursor ?? null;
  const draftsNextCursor = draftsQuery.data?.nextCursor ?? null;
  const syncRunsNextCursor = syncRunsQuery.data?.nextCursor ?? null;
  const companiesNextCursor = companiesQuery.data?.nextCursor ?? null;
  const details = detailQuery.data ?? null;
  const detailLoading = Boolean(detailDocumentId) && (detailQuery.isLoading || detailQuery.isFetching);

  const isLoading = [
    dashboardQuery,
    issuedDocumentsQuery,
    clientDocumentsQuery,
    receivedDocumentsQuery,
    draftsQuery,
    syncRunsQuery,
    customersQuery,
    companiesQuery
  ].some((query) => query.isLoading || query.isFetching);

  const isSubmitting =
    createFiscalCompanyMutation.isPending ||
    updateFiscalCompanyMutation.isPending ||
    createFiscalDraftMutation.isPending ||
    issueFiscalDocumentMutation.isPending ||
    retryFiscalDocumentMutation.isPending ||
    cancelFiscalDocumentMutation.isPending ||
    syncReceivedDocumentsMutation.isPending ||
    emitFiscalDraftMutation.isPending ||
    validateFiscalCompanyMutation.isPending;

  const queryError = [
    dashboardQuery.error,
    issuedDocumentsQuery.error,
    clientDocumentsQuery.error,
    receivedDocumentsQuery.error,
    draftsQuery.error,
    syncRunsQuery.error,
    customersQuery.error,
    companiesQuery.error,
    detailQuery.error
  ].find(Boolean);

  const refreshFiscalData = useCallback(() => {
    if (!workspaceId) return;
    void queryClient.invalidateQueries({ queryKey: fiscalQueryKeys.workspace(workspaceId) });
  }, [queryClient, workspaceId]);

  useEffect(() => {
    if (isClient) setTab("portal");
  }, [isClient]);

  useEffect(() => {
    if (!isClient && !isFiscalOwner && tab === "settings") {
      setTab("dashboard");
    }
  }, [isClient, isFiscalOwner, tab]);

  useEffect(() => {
    if (companies.length === 0) return;
    if (!wizard.companyConfigId) {
      wizardForm.setValue("companyConfigId", companies[0].id, { shouldValidate: true });
    }
    if (!syncCompanyConfigId) {
      syncForm.setValue("companyConfigId", companies[0].id, { shouldValidate: true });
    }
  }, [companies, syncCompanyConfigId, syncForm, wizard.companyConfigId, wizardForm]);

  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const selectedWizardCustomer = wizard.customerId ? customersById.get(wizard.customerId) ?? null : null;

  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch {
        // Mutation hooks own user-facing error toasts.
      }
    },
    []
  );

  function resetCompanyForm() {
    setEditingCompanyId(null);
    companyForm.reset({
      displayName: "",
      legalName: "",
      cnpj: "",
      focusToken: "",
      focusEnvironment: "homologacao",
      emitAutomatically: false,
      stripePolicy: "manual_review"
    });
  }

  function handleIssuedSearchChange(value: string) {
    setIssuedSearch(value);
    setIssuedCursorStack([]);
  }

  function handleReceivedSearchChange(value: string) {
    setReceivedSearch(value);
    setReceivedCursorStack([]);
  }

  function handleCompanySearchChange(value: string) {
    setCompanySearch(value);
    setCompaniesCursorStack([]);
  }

  function handleEditCompany(company: FiscalCompanyConfig) {
    setEditingCompanyId(company.id);
    companyForm.reset({
      displayName: company.displayName,
      legalName: company.legalName,
      cnpj: company.cnpj,
      focusToken: company.focusToken,
      focusEnvironment: company.focusEnvironment === "producao" ? "producao" : "homologacao",
      emitAutomatically: company.emitAutomatically,
      stripePolicy: normalizeFiscalStripePolicy(company.stripePolicy, company.emitAutomatically)
    });
    setTab("settings");
  }

  const submitCompanyForm = companyForm.handleSubmit((values) =>
    runAction(async () => {
      const payload = mapCompanyFormToPayload(values);
      if (editingCompanyId) {
        await updateFiscalCompanyMutation.mutateAsync({ companyId: editingCompanyId, patch: payload });
      } else {
        await createFiscalCompanyMutation.mutateAsync(payload);
      }
      resetCompanyForm();
    })
  );
  const submitSyncReceived = syncForm.handleSubmit((values) =>
    runAction(() => syncReceivedDocumentsMutation.mutateAsync(values))
  );

  const openDetails = async (documentId: string) => {
    if (!workspaceId) return;
    setDetailDocumentId(documentId);
  };

  const handleWizardCustomerChange = (customerId: string) => {
    const customer = customersById.get(customerId);
    wizardForm.setValue("customerId", customerId, { shouldValidate: true });
    wizardForm.setValue("customerName", customer ? getCustomerDisplayName(customer) : "", { shouldValidate: true });
    wizardForm.setValue("customerDocument", customer?.document ?? "", { shouldValidate: true });
  };

  const submitWizard = wizardForm.handleSubmit(async (values) => {
    const customer = selectedWizardCustomer;
    if (!workspaceId || !values.companyConfigId || !customer || !values.itemName.trim()) {
      toast.error("Selecione empresa, cliente cadastrado e item para emitir.");
      return;
    }
    const customerDocument = customer.document;
    if (!customerDocument) {
      toast.error("Complete CPF/CNPJ no cadastro do cliente antes de emitir.");
      return;
    }

    const quantity = toNumber(values.quantity);
    const unitPrice = toNumber(values.unitPrice);
    const discount = toNumber(values.discount);
    const total = Math.max(0, quantity * unitPrice - discount);
    const itemType = values.documentType === "NFSE" ? "SERVICE" : "PRODUCT";
    const origin = values.documentType === "NFSE" ? "MANUAL_SERVICE" : "MANUAL_PRODUCT";

    await runAction(async () => {
      const created = await createFiscalDraftMutation.mutateAsync({
        companyConfigId: values.companyConfigId,
        internalReference: values.reference,
        direction: "OUTBOUND",
        documentType: values.documentType,
        origin,
        sourceSystem: "INTERNAL",
        customerId: customer.id,
        amountSubtotal: total.toFixed(2),
        amountDiscount: discount.toFixed(2),
        amountTotal: total.toFixed(2),
        requestPayloadSnapshot: { notes: values.notes, source: "manual_wizard", customerId: customer.id },
        items: [
          {
            itemType,
            sourceType: "manual",
            name: values.itemName,
            descriptionCommercial: values.itemName,
            descriptionFiscal: values.itemName,
            quantity: quantity.toFixed(4),
            unit: "UN",
            unitPrice: unitPrice.toFixed(2),
            discountAmount: discount.toFixed(2),
            totalAmount: total.toFixed(2)
          }
        ],
        parties: [
          {
            role: values.documentType === "NFSE" ? "TAKER" : "RECIPIENT",
            name: getCustomerDisplayName(customer),
            legalName: customer.legalName || getCustomerDisplayName(customer),
            cnpjCpf: customerDocument,
            stateRegistration: customer.stateRegistration ?? null,
            municipalRegistration: customer.municipalRegistration ?? null,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            address: getCustomerAddressRecord(customer),
            metadata: { source: "customer_registry", customerId: customer.id }
          }
        ]
      });

      await issueFiscalDocumentMutation.mutateAsync(created.id);
      wizardForm.reset(initialWizardState());
      setTab("issued");
    });
  });

  const issuedColumns = useMemo<Array<ResourceTableColumn<FiscalDocument>>>(
    () => [
      { id: "reference", header: "Referencia", width: "1fr", accessor: "internalReference" },
      { id: "type", header: "Tipo", width: "0.7fr", accessor: "documentType" },
      {
        id: "status",
        header: "Status",
        width: "0.9fr",
        render: (document) => (
          <StatusBadge tone={mapTone(document.status)}>{STATUS_LABELS[document.status] ?? document.status}</StatusBadge>
        )
      },
      {
        id: "amount",
        header: "Valor",
        width: "0.9fr",
        render: (document) => formatMoney(document.amountTotal)
      },
      {
        id: "created",
        header: "Criado",
        width: "1fr",
        render: (document) => formatDate(document.createdAt)
      }
    ],
    []
  );

  const receivedColumns = useMemo<Array<ResourceTableColumn<FiscalReceivedDocument>>>(
    () => [
      { id: "type", header: "Tipo", width: "0.8fr", accessor: "type" },
      {
        id: "issuer",
        header: "Fornecedor",
        width: "1fr",
        render: (item) => item.issuerName ?? "-"
      },
      {
        id: "status",
        header: "Status",
        width: "0.8fr",
        render: (item) => (
          <StatusBadge tone={mapTone(item.status)}>{STATUS_LABELS[item.status] ?? item.status}</StatusBadge>
        )
      },
      {
        id: "amount",
        header: "Valor",
        width: "0.8fr",
        render: (item) => formatMoney(item.amountTotal)
      },
      {
        id: "issued",
        header: "Emissao",
        width: "1fr",
        render: (item) => formatDate(item.issuedAt)
      },
      {
        id: "files",
        header: "Arquivos",
        width: "0.8fr",
        render: (item) => (
          <div className="fiscal-page__row-actions">
            {item.xmlUrl ? <a href={item.xmlUrl} target="_blank" rel="noreferrer">XML</a> : <span>-</span>}
            {item.pdfUrl ? <a href={item.pdfUrl} target="_blank" rel="noreferrer">PDF</a> : <span>-</span>}
          </div>
        )
      }
    ],
    []
  );

  const stripeDraftColumns = useMemo<Array<ResourceTableColumn<FiscalEmissionDraft>>>(
    () => [
      {
        id: "session",
        header: "Session Stripe",
        width: "1fr",
        render: (draft) => draft.stripeSessionId ?? "-"
      },
      { id: "type", header: "Tipo", width: "0.8fr", accessor: "documentType" },
      {
        id: "status",
        header: "Status",
        width: "0.8fr",
        render: (draft) => (
          <StatusBadge tone={mapTone(draft.status)}>{STATUS_LABELS[draft.status] ?? draft.status}</StatusBadge>
        )
      },
      {
        id: "created",
        header: "Criado",
        width: "1fr",
        render: (draft) => formatDate(draft.createdAt)
      }
    ],
    []
  );

  const syncRunColumns = useMemo<Array<ResourceTableColumn<FiscalSyncRun>>>(
    () => [
      { id: "type", header: "Tipo", width: "1fr", accessor: "syncType" },
      { id: "trigger", header: "Origem", width: "0.9fr", accessor: "trigger" },
      {
        id: "status",
        header: "Status",
        width: "0.8fr",
        render: (run) => (
          <StatusBadge tone={mapTone(run.status)}>{STATUS_LABELS[run.status] ?? run.status}</StatusBadge>
        )
      },
      {
        id: "counts",
        header: "Processadas",
        width: "1fr",
        render: (run) => `${run.processedCount} / ${run.createdCount + run.updatedCount} salvas`
      },
      {
        id: "started",
        header: "Inicio",
        width: "1fr",
        render: (run) => formatDate(run.startedAt)
      },
      {
        id: "finished",
        header: "Fim",
        width: "1fr",
        render: (run) => (run.finishedAt ? formatDate(run.finishedAt) : "-")
      }
    ],
    []
  );

  const companyColumns = useMemo<Array<ResourceTableColumn<FiscalCompanyConfig>>>(
    () => [
      { id: "company", header: "Empresa", width: "1fr", accessor: "displayName" },
      { id: "cnpj", header: "CNPJ", width: "0.9fr", accessor: "cnpj" },
      { id: "environment", header: "Ambiente", width: "0.9fr", accessor: "focusEnvironment" }
    ],
    []
  );

  const portalStats = useMemo(() => {
    const authorized = documents.filter((d) => ["AUTHORIZED", "ISSUED"].includes(d.status)).length;
    const pending = documents.filter((d) =>
      ["PROCESSING", "ISSUING", "READY_TO_ISSUE", "READY", "DRAFT"].includes(d.status)
    ).length;
    const total = documents
      .filter((d) => ["AUTHORIZED", "ISSUED"].includes(d.status))
      .reduce((sum, d) => sum + (Number(d.amountTotal) || 0), 0);
    return { authorized, pending, total };
  }, [documents]);

  const portalColumns = useMemo<Array<ResourceTableColumn<FiscalDocument>>>(
    () => [
      { id: "type", header: "Tipo", width: "0.7fr", accessor: "documentType" },
      {
        id: "status",
        header: "Status",
        width: "0.95fr",
        render: (document) => (
          <StatusBadge tone={mapTone(document.status)}>{STATUS_LABELS[document.status] ?? document.status}</StatusBadge>
        )
      },
      {
        id: "amount",
        header: "Valor",
        width: "0.9fr",
        render: (document) => formatMoney(document.amountTotal)
      },
      {
        id: "number",
        header: "Numero",
        width: "0.8fr",
        render: (document) => document.number ?? "-"
      },
      {
        id: "issued",
        header: "Emissao",
        width: "1fr",
        render: (document) => formatDate(document.issuedAt ?? document.createdAt)
      }
    ],
    []
  );

  const topNavigation = (
    <section className="fiscal-top-nav" aria-label="Navegacao fiscal">
      <ModuleTabs<FiscalTab>
        value={tab}
        items={availableTabs}
        onChange={setTab}
        className="fiscal-view__tabs"
        variant="underline"
      />
      {!isClient ? (
        <PageToolbar
          className="fiscal-top-nav__actions"
          compact
          ariaLabel="Acoes fiscais"
          end={
            <>
              <WorkspaceActionButton
                className="fiscal-top-nav__btn"
                label="Atualizar fiscal"
                icon={REFRESH_ICON}
                onClick={refreshFiscalData}
                disabled={isLoading || isSubmitting}
              />
              <WorkspaceActionButton
                className="fiscal-top-nav__btn"
                tone="accent"
                label="Nova emissao"
                icon="+"
                onClick={() => setTab("wizard")}
                disabled={isSubmitting || (!isFiscalOwner && companies.length === 0)}
              />
            </>
          }
        />
      ) : null}
    </section>
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="fiscal-view" variant="table" scroll="none">
        <LoadingState
          text="Carregando painel fiscal..."
          animation="fiscal"
          variant="frame"
          visible={isLoading && !dashboard}
        />

        {queryError ? (
          <InlineAlert tone="danger">
            {queryError instanceof Error ? queryError.message : "Falha ao carregar modulo fiscal."}
          </InlineAlert>
        ) : null}

        <div className="fiscal-view__content">
          <div className="fiscal-view__stack">
            {tab === "portal" ? (
              <div className="fiscal-view__portal">
                <div className="fiscal-view__portal-head">
                  <div className="fiscal-view__portal-head-text">
                    <h2 className="fiscal-view__portal-title">Documentos fiscais</h2>
                    <p className="fiscal-view__portal-subtitle">
                      Notas emitidas em seu nome vinculadas a contratos e cobranças realizadas.
                    </p>
                  </div>
                  <StatusBadge>{documents.length} {documents.length === 1 ? "nota" : "notas"}</StatusBadge>
                </div>

                {documents.length > 0 ? (
                  <div className="fiscal-view__summary-grid fiscal-view__portal-stats">
                    <MetricCard label="Autorizadas" value={portalStats.authorized} subtitle="Notas confirmadas pelo orgao emissor." accent="success" compact />
                    <MetricCard label="Em processo" value={portalStats.pending} subtitle="Notas em tramitacao ou aguardando autorizacao." accent="warning" compact />
                    <MetricCard label="Total faturado" value={formatMoney(portalStats.total > 0 ? portalStats.total : 0)} subtitle="Soma das notas autorizadas emitidas para voce." accent="info" compact />
                  </div>
                ) : null}

                {documents.length === 0 && !clientDocumentsQuery.isLoading && !clientDocumentsQuery.isError ? (
                  <EmptyState
                    title="Nenhum documento fiscal emitido para o seu cadastro ainda."
                    description="Os documentos aparecerao aqui assim que forem emitidos."
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    }
                  />
                ) : null}

                {documents.length > 0 || clientDocumentsQuery.isLoading || clientDocumentsQuery.isError ? (
                  <ResourceTable
                    className="fiscal-view__table"
                    data={documents}
                    rowKey="id"
                    columns={portalColumns}
                    responsiveMinWidth="100%"
                    responsiveMinWidthMobile="100%"
                    loading={clientDocumentsQuery.isLoading}
                    loadingState="Carregando documentos fiscais..."
                    error={clientDocumentsQuery.isError ? clientDocumentsQuery.error : undefined}
                    emptyState={
                      <EmptyState
                        variant="table"
                        title="Nenhum documento fiscal encontrado."
                        description="Quando uma nota for emitida para este cadastro, ela aparecera nesta lista."
                      />
                    }
                    actions={{
                      header: "Arquivos",
                      width: "1fr",
                      render: (document) => (
                        <div className="fiscal-page__row-actions">
                          {document.pdfUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(document.pdfUrl ?? "", "_blank", "noopener,noreferrer")}
                            >
                              PDF
                            </Button>
                          ) : null}
                          {document.xmlUrl ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(document.xmlUrl ?? "", "_blank", "noopener,noreferrer")}
                            >
                              XML
                            </Button>
                          ) : null}
                          {!document.pdfUrl && !document.xmlUrl ? <span className="fiscal-view__portal-no-file">Aguardando</span> : null}
                        </div>
                      )
                    }}
                    mobileCard={{
                      render: (document) => (
                        <>
                          <strong>{document.documentType}</strong>
                          <StatusBadge tone={mapTone(document.status)}>{STATUS_LABELS[document.status] ?? document.status}</StatusBadge>
                          <span>{formatMoney(document.amountTotal)}</span>
                          <span>{formatDate(document.issuedAt ?? document.createdAt)}</span>
                          <div className="fiscal-page__row-actions">
                            {document.pdfUrl ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(document.pdfUrl ?? "", "_blank", "noopener,noreferrer")}
                              >
                                PDF
                              </Button>
                            ) : null}
                            {document.xmlUrl ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(document.xmlUrl ?? "", "_blank", "noopener,noreferrer")}
                              >
                                XML
                              </Button>
                            ) : null}
                            {!document.pdfUrl && !document.xmlUrl ? <span className="fiscal-view__portal-no-file">Aguardando</span> : null}
                          </div>
                        </>
                      )
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {tab === "dashboard" ? (
              dashboard ? (
                <div className="fiscal-view__summary-grid">
                  <MetricCard label="Em revisao" value={dashboard?.counters.pendingReview ?? 0} subtitle="Notas que exigem conferencia ou ajuste manual." accent="warning" />
                  <MetricCard label="Fila Stripe" value={drafts.length} subtitle="Drafts aguardando emissao a partir de eventos financeiros." accent="info" />
                  <MetricCard label="Empresas ativas" value={companies.length} subtitle="Configuracoes fiscais disponiveis para emissao e sincronizacao." accent="success" />
                </div>
              ) : null
            ) : null}

            {tab === "issued" ? (
              <>
                <FormField label="Buscar documentos" className="fiscal-view__field">
                  <TextInput value={issuedSearch} onChange={(event) => handleIssuedSearchChange(event.target.value)} placeholder="Referencia, venda, Focus..." />
                </FormField>
                <ResourceTable
                  className="fiscal-view__table"
                  data={documents}
                  columns={issuedColumns}
                  rowKey="id"
                  responsiveMinWidth="960px"
                  loading={issuedDocumentsQuery.isLoading}
                  loadingState="Carregando documentos emitidos..."
                  error={issuedDocumentsQuery.isError ? issuedDocumentsQuery.error : undefined}
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhum documento emitido."
                      description="Use o wizard para emitir uma nota manual ou sincronize eventos financeiros."
                    />
                  }
                  actions={{
                    header: "Acoes",
                    width: "1.2fr",
                    render: (document) => (
                      <div className="fiscal-page__row-actions">
                        <Button size="sm" variant="outline" onClick={() => void openDetails(document.id)}>Detalhe</Button>
                        <Button size="sm" onClick={() => void runAction(() => issueFiscalDocumentMutation.mutateAsync(document.id))} disabled={isSubmitting}>Emitir</Button>
                        <Button size="sm" variant="outline" onClick={() => void runAction(() => retryFiscalDocumentMutation.mutateAsync(document.id))} disabled={isSubmitting}>Retry</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void runAction(() => cancelFiscalDocumentMutation.mutateAsync({
                            documentId: document.id,
                            justification: "Cancelamento solicitado pelo painel fiscal."
                          }))}
                          disabled={isSubmitting || !canCancelFiscalDocument(document)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )
                  }}
                  pagination={
                    issuedCursorStack.length > 0 || issuedNextCursor
                      ? {
                          page: issuedCursorStack.length + 1,
                          pageSize: FISCAL_LIST_PAGE_SIZE,
                          hasPrevious: issuedCursorStack.length > 0,
                          hasNext: Boolean(issuedNextCursor),
                          isLoading: issuedDocumentsQuery.isFetching,
                          label: "Paginacao de documentos emitidos",
                          onPrevious: () => setIssuedCursorStack((current) => current.slice(0, -1)),
                          onNext: () => {
                            if (issuedNextCursor) setIssuedCursorStack((current) => [...current, issuedNextCursor]);
                          }
                        }
                      : undefined
                  }
                  mobileCard={{
                    render: (document) => (
                      <>
                        <strong>{document.internalReference}</strong>
                        <StatusBadge tone={mapTone(document.status)}>{STATUS_LABELS[document.status] ?? document.status}</StatusBadge>
                        <span>{formatMoney(document.amountTotal)}</span>
                        <span>{formatDate(document.createdAt)}</span>
                        <div className="fiscal-page__row-actions">
                          <Button size="sm" variant="outline" onClick={() => void openDetails(document.id)}>Detalhe</Button>
                          <Button size="sm" onClick={() => void runAction(() => issueFiscalDocumentMutation.mutateAsync(document.id))} disabled={isSubmitting}>Emitir</Button>
                          <Button size="sm" variant="outline" onClick={() => void runAction(() => retryFiscalDocumentMutation.mutateAsync(document.id))} disabled={isSubmitting}>Retry</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runAction(() => cancelFiscalDocumentMutation.mutateAsync({
                              documentId: document.id,
                              justification: "Cancelamento solicitado pelo painel fiscal."
                            }))}
                            disabled={isSubmitting || !canCancelFiscalDocument(document)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </>
                    )
                  }}
                />
              </>
            ) : null}

            {tab === "received" ? (
              <>
                <FormField label="Buscar recebidas" className="fiscal-view__field">
                  <TextInput value={receivedSearch} onChange={(event) => handleReceivedSearchChange(event.target.value)} placeholder="Fornecedor, chave..." />
                </FormField>
                <AppForm
                  form={syncForm}
                  className="fiscal-view__settings-form"
                  onRawSubmit={(event) => {
                    event.preventDefault();
                    void submitSyncReceived();
                  }}
                >
                  <AppFormGrid className="fiscal-view__inline-grid" columns={2}>
                    <AppSelectField<FiscalReceivedSyncValues, "type", FiscalReceivedSyncValues["type"]>
                      name="type"
                      label="Tipo sync"
                      className="fiscal-view__field"
                      options={[
                        { value: "NFE_MDE", label: "NFe (MD-e)" },
                        { value: "NFSE_NFSER", label: "NFSe (NFSeR)" }
                      ]}
                    />
                    <AppSelectField
                      name="companyConfigId"
                      label="Empresa"
                      className="fiscal-view__field"
                      options={[
                        { value: "__none", label: "Selecione uma empresa" },
                        ...companies.map((company) => ({ value: company.id, label: company.displayName }))
                      ]}
                      formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : "__none")}
                      parseValue={(value) => (value === "__none" ? "" : value)}
                    />
                  </AppFormGrid>
                  <Button type="submit" variant="outline" disabled={isSubmitting || !syncCompanyConfigId}>
                    Sincronizar recebidas
                  </Button>
                </AppForm>
                <ResourceTable
                  className="fiscal-view__table"
                  data={received}
                  columns={receivedColumns}
                  rowKey="id"
                  responsiveMinWidth="920px"
                  loading={receivedDocumentsQuery.isLoading}
                  loadingState="Carregando notas recebidas..."
                  error={receivedDocumentsQuery.isError ? receivedDocumentsQuery.error : undefined}
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhuma nota recebida."
                      description="Sincronize documentos recebidos por empresa para acompanhar entradas fiscais."
                    />
                  }
                  pagination={
                    receivedCursorStack.length > 0 || receivedNextCursor
                      ? {
                          page: receivedCursorStack.length + 1,
                          pageSize: FISCAL_LIST_PAGE_SIZE,
                          hasPrevious: receivedCursorStack.length > 0,
                          hasNext: Boolean(receivedNextCursor),
                          isLoading: receivedDocumentsQuery.isFetching,
                          label: "Paginacao de documentos recebidos",
                          onPrevious: () => setReceivedCursorStack((current) => current.slice(0, -1)),
                          onNext: () => {
                            if (receivedNextCursor) setReceivedCursorStack((current) => [...current, receivedNextCursor]);
                          }
                        }
                      : undefined
                  }
                  mobileCard={{
                    render: (item) => (
                      <>
                        <strong>{item.issuerName ?? "-"}</strong>
                        <StatusBadge tone={mapTone(item.status)}>{STATUS_LABELS[item.status] ?? item.status}</StatusBadge>
                        <span>{formatMoney(item.amountTotal)}</span>
                        <span>{formatDate(item.issuedAt)}</span>
                        <div className="fiscal-page__row-actions">
                          {item.xmlUrl ? <a href={item.xmlUrl} target="_blank" rel="noreferrer">XML</a> : <span>-</span>}
                          {item.pdfUrl ? <a href={item.pdfUrl} target="_blank" rel="noreferrer">PDF</a> : <span>-</span>}
                        </div>
                      </>
                    )
                  }}
                />
              </>
            ) : null}

            {tab === "stripe" ? (
              <>
                <ResourceTable
                  className="fiscal-view__table"
                  data={drafts}
                  columns={stripeDraftColumns}
                  rowKey="id"
                  responsiveMinWidth="900px"
                  loading={draftsQuery.isLoading}
                  loadingState="Carregando drafts Stripe..."
                  error={draftsQuery.isError ? draftsQuery.error : undefined}
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhum draft Stripe pendente."
                      description="Novos drafts serao criados a partir de eventos financeiros elegiveis."
                    />
                  }
                  actions={{
                    header: "Acoes",
                    width: "0.8fr",
                    render: (draft) => (
                      <Button size="sm" onClick={() => void runAction(() => emitFiscalDraftMutation.mutateAsync(draft.id))} disabled={isSubmitting}>
                        Emitir
                      </Button>
                    )
                  }}
                  pagination={
                    draftsCursorStack.length > 0 || draftsNextCursor
                      ? {
                          page: draftsCursorStack.length + 1,
                          pageSize: FISCAL_LIST_PAGE_SIZE,
                          hasPrevious: draftsCursorStack.length > 0,
                          hasNext: Boolean(draftsNextCursor),
                          isLoading: draftsQuery.isFetching,
                          label: "Paginacao de drafts fiscais",
                          onPrevious: () => setDraftsCursorStack((current) => current.slice(0, -1)),
                          onNext: () => {
                            if (draftsNextCursor) setDraftsCursorStack((current) => [...current, draftsNextCursor]);
                          }
                        }
                      : undefined
                  }
                  mobileCard={{
                    render: (draft) => (
                      <>
                        <strong>{draft.stripeSessionId ?? "-"}</strong>
                        <StatusBadge tone={mapTone(draft.status)}>{STATUS_LABELS[draft.status] ?? draft.status}</StatusBadge>
                        <span>{draft.documentType}</span>
                        <Button size="sm" onClick={() => void runAction(() => emitFiscalDraftMutation.mutateAsync(draft.id))} disabled={isSubmitting}>
                          Emitir
                        </Button>
                      </>
                    )
                  }}
                />
              </>
            ) : null}

            {tab === "sync" ? (
              <>
                <ResourceTable
                  className="fiscal-view__table"
                  data={syncRuns}
                  columns={syncRunColumns}
                  rowKey="id"
                  responsiveMinWidth="920px"
                  loading={syncRunsQuery.isLoading}
                  loadingState="Carregando sincronizacoes..."
                  error={syncRunsQuery.isError ? syncRunsQuery.error : undefined}
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhuma sincronizacao fiscal registrada."
                      description="As execucoes de sincronizacao de notas recebidas aparecerao aqui."
                    />
                  }
                  pagination={
                    syncRunsCursorStack.length > 0 || syncRunsNextCursor
                      ? {
                          page: syncRunsCursorStack.length + 1,
                          pageSize: FISCAL_SYNC_PAGE_SIZE,
                          hasPrevious: syncRunsCursorStack.length > 0,
                          hasNext: Boolean(syncRunsNextCursor),
                          isLoading: syncRunsQuery.isFetching,
                          label: "Paginacao de sincronizacoes fiscais",
                          onPrevious: () => setSyncRunsCursorStack((current) => current.slice(0, -1)),
                          onNext: () => {
                            if (syncRunsNextCursor) setSyncRunsCursorStack((current) => [...current, syncRunsNextCursor]);
                          }
                        }
                      : undefined
                  }
                  mobileCard={{
                    render: (run) => (
                      <>
                        <strong>{run.syncType}</strong>
                        <StatusBadge tone={mapTone(run.status)}>{STATUS_LABELS[run.status] ?? run.status}</StatusBadge>
                        <span>{`${run.processedCount} / ${run.createdCount + run.updatedCount} salvas`}</span>
                        <span>{formatDate(run.startedAt)}</span>
                      </>
                    )
                  }}
                />
              </>
            ) : null}

            {tab === "wizard" ? (
              <>
                <SectionCard className="fiscal-view__form-card" title="Dados da emissao" subtitle="Configure empresa, cliente e item antes de emitir." density="compact">
                <AppForm
                  form={wizardForm}
                  className="fiscal-view__settings-form"
                  onRawSubmit={(event) => {
                    event.preventDefault();
                    void submitWizard();
                  }}
                >
                  <AppFormGrid className="fiscal-view__inline-grid" columns={3}>
                    <AppSelectField<FiscalWizardFormValues, "documentType", FiscalDocumentType>
                      name="documentType"
                      label="Tipo"
                      className="fiscal-view__field"
                      options={[
                        { value: "NFE", label: "NF-e" },
                        { value: "NFSE", label: "NFS-e" }
                      ]}
                    />
                    <AppSelectField
                      name="companyConfigId"
                      label="Empresa"
                      className="fiscal-view__field"
                      options={[
                        { value: "__none", label: "Selecione uma empresa" },
                        ...companies.map((company) => ({ value: company.id, label: company.displayName }))
                      ]}
                      formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : "__none")}
                      parseValue={(value) => (value === "__none" ? "" : value)}
                    />
                    <AppTextField name="reference" label="Referencia" className="fiscal-view__field" />
                  </AppFormGrid>

                  <AppFormGrid className="fiscal-view__inline-grid" columns={3}>
                    <AppSelectField
                      name="customerId"
                      label="Cliente cadastrado"
                      className="fiscal-view__field"
                      options={[
                        { value: "__none", label: "Selecione um cliente" },
                        ...customers.map((customer) => {
                          const detail = formatCustomerOptionDetail(customer);
                          return {
                            value: customer.id,
                            label: `${getCustomerDisplayName(customer)}${detail ? ` - ${detail}` : ""}`
                          };
                        })
                      ]}
                      formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : "__none")}
                      parseValue={(value) => (value === "__none" ? "" : value)}
                      onValueChange={(_, formValue) => handleWizardCustomerChange(typeof formValue === "string" ? formValue : "")}
                    />
                    <AppTextField name="customerName" label="Nome fiscal" className="fiscal-view__field" readOnly />
                    <AppTextField name="customerDocument" label="Documento" className="fiscal-view__field" readOnly />
                  </AppFormGrid>

                  {selectedWizardCustomer && !selectedWizardCustomer.document ? (
                    <InlineAlert tone="danger">
                      Complete CPF/CNPJ no cadastro do cliente antes de emitir.
                    </InlineAlert>
                  ) : null}

                  <AppFormGrid className="fiscal-view__inline-grid" columns={1}>
                    <AppTextField name="itemName" label="Item" className="fiscal-view__field" />
                  </AppFormGrid>

                  <AppFormGrid className="fiscal-view__inline-grid" columns={3}>
                    <AppTextField name="quantity" label="Qtd" className="fiscal-view__field" inputMode="decimal" />
                    <AppTextField name="unitPrice" label="Unitario" className="fiscal-view__field" inputMode="decimal" />
                    <AppTextField name="discount" label="Desconto" className="fiscal-view__field" inputMode="decimal" />
                  </AppFormGrid>

                  <AppTextareaField name="notes" label="Observacoes" className="fiscal-view__field" rows={3} />

                  <AppFormActions align="start">
                    <Button type="submit" disabled={isSubmitting || !wizardForm.formState.isValid}>
                      Emitir documento
                    </Button>
                  </AppFormActions>
                </AppForm>
                </SectionCard>
              </>
            ) : null}

            {tab === "settings" ? (
              <>
                <SectionCard className="fiscal-view__form-card" title="Empresa fiscal" subtitle="Cadastre as credenciais fiscais usadas na emissao." density="compact">
                <AppForm
                  form={companyForm}
                  className="fiscal-view__settings-form"
                  onRawSubmit={(event) => {
                    event.preventDefault();
                    void submitCompanyForm();
                  }}
                >
                  <AppFormGrid className="fiscal-view__inline-grid" columns={3}>
                    <AppTextField name="displayName" label="Nome exibicao" className="fiscal-view__field" />
                    <AppTextField name="legalName" label="Razao social" className="fiscal-view__field" />
                    <AppTextField name="cnpj" label="CNPJ" className="fiscal-view__field" inputMode="numeric" />
                  </AppFormGrid>
                  <AppFormGrid className="fiscal-view__inline-grid" columns={2}>
                    <AppSelectField<FiscalCompanyFormValues, "focusEnvironment", FiscalCompanyFormValues["focusEnvironment"]>
                      name="focusEnvironment"
                      label="Ambiente Focus"
                      className="fiscal-view__field"
                      options={[
                        { value: "homologacao", label: "Homologacao" },
                        { value: "producao", label: "Producao" }
                      ]}
                    />
                    <AppSelectField<FiscalCompanyFormValues, "stripePolicy", FiscalCompanyFormValues["stripePolicy"]>
                      name="stripePolicy"
                      label="Politica Stripe"
                      className="fiscal-view__field"
                      options={[
                        { value: "manual_review", label: "Revisao manual" },
                        { value: "automatic_after_payment", label: "Automatica apos pagamento" }
                      ]}
                    />
                  </AppFormGrid>
                  <AppTextField name="focusToken" label="Token Focus" className="fiscal-view__field" />
                  <AppFormActions className="fiscal-view__row-actions">
                    {editingCompanyId ? (
                      <Button type="button" variant="outline" onClick={resetCompanyForm} disabled={isSubmitting || companyForm.formState.isSubmitting}>
                        Cancelar edicao
                      </Button>
                    ) : null}
                    <Button type="submit" disabled={isSubmitting || companyForm.formState.isSubmitting}>
                      {editingCompanyId ? "Salvar empresa" : "Cadastrar empresa"}
                    </Button>
                  </AppFormActions>
                </AppForm>
                <FormField label="Buscar empresas" className="fiscal-view__field">
                  <TextInput value={companySearch} onChange={(event) => handleCompanySearchChange(event.target.value)} placeholder="Nome, razao social ou CNPJ" />
                </FormField>
                <ResourceTable
                  className="fiscal-view__table"
                  data={companies}
                  columns={companyColumns}
                  rowKey="id"
                  responsiveMinWidth="880px"
                  loading={companiesQuery.isLoading}
                  loadingState="Carregando empresas fiscais..."
                  error={companiesQuery.isError ? companiesQuery.error : undefined}
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhuma empresa fiscal cadastrada."
                      description="Cadastre uma empresa para habilitar emissao e sincronizacao fiscal."
                    />
                  }
                  actions={{
                    header: "Acoes",
                    width: "1fr",
                    render: (company) => (
                      <div className="fiscal-page__row-actions">
                        <Button size="sm" variant="outline" onClick={() => handleEditCompany(company)} disabled={isSubmitting}>
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void runAction(() => validateFiscalCompanyMutation.mutateAsync(company.id))} disabled={isSubmitting}>
                          Validar
                        </Button>
                      </div>
                    )
                  }}
                  pagination={
                    companiesCursorStack.length > 0 || companiesNextCursor
                      ? {
                          page: companiesCursorStack.length + 1,
                          pageSize: FISCAL_LIST_PAGE_SIZE,
                          hasPrevious: companiesCursorStack.length > 0,
                          hasNext: Boolean(companiesNextCursor),
                          isLoading: companiesQuery.isFetching,
                          label: "Paginacao de empresas fiscais",
                          onPrevious: () => setCompaniesCursorStack((current) => current.slice(0, -1)),
                          onNext: () => {
                            if (companiesNextCursor) setCompaniesCursorStack((current) => [...current, companiesNextCursor]);
                          }
                        }
                      : undefined
                  }
                  mobileCard={{
                    render: (company) => (
                      <>
                        <strong>{company.displayName}</strong>
                        <span>{company.cnpj}</span>
                        <span>{company.focusEnvironment}</span>
                        <div className="fiscal-page__row-actions">
                          <Button size="sm" variant="outline" onClick={() => handleEditCompany(company)} disabled={isSubmitting}>
                            Editar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void runAction(() => validateFiscalCompanyMutation.mutateAsync(company.id))} disabled={isSubmitting}>
                            Validar
                          </Button>
                        </div>
                      </>
                    )
                  }}
                />
                </SectionCard>
              </>
            ) : null}

            {tab !== "dashboard" && !workspaceId ? (
              <EmptyState>Selecione um workspace para acessar o modulo fiscal.</EmptyState>
            ) : null}
          </div>
        </div>
      </WorkspaceFrame>

      {detailDocumentId ? (
        <DrawerShell
          titleId="fiscal-document-details"
          title="Detalhe da nota"
          shellClassName="fiscal-view__modal"
          bodyClassName="fiscal-view__modal-content"
          onClose={() => {
            setDetailDocumentId(null);
          }}
        >
          {detailLoading || !details ? (
            <LoadingState text="Carregando detalhes" animation="fiscal" />
          ) : (
            <>
              <p><strong>Referencia:</strong> {details.document.internalReference}</p>
              <p><strong>Status:</strong> {STATUS_LABELS[details.document.status] ?? details.document.status}</p>
              <p><strong>Focus:</strong> {details.document.focusStatus ?? "-"}</p>
              <p><strong>Valor:</strong> {formatMoney(details.document.amountTotal)}</p>

              <h3>Payload enviado</h3>
              <Textarea value={safeJson(details.document.requestPayloadSnapshot)} rows={7} readOnly />

              <h3>Payload retornado</h3>
              <Textarea value={safeJson(details.document.responsePayloadSnapshot)} rows={7} readOnly />
            </>
          )}
        </DrawerShell>
      ) : null}
    </AppShell>
  );
}

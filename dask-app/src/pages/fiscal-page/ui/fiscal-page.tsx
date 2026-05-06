import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { fiscalService } from "@/modules/fiscal";
import type {
  FiscalCompanyConfig,
  FiscalDashboardResponse,
  FiscalDocument,
  FiscalDocumentDetails,
  FiscalDocumentType,
  FiscalEmissionDraft,
  FiscalReceivedDocument,
  FiscalReceivedType
} from "@/modules/fiscal";
import { formatCustomerOptionDetail, getCustomerDisplayName, useWorkspace, type Customer } from "@/modules/workspace";
import { formatDateTime as formatDate } from "@/shared/lib/date";
import { formatMoney } from "@/shared/lib/money";
import {
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
  SectionCard,
  Select,
  StatusBadge,
  TextInput,
  Textarea,
  WorkspaceActionButton,
  WorkspaceFrame,
  type ResourceTableColumn
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./fiscal-page.css";

type FiscalTab = "dashboard" | "issued" | "received" | "stripe" | "wizard" | "settings" | "portal";

interface WizardState {
  documentType: FiscalDocumentType;
  companyConfigId: string;
  customerId: string;
  customerName: string;
  customerDocument: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  reference: string;
  notes: string;
}

const TAB_ITEMS: Array<{ id: FiscalTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "issued", label: "Emitidas" },
  { id: "received", label: "Recebidas" },
  { id: "stripe", label: "Stripe" },
  { id: "wizard", label: "Wizard" },
  { id: "settings", label: "Configuracoes" }
];

const TAB_ITEMS_CLIENT: Array<{ id: FiscalTab; label: string }> = [
  { id: "portal", label: "Portal do cliente" }
];

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

function initialWizardState(): WizardState {
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

export function FiscalPage() {
  const { snapshot, listCustomers } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const isClient = snapshot?.access?.isClient || snapshot?.access?.role === "CLIENT";
  const customerIds = useMemo(() => snapshot?.access?.customerIds ?? [], [snapshot?.access?.customerIds]);

  const [tab, setTab] = useState<FiscalTab>("dashboard");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [dashboard, setDashboard] = useState<FiscalDashboardResponse | null>(null);
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [received, setReceived] = useState<FiscalReceivedDocument[]>([]);
  const [drafts, setDrafts] = useState<FiscalEmissionDraft[]>([]);
  const [companies, setCompanies] = useState<FiscalCompanyConfig[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [issuedSearch, setIssuedSearch] = useState("");
  const [receivedSearch, setReceivedSearch] = useState("");
  const [syncType, setSyncType] = useState<FiscalReceivedType>("NFE_MDE");
  const [syncCompanyConfigId, setSyncCompanyConfigId] = useState("");

  const [wizard, setWizard] = useState<WizardState>(() => initialWizardState());
  const [companyForm, setCompanyForm] = useState({
    displayName: "",
    legalName: "",
    cnpj: "",
    focusToken: ""
  });

  const [details, setDetails] = useState<FiscalDocumentDetails | null>(null);
  const [detailDocumentId, setDetailDocumentId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError("");
    try {
      if (isClient) {
        if (customerIds.length === 0) {
          setDocuments([]);
        } else {
          const results = await Promise.all(
            customerIds.map((id) =>
              fiscalService.listDocuments(workspaceId, { customerId: id, direction: "OUTBOUND", limit: 150 })
            )
          );
          const merged = results.flatMap((r) => r.items);
          merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setDocuments(merged);
        }
        return;
      }

      const [dash, docs, recs, stripeDrafts, companyList, customerList] = await Promise.all([
        fiscalService.getDashboard(workspaceId),
        fiscalService.listDocuments(workspaceId, { direction: "OUTBOUND", search: issuedSearch || undefined, limit: 150 }),
        fiscalService.listReceived(workspaceId, { search: receivedSearch || undefined, limit: 150 }),
        fiscalService.listDrafts(workspaceId, 150),
        fiscalService.listCompanies(workspaceId),
        listCustomers()
      ]);

      setDashboard(dash);
      setDocuments(docs.items);
      setReceived(recs.items);
      setDrafts(stripeDrafts.items);
      setCompanies(companyList.items);
      setCustomers(customerList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar modulo fiscal.");
    } finally {
      setIsLoading(false);
    }
  }, [customerIds, isClient, issuedSearch, listCustomers, receivedSearch, workspaceId]);

  useEffect(() => {
    if (isClient) setTab("portal");
  }, [isClient]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (companies.length === 0) return;
    if (!wizard.companyConfigId) {
      setWizard((current) => ({ ...current, companyConfigId: companies[0].id }));
    }
    if (!syncCompanyConfigId) {
      setSyncCompanyConfigId(companies[0].id);
    }
  }, [companies, syncCompanyConfigId, wizard.companyConfigId]);

  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const selectedWizardCustomer = wizard.customerId ? customersById.get(wizard.customerId) ?? null : null;

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setIsSubmitting(true);
      setMessage("");
      setError("");
      try {
        await action();
        setMessage(successMessage);
        await loadAll();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao executar acao fiscal.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadAll]
  );

  const openDetails = async (documentId: string) => {
    if (!workspaceId) return;
    setDetailDocumentId(documentId);
    setDetailLoading(true);
    setDetails(null);
    try {
      const response = await fiscalService.getDocumentDetails(workspaceId, documentId);
      setDetails(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar detalhe.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleWizardCustomerChange = (customerId: string) => {
    const customer = customersById.get(customerId);
    setWizard((current) => ({
      ...current,
      customerId,
      customerName: customer ? getCustomerDisplayName(customer) : "",
      customerDocument: customer?.document ?? ""
    }));
  };

  const submitWizard = async () => {
    const customer = selectedWizardCustomer;
    if (!workspaceId || !wizard.companyConfigId || !customer || !wizard.itemName.trim()) {
      setError("Selecione empresa, cliente cadastrado e item para emitir.");
      return;
    }
    const customerDocument = customer.document;
    if (!customerDocument) {
      setError("Complete CPF/CNPJ no cadastro do cliente antes de emitir.");
      return;
    }

    const quantity = toNumber(wizard.quantity);
    const unitPrice = toNumber(wizard.unitPrice);
    const discount = toNumber(wizard.discount);
    const total = Math.max(0, quantity * unitPrice - discount);
    const itemType = wizard.documentType === "NFSE" ? "SERVICE" : "PRODUCT";
    const origin = wizard.documentType === "NFSE" ? "MANUAL_SERVICE" : "MANUAL_PRODUCT";

    await runAction(async () => {
      const created = await fiscalService.createDocument(workspaceId, {
        companyConfigId: wizard.companyConfigId,
        internalReference: wizard.reference,
        direction: "OUTBOUND",
        documentType: wizard.documentType,
        origin,
        sourceSystem: "INTERNAL",
        customerId: customer.id,
        amountSubtotal: total.toFixed(2),
        amountDiscount: discount.toFixed(2),
        amountTotal: total.toFixed(2),
        requestPayloadSnapshot: { notes: wizard.notes, source: "manual_wizard", customerId: customer.id },
        items: [
          {
            itemType,
            sourceType: "manual",
            name: wizard.itemName,
            descriptionCommercial: wizard.itemName,
            descriptionFiscal: wizard.itemName,
            quantity: quantity.toFixed(4),
            unit: "UN",
            unitPrice: unitPrice.toFixed(2),
            discountAmount: discount.toFixed(2),
            totalAmount: total.toFixed(2)
          }
        ],
        parties: [
          {
            role: wizard.documentType === "NFSE" ? "TAKER" : "RECIPIENT",
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

      await fiscalService.issueDocument(workspaceId, created.id);
      setWizard(initialWizardState());
      setTab("issued");
    }, "Documento criado e enviado para emissao.");
  };

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
        items={isClient ? TAB_ITEMS_CLIENT : TAB_ITEMS}
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
                onClick={() => void loadAll()}
                disabled={isLoading || isSubmitting}
              />
              <WorkspaceActionButton
                className="fiscal-top-nav__btn"
                tone="accent"
                label="Nova emissao"
                icon="+"
                onClick={() => setTab("wizard")}
                disabled={isSubmitting}
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

        {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

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

                {documents.length === 0 && !isLoading ? (
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

                {documents.length > 0 ? (
                  <ResourceTable
                    className="fiscal-view__table"
                    data={documents}
                    rowKey="id"
                    columns={portalColumns}
                    responsiveMinWidth="100%"
                    responsiveMinWidthMobile="100%"
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
                  <TextInput value={issuedSearch} onChange={(event) => setIssuedSearch(event.target.value)} placeholder="Referencia, venda, Focus..." />
                </FormField>
                <ResourceTable
                  className="fiscal-view__table"
                  data={documents}
                  columns={issuedColumns}
                  rowKey="id"
                  responsiveMinWidth="960px"
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
                        <Button size="sm" onClick={() => void runAction(() => fiscalService.issueDocument(workspaceId, document.id), "Emissao enviada.")} disabled={isSubmitting}>Emitir</Button>
                        <Button size="sm" variant="outline" onClick={() => void runAction(() => fiscalService.retryDocument(workspaceId, document.id), "Reprocesso solicitado.")} disabled={isSubmitting}>Retry</Button>
                      </div>
                    )
                  }}
                />
              </>
            ) : null}

            {tab === "received" ? (
              <>
                <div className="fiscal-view__inline-grid">
                  <FormField label="Buscar recebidas" className="fiscal-view__field">
                    <TextInput value={receivedSearch} onChange={(event) => setReceivedSearch(event.target.value)} placeholder="Fornecedor, chave..." />
                  </FormField>
                  <FormField label="Tipo sync" className="fiscal-view__field">
                    <Select value={syncType} onChange={(event) => setSyncType(event.target.value as FiscalReceivedType)}>
                      <option value="NFE_MDE">NFe (MD-e)</option>
                      <option value="NFSE_NFSER">NFSe (NFSeR)</option>
                    </Select>
                  </FormField>
                  <FormField label="Empresa" className="fiscal-view__field">
                    <Select value={syncCompanyConfigId} onChange={(event) => setSyncCompanyConfigId(event.target.value)}>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.displayName}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void runAction(() => fiscalService.syncReceived(workspaceId, { companyConfigId: syncCompanyConfigId, type: syncType }), "Sincronizacao iniciada.")}
                  disabled={isSubmitting || !syncCompanyConfigId}
                >
                  Sincronizar recebidas
                </Button>
                <ResourceTable
                  className="fiscal-view__table"
                  data={received}
                  columns={receivedColumns}
                  rowKey="id"
                  responsiveMinWidth="920px"
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhuma nota recebida."
                      description="Sincronize documentos recebidos por empresa para acompanhar entradas fiscais."
                    />
                  }
                />
              </>
            ) : null}

            {tab === "stripe" ? (
              <ResourceTable
                className="fiscal-view__table"
                data={drafts}
                columns={stripeDraftColumns}
                rowKey="id"
                responsiveMinWidth="900px"
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
                    <Button size="sm" onClick={() => void runAction(() => fiscalService.emitDraft(workspaceId, draft.id), "Draft emitido.")} disabled={isSubmitting}>
                      Emitir
                    </Button>
                  )
                }}
              />
            ) : null}

            {tab === "wizard" ? (
              <>
                <SectionCard className="fiscal-view__form-card" title="Dados da emissao" subtitle="Configure empresa, cliente e item antes de emitir." density="compact">
                <div className="fiscal-view__inline-grid">
                  <FormField label="Tipo" className="fiscal-view__field">
                <Select value={wizard.documentType} onChange={(event) => setWizard((current) => ({ ...current, documentType: event.target.value as FiscalDocumentType }))}>
                  <option value="NFE">NF-e</option>
                  <option value="NFSE">NFS-e</option>
                </Select>
              </FormField>
                  <FormField label="Empresa" className="fiscal-view__field">
                <Select value={wizard.companyConfigId} onChange={(event) => setWizard((current) => ({ ...current, companyConfigId: event.target.value }))}>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.displayName}</option>
                  ))}
                </Select>
              </FormField>
                  <FormField label="Referencia" className="fiscal-view__field">
                <TextInput value={wizard.reference} onChange={(event) => setWizard((current) => ({ ...current, reference: event.target.value }))} />
              </FormField>
                </div>
                <div className="fiscal-view__inline-grid">
                  <FormField label="Cliente cadastrado" className="fiscal-view__field">
                <Select value={wizard.customerId} onChange={(event) => handleWizardCustomerChange(event.target.value)}>
                  <option value="">Selecione um cliente</option>
                  {customers.map((customer) => {
                    const detail = formatCustomerOptionDetail(customer);
                    return (
                      <option key={customer.id} value={customer.id}>
                        {getCustomerDisplayName(customer)}{detail ? ` - ${detail}` : ""}
                      </option>
                    );
                  })}
                </Select>
              </FormField>
                  <FormField label="Nome fiscal" className="fiscal-view__field">
                <TextInput value={wizard.customerName} readOnly />
              </FormField>
                  <FormField label="Documento" className="fiscal-view__field">
                <TextInput value={wizard.customerDocument} readOnly />
              </FormField>
                </div>
                {selectedWizardCustomer && !selectedWizardCustomer.document ? (
                  <InlineAlert tone="danger">
                    Complete CPF/CNPJ no cadastro do cliente antes de emitir.
                  </InlineAlert>
                ) : null}
                <div className="fiscal-view__inline-grid">
                  <FormField label="Item" className="fiscal-view__field">
                <TextInput value={wizard.itemName} onChange={(event) => setWizard((current) => ({ ...current, itemName: event.target.value }))} />
              </FormField>
                </div>
                <div className="fiscal-view__inline-grid">
                  <FormField label="Qtd" className="fiscal-view__field"><TextInput value={wizard.quantity} onChange={(event) => setWizard((current) => ({ ...current, quantity: event.target.value }))} /></FormField>
                  <FormField label="Unitario" className="fiscal-view__field"><TextInput value={wizard.unitPrice} onChange={(event) => setWizard((current) => ({ ...current, unitPrice: event.target.value }))} /></FormField>
                  <FormField label="Desconto" className="fiscal-view__field"><TextInput value={wizard.discount} onChange={(event) => setWizard((current) => ({ ...current, discount: event.target.value }))} /></FormField>
                </div>
                <FormField label="Observacoes" className="fiscal-view__field">
              <Textarea value={wizard.notes} onChange={(event) => setWizard((current) => ({ ...current, notes: event.target.value }))} rows={3} />
            </FormField>
                <Button onClick={() => void submitWizard()} disabled={isSubmitting}>Emitir documento</Button>
                </SectionCard>
              </>
            ) : null}

            {tab === "settings" ? (
              <>
                <SectionCard className="fiscal-view__form-card" title="Empresa fiscal" subtitle="Cadastre as credenciais fiscais usadas na emissao." density="compact">
                <div className="fiscal-view__inline-grid">
                  <FormField label="Nome exibicao" className="fiscal-view__field"><TextInput value={companyForm.displayName} onChange={(event) => setCompanyForm((current) => ({ ...current, displayName: event.target.value }))} /></FormField>
                  <FormField label="Razao social" className="fiscal-view__field"><TextInput value={companyForm.legalName} onChange={(event) => setCompanyForm((current) => ({ ...current, legalName: event.target.value }))} /></FormField>
                  <FormField label="CNPJ" className="fiscal-view__field"><TextInput value={companyForm.cnpj} onChange={(event) => setCompanyForm((current) => ({ ...current, cnpj: event.target.value }))} /></FormField>
                </div>
                <FormField label="Token Focus" className="fiscal-view__field">
              <TextInput value={companyForm.focusToken} onChange={(event) => setCompanyForm((current) => ({ ...current, focusToken: event.target.value }))} />
            </FormField>
                <div className="fiscal-view__row-actions">
              <Button
                onClick={() =>
                  void runAction(
                    () =>
                      fiscalService.createCompany(workspaceId, {
                        displayName: companyForm.displayName,
                        legalName: companyForm.legalName,
                        cnpj: companyForm.cnpj,
                        focusToken: companyForm.focusToken
                      }),
                    "Empresa fiscal cadastrada."
                  )
                }
                disabled={isSubmitting}
              >
                Cadastrar empresa
              </Button>
            </div>
                <ResourceTable
                  className="fiscal-view__table"
                  data={companies}
                  columns={companyColumns}
                  rowKey="id"
                  responsiveMinWidth="880px"
                  emptyState={
                    <EmptyState
                      variant="table"
                      title="Nenhuma empresa fiscal cadastrada."
                      description="Cadastre uma empresa para habilitar emissao e sincronizacao fiscal."
                    />
                  }
                  actions={{
                    header: "Validar",
                    width: "0.8fr",
                    render: (company) => (
                      <Button size="sm" variant="outline" onClick={() => void runAction(() => fiscalService.validateCompany(workspaceId, company.id).then(() => undefined), "Validacao concluida.")} disabled={isSubmitting}>
                        Validar
                      </Button>
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
            setDetails(null);
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

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
import { useWorkspace } from "@/modules/workspace";
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
  Tabs,
  TextInput,
  Textarea
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./fiscal-page.css";

type FiscalTab = "dashboard" | "issued" | "received" | "stripe" | "wizard" | "settings";

interface WizardState {
  documentType: FiscalDocumentType;
  companyConfigId: string;
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

const SECTION_COPY: Record<FiscalTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Painel fiscal",
    subtitle: "Acompanhe emissao, recebimento e pendencias com a mesma leitura visual da timeline."
  },
  issued: {
    title: "Documentos emitidos",
    subtitle: "Consulte referencias, status e acoes operacionais da fila de emissao."
  },
  received: {
    title: "Documentos recebidos",
    subtitle: "Sincronize entradas e acompanhe XMLs, PDFs e manifestacoes."
  },
  stripe: {
    title: "Fila Stripe",
    subtitle: "Gerencie drafts gerados a partir de eventos financeiros aguardando emissao."
  },
  wizard: {
    title: "Wizard de emissao",
    subtitle: "Monte uma emissao manual com empresa, cliente e item em um fluxo unico."
  },
  settings: {
    title: "Configuracao fiscal",
    subtitle: "Cadastre empresas, tokens e valide o ambiente de emissao."
  }
};

function mapTone(status: string): "default" | "success" | "warning" {
  if (["AUTHORIZED", "ISSUED", "SYNCED", "MANIFESTED"].includes(status)) {
    return "success";
  }
  if (["REJECTED", "FAILED", "CANCELLED"].includes(status)) {
    return "warning";
  }
  return "default";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function formatMoney(value: string | null | undefined): string {
  const amount = Number(value ?? "0");
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
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

function initialWizardState(): WizardState {
  return {
    documentType: "NFE",
    companyConfigId: "",
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
  const { snapshot } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

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
      const [dash, docs, recs, stripeDrafts, companyList] = await Promise.all([
        fiscalService.getDashboard(workspaceId),
        fiscalService.listDocuments(workspaceId, { direction: "OUTBOUND", search: issuedSearch || undefined, limit: 150 }),
        fiscalService.listReceived(workspaceId, { search: receivedSearch || undefined, limit: 150 }),
        fiscalService.listDrafts(workspaceId, 150),
        fiscalService.listCompanies(workspaceId)
      ]);

      setDashboard(dash);
      setDocuments(docs.items);
      setReceived(recs.items);
      setDrafts(stripeDrafts.items);
      setCompanies(companyList.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar modulo fiscal.");
    } finally {
      setIsLoading(false);
    }
  }, [issuedSearch, receivedSearch, workspaceId]);

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

  const submitWizard = async () => {
    if (!workspaceId || !wizard.companyConfigId || !wizard.customerName.trim() || !wizard.itemName.trim()) {
      setError("Preencha empresa, cliente e item para emitir.");
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
        amountSubtotal: total.toFixed(2),
        amountDiscount: discount.toFixed(2),
        amountTotal: total.toFixed(2),
        requestPayloadSnapshot: { notes: wizard.notes, source: "manual_wizard" },
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
        parties: wizard.customerDocument
          ? [
              {
                role: wizard.documentType === "NFSE" ? "TAKER" : "RECIPIENT",
                name: wizard.customerName,
                legalName: wizard.customerName,
                cnpjCpf: wizard.customerDocument
              }
            ]
          : []
      });

      await fiscalService.issueDocument(workspaceId, created.id);
      setWizard(initialWizardState());
      setTab("issued");
    }, "Documento criado e enviado para emissao.");
  };

  const authorizedToday = documents.filter((item) => item.status === "AUTHORIZED").length;
  const activeSection = SECTION_COPY[tab];
  const fiscalMetricCards = [
    { label: "Emitidas hoje", value: dashboard?.counters.issuedToday ?? 0 },
    { label: "Pendentes", value: dashboard?.counters.pending ?? 0 },
    { label: "Recebidas", value: dashboard?.counters.received ?? 0 },
    { label: "Rejeitadas", value: dashboard?.counters.rejected ?? 0 },
    { label: "Empresas fiscais", value: companies.length },
    { label: "Autorizadas", value: authorizedToday }
  ];

  return (
    <AppShell metrics={metrics} hideSidebarBrandMark pageLabel="Fiscal" pageTitle="Fiscal">
      <div className="fiscal-view workspace-view">
        <BoardMetrics metrics={metrics} cards={fiscalMetricCards} className="fiscal-view__metrics workspace-view__metrics" />

        {message ? <div className="fiscal-view__feedback fiscal-view__feedback--ok">{message}</div> : null}
        {error ? <div className="fiscal-view__feedback fiscal-view__feedback--error">{error}</div> : null}

        <Section
          title={activeSection.title}
          subtitle={activeSection.subtitle}
          actions={
            <div className="fiscal-view__header-actions workspace-view__actions">
              <StatusBadge>{TAB_ITEMS.find((item) => item.id === tab)?.label ?? "Fiscal"}</StatusBadge>
              <Button variant="outline" onClick={() => void loadAll()} disabled={isLoading || isSubmitting}>
                Atualizar
              </Button>
              <Button onClick={() => setTab("wizard")} disabled={isSubmitting}>
                Nova emissao
              </Button>
            </div>
          }
          className="fiscal-view__section workspace-view__section"
        >
          <div className="fiscal-view__stack">
            <Tabs<FiscalTab> value={tab} items={TAB_ITEMS} onChange={setTab} className="fiscal-view__tabs" />

            {tab === "dashboard" ? (
              isLoading && !dashboard ? (
                <LoadingState text="Carregando painel fiscal..." />
              ) : (
                <div className="fiscal-view__summary-grid">
                  <article className="fiscal-view__summary-card">
                    <span className="fiscal-view__summary-label">Em revisao</span>
                    <strong>{dashboard?.counters.pendingReview ?? 0}</strong>
                    <p>Notas que ainda exigem conferencia ou ajuste manual.</p>
                  </article>
                  <article className="fiscal-view__summary-card">
                    <span className="fiscal-view__summary-label">Fila Stripe</span>
                    <strong>{drafts.length}</strong>
                    <p>Drafts aguardando emissao a partir de eventos financeiros.</p>
                  </article>
                  <article className="fiscal-view__summary-card">
                    <span className="fiscal-view__summary-label">Empresas ativas</span>
                    <strong>{companies.length}</strong>
                    <p>Configuracoes fiscais disponiveis para emissao e sincronizacao.</p>
                  </article>
                </div>
              )
            ) : null}

            {tab === "issued" ? (
              <>
                <FormField label="Buscar documentos" className="fiscal-view__field">
                  <TextInput value={issuedSearch} onChange={(event) => setIssuedSearch(event.target.value)} placeholder="Referencia, venda, Focus..." />
                </FormField>
                <DataTable className="fiscal-view__table" columns="1fr 0.7fr 0.9fr 0.9fr 1fr 1.2fr" responsiveMinWidth="960px">
              <DataTableHeader>
                <DataTableCell>Referencia</DataTableCell>
                <DataTableCell>Tipo</DataTableCell>
                <DataTableCell>Status</DataTableCell>
                <DataTableCell>Valor</DataTableCell>
                <DataTableCell>Criado</DataTableCell>
                <DataTableCell>Acoes</DataTableCell>
              </DataTableHeader>
              <DataTableBody>
                {isLoading && documents.length === 0 ? (
                  <LoadingState text="Carregando documentos emitidos..." />
                ) : documents.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell>Nenhum documento encontrado.</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                  </DataTableRow>
                ) : (
                  documents.map((document) => (
                    <DataTableRow key={document.id}>
                      <DataTableCell>{document.internalReference}</DataTableCell>
                      <DataTableCell>{document.documentType}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={mapTone(document.status)}>{STATUS_LABELS[document.status] ?? document.status}</StatusBadge>
                      </DataTableCell>
                      <DataTableCell>{formatMoney(document.amountTotal)}</DataTableCell>
                      <DataTableCell>{formatDate(document.createdAt)}</DataTableCell>
                      <DataTableCell>
                        <div className="fiscal-page__row-actions">
                          <Button size="sm" variant="outline" onClick={() => void openDetails(document.id)}>Detalhe</Button>
                          <Button size="sm" onClick={() => void runAction(() => fiscalService.issueDocument(workspaceId, document.id), "Emissao enviada.")} disabled={isSubmitting}>Emitir</Button>
                          <Button size="sm" variant="outline" onClick={() => void runAction(() => fiscalService.retryDocument(workspaceId, document.id), "Reprocesso solicitado.")} disabled={isSubmitting}>Retry</Button>
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
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
                <DataTable className="fiscal-view__table" columns="0.8fr 1fr 0.8fr 0.8fr 1fr 0.8fr" responsiveMinWidth="920px">
              <DataTableHeader>
                <DataTableCell>Tipo</DataTableCell>
                <DataTableCell>Fornecedor</DataTableCell>
                <DataTableCell>Status</DataTableCell>
                <DataTableCell>Valor</DataTableCell>
                <DataTableCell>Emissao</DataTableCell>
                <DataTableCell>Arquivos</DataTableCell>
              </DataTableHeader>
              <DataTableBody>
                {isLoading && received.length === 0 ? (
                  <LoadingState text="Carregando recebidas..." />
                ) : received.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell>Nenhuma nota recebida encontrada.</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                  </DataTableRow>
                ) : (
                  received.map((item) => (
                    <DataTableRow key={item.id}>
                      <DataTableCell>{item.type}</DataTableCell>
                      <DataTableCell>{item.issuerName ?? "-"}</DataTableCell>
                      <DataTableCell><StatusBadge tone={mapTone(item.status)}>{STATUS_LABELS[item.status] ?? item.status}</StatusBadge></DataTableCell>
                      <DataTableCell>{formatMoney(item.amountTotal)}</DataTableCell>
                      <DataTableCell>{formatDate(item.issuedAt)}</DataTableCell>
                      <DataTableCell>
                        <div className="fiscal-page__row-actions">
                          {item.xmlUrl ? <a href={item.xmlUrl} target="_blank" rel="noreferrer">XML</a> : <span>-</span>}
                          {item.pdfUrl ? <a href={item.pdfUrl} target="_blank" rel="noreferrer">PDF</a> : <span>-</span>}
                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
              </>
            ) : null}

            {tab === "stripe" ? (
              <DataTable className="fiscal-view__table" columns="1fr 0.8fr 0.8fr 1fr 0.8fr" responsiveMinWidth="900px">
              <DataTableHeader>
                <DataTableCell>Session Stripe</DataTableCell>
                <DataTableCell>Tipo</DataTableCell>
                <DataTableCell>Status</DataTableCell>
                <DataTableCell>Criado</DataTableCell>
                <DataTableCell>Acoes</DataTableCell>
              </DataTableHeader>
              <DataTableBody>
                {isLoading && drafts.length === 0 ? (
                  <LoadingState text="Carregando drafts Stripe..." />
                ) : drafts.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell>Nenhum draft Stripe pendente.</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                  </DataTableRow>
                ) : (
                  drafts.map((draft) => (
                    <DataTableRow key={draft.id}>
                      <DataTableCell>{draft.stripeSessionId ?? "-"}</DataTableCell>
                      <DataTableCell>{draft.documentType}</DataTableCell>
                      <DataTableCell><StatusBadge tone={mapTone(draft.status)}>{STATUS_LABELS[draft.status] ?? draft.status}</StatusBadge></DataTableCell>
                      <DataTableCell>{formatDate(draft.createdAt)}</DataTableCell>
                      <DataTableCell>
                        <Button size="sm" onClick={() => void runAction(() => fiscalService.emitDraft(workspaceId, draft.id), "Draft emitido.")} disabled={isSubmitting}>
                          Emitir
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
            ) : null}

            {tab === "wizard" ? (
              <>
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
                  <FormField label="Cliente" className="fiscal-view__field">
                <TextInput value={wizard.customerName} onChange={(event) => setWizard((current) => ({ ...current, customerName: event.target.value }))} />
              </FormField>
                  <FormField label="Documento" className="fiscal-view__field">
                <TextInput value={wizard.customerDocument} onChange={(event) => setWizard((current) => ({ ...current, customerDocument: event.target.value }))} />
              </FormField>
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
              </>
            ) : null}

            {tab === "settings" ? (
              <>
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
                <DataTable className="fiscal-view__table" columns="1fr 0.9fr 0.9fr 0.8fr" responsiveMinWidth="880px">
              <DataTableHeader>
                <DataTableCell>Empresa</DataTableCell>
                <DataTableCell>CNPJ</DataTableCell>
                <DataTableCell>Ambiente</DataTableCell>
                <DataTableCell>Validar</DataTableCell>
              </DataTableHeader>
              <DataTableBody>
                {isLoading && companies.length === 0 ? (
                  <LoadingState text="Carregando empresas fiscais..." />
                ) : companies.length === 0 ? (
                  <DataTableRow>
                    <DataTableCell>Nenhuma empresa fiscal cadastrada.</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                    <DataTableCell>-</DataTableCell>
                  </DataTableRow>
                ) : (
                  companies.map((company) => (
                    <DataTableRow key={company.id}>
                      <DataTableCell>{company.displayName}</DataTableCell>
                      <DataTableCell>{company.cnpj}</DataTableCell>
                      <DataTableCell>{company.focusEnvironment}</DataTableCell>
                      <DataTableCell>
                        <Button size="sm" variant="outline" onClick={() => void runAction(() => fiscalService.validateCompany(workspaceId, company.id).then(() => undefined), "Validacao concluida.")} disabled={isSubmitting}>
                          Validar
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
              </>
            ) : null}

            {tab !== "dashboard" && !workspaceId ? (
              <EmptyState>Selecione um workspace para acessar o modulo fiscal.</EmptyState>
            ) : null}
          </div>
        </Section>
      </div>

      {detailDocumentId ? (
        <ModalShell
          titleId="fiscal-document-details"
          className="fiscal-view__modal"
          onClose={() => {
            setDetailDocumentId(null);
            setDetails(null);
          }}
        >
          <header className="fiscal-view__modal-header">
            <h2 id="fiscal-document-details">Detalhe da nota</h2>
            <button type="button" onClick={() => setDetailDocumentId(null)}>x</button>
          </header>

          {detailLoading || !details ? (
            <p className="fiscal-view__empty">Carregando detalhes...</p>
          ) : (
            <div className="fiscal-view__modal-content">
              <p><strong>Referencia:</strong> {details.document.internalReference}</p>
              <p><strong>Status:</strong> {STATUS_LABELS[details.document.status] ?? details.document.status}</p>
              <p><strong>Focus:</strong> {details.document.focusStatus ?? "-"}</p>
              <p><strong>Valor:</strong> {formatMoney(details.document.amountTotal)}</p>

              <h3>Payload enviado</h3>
              <Textarea value={safeJson(details.document.requestPayloadSnapshot)} rows={7} readOnly />

              <h3>Payload retornado</h3>
              <Textarea value={safeJson(details.document.responsePayloadSnapshot)} rows={7} readOnly />
            </div>
          )}
        </ModalShell>
      ) : null}
    </AppShell>
  );
}

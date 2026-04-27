import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { buildWorkspaceBoardPath, buildWorkspaceDocumentationPath } from "@/app/router/route-paths";
import { buildBoardMetrics, type Task, type TaskCustomFieldValue, type TaskFieldDefinition } from "@/entities/task";
import {
  useWorkspace,
  type Customer,
  type CustomerStatus,
  type CreateCustomerInput,
  type WorkspaceDocument
} from "@/modules/workspace";
import { billingService, type ConnectCatalogItem } from "@/modules/billing";
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
  Select,
  StatusBadge,
  Tabs,
  TextInput,
  Textarea,
  WorkspaceActionButton,
  WorkspaceFrame
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./leads-page.css";

type LeadsTab = "overview" | "leads" | "customers";
type ModalMode = "lead" | "customer" | "customer-from-lead" | "link-customer" | "customer-detail";

type LeadFormState = {
  customerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  source: string;
  interest: string;
  estimatedValue: string;
  proposalValidity: string;
  notes: string;
};

const TABS: Array<{ id: LeadsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads" },
  { id: "customers", label: "Clientes" }
];

const COMMERCIAL_TYPE_ID = "commercial";

const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  prospect: "Prospect",
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado"
};

const FUNNEL_STAGES = [
  { key: "entrada", label: "Entrada", statuses: ["lead_new", "lead_qualification"], color: "#0d8df7" },
  { key: "venda", label: "Venda", statuses: ["opportunity_open", "proposal_preparing", "proposal_sent", "proposal_approved"], color: "#f59e0b" },
  { key: "formalizacao", label: "Formalização", statuses: ["contract_preparing", "contract_sent", "contract_accepted"], color: "#7c3aed" },
  { key: "financeiro", label: "Financeiro", statuses: ["billing_created", "payment_waiting", "paid_active"], color: "#16a34a" }
];

function emptyLeadForm(): LeadFormState {
  return {
    customerId: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    companyName: "",
    source: "",
    interest: "",
    estimatedValue: "",
    proposalValidity: "",
    notes: ""
  };
}

function emptyCustomerForm(): CreateCustomerInput {
  return {
    name: "",
    tradeName: "",
    legalName: "",
    document: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
    status: "prospect",
    notes: ""
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function formatMoney(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(amount)) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
}

function formatMoneyCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return formatMoney(value);
}

function getTextField(task: Task, fieldId: string): string {
  const value = task.customFields[fieldId];
  return typeof value === "string" ? value.trim() : "";
}

function getNumberField(task: Task, fieldId: string): number | null {
  const value = task.customFields[fieldId];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCustomFieldValuesBySlug(
  fieldDefinitions: TaskFieldDefinition[],
  fields: Record<string, unknown>
): Record<string, TaskCustomFieldValue> {
  return Object.entries(fields).reduce<Record<string, TaskCustomFieldValue>>((acc, [slug, value]) => {
    if (value === undefined) return acc;
    const field = fieldDefinitions.find((d) => d.slug === slug || d.id === slug);
    const fieldId = field?.definitionId ?? field?.id;
    if (!fieldId) return acc;
    acc[fieldId] = (value ?? null) as TaskCustomFieldValue;
    return acc;
  }, {});
}

function getCustomerDisplayName(customer: Customer | null | undefined): string {
  return customer?.tradeName || customer?.legalName || customer?.name || "";
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "L";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? "D"}`.toUpperCase();
}

function formatCustomerAddress(customer: Customer | null | undefined): string {
  const address = customer?.address;
  if (!address) return "";
  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.district,
    [address.city, address.state].filter(Boolean).join(" / "),
    address.zipCode,
    address.country
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" - ");
}

function buildCustomerInputFromLead(task: Task): CreateCustomerInput {
  const companyName = getTextField(task, "companyName");
  const clientName = getTextField(task, "clientName");
  const contactName = getTextField(task, "contactName");
  const name = clientName || companyName || contactName || task.title;
  return {
    name,
    tradeName: companyName || clientName || "",
    email: getTextField(task, "contactEmail"),
    phone: getTextField(task, "contactPhone"),
    logoUrl: getTextField(task, "clientLogoUrl"),
    status: "prospect",
    notes: task.text
  };
}

function findPossibleDuplicates(customers: Customer[], input: CreateCustomerInput): Customer[] {
  const normalized = {
    name: String(input.name ?? "").trim().toLowerCase(),
    email: String(input.email ?? "").trim().toLowerCase(),
    phone: String(input.phone ?? "").replace(/\D/g, ""),
    document: String(input.document ?? "").replace(/\D/g, "")
  };
  return customers.filter((customer) => {
    const customerPhone = String(customer.phone ?? "").replace(/\D/g, "");
    const customerDocument = String(customer.document ?? "").replace(/\D/g, "");
    return (
      (normalized.email && customer.email?.toLowerCase() === normalized.email) ||
      (normalized.phone && customerPhone === normalized.phone) ||
      (normalized.document && customerDocument === normalized.document) ||
      (normalized.name && customer.name.toLowerCase().includes(normalized.name))
    );
  });
}

function isApprovedProposal(document: WorkspaceDocument | undefined): boolean {
  return document?.kind === "proposal" && document.metadata?.status === "approved";
}

export function LeadsPage() {
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const {
    snapshot,
    isLoading,
    createTask,
    updateTask,
    listCustomers,
    createCustomer,
    listWorkspaceDocuments
  } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<LeadsTab>("overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [catalogItems, setCatalogItems] = useState<ConnectCatalogItem[]>([]);
  const [isAuxLoading, setIsAuxLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<LeadFormState>(() => emptyLeadForm());
  const [customerForm, setCustomerForm] = useState<CreateCustomerInput>(() => emptyCustomerForm());
  const [linkCustomerId, setLinkCustomerId] = useState("");

  const boardStatuses = snapshot?.boardConfig.statuses ?? [];
  const commercialType =
    snapshot?.boardConfig.taskTypes.find((t) => t.id === COMMERCIAL_TYPE_ID) ??
    snapshot?.boardConfig.taskTypes.find((t) => t.label.toLowerCase().includes("comercial"));
  const commercialTypeId = commercialType?.id ?? COMMERCIAL_TYPE_ID;
  const initialStatusId = boardStatuses[0]?.id ?? "lead_new";

  const commercialTasks = useMemo(
    () => (snapshot?.tasks ?? []).filter((task) => task.type === commercialTypeId),
    [commercialTypeId, snapshot?.tasks]
  );

  const statusLabelById = useMemo(
    () => new Map(boardStatuses.map((s) => [s.id, s.label])),
    [boardStatuses]
  );

  const commercialFieldDefinitions = snapshot?.boardConfig.fieldDefinitions ?? [];
  const buildCommercialCustomFieldValues = useCallback(
    (fields: Record<string, unknown>) => buildCustomFieldValuesBySlug(commercialFieldDefinitions, fields),
    [commercialFieldDefinitions]
  );

  const customersById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const documentsById = useMemo(() => new Map(documents.map((d) => [d.id, d])), [documents]);
  const catalogItemsById = useMemo(() => new Map(catalogItems.map((item) => [item.id, item])), [catalogItems]);
  const selectedCatalogItem = leadForm.interest ? catalogItemsById.get(leadForm.interest) ?? null : null;
  const resolveCatalogLabel = useCallback(
    (value: string) => catalogItemsById.get(value)?.name ?? value,
    [catalogItemsById]
  );

  const selectedTask = useMemo(
    () => commercialTasks.find((t) => t.id === selectedTaskId) ?? null,
    [commercialTasks, selectedTaskId]
  );
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return commercialTasks;
    return commercialTasks.filter((task) => {
      const customer = customersById.get(getTextField(task, "customerId"));
      return [
        task.title, task.text,
        getTextField(task, "companyName"), getTextField(task, "clientName"),
        getTextField(task, "contactName"), getTextField(task, "contactEmail"),
        getTextField(task, "source"), resolveCatalogLabel(getTextField(task, "interest")),
        customer?.name
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(query));
    });
  }, [commercialTasks, customersById, resolveCatalogLabel, search]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((c) =>
      [c.name, c.tradeName, c.legalName, c.document, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query))
    );
  }, [customers, search]);

  // ── Pipeline analytics ────────────────────────────────────────────────────
  const pipelineMetrics = useMemo(() => {
    const activeTasks = commercialTasks.filter((t) => !["lost", "closed"].includes(t.status));
    const wonTasks = commercialTasks.filter((t) => t.status === "paid_active");
    const lostTasks = commercialTasks.filter((t) => t.status === "lost");
    const proposalDocs = documents.filter((d) => d.kind === "proposal");
    const approvedProposals = proposalDocs.filter((d) => d.metadata?.status === "approved");
    const linkedCount = commercialTasks.filter((t) => getTextField(t, "customerId")).length;

    const tasksWithValue = activeTasks.filter((t) => getNumberField(t, "estimatedValue") !== null);
    const totalPipelineValue = tasksWithValue.reduce((s, t) => s + (getNumberField(t, "estimatedValue") ?? 0), 0);
    const wonValue = wonTasks.reduce((s, t) => s + (getNumberField(t, "estimatedValue") ?? 0), 0);
    const avgDealSize = tasksWithValue.length > 0 ? totalPipelineValue / tasksWithValue.length : 0;

    return {
      totalPipelineValue,
      wonValue,
      avgDealSize,
      activeLeads: activeTasks.length,
      lostLeads: lostTasks.length,
      totalLeads: commercialTasks.length,
      linkedCount,
      proposals: proposalDocs.length,
      approvedProposals: approvedProposals.length,
      contracts: documents.filter((d) => d.kind === "contract").length,
      customers: customers.length,
      activeCustomers: customers.filter((c) => c.status === "active").length,
      conversionRate: commercialTasks.length === 0 ? 0 : Math.round((linkedCount / commercialTasks.length) * 100),
      proposalWinRate: proposalDocs.length === 0 ? 0 : Math.round((approvedProposals.length / proposalDocs.length) * 100)
    };
  }, [commercialTasks, customers, documents]);

  const funnelData = useMemo(() => {
    const firstCount = FUNNEL_STAGES[0]
      ? commercialTasks.filter((t) => FUNNEL_STAGES[0].statuses.includes(t.status)).length
      : 1;
    const maxCount = Math.max(1, firstCount);

    return FUNNEL_STAGES.map((stage, i) => {
      const tasks = commercialTasks.filter((t) => stage.statuses.includes(t.status));
      const prevTasks = i > 0
        ? commercialTasks.filter((t) => FUNNEL_STAGES[i - 1].statuses.includes(t.status))
        : tasks;
      return {
        ...stage,
        count: tasks.length,
        value: tasks.reduce((s, t) => s + (getNumberField(t, "estimatedValue") ?? 0), 0),
        barPct: Math.round((tasks.length / maxCount) * 100),
        globalPct: Math.round((tasks.length / Math.max(1, firstCount)) * 100),
        conversionFromPrev: prevTasks.length === 0 || i === 0
          ? null
          : Math.round((tasks.length / prevTasks.length) * 100)
      };
    });
  }, [commercialTasks]);

  const statusDistribution = useMemo(() => {
    const maxCount = Math.max(1, ...boardStatuses.map((s) =>
      commercialTasks.filter((t) => t.status === s.id).length
    ));
    return boardStatuses
      .map((status) => {
        const tasks = commercialTasks.filter((t) => t.status === status.id);
        return {
          id: status.id,
          label: status.label,
          dot: status.dot,
          count: tasks.length,
          value: tasks.reduce((s, t) => s + (getNumberField(t, "estimatedValue") ?? 0), 0),
          barPct: Math.round((tasks.length / maxCount) * 100)
        };
      })
      .filter((s) => s.count > 0);
  }, [boardStatuses, commercialTasks]);

  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, { count: number; value: number }> = {};
    for (const task of commercialTasks) {
      const src = getTextField(task, "source").trim() || "Não informada";
      if (!counts[src]) counts[src] = { count: 0, value: 0 };
      counts[src].count += 1;
      counts[src].value += getNumberField(task, "estimatedValue") ?? 0;
    }
    const max = Math.max(1, ...Object.values(counts).map((v) => v.count));
    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([label, data]) => ({ label, ...data, barPct: Math.round((data.count / max) * 100) }));
  }, [commercialTasks]);

  const pendingItems = useMemo(() => {
    const withoutCustomer = commercialTasks.filter((t) => !getTextField(t, "customerId"));
    const withoutProposal = commercialTasks.filter((t) => !getTextField(t, "proposalId") &&
      ["opportunity_open", "proposal_preparing"].includes(t.status));
    const draftProposals = documents.filter((d) => d.kind === "proposal" && d.metadata?.status === "draft");
    const sentProposals = documents.filter((d) => d.kind === "proposal" && d.metadata?.status === "sent");
    const contractDrafts = documents.filter((d) => d.kind === "contract" && d.metadata?.status === "draft");
    return [
      ...withoutCustomer.slice(0, 2).map((t) => ({ id: `nc-${t.id}`, label: t.title, detail: "Sem cliente vinculado", urgency: "high" as const })),
      ...withoutProposal.slice(0, 2).map((t) => ({ id: `np-${t.id}`, label: t.title, detail: "Oportunidade sem proposta", urgency: "medium" as const })),
      ...draftProposals.slice(0, 2).map((d) => ({ id: `dp-${d.id}`, label: d.title, detail: "Proposta em rascunho", urgency: "medium" as const })),
      ...sentProposals.slice(0, 2).map((d) => ({ id: `sp-${d.id}`, label: d.title, detail: "Aguardando resposta do cliente", urgency: "low" as const })),
      ...contractDrafts.slice(0, 2).map((d) => ({ id: `cd-${d.id}`, label: d.title, detail: "Contrato em preparação", urgency: "medium" as const }))
    ].slice(0, 8);
  }, [commercialTasks, documents]);

  const filteredLeadMetrics = useMemo(() => {
    const totalValue = filteredTasks.reduce((sum, task) => sum + (getNumberField(task, "estimatedValue") ?? 0), 0);
    const activeCount = filteredTasks.filter((task) => !["lost", "closed"].includes(task.status)).length;
    const unlinkedCount = filteredTasks.filter((task) => !getTextField(task, "customerId")).length;
    const proposalCount = filteredTasks.filter((task) => getTextField(task, "proposalId")).length;
    return {
      totalValue,
      activeCount,
      unlinkedCount,
      proposalCount,
      avgValue: filteredTasks.length > 0 ? totalValue / filteredTasks.length : 0
    };
  }, [filteredTasks]);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadAuxData = useCallback(async () => {
    setIsAuxLoading(true);
    setError("");
    try {
      const workspaceId = snapshot?.id;
      const [nextCustomers, nextDocuments, catalogResponse] = await Promise.all([
        listCustomers(),
        listWorkspaceDocuments(),
        workspaceId ? billingService.listConnectCatalogItems(workspaceId, false) : Promise.resolve({ items: [] })
      ]);
      setCustomers(nextCustomers);
      setDocuments(nextDocuments);
      setCatalogItems(catalogResponse.items.filter((item) => item.isActive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados comerciais.");
    } finally {
      setIsAuxLoading(false);
    }
  }, [listCustomers, listWorkspaceDocuments, snapshot?.id]);

  useEffect(() => { void loadAuxData(); }, [loadAuxData]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    setIsSubmitting(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(successMessage);
      await loadAuxData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao executar ação comercial.");
    } finally {
      setIsSubmitting(false);
    }
  }, [loadAuxData]);

  // ── Modal openers ─────────────────────────────────────────────────────────
  const openNewLeadModal = (customer?: Customer) => {
    setLeadForm({ ...emptyLeadForm(), customerId: customer?.id ?? "", companyName: getCustomerDisplayName(customer) || "", contactEmail: customer?.email ?? "", contactPhone: customer?.phone ?? "" });
    setSelectedCustomerId(customer?.id ?? null);
    setSelectedTaskId(null);
    setModalMode("lead");
  };
  const openCustomerModal = () => { setCustomerForm(emptyCustomerForm()); setSelectedCustomerId(null); setSelectedTaskId(null); setModalMode("customer"); };
  const openCustomerFromLeadModal = (task: Task) => { setCustomerForm(buildCustomerInputFromLead(task)); setSelectedTaskId(task.id); setSelectedCustomerId(null); setModalMode("customer-from-lead"); };
  const openLinkCustomerModal = (task: Task) => { setSelectedTaskId(task.id); setLinkCustomerId(getTextField(task, "customerId")); setModalMode("link-customer"); };

  // ── Actions ───────────────────────────────────────────────────────────────
  const createLeadWorkItem = async () => {
    const customer = leadForm.customerId ? customersById.get(leadForm.customerId) : null;
    const companyName = leadForm.companyName.trim() || getCustomerDisplayName(customer);
    const contactName = leadForm.contactName.trim();
    const catalogItem = selectedCatalogItem;
    const catalogMetadata = catalogItem?.metadata ?? {};
    const titleBase = companyName || contactName || catalogItem?.name;
    if (!titleBase) throw new Error("Informe empresa, contato ou interesse para criar o lead.");
    const estimatedValue = Number(leadForm.estimatedValue.replace(",", "."));
    const catalogAmount = catalogItem ? catalogItem.amount / 100 : undefined;
    const fields = {
      customerId: leadForm.customerId || undefined,
      clientName: getCustomerDisplayName(customer) || companyName || contactName,
      companyName: companyName || undefined,
      clientLogoUrl: customer?.logoUrl || undefined,
      contactName: contactName || undefined,
      contactEmail: leadForm.contactEmail.trim() || customer?.email || undefined,
      contactPhone: leadForm.contactPhone.trim() || customer?.phone || undefined,
      source: leadForm.source.trim() || undefined,
      interest: catalogItem?.id || undefined,
      estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : catalogAmount,
      proposalValidity: leadForm.proposalValidity || catalogMetadata.proposalValidity || undefined,
      paymentTerms: catalogMetadata.paymentTerms || undefined
    };
    await createTask({
      type: commercialTypeId,
      title: titleBase,
      description: leadForm.notes.trim() || catalogMetadata.scope || catalogItem?.description || catalogItem?.name || "",
      priority: 2,
      statusId: initialStatusId,
      fields,
      customFieldValues: buildCommercialCustomFieldValues(fields)
    });
  };

  const createCustomerFromForm = async () => {
    if (!customerForm.name?.trim()) throw new Error("Informe o nome do cliente.");
    const created = await createCustomer({ ...customerForm, sourceWorkItemId: modalMode === "customer-from-lead" ? selectedTask?.id ?? null : null });
    if (modalMode === "customer-from-lead" && selectedTask) await linkTaskToCustomer(selectedTask, created);
  };

  const linkTaskToCustomer = async (task: Task, customer: Customer) => {
    const nextFields = { ...task.customFields, customerId: customer.id, clientName: getCustomerDisplayName(customer), companyName: getTextField(task, "companyName") || getCustomerDisplayName(customer), clientLogoUrl: customer.logoUrl || getTextField(task, "clientLogoUrl") || undefined, contactEmail: getTextField(task, "contactEmail") || customer.email || undefined, contactPhone: getTextField(task, "contactPhone") || customer.phone || undefined };
    await updateTask(task.id, { fields: nextFields, customFieldValues: buildCommercialCustomFieldValues(nextFields) });
  };

  // ── Top nav ───────────────────────────────────────────────────────────────
  const topNavigation = (
    <section className="leads-top-nav" aria-label="Navegação comercial">
      <Tabs<LeadsTab> value={tab} items={TABS} onChange={setTab} className="leads-page__tabs" />
      <div className="leads-top-nav__actions">
        <WorkspaceActionButton className="leads-top-nav__btn" label="Atualizar" icon={<IconRefresh />} onClick={() => void loadAuxData()} disabled={isAuxLoading || isSubmitting} />
        <WorkspaceActionButton className="leads-top-nav__btn leads-top-nav__btn--customer" label="Novo cliente" icon={<IconUsers />} onClick={openCustomerModal} />
        <WorkspaceActionButton className="leads-top-nav__btn leads-top-nav__btn--lead" tone="accent" label="Novo lead" icon={<IconTrendUp />} onClick={() => openNewLeadModal()} />
      </div>
    </section>
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="leads-page">
        <LoadingState text="Carregando central comercial..." animation="leads" variant="frame" visible={(isLoading && !snapshot) || isAuxLoading} />

        {message ? <div className="leads-page__feedback leads-page__feedback--ok">{message}</div> : null}
        {error ? <div className="leads-page__feedback leads-page__feedback--error">{error}</div> : null}

        <div className="leads-page__content">
          <div className="leads-page__stack">

            {/* ═══════════════════ OVERVIEW ═══════════════════ */}
            {tab === "overview" ? (
              <>
                {/* KPI strip */}
                <div className="leads-kpi-strip">
                  <KpiCard
                    label="Pipeline total"
                    value={formatMoneyCompact(pipelineMetrics.totalPipelineValue)}
                    sub={`${pipelineMetrics.activeLeads} oportunidades ativas`}
                    accent="blue"
                    icon={<IconTrendUp />}
                  />
                  <KpiCard
                    label="Receita ganha"
                    value={formatMoneyCompact(pipelineMetrics.wonValue)}
                    sub={`Ticket médio ${formatMoneyCompact(pipelineMetrics.avgDealSize)}`}
                    accent="green"
                    icon={<IconCheck />}
                  />
                  <KpiCard
                    label="Taxa de conversão"
                    value={`${pipelineMetrics.conversionRate}%`}
                    sub={`${pipelineMetrics.linkedCount} de ${pipelineMetrics.totalLeads} leads vinculados`}
                    accent="purple"
                    icon={<IconUsers />}
                  />
                  <KpiCard
                    label="Aprovação de propostas"
                    value={`${pipelineMetrics.proposalWinRate}%`}
                    sub={`${pipelineMetrics.approvedProposals} aprovadas de ${pipelineMetrics.proposals}`}
                    accent="amber"
                    icon={<IconDoc />}
                  />
                </div>

                {/* Sales funnel */}
                <section className="leads-funnel-section">
                  <header className="leads-section-header">
                    <span className="leads-page__eyebrow">Funil de vendas</span>
                    <span className="leads-section-header__sub">Progressão por perspectiva</span>
                  </header>
                  <div className="leads-funnel">
                    {funnelData.map((stage, i) => (
                      <div key={stage.key} className="leads-funnel__item">
                        {i > 0 && stage.conversionFromPrev !== null ? (
                          <div className="leads-funnel__connector">
                            <span className="leads-funnel__connector-rate" style={{ color: stage.conversionFromPrev >= 50 ? "var(--success)" : stage.conversionFromPrev >= 25 ? "#f59e0b" : "var(--danger)" }}>
                              {stage.conversionFromPrev}%
                            </span>
                            <span className="leads-funnel__connector-label">conversão</span>
                          </div>
                        ) : null}
                        <div className="leads-funnel__stage">
                          <div className="leads-funnel__stage-meta">
                            <span className="leads-funnel__stage-label">{stage.label}</span>
                            <div className="leads-funnel__stage-values">
                              <strong className="leads-funnel__stage-count">{stage.count}</strong>
                              {stage.value > 0 && <span className="leads-funnel__stage-value">{formatMoneyCompact(stage.value)}</span>}
                            </div>
                          </div>
                          <div className="leads-funnel__bar-track">
                            <div
                              className="leads-funnel__bar-fill"
                              style={{ width: `${Math.max(stage.barPct, stage.count > 0 ? 4 : 0)}%`, background: stage.color }}
                              aria-label={`${stage.count} leads`}
                            />
                          </div>
                          <span className="leads-funnel__stage-pct">{stage.globalPct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Two-column analytics */}
                <div className="leads-analytics-grid">
                  {/* Status distribution */}
                  <section className="leads-chart-card">
                    <header className="leads-section-header">
                      <span className="leads-page__eyebrow">Distribuição por status</span>
                    </header>
                    {statusDistribution.length === 0 ? (
                      <p className="leads-chart-card__empty">Nenhum lead registrado.</p>
                    ) : (
                      <div className="leads-status-chart">
                        {statusDistribution.map((status) => (
                          <div key={status.id} className="leads-status-row">
                            <div className="leads-status-row__label">
                              <span className="leads-status-dot" style={{ background: status.dot }} />
                              <span className="leads-status-name">{status.label}</span>
                            </div>
                            <div className="leads-status-bar-track">
                              <div
                                className="leads-status-bar-fill"
                                style={{ width: `${Math.max(status.barPct, status.count > 0 ? 3 : 0)}%`, background: status.dot }}
                              />
                            </div>
                            <div className="leads-status-row__right">
                              <span className="leads-status-count">{status.count}</span>
                              {status.value > 0 && <span className="leads-status-value">{formatMoneyCompact(status.value)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Source breakdown */}
                  <section className="leads-chart-card">
                    <header className="leads-section-header">
                      <span className="leads-page__eyebrow">Origem dos leads</span>
                    </header>
                    {sourceBreakdown.length === 0 ? (
                      <p className="leads-chart-card__empty">Nenhuma origem registrada.</p>
                    ) : (
                      <div className="leads-status-chart">
                        {sourceBreakdown.map((src) => (
                          <div key={src.label} className="leads-status-row">
                            <div className="leads-status-row__label">
                              <span className="leads-source-dot" />
                              <span className="leads-status-name">{src.label}</span>
                            </div>
                            <div className="leads-status-bar-track">
                              <div className="leads-status-bar-fill leads-status-bar-fill--source" style={{ width: `${Math.max(src.barPct, src.count > 0 ? 3 : 0)}%` }} />
                            </div>
                            <div className="leads-status-row__right">
                              <span className="leads-status-count">{src.count}</span>
                              {src.value > 0 && <span className="leads-status-value">{formatMoneyCompact(src.value)}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Pending items */}
                {pendingItems.length > 0 && (
                  <section className="leads-pending-section">
                    <header className="leads-section-header">
                      <span className="leads-page__eyebrow">Ações pendentes</span>
                      <span className="leads-pending-badge">{pendingItems.length}</span>
                    </header>
                    <div className="leads-pending-grid">
                      {pendingItems.map((item) => (
                        <div key={item.id} className={`leads-pending-item leads-pending-item--${item.urgency}`}>
                          <span className="leads-pending-urgency" aria-hidden="true">
                            {item.urgency === "high" ? "●" : item.urgency === "medium" ? "◐" : "○"}
                          </span>
                          <div className="leads-pending-content">
                            <strong>{item.label}</strong>
                            <span>{item.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recent leads */}
                <div className="leads-analytics-grid leads-analytics-grid--wide">
                  <section className="leads-chart-card">
                    <header className="leads-section-header">
                      <span className="leads-page__eyebrow">Leads recentes</span>
                    </header>
                    {commercialTasks.length === 0 ? (
                      <p className="leads-chart-card__empty">Nenhum lead registrado.</p>
                    ) : (
                      <ul className="leads-activity-list">
                        {commercialTasks.slice(0, 6).map((task) => {
                          const customer = customersById.get(getTextField(task, "customerId"));
                          const value = getNumberField(task, "estimatedValue");
                          return (
                            <li key={task.id} className="leads-activity-item">
                              <span className="leads-activity-dot" style={{ background: boardStatuses.find((s) => s.id === task.status)?.dot ?? "var(--leads-accent)" }} />
                              <div className="leads-activity-main">
                                <strong>{task.title}</strong>
                                <span>{customer ? getCustomerDisplayName(customer) : getTextField(task, "companyName") || "Sem empresa"}</span>
                              </div>
                              <div className="leads-activity-right">
                                <span className="leads-activity-status">{statusLabelById.get(task.status) ?? task.status}</span>
                                {value !== null && <span className="leads-activity-value">{formatMoneyCompact(value)}</span>}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                  <section className="leads-chart-card">
                    <header className="leads-section-header">
                      <span className="leads-page__eyebrow">Clientes ativos</span>
                      <span className="leads-section-header__sub">{pipelineMetrics.activeCustomers} de {pipelineMetrics.customers}</span>
                    </header>
                    {customers.length === 0 ? (
                      <p className="leads-chart-card__empty">Nenhum cliente cadastrado.</p>
                    ) : (
                      <ul className="leads-activity-list">
                        {customers.filter((c) => c.status === "active").concat(customers.filter((c) => c.status !== "active")).slice(0, 6).map((customer) => {
                          const linked = commercialTasks.filter((t) => getTextField(t, "customerId") === customer.id).length;
                          return (
                            <li key={customer.id} className="leads-activity-item">
                              <div className="leads-customer-avatar">
                                {customer.logoUrl
                                  ? <img src={customer.logoUrl} alt="" />
                                  : <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>}
                              </div>
                              <div className="leads-activity-main">
                                <strong>{getCustomerDisplayName(customer)}</strong>
                                <span>{customer.email ?? customer.document ?? "Sem contato"}</span>
                              </div>
                              <div className="leads-activity-right">
                                <span className={`leads-customer-status leads-customer-status--${customer.status}`}>{CUSTOMER_STATUS_LABELS[customer.status]}</span>
                                <span className="leads-activity-value">{linked} deal{linked !== 1 ? "s" : ""}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </div>
              </>
            ) : null}

            {/* ═══════════════════ LEADS TABLE ═══════════════════ */}
            {tab === "leads" ? (
              <section className="leads-board-shell">
                <header className="leads-board-hero">
                  <div className="leads-board-hero__copy">
                    <span className="leads-page__eyebrow">Pipeline filtrado</span>
                    <h2>Leads comerciais</h2>
                    <p>
                      {filteredTasks.length} lead{filteredTasks.length !== 1 ? "s" : ""}
                      {search ? ` encontrado${filteredTasks.length !== 1 ? "s" : ""}` : " no radar"} com contexto de cliente, proposta e contrato.
                    </p>
                  </div>
                  <div className="leads-board-hero__value">
                    <span>Valor em aberto</span>
                    <strong>{formatMoneyCompact(filteredLeadMetrics.totalValue)}</strong>
                  </div>
                </header>

                <div className="leads-board-stats">
                  <div className="leads-board-stat">
                    <span>Ativos</span>
                    <strong>{filteredLeadMetrics.activeCount}</strong>
                  </div>
                  <div className="leads-board-stat">
                    <span>Sem cliente</span>
                    <strong>{filteredLeadMetrics.unlinkedCount}</strong>
                  </div>
                  <div className="leads-board-stat">
                    <span>Com proposta</span>
                    <strong>{filteredLeadMetrics.proposalCount}</strong>
                  </div>
                  <div className="leads-board-stat">
                    <span>Ticket medio</span>
                    <strong>{formatMoneyCompact(filteredLeadMetrics.avgValue)}</strong>
                  </div>
                </div>

                <div className="leads-page__filters leads-page__filters--bar leads-page__filters--panel">
                  <FormField label="Buscar leads">
                    <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Empresa, contato, origem ou interesse…" />
                  </FormField>
                  <div className="leads-page__filter-meta leads-page__filter-meta--chips">
                    <span className="leads-filter-count">
                      {filteredTasks.length} lead{filteredTasks.length !== 1 ? "s" : ""}
                      {search ? ` encontrado${filteredTasks.length !== 1 ? "s" : ""}` : " no total"}
                    </span>
                    <span className="leads-filter-pipeline">
                      Pipeline: {formatMoneyCompact(filteredLeadMetrics.totalValue)}
                    </span>
                  </div>
                </div>
                <DataTable columns="minmax(240px, 1.35fr) minmax(180px, 1fr) minmax(170px, .9fr) minmax(120px, .7fr) minmax(135px, .78fr) minmax(180px, .92fr) minmax(126px, .68fr) minmax(104px, .58fr) minmax(260px, 1.4fr)" responsiveMinWidth="1320px" className="leads-page__table leads-page__table--leads">
                  <DataTableHeader>
                    <DataTableCell>Lead / Oportunidade</DataTableCell>
                    <DataTableCell>Cliente</DataTableCell>
                    <DataTableCell>Contato</DataTableCell>
                    <DataTableCell>Origem</DataTableCell>
                    <DataTableCell>Valor estimado</DataTableCell>
                    <DataTableCell>Status</DataTableCell>
                    <DataTableCell>Proposta</DataTableCell>
                    <DataTableCell>Contrato</DataTableCell>
                    <DataTableCell>Ações</DataTableCell>
                  </DataTableHeader>
                  <DataTableBody>
                    {filteredTasks.length === 0 ? (
                      <EmptyState>Nenhum WorkItem comercial encontrado.</EmptyState>
                    ) : (
                      filteredTasks.map((task) => {
                        const customer = customersById.get(getTextField(task, "customerId"));
                        const proposal = documentsById.get(getTextField(task, "proposalId"));
                        const contract = documentsById.get(getTextField(task, "contractId"));
                        const stageColor = boardStatuses.find((s) => s.id === task.status)?.dot;
                        const leadSubtitle = resolveCatalogLabel(getTextField(task, "interest")) || task.text || "Sem escopo informado";
                        return (
                          <DataTableRow key={task.id} className="leads-page__lead-row">
                            <DataTableCell>
                              <div className="leads-page__lead-cell">
                                <div className="leads-lead-avatar" style={{ borderColor: stageColor ?? "var(--leads-accent)" }}>
                                  <span>{getInitials(task.title)}</span>
                                </div>
                                <div className="leads-page__lead-main">
                                  <div className="leads-page__lead-title-row">
                                    <span className="leads-stage-dot" style={{ background: stageColor ?? "var(--leads-accent)" }} />
                                    <strong>{task.title}</strong>
                                  </div>
                                  <span>{leadSubtitle}</span>
                                </div>
                              </div>
                            </DataTableCell>
                            <DataTableCell>
                              <div className="leads-page__lead-main">
                                <Badge tone={customer ? "success" : "warning"}>
                                  {customer ? getCustomerDisplayName(customer) : "Sem cliente"}
                                </Badge>
                                {!customer && getTextField(task, "companyName") ? <span>{getTextField(task, "companyName")}</span> : null}
                              </div>
                            </DataTableCell>
                            <DataTableCell>
                              <div className="leads-page__lead-main">
                                {getTextField(task, "contactName") ? <strong>{getTextField(task, "contactName")}</strong> : null}
                                <span>{getTextField(task, "contactEmail") || "-"}</span>
                              </div>
                            </DataTableCell>
                            <DataTableCell>
                              {getTextField(task, "source") ? (
                                <Badge tone="default">{getTextField(task, "source")}</Badge>
                              ) : <span className="leads-muted">-</span>}
                            </DataTableCell>
                            <DataTableCell>
                              <strong className="leads-value-cell">{formatMoney(getNumberField(task, "estimatedValue"))}</strong>
                            </DataTableCell>
                            <DataTableCell>
                              <StatusBadge>{statusLabelById.get(task.status) ?? task.status}</StatusBadge>
                            </DataTableCell>
                            <DataTableCell>
                              <Badge tone={proposal ? (isApprovedProposal(proposal) ? "success" : "default") : "muted"}>
                                {proposal ? (isApprovedProposal(proposal) ? "Aprovada" : "Gerada") : "Sem proposta"}
                              </Badge>
                            </DataTableCell>
                            <DataTableCell>
                              <Badge tone={contract ? "success" : "muted"}>{contract ? "Gerado" : "-"}</Badge>
                            </DataTableCell>
                            <DataTableCell>
                              <div className="leads-page__row-actions leads-page__row-actions--lead">
                                {customer ? (
                                  <Button size="sm" variant="outline" onClick={() => { setSelectedCustomerId(customer.id); setModalMode("customer-detail"); }}>Cliente</Button>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => openCustomerFromLeadModal(task)}>Criar cliente</Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => openLinkCustomerModal(task)}>Vincular</Button>
                                {proposal || contract ? (
                                  <Button size="sm" variant="outline" onClick={() => workspaceSlug && navigate(buildWorkspaceDocumentationPath(workspaceSlug))}>Docs</Button>
                                ) : null}
                                <Button size="sm" className="leads-page__board-button" onClick={() => workspaceSlug && navigate(buildWorkspaceBoardPath(workspaceSlug))}>Board</Button>
                              </div>
                            </DataTableCell>
                          </DataTableRow>
                        );
                      })
                    )}
                  </DataTableBody>
                </DataTable>
              </section>
            ) : null}

            {/* ═══════════════════ CUSTOMERS TABLE ═══════════════════ */}
            {tab === "customers" ? (
              <>
                <div className="leads-page__filters leads-page__filters--bar">
                  <FormField label="Buscar clientes">
                    <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, documento, e-mail ou telefone…" />
                  </FormField>
                  <div className="leads-page__filter-meta">
                    <span className="leads-filter-count">{filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? "s" : ""}</span>
                    <span className="leads-filter-pipeline">{pipelineMetrics.activeCustomers} ativo{pipelineMetrics.activeCustomers !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <DataTable columns="1.3fr 0.8fr 1.1fr 0.8fr 0.65fr 0.65fr 0.65fr 0.8fr 1.1fr" responsiveMinWidth="1080px" className="leads-page__table">
                  <DataTableHeader>
                    <DataTableCell>Cliente</DataTableCell>
                    <DataTableCell>Documento</DataTableCell>
                    <DataTableCell>E-mail</DataTableCell>
                    <DataTableCell>Telefone</DataTableCell>
                    <DataTableCell>Status</DataTableCell>
                    <DataTableCell>Deals</DataTableCell>
                    <DataTableCell>Propostas</DataTableCell>
                    <DataTableCell>Última atividade</DataTableCell>
                    <DataTableCell>Ações</DataTableCell>
                  </DataTableHeader>
                  <DataTableBody>
                    {filteredCustomers.length === 0 ? (
                      <EmptyState>Nenhum cliente cadastrado.</EmptyState>
                    ) : (
                      filteredCustomers.map((customer) => {
                        const linkedTasks = commercialTasks.filter((t) => getTextField(t, "customerId") === customer.id);
                        const proposals = linkedTasks.filter((t) => getTextField(t, "proposalId")).length;
                        return (
                          <DataTableRow key={customer.id}>
                            <DataTableCell>
                              <div className="leads-page__customer-cell">
                                <div className="leads-customer-avatar">
                                  {customer.logoUrl ? <img src={customer.logoUrl} alt="" /> : <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>}
                                </div>
                                <div className="leads-page__lead-main">
                                  <strong>{getCustomerDisplayName(customer)}</strong>
                                  <span>{customer.legalName ?? customer.website ?? "Cadastro mestre"}</span>
                                </div>
                              </div>
                            </DataTableCell>
                            <DataTableCell><span className="leads-muted">{customer.document ?? "-"}</span></DataTableCell>
                            <DataTableCell>{customer.email ?? <span className="leads-muted">-</span>}</DataTableCell>
                            <DataTableCell>{customer.phone ?? <span className="leads-muted">-</span>}</DataTableCell>
                            <DataTableCell>
                              <span className={`leads-customer-status leads-customer-status--${customer.status}`}>{CUSTOMER_STATUS_LABELS[customer.status]}</span>
                            </DataTableCell>
                            <DataTableCell><strong>{linkedTasks.length}</strong></DataTableCell>
                            <DataTableCell><strong>{proposals}</strong></DataTableCell>
                            <DataTableCell><span className="leads-muted">{formatDate(customer.updatedAt)}</span></DataTableCell>
                            <DataTableCell>
                              <div className="leads-page__row-actions">
                                <Button size="sm" variant="outline" onClick={() => { setSelectedCustomerId(customer.id); setModalMode("customer-detail"); }}>Detalhes</Button>
                                <Button size="sm" onClick={() => openNewLeadModal(customer)}>Novo lead</Button>
                              </div>
                            </DataTableCell>
                          </DataTableRow>
                        );
                      })
                    )}
                  </DataTableBody>
                </DataTable>
              </>
            ) : null}

          </div>
        </div>
      </WorkspaceFrame>

      {/* ═══════════════════ MODALS ═══════════════════ */}
      {modalMode === "lead" ? (
        <ModalShell titleId="lead-form-modal" className="leads-page__modal" onClose={() => setModalMode(null)}>
          <CommercialModalHeader title="Novo lead comercial" onClose={() => setModalMode(null)} />
          <div className="leads-page__modal-content">
            <div className="leads-page__form-grid">
              <FormField label="Cliente vinculado">
                <Select value={leadForm.customerId} onChange={(e) => setLeadForm((c) => ({ ...c, customerId: e.target.value }))}>
                  <option value="">Sem cliente vinculado</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{getCustomerDisplayName(c)}</option>)}
                </Select>
              </FormField>
              <FormField label="Empresa">
                <TextInput value={leadForm.companyName} onChange={(e) => setLeadForm((c) => ({ ...c, companyName: e.target.value }))} />
              </FormField>
              <FormField label="Contato">
                <TextInput value={leadForm.contactName} onChange={(e) => setLeadForm((c) => ({ ...c, contactName: e.target.value }))} />
              </FormField>
            </div>
            <div className="leads-page__form-grid">
              <FormField label="E-mail">
                <TextInput value={leadForm.contactEmail} onChange={(e) => setLeadForm((c) => ({ ...c, contactEmail: e.target.value }))} />
              </FormField>
              <FormField label="Telefone">
                <TextInput value={leadForm.contactPhone} onChange={(e) => setLeadForm((c) => ({ ...c, contactPhone: e.target.value }))} />
              </FormField>
              <FormField label="Origem">
                <TextInput value={leadForm.source} onChange={(e) => setLeadForm((c) => ({ ...c, source: e.target.value }))} />
              </FormField>
            </div>
            <div className="leads-page__form-grid">
              <FormField label="Valor estimado (R$)">
                <TextInput value={leadForm.estimatedValue} onChange={(e) => setLeadForm((c) => ({ ...c, estimatedValue: e.target.value }))} placeholder="0,00" />
              </FormField>
              <FormField label="Validade da proposta">
                <TextInput type="date" value={leadForm.proposalValidity} onChange={(e) => setLeadForm((c) => ({ ...c, proposalValidity: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Interesse / escopo">
              <Select
                value={leadForm.interest}
                onChange={(e) => {
                  const catalogItem = catalogItemsById.get(e.target.value);
                  setLeadForm((current) => ({
                    ...current,
                    interest: e.target.value,
                    estimatedValue: current.estimatedValue || (catalogItem ? String(catalogItem.amount / 100) : ""),
                    proposalValidity: current.proposalValidity || catalogItem?.metadata?.proposalValidity || ""
                  }));
                }}
              >
                <option value="">Selecione um item do catalogo</option>
                {catalogItems.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Observações">
              <Textarea rows={3} value={leadForm.notes} onChange={(e) => setLeadForm((c) => ({ ...c, notes: e.target.value }))} />
            </FormField>
            <div className="leads-page__row-actions">
              <Button onClick={() => void runAction(async () => { await createLeadWorkItem(); setModalMode(null); setTab("leads"); }, "Lead criado como WorkItem comercial.")} disabled={isSubmitting}>
                Criar lead
              </Button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {(modalMode === "customer" || modalMode === "customer-from-lead") ? (
        <ModalShell titleId="customer-form-modal" className="leads-page__modal" onClose={() => setModalMode(null)}>
          <CommercialModalHeader title={modalMode === "customer-from-lead" ? "Criar cliente a partir do lead" : "Novo cliente"} onClose={() => setModalMode(null)} />
          <CustomerForm
            value={customerForm}
            duplicates={findPossibleDuplicates(customers, customerForm)}
            onChange={setCustomerForm}
            onLinkDuplicate={(customer) => {
              if (selectedTask) {
                void runAction(async () => { await linkTaskToCustomer(selectedTask, customer); setModalMode(null); }, "WorkItem vinculado ao cliente existente.");
              }
            }}
            onSubmit={() => void runAction(async () => { await createCustomerFromForm(); setModalMode(null); setTab("customers"); }, modalMode === "customer-from-lead" ? "Cliente criado e vinculado ao WorkItem." : "Cliente criado com sucesso.")}
            disabled={isSubmitting}
          />
        </ModalShell>
      ) : null}

      {modalMode === "link-customer" && selectedTask ? (
        <ModalShell titleId="link-customer-modal" className="leads-page__modal" onClose={() => setModalMode(null)}>
          <CommercialModalHeader title="Vincular cliente ao lead" onClose={() => setModalMode(null)} />
          <div className="leads-page__modal-content">
            <FormField label="Selecionar cliente">
              <Select value={linkCustomerId} onChange={(e) => setLinkCustomerId(e.target.value)}>
                <option value="">Remover vínculo</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{getCustomerDisplayName(c)}</option>)}
              </Select>
            </FormField>
            <div className="leads-page__row-actions">
              <Button onClick={() => void runAction(async () => {
                if (!linkCustomerId) {
                  const nextFields = { ...selectedTask.customFields, customerId: "" };
                  await updateTask(selectedTask.id, { fields: nextFields, customFieldValues: buildCommercialCustomFieldValues(nextFields) });
                } else {
                  const customer = customersById.get(linkCustomerId);
                  if (!customer) throw new Error("Cliente selecionado não encontrado.");
                  await linkTaskToCustomer(selectedTask, customer);
                }
                setModalMode(null);
              }, "Vínculo de cliente atualizado.")} disabled={isSubmitting}>Salvar</Button>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {modalMode === "customer-detail" && selectedCustomer ? (
        <ModalShell titleId="customer-detail-modal" className="leads-page__modal" onClose={() => setModalMode(null)}>
          <CommercialModalHeader title="Detalhes do cliente" onClose={() => setModalMode(null)} />
          <div className="leads-page__modal-content">
            <div className="leads-page__customer-detail">
              <div className="leads-customer-avatar leads-customer-avatar--lg">
                {selectedCustomer.logoUrl
                  ? <img src={selectedCustomer.logoUrl} alt="" />
                  : <span>{getCustomerDisplayName(selectedCustomer).slice(0, 2).toUpperCase()}</span>}
              </div>
              <div className="leads-customer-detail-info">
                <h3>{getCustomerDisplayName(selectedCustomer)}</h3>
                <span className={`leads-customer-status leads-customer-status--${selectedCustomer.status}`}>{CUSTOMER_STATUS_LABELS[selectedCustomer.status]}</span>
                {selectedCustomer.legalName ? <p>{selectedCustomer.legalName}</p> : null}
                {selectedCustomer.document ? <p>{selectedCustomer.document}</p> : null}
                {selectedCustomer.email || selectedCustomer.phone ? <p>{[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(" · ")}</p> : null}
                {formatCustomerAddress(selectedCustomer) ? <p>{formatCustomerAddress(selectedCustomer)}</p> : null}
              </div>
            </div>
            <h3 className="leads-modal-section-title">Deals vinculados</h3>
            <ul className="leads-page__timeline">
              {commercialTasks.filter((t) => getTextField(t, "customerId") === selectedCustomer.id).length === 0
                ? <li>Nenhum deal vinculado.</li>
                : commercialTasks.filter((t) => getTextField(t, "customerId") === selectedCustomer.id).map((task) => {
                    const value = getNumberField(task, "estimatedValue");
                    return (
                      <li key={task.id}>
                        <strong>{task.title}</strong>
                        <div className="leads-timeline-meta">
                          <span>{statusLabelById.get(task.status) ?? task.status}</span>
                          {value !== null && <span>{formatMoney(value)}</span>}
                        </div>
                        {getTextField(task, "interest") || task.text ? <p>{resolveCatalogLabel(getTextField(task, "interest")) || task.text}</p> : null}
                      </li>
                    );
                  })}
            </ul>
            <div className="leads-page__row-actions">
              <Button onClick={() => openNewLeadModal(selectedCustomer)}>Novo lead para este cliente</Button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </AppShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, icon }: {
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "green" | "purple" | "amber";
  icon: ReactNode;
}) {
  return (
    <div className={`leads-kpi-card leads-kpi-card--${accent}`}>
      <div className="leads-kpi-card__icon" aria-hidden="true">{icon}</div>
      <div className="leads-kpi-card__body">
        <span className="leads-kpi-card__label">{label}</span>
        <strong className="leads-kpi-card__value">{value}</strong>
        <span className="leads-kpi-card__sub">{sub}</span>
      </div>
    </div>
  );
}

function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "muted" }) {
  return <span className={`leads-page__badge leads-page__badge--${tone}`}>{children}</span>;
}

function CommercialModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="leads-page__modal-header">
      <h2>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Fechar">
        <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
          <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </header>
  );
}

function CustomerForm({ value, duplicates, disabled, onChange, onLinkDuplicate, onSubmit }: {
  value: CreateCustomerInput;
  duplicates: Customer[];
  disabled: boolean;
  onChange: (value: CreateCustomerInput) => void;
  onLinkDuplicate: (customer: Customer) => void;
  onSubmit: () => void;
}) {
  const updateAddress = (field: keyof NonNullable<CreateCustomerInput["address"]>, nextValue: string) => {
    onChange({ ...value, address: { ...(value.address ?? {}), [field]: nextValue } });
  };
  return (
    <div className="leads-page__modal-content">
      <div className="leads-page__form-grid">
        <FormField label="Nome *"><TextInput value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} /></FormField>
        <FormField label="Nome fantasia"><TextInput value={value.tradeName ?? ""} onChange={(e) => onChange({ ...value, tradeName: e.target.value })} /></FormField>
        <FormField label="Razão social"><TextInput value={value.legalName ?? ""} onChange={(e) => onChange({ ...value, legalName: e.target.value })} /></FormField>
      </div>
      <div className="leads-page__form-grid">
        <FormField label="CNPJ / CPF"><TextInput value={value.document ?? ""} onChange={(e) => onChange({ ...value, document: e.target.value })} /></FormField>
        <FormField label="E-mail"><TextInput value={value.email ?? ""} onChange={(e) => onChange({ ...value, email: e.target.value })} /></FormField>
        <FormField label="Telefone"><TextInput value={value.phone ?? ""} onChange={(e) => onChange({ ...value, phone: e.target.value })} /></FormField>
      </div>
      <div className="leads-page__form-grid">
        <FormField label="Website"><TextInput value={value.website ?? ""} onChange={(e) => onChange({ ...value, website: e.target.value })} /></FormField>
        <FormField label="Logo URL"><TextInput value={value.logoUrl ?? ""} onChange={(e) => onChange({ ...value, logoUrl: e.target.value })} /></FormField>
        <FormField label="Status">
          <Select value={value.status ?? "prospect"} onChange={(e) => onChange({ ...value, status: e.target.value as CustomerStatus })}>
            <option value="prospect">Prospect</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="archived">Arquivado</option>
          </Select>
        </FormField>
      </div>
      <div className="leads-page__form-grid">
        <FormField label="Endereço"><TextInput value={value.address?.street ?? ""} onChange={(e) => updateAddress("street", e.target.value)} /></FormField>
        <FormField label="Número"><TextInput value={value.address?.number ?? ""} onChange={(e) => updateAddress("number", e.target.value)} /></FormField>
        <FormField label="Complemento"><TextInput value={value.address?.complement ?? ""} onChange={(e) => updateAddress("complement", e.target.value)} /></FormField>
      </div>
      <div className="leads-page__form-grid">
        <FormField label="Cidade"><TextInput value={value.address?.city ?? ""} onChange={(e) => updateAddress("city", e.target.value)} /></FormField>
        <FormField label="Estado"><TextInput value={value.address?.state ?? ""} onChange={(e) => updateAddress("state", e.target.value)} /></FormField>
        <FormField label="CEP"><TextInput value={value.address?.zipCode ?? ""} onChange={(e) => updateAddress("zipCode", e.target.value)} /></FormField>
      </div>
      <FormField label="Observações"><Textarea rows={3} value={value.notes ?? ""} onChange={(e) => onChange({ ...value, notes: e.target.value })} /></FormField>
      {duplicates.length > 0 ? (
        <div className="leads-page__duplicates">
          <span className="leads-page__eyebrow">Possíveis duplicados — clique para vincular</span>
          {duplicates.slice(0, 4).map((customer) => (
            <button key={customer.id} type="button" className="leads-duplicate-btn" onClick={() => onLinkDuplicate(customer)}>
              <div className="leads-customer-avatar"><span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span></div>
              <div>
                <strong>{getCustomerDisplayName(customer)}</strong>
                <span>{customer.email ?? customer.phone ?? customer.document ?? "Cliente existente"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
      <div className="leads-page__row-actions">
        <Button onClick={onSubmit} disabled={disabled}>Salvar cliente</Button>
      </div>
    </div>
  );
}

// ── Icons (inline SVG, zero deps) ─────────────────────────────────────────────
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconTrendUp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
      <path d="M2 14l5-5 4 4 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
      <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M1 17c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 8c1.66 0 3 1.34 3 3 0 1.1-.6 2.06-1.5 2.57" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.5 17c0-1.58-.64-3-1.67-4.03" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
      <path d="M4 3h8l4 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3v4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

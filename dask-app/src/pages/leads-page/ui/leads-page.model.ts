import type {
  BoardLeadOperationalMetadata,
  Task,
  TaskCustomFieldValue,
  TaskFieldDefinition,
  TaskStatus
} from "@/entities/task";
import type { Customer, CustomerStatus, CreateCustomerInput, WorkspaceDocument } from "@/modules/workspace";

export type LeadsTab = "overview" | "leads" | "customers";
export type ModalMode = "lead" | "customer" | "customer-from-lead" | "link-customer" | "customer-detail";

export type LeadFormState = {
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

export const TABS: Array<{ id: LeadsTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads" },
  { id: "customers", label: "Clientes" }
];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  prospect: "Prospect",
  active: "Ativo",
  inactive: "Inativo",
  archived: "Arquivado"
};

export function emptyLeadForm(): LeadFormState {
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

export function emptyCustomerForm(): CreateCustomerInput {
  return {
    name: "",
    tradeName: "",
    legalName: "",
    document: "",
    stateRegistration: "",
    municipalRegistration: "",
    taxRegime: "",
    email: "",
    phone: "",
    website: "",
    logoUrl: "",
    status: "prospect",
    notes: ""
  };
}

export function getTextField(task: Task, fieldId: string): string {
  const value = task.customFields[fieldId];
  return typeof value === "string" ? value.trim() : "";
}

export function getNumberField(task: Task, fieldId: string): number | null {
  const value = task.customFields[fieldId];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildCustomFieldValuesBySlug(
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

export function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "L";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? "D"}`.toUpperCase();
}

export function formatCustomerAddress(customer: Customer | null | undefined): string {
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

export function buildCustomerInputFromLead(task: Task): CreateCustomerInput {
  const companyName = getTextField(task, "companyName");
  const clientName = getTextField(task, "clientName");
  const contactName = getTextField(task, "contactName");
  const name = clientName || companyName || contactName || task.title;
  return {
    name,
    tradeName: companyName || clientName || "",
    legalName: getTextField(task, "clientLegalName"),
    document: getTextField(task, "clientDocument"),
    email: getTextField(task, "contactEmail"),
    phone: getTextField(task, "contactPhone"),
    logoUrl: getTextField(task, "clientLogoUrl"),
    status: "prospect",
    notes: task.text
  };
}

export function findPossibleDuplicates(customers: Customer[], input: CreateCustomerInput): Customer[] {
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

export function isApprovedProposal(document: WorkspaceDocument | undefined): boolean {
  return document?.kind === "proposal" && document.metadata?.status === "approved";
}

export function isOpenBillingStatus(status: string): boolean {
  return Boolean(status) && !["paid", "subscription_active", "canceled", "refunded"].includes(status);
}

export function buildPipelineMetrics(
  commercialTasks: Task[],
  customers: Customer[],
  documents: WorkspaceDocument[],
  metadata: BoardLeadOperationalMetadata | null
) {
  const activeStatusIds = new Set(metadata?.activeStatusIds ?? []);
  const wonStatusIds = new Set(metadata?.wonStatusIds ?? []);
  const lostStatusIds = new Set(metadata?.lostStatusIds ?? []);
  const activeTasks = commercialTasks.filter((task) => activeStatusIds.has(task.status));
  const wonTasks = commercialTasks.filter((task) => wonStatusIds.has(task.status));
  const lostTasks = commercialTasks.filter((task) => lostStatusIds.has(task.status));
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
}

export type PipelineMetrics = ReturnType<typeof buildPipelineMetrics>;

export function buildFunnelData(commercialTasks: Task[], metadata: BoardLeadOperationalMetadata | null) {
  const stages = metadata?.funnel ?? [];
  const firstStageStatusIds = new Set(stages[0]?.statusIds ?? []);
  const firstCount = stages[0]
    ? commercialTasks.filter((task) => firstStageStatusIds.has(task.status)).length
    : 1;
  const maxCount = Math.max(1, firstCount);

  return stages.map((stage, i) => {
    const stageStatusIds = new Set(stage.statusIds);
    const previousStatusIds = new Set(stages[i - 1]?.statusIds ?? []);
    const tasks = commercialTasks.filter((task) => stageStatusIds.has(task.status));
    const prevTasks = i > 0
      ? commercialTasks.filter((task) => previousStatusIds.has(task.status))
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
}

export type FunnelData = ReturnType<typeof buildFunnelData>;

export function buildStatusDistribution(boardStatuses: TaskStatus[], commercialTasks: Task[]) {
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
}

export type StatusDistribution = ReturnType<typeof buildStatusDistribution>;

export function buildSourceBreakdown(commercialTasks: Task[]) {
  const counts: Record<string, { count: number; value: number }> = {};
  for (const task of commercialTasks) {
    const src = getTextField(task, "source").trim() || "Nao informada";
    if (!counts[src]) counts[src] = { count: 0, value: 0 };
    counts[src].count += 1;
    counts[src].value += getNumberField(task, "estimatedValue") ?? 0;
  }
  const max = Math.max(1, ...Object.values(counts).map((v) => v.count));
  return Object.entries(counts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([label, data]) => ({ label, ...data, barPct: Math.round((data.count / max) * 100) }));
}

export type SourceBreakdown = ReturnType<typeof buildSourceBreakdown>;

export function buildPendingItems(
  commercialTasks: Task[],
  documents: WorkspaceDocument[],
  metadata: BoardLeadOperationalMetadata | null
) {
  const proposalRequiredStatusIds = new Set(metadata?.proposalRequiredStatusIds ?? []);
  const withoutCustomer = commercialTasks.filter((t) => !getTextField(t, "customerId"));
  const withoutProposal = commercialTasks.filter((t) => !getTextField(t, "proposalId") &&
    proposalRequiredStatusIds.has(t.status));
  const draftProposals = documents.filter((d) => d.kind === "proposal" && d.metadata?.status === "draft");
  const sentProposals = documents.filter((d) => d.kind === "proposal" && d.metadata?.status === "sent");
  const contractDrafts = documents.filter((d) => d.kind === "contract" && d.metadata?.status === "draft");
  return [
    ...withoutCustomer.slice(0, 2).map((t) => ({ id: `nc-${t.id}`, label: t.title, detail: "Sem cliente vinculado", urgency: "high" as const })),
    ...withoutProposal.slice(0, 2).map((t) => ({ id: `np-${t.id}`, label: t.title, detail: "Oportunidade sem proposta", urgency: "medium" as const })),
    ...draftProposals.slice(0, 2).map((d) => ({ id: `dp-${d.id}`, label: d.title, detail: "Proposta em rascunho", urgency: "medium" as const })),
    ...sentProposals.slice(0, 2).map((d) => ({ id: `sp-${d.id}`, label: d.title, detail: "Aguardando resposta do cliente", urgency: "low" as const })),
    ...contractDrafts.slice(0, 2).map((d) => ({ id: `cd-${d.id}`, label: d.title, detail: "Contrato em preparacao", urgency: "medium" as const }))
  ].slice(0, 8);
}

export type PendingItems = ReturnType<typeof buildPendingItems>;

export function buildFilteredLeadMetrics(filteredTasks: Task[], metadata: BoardLeadOperationalMetadata | null) {
  const activeStatusIds = new Set(metadata?.activeStatusIds ?? []);
  const totalValue = filteredTasks.reduce((sum, task) => sum + (getNumberField(task, "estimatedValue") ?? 0), 0);
  const activeCount = filteredTasks.filter((task) => activeStatusIds.has(task.status)).length;
  const unlinkedCount = filteredTasks.filter((task) => !getTextField(task, "customerId")).length;
  const proposalCount = filteredTasks.filter((task) => getTextField(task, "proposalId")).length;
  const billingCount = filteredTasks.filter((task) => getTextField(task, "billingOrderId") || getTextField(task, "billingStatus")).length;
  const openValue = filteredTasks.reduce((sum, task) => {
    const billingStatus = getTextField(task, "billingStatus");
    const hasBillingOrder = Boolean(getTextField(task, "billingOrderId"));
    const isOpen = isOpenBillingStatus(billingStatus) || (hasBillingOrder && !billingStatus);
    return isOpen ? sum + (getNumberField(task, "estimatedValue") ?? 0) : sum;
  }, 0);
  const nextStepsCount = filteredTasks.filter((task) => {
    if (!getTextField(task, "customerId")) return true;
    if (!getTextField(task, "proposalId")) return true;
    if (!getTextField(task, "contractId")) return true;
    if (!getTextField(task, "billingOrderId") && !getTextField(task, "billingStatus")) return true;
    return false;
  }).length;

  return {
    totalValue,
    activeCount,
    unlinkedCount,
    proposalCount,
    billingCount,
    openValue,
    nextStepsCount,
    avgValue: filteredTasks.length > 0 ? totalValue / filteredTasks.length : 0
  };
}

export type FilteredLeadMetrics = ReturnType<typeof buildFilteredLeadMetrics>;

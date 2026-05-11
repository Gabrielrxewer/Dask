import type {
  FiscalDirection,
  FiscalDocumentType,
  FiscalReceivedType
} from "@/modules/fiscal/model/types";

export interface FiscalDashboardFilters {
  from?: string | null;
  to?: string | null;
}

export interface FiscalListFilters {
  companyId?: string;
  workspaceBusinessId?: string;
  documentType?: FiscalDocumentType;
  direction?: FiscalDirection;
  status?: string;
  issueFrom?: string | null;
  issueTo?: string | null;
  competenceFrom?: string | null;
  competenceTo?: string | null;
  customerId?: string;
  customerDocument?: string;
  providerRef?: string;
  source?: string;
  search?: string;
  pageSize?: number;
  cursor?: string | null;
}

export interface FiscalReceivedFilters {
  companyId?: string;
  workspaceBusinessId?: string;
  type?: FiscalReceivedType;
  status?: string;
  search?: string;
  from?: string | null;
  to?: string | null;
  pageSize?: number;
  cursor?: string | null;
}

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | "" | "ALL"> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) =>
      value !== undefined && value !== null && value !== "" && value !== "ALL"
    )
  ) as Record<string, TValue>;
}

export function normalizeFiscalDashboardFilters(filters?: FiscalDashboardFilters) {
  return cleanRecord<string>({
    from: filters?.from ?? undefined,
    to: filters?.to ?? undefined
  });
}

export function normalizeFiscalListFilters(filters?: FiscalListFilters) {
  return cleanRecord<string | number>({
    companyId: filters?.companyId,
    workspaceBusinessId: filters?.workspaceBusinessId,
    documentType: filters?.documentType,
    direction: filters?.direction,
    status: filters?.status,
    issueFrom: filters?.issueFrom ?? undefined,
    issueTo: filters?.issueTo ?? undefined,
    competenceFrom: filters?.competenceFrom ?? undefined,
    competenceTo: filters?.competenceTo ?? undefined,
    customerId: filters?.customerId,
    customerDocument: filters?.customerDocument?.replace(/\D/g, ""),
    providerRef: filters?.providerRef,
    source: filters?.source,
    search: filters?.search?.trim(),
    pageSize: filters?.pageSize,
    cursor: filters?.cursor ?? undefined
  });
}

export function normalizeFiscalReceivedFilters(filters?: FiscalReceivedFilters) {
  return cleanRecord<string | number>({
    companyId: filters?.companyId,
    workspaceBusinessId: filters?.workspaceBusinessId,
    type: filters?.type,
    status: filters?.status,
    search: filters?.search?.trim(),
    from: filters?.from ?? undefined,
    to: filters?.to ?? undefined,
    pageSize: filters?.pageSize,
    cursor: filters?.cursor ?? undefined
  });
}

export const fiscalQueryKeys = {
  all: ["fiscal"] as const,
  workspace: (workspaceId: string) => [...fiscalQueryKeys.all, workspaceId] as const,
  dashboard: (workspaceId: string, filters?: FiscalDashboardFilters) =>
    [...fiscalQueryKeys.workspace(workspaceId), "dashboard", normalizeFiscalDashboardFilters(filters)] as const,
  customers: (workspaceId: string) => [...fiscalQueryKeys.workspace(workspaceId), "customers"] as const,
  companies: (workspaceId: string, filters?: FiscalListFilters) =>
    [...fiscalQueryKeys.workspace(workspaceId), "companies", normalizeFiscalListFilters(filters)] as const,
  company: (workspaceId: string, companyId: string) =>
    [...fiscalQueryKeys.workspace(workspaceId), "companies", companyId] as const,
  documents: (workspaceId: string, filters?: FiscalListFilters) =>
    [...fiscalQueryKeys.workspace(workspaceId), "documents", normalizeFiscalListFilters(filters)] as const,
  document: (workspaceId: string, documentId: string) =>
    [...fiscalQueryKeys.workspace(workspaceId), "documents", documentId] as const,
  receivedDocuments: (workspaceId: string, filters?: FiscalReceivedFilters) =>
    [...fiscalQueryKeys.workspace(workspaceId), "received-documents", normalizeFiscalReceivedFilters(filters)] as const,
  drafts: (workspaceId: string, filters?: FiscalListFilters) =>
    [...fiscalQueryKeys.workspace(workspaceId), "drafts", normalizeFiscalListFilters(filters)] as const,
  syncRuns: (workspaceId: string, filters?: FiscalListFilters) =>
    [...fiscalQueryKeys.workspace(workspaceId), "sync-runs", normalizeFiscalListFilters(filters)] as const,
  profiles: (workspaceId: string) => [...fiscalQueryKeys.workspace(workspaceId), "profiles"] as const,
  operationTemplates: (workspaceId: string) =>
    [...fiscalQueryKeys.workspace(workspaceId), "operation-templates"] as const
};

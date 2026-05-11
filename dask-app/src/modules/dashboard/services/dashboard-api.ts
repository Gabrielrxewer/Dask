import { apiClient } from "@/shared/api/http-client";
import type { DashboardFilters, DashboardResponse } from "@/modules/dashboard/types";

type ApiWorkspaceSummary = {
  id: string;
  key: string;
  name: string;
};

type WorkspaceSummary = ApiWorkspaceSummary & {
  slug: string;
};

let workspaceCache: WorkspaceSummary[] = [];

function toWorkspaceSlug(workspace: Pick<ApiWorkspaceSummary, "key" | "name" | "id">): string {
  const preferred = workspace.key || workspace.name || workspace.id;
  return preferred
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const workspaces = await apiClient.get<ApiWorkspaceSummary[]>("/workspaces", {
    authMode: "required",
    retryOnUnauthorized: true
  });

  workspaceCache = workspaces.map((workspace) => ({
    ...workspace,
    slug: toWorkspaceSlug(workspace)
  }));

  return workspaceCache;
}

async function resolveWorkspaceId(workspaceSlug: string): Promise<string> {
  const normalizedSlug = workspaceSlug.trim().toLowerCase();

  if (workspaceCache.length === 0) {
    await listWorkspaces();
  }

  const cached = workspaceCache.find((workspace) => workspace.slug === normalizedSlug);
  if (cached) {
    return cached.id;
  }

  const refreshed = await listWorkspaces();
  const matched = refreshed.find((workspace) => workspace.slug === normalizedSlug);
  if (!matched) {
    throw new Error("Workspace not found for route slug.");
  }

  return matched.id;
}

function appendFilter(query: URLSearchParams, key: keyof DashboardFilters, value: string | undefined): void {
  if (value && value.trim().length > 0) {
    query.set(key, value);
  }
}

function buildDashboardQuery(filters: DashboardFilters): string {
  const query = new URLSearchParams();
  appendFilter(query, "from", filters.from);
  appendFilter(query, "to", filters.to);
  appendFilter(query, "assigneeId", filters.assigneeId);
  appendFilter(query, "itemTypeId", filters.itemTypeId);
  appendFilter(query, "stateId", filters.stateId);
  appendFilter(query, "columnId", filters.columnId);
  appendFilter(query, "workflowId", filters.workflowId);
  appendFilter(query, "status", filters.status);

  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

async function fetchDashboard(
  workspaceSlug: string,
  scope: "overview" | "crm" | "automation" | "widgets",
  filters: DashboardFilters,
  signal?: AbortSignal
): Promise<DashboardResponse> {
  const workspaceId = await resolveWorkspaceId(workspaceSlug);
  return apiClient.get<DashboardResponse>(`/workspaces/${workspaceId}/dashboard/${scope}${buildDashboardQuery(filters)}`, {
    authMode: "required",
    retryOnUnauthorized: true,
    signal
  });
}

export const dashboardApi = {
  fetchOverview(workspaceSlug: string, filters: DashboardFilters, signal?: AbortSignal) {
    return fetchDashboard(workspaceSlug, "overview", filters, signal);
  },
  fetchCrm(workspaceSlug: string, filters: DashboardFilters, signal?: AbortSignal) {
    return fetchDashboard(workspaceSlug, "crm", filters, signal);
  },
  fetchAutomation(workspaceSlug: string, filters: DashboardFilters, signal?: AbortSignal) {
    return fetchDashboard(workspaceSlug, "automation", filters, signal);
  },
  fetchWidgets(workspaceSlug: string, filters: DashboardFilters, signal?: AbortSignal) {
    return fetchDashboard(workspaceSlug, "widgets", filters, signal);
  }
};

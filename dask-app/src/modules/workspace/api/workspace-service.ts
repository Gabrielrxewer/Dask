import { apiClient } from "@/shared/api/http-client";
import { isApiError } from "@/shared/api/http-client";
import { CARD_FIELDS_SCHEMA_VERSION } from "@/entities/task";
import type {
  AiAgentSummary,
  AiObservability,
  AiRunSummary,
  ApiBoardColumn,
  ApiCustomField,
  ApiItemType,
  ApiWorkflowState,
  AutomationExecution,
  AutomationRule,
  CreateAiAgentInput,
  CreateAutomationRuleInput,
  CreateBoardColumnInput,
  CreateCustomFieldInput,
  CreateItemTypeInput,
  UpdateBoardColumnInput,
  UpdateCustomFieldInput,
  UpdateItemTypeInput,
  TaskScheduleInput,
  WorkspacePreferences,
  WorkspaceProfile,
  WorkspaceInvite,
  PublicWorkspaceInvite,
  WorkspacePermissionKey,
  WorkspaceAccessControlSnapshot,
  WorkspaceService,
  WorkspaceSnapshot,
  WorkspaceSummary,
  WorkspaceTemplateKey,
  WorkspaceTemplateOption
} from "@/modules/workspace/model/types";

type ApiWorkspaceSummary = {
  id: string;
  organizationId: string | null;
  kind: WorkspaceSummary["kind"];
  name: string;
  key: string;
  role: WorkspaceSummary["role"];
};

function toWorkspaceSlug(workspace: Pick<ApiWorkspaceSummary, "key" | "name" | "id">): string {
  const preferred = workspace.key || workspace.name || workspace.id;
  return preferred
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeWorkspaceKey(value: string): string {
  const base = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);

  const fallback = base.length >= 2 ? base : "MYWORKSPACE";
  const suffix = Date.now().toString().slice(-4);
  return `${fallback.slice(0, 16)}${suffix}`.slice(0, 20);
}

let workspaceCache: WorkspaceSummary[] = [];
const snapshotByWorkspaceSlug = new Map<string, WorkspaceSnapshot>();
const fallbackTemplates: WorkspaceTemplateOption[] = [
  { key: "software_delivery", name: "Software Delivery", description: "Template padrao" },
  { key: "product_discovery", name: "Product Discovery", description: "Template de descoberta" },
  { key: "operations_kanban", name: "Operations Kanban", description: "Template operacional" }
];

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

  const matched = workspaceCache.find((workspace) => workspace.slug === normalizedSlug);
  if (matched) {
    return matched.id;
  }

  const refreshed = await listWorkspaces();
  const refreshedMatched = refreshed.find((workspace) => workspace.slug === normalizedSlug);
  if (!refreshedMatched) {
    throw new Error("Workspace not found for route slug.");
  }

  return refreshedMatched.id;
}

async function fetchSnapshot(workspaceSlug: string): Promise<WorkspaceSnapshot> {
  const workspaceId = await resolveWorkspaceId(workspaceSlug);
  const snapshot = await apiClient.get<WorkspaceSnapshot>(`/workspaces/${workspaceId}/snapshot`, {
    authMode: "required",
    retryOnUnauthorized: true
  });

  snapshotByWorkspaceSlug.set(workspaceSlug, snapshot);
  return snapshot;
}

function getCachedTask(workspaceSlug: string, taskId: string) {
  const snapshot = snapshotByWorkspaceSlug.get(workspaceSlug);
  return snapshot?.tasks.find((task) => task.id === taskId) ?? null;
}

async function patchWorkItem(
  workspaceSlug: string,
  taskId: string,
  payload: Record<string, unknown>
): Promise<WorkspaceSnapshot> {
  const workspaceId = await resolveWorkspaceId(workspaceSlug);
  await apiClient.patch(`/workspaces/${workspaceId}/work-items/${taskId}`, payload, {
    authMode: "required",
    retryOnUnauthorized: true
  });

  return fetchSnapshot(workspaceSlug);
}

export const workspaceService: WorkspaceService = {
  listWorkspaces,

  async listWorkspaceTemplates() {
    try {
      return await apiClient.get<WorkspaceTemplateOption[]>("/workspaces/templates-catalog", {
        authMode: "required",
        retryOnUnauthorized: true
      });
    } catch (error) {
      if (isApiError(error) && (error.status === 404 || error.status === 405)) {
        return fallbackTemplates;
      }

      throw error;
    }
  },

  async provisionWorkspace(input) {
    try {
      await apiClient.post("/workspaces/provision", input, {
        authMode: "required",
        retryOnUnauthorized: true
      });
    } catch (error) {
      if (!isApiError(error) || (error.status !== 404 && error.status !== 405)) {
        throw error;
      }

      let organizationId: string | undefined;
      if (input.kind === "CORPORATE") {
        const organization = await apiClient.post<{ id: string }>(
          "/organizations",
          {
            name: input.organizationName ?? `${input.workspaceName} Organization`,
            slug:
              input.organizationSlug ??
              input.workspaceName
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
          },
          {
            authMode: "required",
            retryOnUnauthorized: true
          }
        );
        organizationId = organization.id;
      }

      await apiClient.post(
        "/workspaces",
        {
          kind: input.kind,
          organizationId,
          name: input.workspaceName,
          key: input.workspaceKey ?? makeWorkspaceKey(input.workspaceName),
          templateKey: input.templateKey
        },
        {
          authMode: "required",
          retryOnUnauthorized: true
        }
      );
    }

    const workspaces = await listWorkspaces();
    const created = workspaces.find((workspace) => workspace.name === input.workspaceName) ?? workspaces[0];

    if (!created) {
      throw new Error("Workspace was provisioned but could not be resolved in list.");
    }

    return created;
  },

  async createPersonalWorkspace(input) {
    const workspaceName = (input?.workspaceName ?? "Meu Workspace").trim() || "Meu Workspace";

    return workspaceService.provisionWorkspace({
      kind: "PERSONAL",
      workspaceName,
      workspaceKey: makeWorkspaceKey(workspaceName),
      templateKey: "software_delivery"
    });
  },

  async getSnapshot(workspaceSlug) {
    return fetchSnapshot(workspaceSlug);
  },

  async createTask(workspaceSlug, input) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/work-items`, {
      title: input.title,
      description: input.description,
      typeSlug: input.type,
      metadata: { priority: input.priority }
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async moveTask(workspaceSlug, taskId, nextStatus) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/work-items/${taskId}`, {
      stateSlug: nextStatus
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async moveTaskToColumn(workspaceSlug, taskId, columnId, stateId) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/work-items/${taskId}/move`, {
      columnId,
      ...(stateId ? { stateId } : {})
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async updateTaskPriority(workspaceSlug, taskId, priority) {
    return patchWorkItem(workspaceSlug, taskId, {
      metadata: { priority }
    });
  },

  async updateTaskTitle(workspaceSlug, taskId, title) {
    return patchWorkItem(workspaceSlug, taskId, {
      title
    });
  },

  async updateTaskDescription(workspaceSlug, taskId, description) {
    return patchWorkItem(workspaceSlug, taskId, {
      description
    });
  },

  async updateTaskCustomField(workspaceSlug, taskId, fieldId, value) {
    const current = getCachedTask(workspaceSlug, taskId);
    const nextFields = {
      ...(current?.customFields ?? {}),
      [fieldId]: value
    };

    return patchWorkItem(workspaceSlug, taskId, {
      fields: nextFields
    });
  },

  async updateTaskSchedule(workspaceSlug: string, taskId: string, input: TaskScheduleInput) {
    const current = getCachedTask(workspaceSlug, taskId);
    const nextFields = {
      ...(current?.customFields ?? {}),
      plannedStartAt: input.plannedStartAt ?? null,
      plannedEndAt: input.plannedEndAt ?? null
    };

    return patchWorkItem(workspaceSlug, taskId, {
      fields: nextFields
    });
  },

  async toggleChecklistItem(workspaceSlug, taskId, itemId) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const current = getCachedTask(workspaceSlug, taskId);
    const nextChecklist = {
      items: (current?.checklist.items ?? []).map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      )
    };

    await apiClient.patch(`/workspaces/${workspaceId}/work-items/${taskId}`, {
      checklist: nextChecklist
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async setAutomationStatus(workspaceSlug, automationId, status) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/automation/workspaces/${workspaceId}/rules/${automationId}`, {
      enabled: status === "active"
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async updatePreferences(workspaceSlug, patch) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const preferences = await apiClient.patch<WorkspacePreferences>(`/workspaces/${workspaceId}/preferences`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    const snapshot = await fetchSnapshot(workspaceSlug);
    return {
      ...snapshot,
      preferences
    };
  },

  async resetWorkspaceTemplate(workspaceSlug: string, templateKey?: WorkspaceTemplateKey) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(
      `/workspaces/${workspaceId}/reset-template`,
      templateKey ? { templateKey } : {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );

    return fetchSnapshot(workspaceSlug);
  },

  // ─── Board Config — Fetch com UUIDs reais ────────────────────────────────

  async fetchBoardColumns(workspaceSlug: string): Promise<ApiBoardColumn[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<ApiBoardColumn[]>(`/workspaces/${workspaceId}/board-columns`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async fetchWorkflowStates(workspaceSlug: string): Promise<ApiWorkflowState[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<ApiWorkflowState[]>(`/workspaces/${workspaceId}/workflow-states`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async fetchItemTypes(workspaceSlug: string): Promise<ApiItemType[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<ApiItemType[]>(`/workspaces/${workspaceId}/item-types`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async fetchCustomFields(workspaceSlug: string): Promise<ApiCustomField[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<ApiCustomField[]>(`/workspaces/${workspaceId}/custom-fields`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  // ─── Board Config ─────────────────────────────────────────────────────────

  async createBoardColumn(workspaceSlug: string, input: CreateBoardColumnInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/board-columns`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async updateBoardColumn(workspaceSlug: string, columnId: string, input: UpdateBoardColumnInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/board-columns/${columnId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async deleteBoardColumn(workspaceSlug: string, columnId: string) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/board-columns/${columnId}`, { isActive: false }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async createItemType(workspaceSlug: string, input: CreateItemTypeInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/item-types`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async updateItemType(workspaceSlug: string, typeId: string, input: UpdateItemTypeInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/item-types/${typeId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async deleteItemType(workspaceSlug: string, typeId: string) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/item-types/${typeId}`, { isActive: false }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async createCustomField(workspaceSlug: string, input: CreateCustomFieldInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/custom-fields`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async updateCustomField(workspaceSlug: string, fieldId: string, input: UpdateCustomFieldInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/custom-fields/${fieldId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async deleteCustomField(workspaceSlug: string, fieldId: string) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/custom-fields/${fieldId}`, { isActive: false }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async listAutomationRules(workspaceSlug: string, options?: { includeDisabled?: boolean }): Promise<AutomationRule[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const qs = options?.includeDisabled ? "?includeDisabled=true" : "";
    return apiClient.get<AutomationRule[]>(`/automation/workspaces/${workspaceId}/rules${qs}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listAutomationExecutions(workspaceSlug: string, options?: { limit?: number }): Promise<AutomationExecution[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const qs = typeof options?.limit === "number" ? `?limit=${options.limit}` : "";
    return apiClient.get<AutomationExecution[]>(`/automation/workspaces/${workspaceId}/executions${qs}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async runAutomationRule(workspaceSlug: string, ruleId: string, context?: Record<string, unknown>): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/automation/rules/${ruleId}/run`, {
      workspaceId,
      context: context ?? {}
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createAutomationRule(workspaceSlug: string, input: CreateAutomationRuleInput): Promise<AutomationRule> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationRule>("/automation/rules", {
      workspaceId,
      ...input
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listAiAgents(workspaceSlug: string): Promise<AiAgentSummary[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AiAgentSummary[]>(`/ai/workspaces/${workspaceId}/agents`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listAiRuns(
    workspaceSlug: string,
    input?: { itemId?: string; limit?: number }
  ): Promise<AiRunSummary[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (input?.itemId) {
      query.set("itemId", input.itemId);
    }
    if (typeof input?.limit === "number") {
      query.set("limit", String(input.limit));
    }
    const qs = query.toString();
    return apiClient.get<AiRunSummary[]>(
      `/ai/workspaces/${workspaceId}/runs${qs.length > 0 ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getAiObservability(workspaceSlug: string): Promise<AiObservability> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AiObservability>(`/ai/workspaces/${workspaceId}/observability`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createAiAgent(workspaceSlug: string, input: CreateAiAgentInput): Promise<{ id: string }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<{ id: string }>(`/ai/workspaces/${workspaceId}/agents`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateAiAgent(
    workspaceSlug: string,
    agentId: string,
    patch: Partial<CreateAiAgentInput> & { description?: string | null }
  ): Promise<{ id: string }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<{ id: string }>(`/ai/workspaces/${workspaceId}/agents/${agentId}`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async runAiAgentOnItem(
    workspaceSlug: string,
    itemId: string,
    agentId: string,
    input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
  ): Promise<{ runId: string; content: string }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<{ runId: string; content: string }>(
      `/ai/workspaces/${workspaceId}/items/${itemId}/agents/${agentId}/run`,
      {
        instruction: input.instruction,
        includeSemanticContext: input.includeSemanticContext ?? true,
        topKContextDocs: input.topKContextDocs ?? 5
      },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async runAiRiskAnalysis(
    workspaceSlug: string,
    itemId: string,
    input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
  ): Promise<{ runId: string; content: string }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<{ runId: string; content: string }>(
      `/ai/workspaces/${workspaceId}/items/${itemId}/risk-analysis`,
      {
        includeSemanticContext: input?.includeSemanticContext ?? true,
        topKContextDocs: input?.topKContextDocs ?? 5
      },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getAccessControl(workspaceSlug: string): Promise<WorkspaceAccessControlSnapshot> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkspaceAccessControlSnapshot>(`/workspaces/${workspaceId}/access-control`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listWorkspaceInvites(workspaceSlug: string): Promise<WorkspaceInvite[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createWorkspaceInvite(
    workspaceSlug: string,
    input: { email: string; role: "ADMIN" | "MEMBER" | "VIEWER" }
  ): Promise<WorkspaceInvite> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkspaceInvite>(`/workspaces/${workspaceId}/invites`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async resendWorkspaceInvite(workspaceSlug: string, inviteId: string): Promise<WorkspaceInvite> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkspaceInvite>(`/workspaces/${workspaceId}/invites/${inviteId}/resend`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async revokeWorkspaceInvite(workspaceSlug: string, inviteId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/invites/${inviteId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async getWorkspaceInviteByToken(token: string): Promise<PublicWorkspaceInvite> {
    return apiClient.get<PublicWorkspaceInvite>(`/auth/workspace-invite/${encodeURIComponent(token)}`, {
      authMode: "none",
      retryOnUnauthorized: false
    });
  },

  async getWorkspaceProfile(workspaceSlug: string): Promise<WorkspaceProfile> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkspaceProfile>(`/workspaces/${workspaceId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateWorkspaceProfile(
    workspaceSlug: string,
    patch: {
      name?: string;
      key?: string;
      info?: { description?: string; company?: string; website?: string };
    }
  ): Promise<WorkspaceProfile> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<WorkspaceProfile>(`/workspaces/${workspaceId}`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateMemberAccessControl(
    workspaceSlug: string,
    memberUserId: string,
    patch: {
      role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
      permissions?: { allow?: WorkspacePermissionKey[]; deny?: WorkspacePermissionKey[] };
    }
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/members/${memberUserId}/access-control`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async setCardFieldVisibility(workspaceSlug, fieldId, visible) {
    const snapshot = snapshotByWorkspaceSlug.get(workspaceSlug) ?? (await fetchSnapshot(workspaceSlug));
    const visibleFields = new Set(snapshot.preferences.visibleCardFieldIds ?? []);

    if (visible) {
      visibleFields.add(fieldId);
    } else {
      visibleFields.delete(fieldId);
    }

    return workspaceService.updatePreferences(workspaceSlug, {
      visibleCardFieldIds: Array.from(visibleFields),
      settings: {
        cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION
      }
    });
  },

  async setTypeFieldVisibility(workspaceSlug: string, typeId: string, fieldId: string, visible: boolean) {
    const snapshot = snapshotByWorkspaceSlug.get(workspaceSlug) ?? (await fetchSnapshot(workspaceSlug));
    const byType: Record<string, string[]> = {
      ...(snapshot.preferences.visibleFieldsByType ?? {})
    };
    const currentIds = new Set<string>(byType[typeId] ?? []);

    if (visible) {
      currentIds.add(fieldId);
    } else {
      currentIds.delete(fieldId);
    }

    byType[typeId] = Array.from(currentIds);

    return workspaceService.updatePreferences(workspaceSlug, {
      visibleFieldsByType: byType,
      settings: {
        cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION
      }
    });
  },

  async setTypeDetailFieldVisibility(workspaceSlug: string, typeId: string, fieldId: string, visible: boolean) {
    const snapshot = snapshotByWorkspaceSlug.get(workspaceSlug) ?? (await fetchSnapshot(workspaceSlug));
    const byType: Record<string, string[]> = {
      ...(snapshot.preferences.detailVisibleFieldsByType ?? {})
    };
    const currentIds = new Set<string>(byType[typeId] ?? []);

    if (visible) {
      currentIds.add(fieldId);
    } else {
      currentIds.delete(fieldId);
    }

    byType[typeId] = Array.from(currentIds);

    return workspaceService.updatePreferences(workspaceSlug, {
      detailVisibleFieldsByType: byType,
      settings: {
        cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION
      }
    });
  }
};

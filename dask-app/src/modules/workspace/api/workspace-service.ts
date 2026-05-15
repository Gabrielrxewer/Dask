import { apiClient } from "@/shared/api/http-client";
import { CARD_FIELDS_SCHEMA_VERSION } from "@/entities/task";
import type { Task } from "@/entities/task";
import type {
  AiCapabilities,
  AiAgentSummary,
  AiObservability,
  AiRunSummary,
  AiAgentRuntimePublishResult,
  AiAgentRuntimeValidationResult,
  ApiBoardColumn,
  ApiCustomField,
  ApiItemType,
  ApiWorkflowState,
  AutomationView,
  AutomationApprovalDetail,
  AutomationApprovalRecord,
  AutomationApprovalSummary,
  AutomationRunDetail,
  AutomationRunListItem,
  AutomationSideEffectSummary,
  AutomationWorkflow,
  AutomationWorkflowStatus,
  AutomationWorkflowVersion,
  AutomationWorkflowVersionStatus,
  AutomationCapabilities,
  CommunicationConversationDetail,
  CommunicationConversationSummary,
  CommunicationMessageSummary,
  CommunicationTemplate,
  CommunicationTemplateVersion,
  CreateCustomerInput,
  CreateAiAgentInput,
  CreateWhatsAppTemplateInput,
  DocumentAssetType,
  RunDocumentationAssistantInput,
  RunDocumentationAssistantResult,
  RunAiAgentRuntimeInput,
  RunAiAgentRuntimeResult,
  RunAutomationWorkflowInput,
  RunAutomationWorkflowResult,
  SaveAutomationWorkflowVersionInput,
  CreateAutomationWorkflowInput,
  CreateBoardColumnInput,
  BulkUpdateWorkItemsInput,
  BulkUpdateWorkItemsResult,
  ListCommunicationInboxOptions,
  CreateCustomFieldInput,
  CreateWorkflowStateInput,
  CreateItemTypeInput,
  ListWorkItemsInput,
  UpdateBoardColumnInput,
  UpdateAutomationWorkflowInput,
  UpdateCommunicationTemplateVersionInput,
  UpdateCustomFieldInput,
  UpdateWorkflowStateInput,
  UpdateItemTypeInput,
  WorkItemFieldBindingInput,
  TaskScheduleInput,
  UpdateTaskInput,
  WorkspaceDocument,
  WorkspaceDocumentAsset,
  WorkspaceDocumentFilters,
  WorkspaceDocumentFolder,
  WorkspaceDocumentsPage,
  WhatsAppConsent,
  WhatsAppIntegration,
  UpsertWhatsAppIntegrationInput,
  Customer,
  CustomerStatus,
  CustomersPage,
  WorkItemTypeTransformationPayload,
  WorkItemTypeTransformationSummary,
  WorkItemTypeTransformationValidation,
  WorkItemLinkedDocument,
  WorkItemsPage,
  WorkspaceAuditEvent,
  WorkspacePreferences,
  WorkspaceProfile,
  BoardTemplateSummary,
  WorkspaceInvite,
  PublicWorkspaceInvite,
  WorkspaceModuleKey,
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

type ApiTagDefinition = {
  id: string;
  name: string;
  slug: string;
  color: string;
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

function buildWorkItemsQuery(input?: ListWorkItemsInput): string {
  const params = new URLSearchParams();
  params.set("paged", "true");

  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      if (key === "customFieldFilters") {
        params.set(key, JSON.stringify(value));
        continue;
      }
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
      continue;
    }
    params.set(key, String(value));
  }

  return params.toString();
}

function buildWorkspaceDocumentsQuery(input?: WorkspaceDocumentFilters & { paged?: boolean }): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(key, value.join(","));
      }
      continue;
    }
    params.set(key, String(value));
  }

  return params.toString();
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
    return apiClient.get<WorkspaceTemplateOption[]>("/workspaces/templates-catalog", {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listBoardTemplates(workspaceSlug: string): Promise<BoardTemplateSummary[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<BoardTemplateSummary[]>(`/workspaces/${workspaceId}/templates`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createBoardTemplate(
    workspaceSlug: string,
    input: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      rules?: Record<string, unknown>;
    }
  ): Promise<BoardTemplateSummary> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<BoardTemplateSummary>(`/workspaces/${workspaceId}/templates`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async deleteWorkspace(workspaceSlug: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    workspaceCache = workspaceCache.filter((workspace) => workspace.id !== workspaceId);

    for (const [slug, snapshot] of snapshotByWorkspaceSlug.entries()) {
      if (snapshot.id === workspaceId || slug === workspaceSlug) {
        snapshotByWorkspaceSlug.delete(slug);
      }
    }
  },

  async provisionWorkspace(input) {
    await apiClient.post("/workspaces/provision", input, {
      authMode: "required",
      retryOnUnauthorized: true
    });

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

  async listWorkItemsPage(workspaceSlug: string, input?: ListWorkItemsInput): Promise<WorkItemsPage> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = buildWorkItemsQuery(input);
    return apiClient.get<WorkItemsPage>(`/workspaces/${workspaceId}/work-items?${query}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async bulkUpdateWorkItems(workspaceSlug: string, input: BulkUpdateWorkItemsInput): Promise<BulkUpdateWorkItemsResult> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<BulkUpdateWorkItemsResult>(`/workspaces/${workspaceId}/work-items/bulk-update`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listCustomersPage(
    workspaceSlug: string,
    input?: { search?: string; status?: CustomerStatus; limit?: number; cursor?: string | null }
  ): Promise<CustomersPage> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    query.set("paged", "true");
    if (input?.search) query.set("search", input.search);
    if (input?.status) query.set("status", input.status);
    if (input?.limit) query.set("limit", String(input.limit));
    if (input?.cursor) query.set("cursor", input.cursor);
    return apiClient.get<CustomersPage>(`/workspaces/${workspaceId}/customers?${query.toString()}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listWorkItemTypeTransformations(workspaceSlug: string): Promise<WorkItemTypeTransformationSummary[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkItemTypeTransformationSummary[]>(
      `/workspaces/${workspaceId}/work-item-type-transformations`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async validateWorkItemTypeTransformation(
    workspaceSlug: string,
    taskId: string,
    input: WorkItemTypeTransformationPayload
  ): Promise<WorkItemTypeTransformationValidation> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkItemTypeTransformationValidation>(
      `/workspaces/${workspaceId}/work-items/${taskId}/type-transformation/validate`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async transformWorkItemType(
    workspaceSlug: string,
    taskId: string,
    input: WorkItemTypeTransformationPayload
  ): Promise<Task> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const task = await apiClient.post<Task>(
      `/workspaces/${workspaceId}/work-items/${taskId}/type-transformation`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
    snapshotByWorkspaceSlug.delete(workspaceSlug);
    return task;
  },

  async convertWorkItemToCustomer(
    workspaceSlug: string,
    taskId: string,
    input: {
      customerId?: string;
      customer?: CreateCustomerInput;
      fields?: Record<string, unknown>;
      customFieldValues?: Record<string, unknown>;
    }
  ): Promise<Customer> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const customer = await apiClient.post<Customer>(
      `/workspaces/${workspaceId}/work-items/${taskId}/convert-to-customer`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
    snapshotByWorkspaceSlug.delete(workspaceSlug);
    return customer;
  },

  async listWorkspaceAuditLog(workspaceSlug: string, input?: { limit?: number }): Promise<WorkspaceAuditEvent[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const params = new URLSearchParams();
    if (input?.limit) {
      params.set("limit", String(input.limit));
    }
    const query = params.toString();
    return apiClient.get<WorkspaceAuditEvent[]>(`/audit/workspaces/${workspaceId}/events${query ? `?${query}` : ""}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createTask(workspaceSlug, input) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/work-items`, {
      title: input.title,
      description: input.description,
      typeSlug: input.type,
      ...(input.columnId ? { columnId: input.columnId } : {}),
      ...(input.stateId ? { stateId: input.stateId } : {}),
      ...(input.statusId && !input.stateId ? { stateSlug: input.statusId } : {}),
      ...(typeof input.position === "number" ? { position: input.position } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
      ...(input.checklist !== undefined ? { checklist: input.checklist } : {}),
      ...(input.fields !== undefined ? { fields: input.fields } : {}),
      ...(input.customFieldValues !== undefined ? { customFieldValues: input.customFieldValues } : {}),
      metadata: { priority: input.priority }
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async deleteTask(workspaceSlug, taskId) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/work-items/${taskId}`, {
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

  async moveTaskToColumn(workspaceSlug, taskId, columnId, stateId, position) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/work-items/${taskId}/move`, {
      columnId,
      ...(stateId ? { stateId } : {}),
      ...(typeof position === "number" ? { position } : {})
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
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/work-items/${taskId}/schedule`, {
      ...(input.plannedStartAt !== undefined ? { plannedStartAt: input.plannedStartAt } : {}),
      ...(input.plannedEndAt !== undefined ? { plannedEndAt: input.plannedEndAt } : {}),
      ...(input.reason ? { reason: input.reason } : {})
    }, {
      authMode: "required",
      retryOnUnauthorized: true
    });

    return fetchSnapshot(workspaceSlug);
  },

  async updateTask(workspaceSlug: string, taskId: string, input: UpdateTaskInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const payload: Record<string, unknown> = {};
    let hasTagChanges = false;

    if (input.title !== undefined) {
      payload.title = input.title;
    }

    if (input.description !== undefined) {
      payload.description = input.description;
    }

    if (input.stateId !== undefined) {
      payload.stateSlug = input.stateId;
    }

    if (input.typeSlug !== undefined) {
      payload.typeSlug = input.typeSlug;
    }

    if (input.assigneeId !== undefined) {
      payload.assigneeId = input.assigneeId;
    }

    if (input.dueDate !== undefined) {
      payload.dueDate = input.dueDate;
    }

    if (input.priority !== undefined) {
      payload.metadata = { priority: input.priority };
    }

    if (input.checklist !== undefined) {
      payload.checklist = input.checklist;
    }

    if (input.fields !== undefined) {
      payload.fields = input.fields;
    }

    if (input.customFieldValues !== undefined) {
      payload.customFieldValues = input.customFieldValues;
    }

    if (input.tags !== undefined) {
      const current = getCachedTask(workspaceSlug, taskId);
      const currentTagNames = new Set((current?.tags ?? []).map(name => name.trim()).filter(Boolean));
      const nextTagNames = new Set(input.tags.map(name => name.trim()).filter(Boolean));

      const [workspaceTags] = await Promise.all([
        apiClient.get<ApiTagDefinition[]>(`/workspaces/${workspaceId}/tags`, {
          authMode: "required",
          retryOnUnauthorized: true
        })
      ]);

      const tagIdByName = new Map(workspaceTags.map(tag => [tag.name, tag.id]));
      const currentTagIds = Array.from(currentTagNames)
        .map(name => tagIdByName.get(name))
        .filter((tagId): tagId is string => Boolean(tagId));
      const nextTagIds = Array.from(nextTagNames)
        .map(name => tagIdByName.get(name))
        .filter((tagId): tagId is string => Boolean(tagId));

      const currentTagIdSet = new Set(currentTagIds);
      const nextTagIdSet = new Set(nextTagIds);
      const tagIdsToAdd = nextTagIds.filter(tagId => !currentTagIdSet.has(tagId));
      const tagIdsToRemove = currentTagIds.filter(tagId => !nextTagIdSet.has(tagId));

      if (tagIdsToAdd.length > 0 || tagIdsToRemove.length > 0) {
        hasTagChanges = true;
      }

      await Promise.all([
        ...tagIdsToAdd.map(tagId =>
          apiClient.post(`/workspaces/${workspaceId}/work-items/${taskId}/tags/${tagId}`, undefined, {
            authMode: "required",
            retryOnUnauthorized: true
          })
        ),
        ...tagIdsToRemove.map(tagId =>
          apiClient.delete(`/workspaces/${workspaceId}/work-items/${taskId}/tags/${tagId}`, {
            authMode: "required",
            retryOnUnauthorized: true
          })
        )
      ]);
    }

    if (Object.keys(payload).length > 0) {
      await apiClient.patch(`/workspaces/${workspaceId}/work-items/${taskId}`, payload, {
        authMode: "required",
        retryOnUnauthorized: true
      });
    } else if (!hasTagChanges) {
      return fetchSnapshot(workspaceSlug);
    }

    return fetchSnapshot(workspaceSlug);
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
    await apiClient.post(`/workspaces/${workspaceId}/automation-workflows/${automationId}/${status === "active" ? "activate" : "pause"}`, undefined, {
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

  async updateWorkItemListConfig(workspaceSlug, workItemTypeId, config) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const preferences = await apiClient.put<WorkspacePreferences>(
      `/workspaces/${workspaceId}/work-item-list-configs/${workItemTypeId}`,
      config,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );

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

  async createWorkflowState(workspaceSlug: string, input: CreateWorkflowStateInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/workflow-states`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

  async updateWorkflowState(workspaceSlug: string, stateId: string, input: UpdateWorkflowStateInput) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/workflow-states/${stateId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
    return fetchSnapshot(workspaceSlug);
  },

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

  async replaceItemTypeFieldBindings(
    workspaceSlug: string,
    typeId: string,
    bindings: WorkItemFieldBindingInput[]
  ) {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.put(
      `/workspaces/${workspaceId}/item-types/${typeId}/field-bindings`,
      { bindings },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
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

  async getAutomationCapabilities(workspaceSlug: string): Promise<AutomationCapabilities> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AutomationCapabilities>(`/automation/workspaces/${workspaceId}/capabilities`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listAutomationWorkflows(
    workspaceSlug: string,
    options?: { status?: AutomationWorkflowStatus; limit?: number }
  ): Promise<{ items: AutomationWorkflow[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.status) query.set("status", options.status);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: AutomationWorkflow[] }>(
      `/workspaces/${workspaceId}/automation-workflows${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async createAutomationWorkflow(
    workspaceSlug: string,
    input: CreateAutomationWorkflowInput
  ): Promise<AutomationWorkflow> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflow>(`/workspaces/${workspaceId}/automation-workflows`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async getAutomationWorkflow(workspaceSlug: string, workflowId: string): Promise<AutomationWorkflow> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AutomationWorkflow>(`/workspaces/${workspaceId}/automation-workflows/${workflowId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateAutomationWorkflow(
    workspaceSlug: string,
    workflowId: string,
    input: UpdateAutomationWorkflowInput
  ): Promise<AutomationWorkflow> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<AutomationWorkflow>(`/workspaces/${workspaceId}/automation-workflows/${workflowId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async activateAutomationWorkflow(workspaceSlug: string, workflowId: string): Promise<AutomationWorkflow> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflow>(`/workspaces/${workspaceId}/automation-workflows/${workflowId}/activate`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async pauseAutomationWorkflow(workspaceSlug: string, workflowId: string): Promise<AutomationWorkflow> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflow>(`/workspaces/${workspaceId}/automation-workflows/${workflowId}/pause`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async archiveAutomationWorkflow(workspaceSlug: string, workflowId: string): Promise<AutomationWorkflow> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflow>(`/workspaces/${workspaceId}/automation-workflows/${workflowId}/archive`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listAutomationWorkflowVersions(
    workspaceSlug: string,
    workflowId: string,
    options?: { status?: AutomationWorkflowVersionStatus; limit?: number }
  ): Promise<{ items: AutomationWorkflowVersion[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.status) query.set("status", options.status);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: AutomationWorkflowVersion[] }>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/versions${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async createAutomationWorkflowDraftVersion(
    workspaceSlug: string,
    workflowId: string,
    input?: SaveAutomationWorkflowVersionInput
  ): Promise<AutomationWorkflowVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflowVersion>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/versions/draft`,
      input ?? {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getAutomationWorkflowVersion(
    workspaceSlug: string,
    workflowId: string,
    versionId: string
  ): Promise<AutomationWorkflowVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AutomationWorkflowVersion>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/versions/${versionId}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async updateAutomationWorkflowVersion(
    workspaceSlug: string,
    workflowId: string,
    versionId: string,
    input: SaveAutomationWorkflowVersionInput
  ): Promise<AutomationWorkflowVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<AutomationWorkflowVersion>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/versions/${versionId}`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async publishAutomationWorkflowVersion(
    workspaceSlug: string,
    workflowId: string,
    versionId: string,
    input?: { activateWorkflow?: boolean }
  ): Promise<AutomationWorkflowVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflowVersion>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/versions/${versionId}/publish`,
      input ?? {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async cloneAutomationWorkflowVersion(
    workspaceSlug: string,
    workflowId: string,
    versionId: string
  ): Promise<AutomationWorkflowVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationWorkflowVersion>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/versions/${versionId}/clone`,
      undefined,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async runAutomationWorkflow(
    workspaceSlug: string,
    workflowId: string,
    input?: RunAutomationWorkflowInput
  ): Promise<RunAutomationWorkflowResult> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<RunAutomationWorkflowResult>(
      `/workspaces/${workspaceId}/automation-workflows/${workflowId}/run`,
      {
        triggerType: input?.triggerType ?? "manual",
        context: input?.context ?? {}
      },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async listAutomationRuns(
    workspaceSlug: string,
    options?: {
      workflowId?: string;
      status?: string;
      triggerType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      limit?: number;
    }
  ): Promise<{ items: AutomationRunListItem[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.workflowId) query.set("workflowId", options.workflowId);
    if (options?.status) query.set("status", options.status);
    if (options?.triggerType) query.set("triggerType", options.triggerType);
    if (options?.dateFrom) query.set("dateFrom", options.dateFrom);
    if (options?.dateTo) query.set("dateTo", options.dateTo);
    if (options?.search) query.set("search", options.search);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: AutomationRunListItem[] }>(
      `/automation/workspaces/${workspaceId}/runs${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getAutomationRunDetail(workspaceSlug: string, runId: string): Promise<AutomationRunDetail> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AutomationRunDetail>(`/automation/workspaces/${workspaceId}/runs/${runId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async cancelAutomationRun(workspaceSlug: string, runId: string, reason?: string): Promise<AutomationRunDetail> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationRunDetail>(
      `/automation/workspaces/${workspaceId}/runs/${runId}/cancel`,
      reason ? { reason } : {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async listAutomationApprovals(
    workspaceSlug: string,
    options?: {
      status?: string;
      type?: string;
      channel?: string;
      workflowId?: string;
      contactId?: string;
      workItemId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      limit?: number;
    }
  ): Promise<{ items: AutomationApprovalSummary[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.status) query.set("status", options.status);
    if (options?.type) query.set("type", options.type);
    if (options?.channel) query.set("channel", options.channel);
    if (options?.workflowId) query.set("workflowId", options.workflowId);
    if (options?.contactId) query.set("contactId", options.contactId);
    if (options?.workItemId) query.set("workItemId", options.workItemId);
    if (options?.dateFrom) query.set("dateFrom", options.dateFrom);
    if (options?.dateTo) query.set("dateTo", options.dateTo);
    if (options?.search) query.set("search", options.search);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: AutomationApprovalSummary[] }>(
      `/workspaces/${workspaceId}/automation-approvals${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async listCommunicationInbox(
    workspaceSlug: string,
    options?: ListCommunicationInboxOptions
  ): Promise<{ items: CommunicationConversationSummary[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.status) query.set("status", options.status);
    if (options?.channel) query.set("channel", options.channel);
    if (options?.assignedTo) query.set("assignedTo", options.assignedTo);
    if (options?.workItemId) query.set("workItemId", options.workItemId);
    if (options?.contactId) query.set("contactId", options.contactId);
    if (typeof options?.hasUnread === "boolean") query.set("hasUnread", String(options.hasUnread));
    if (typeof options?.hasPendingApproval === "boolean") query.set("hasPendingApproval", String(options.hasPendingApproval));
    if (options?.dateFrom) query.set("dateFrom", options.dateFrom);
    if (options?.dateTo) query.set("dateTo", options.dateTo);
    if (options?.search) query.set("search", options.search);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: CommunicationConversationSummary[] }>(
      `/workspaces/${workspaceId}/communication/inbox${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getCommunicationConversation(
    workspaceSlug: string,
    conversationId: string
  ): Promise<CommunicationConversationDetail> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<CommunicationConversationDetail>(
      `/workspaces/${workspaceId}/communication/conversations/${conversationId}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async markCommunicationConversationRead(workspaceSlug: string, conversationId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/communication/conversations/${conversationId}/read`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async resolveCommunicationConversation(workspaceSlug: string, conversationId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/communication/conversations/${conversationId}/resolve`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async archiveCommunicationConversation(workspaceSlug: string, conversationId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/communication/conversations/${conversationId}/archive`, undefined, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async assignCommunicationConversation(
    workspaceSlug: string,
    conversationId: string,
    assignedToId?: string | null
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(
      `/workspaces/${workspaceId}/communication/conversations/${conversationId}/assign`,
      { assignedToId: assignedToId ?? null },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async linkCommunicationConversationWorkItem(
    workspaceSlug: string,
    conversationId: string,
    workItemId?: string | null
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(
      `/workspaces/${workspaceId}/communication/conversations/${conversationId}/link-work-item`,
      { workItemId: workItemId ?? null },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async replyCommunicationConversation(
    workspaceSlug: string,
    conversationId: string,
    input: { channel: "email" | "whatsapp"; text: string; sendMode: "manual" }
  ): Promise<{ sideEffect: AutomationSideEffectSummary; message: CommunicationMessageSummary }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<{ sideEffect: AutomationSideEffectSummary; message: CommunicationMessageSummary }>(
      `/workspaces/${workspaceId}/communication/conversations/${conversationId}/reply`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getAutomationApproval(workspaceSlug: string, approvalId: string): Promise<AutomationApprovalDetail> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AutomationApprovalDetail>(
      `/workspaces/${workspaceId}/automation-approvals/${approvalId}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async approveAutomationApproval(
    workspaceSlug: string,
    approvalId: string,
    input: { editedPayload?: Record<string, unknown>; decisionReason?: string; decision?: Record<string, unknown> }
  ): Promise<AutomationApprovalRecord> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationApprovalRecord>(
      `/workspaces/${workspaceId}/automation-approvals/${approvalId}/approve`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async rejectAutomationApproval(
    workspaceSlug: string,
    approvalId: string,
    input: { editedPayload?: Record<string, unknown>; decisionReason?: string; decision?: Record<string, unknown> }
  ): Promise<AutomationApprovalRecord> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationApprovalRecord>(
      `/workspaces/${workspaceId}/automation-approvals/${approvalId}/reject`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async cancelAutomationApproval(workspaceSlug: string, approvalId: string, reason?: string): Promise<AutomationApprovalRecord> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationApprovalRecord>(
      `/workspaces/${workspaceId}/automation-approvals/${approvalId}/cancel`,
      reason ? { reason } : {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async listCommunicationTemplates(
    workspaceSlug: string,
    options?: { channel?: string; status?: string; limit?: number }
  ): Promise<{ items: CommunicationTemplate[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.channel) query.set("channel", options.channel);
    if (options?.status) query.set("status", options.status);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: CommunicationTemplate[] }>(
      `/automation/workspaces/${workspaceId}/communication/templates${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async createWhatsAppTemplate(workspaceSlug: string, input: CreateWhatsAppTemplateInput): Promise<CommunicationTemplate> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<CommunicationTemplate>(
      `/automation/workspaces/${workspaceId}/communication/templates/whatsapp`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async updateCommunicationTemplateVersion(
    workspaceSlug: string,
    versionId: string,
    input: UpdateCommunicationTemplateVersionInput
  ): Promise<CommunicationTemplateVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<CommunicationTemplateVersion>(
      `/automation/workspaces/${workspaceId}/communication/templates/versions/${versionId}`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async publishCommunicationTemplateVersion(workspaceSlug: string, versionId: string): Promise<CommunicationTemplateVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<CommunicationTemplateVersion>(
      `/automation/workspaces/${workspaceId}/communication/templates/versions/${versionId}/publish`,
      {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async markWhatsAppTemplateApprovalStatus(
    workspaceSlug: string,
    versionId: string,
    input: {
      approvalStatus: "pending_review" | "approved" | "rejected" | "paused" | "disabled";
      providerTemplateName?: string | null;
      providerTemplateId?: string | null;
    }
  ): Promise<CommunicationTemplateVersion> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<CommunicationTemplateVersion>(
      `/automation/workspaces/${workspaceId}/communication/templates/versions/${versionId}/approval-status`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async listWhatsAppConsents(
    workspaceSlug: string,
    options?: { status?: string; limit?: number }
  ): Promise<{ items: WhatsAppConsent[] }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (options?.status) query.set("status", options.status);
    if (typeof options?.limit === "number") query.set("limit", String(options.limit));
    const qs = query.toString();
    return apiClient.get<{ items: WhatsAppConsent[] }>(
      `/automation/workspaces/${workspaceId}/communication/whatsapp/consents${qs ? `?${qs}` : ""}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async upsertWhatsAppConsent(
    workspaceSlug: string,
    input: {
      address: string;
      status: "unknown" | "opted_in" | "opted_out" | "suppressed" | "bounced" | "complained" | "invalid";
      source?: string | null;
      reason?: string | null;
    }
  ): Promise<WhatsAppConsent> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.put<WhatsAppConsent>(
      `/automation/workspaces/${workspaceId}/communication/whatsapp/consents`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async getWhatsAppIntegration(workspaceSlug: string): Promise<{ integration: WhatsAppIntegration | null }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<{ integration: WhatsAppIntegration | null }>(
      `/automation/workspaces/${workspaceId}/communication/whatsapp/integration`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async upsertWhatsAppIntegration(
    workspaceSlug: string,
    input: UpsertWhatsAppIntegrationInput
  ): Promise<WhatsAppIntegration> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.put<WhatsAppIntegration>(
      `/automation/workspaces/${workspaceId}/communication/whatsapp/integration`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async testWhatsAppIntegration(workspaceSlug: string): Promise<WhatsAppIntegration> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WhatsAppIntegration>(
      `/automation/workspaces/${workspaceId}/communication/whatsapp/integration/test`,
      {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async disableWhatsAppIntegration(workspaceSlug: string): Promise<WhatsAppIntegration> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WhatsAppIntegration>(
      `/automation/workspaces/${workspaceId}/communication/whatsapp/integration/disable`,
      {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async simulateWhatsAppMockEvent(
    workspaceSlug: string,
    sideEffectId: string,
    input: { eventType: "delivered" | "read" | "failed" | "replied"; messageText?: string }
  ): Promise<AutomationSideEffectSummary> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AutomationSideEffectSummary>(
      `/automation/workspaces/${workspaceId}/side-effects/${sideEffectId}/whatsapp-mock-events`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async listAutomationViews(workspaceSlug: string): Promise<AutomationView[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AutomationView[]>(`/automation/workspaces/${workspaceId}/views`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listWorkspaceDocuments(workspaceSlug: string, input?: WorkspaceDocumentFilters): Promise<WorkspaceDocument[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = buildWorkspaceDocumentsQuery(input);
    return apiClient.get<WorkspaceDocument[]>(`/workspaces/${workspaceId}/documents${query ? `?${query}` : ""}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listWorkspaceDocumentsPage(
    workspaceSlug: string,
    input?: WorkspaceDocumentFilters
  ): Promise<WorkspaceDocumentsPage> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = buildWorkspaceDocumentsQuery({ ...input, paged: true });
    return apiClient.get<WorkspaceDocumentsPage>(`/workspaces/${workspaceId}/documents${query ? `?${query}` : ""}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listWorkspaceDocumentFolders(workspaceSlug: string): Promise<WorkspaceDocumentFolder[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkspaceDocumentFolder[]>(`/workspaces/${workspaceId}/document-folders`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createWorkspaceDocumentFolder(
    workspaceSlug: string,
    input: Parameters<WorkspaceService["createWorkspaceDocumentFolder"]>[1]
  ): Promise<WorkspaceDocumentFolder> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkspaceDocumentFolder>(`/workspaces/${workspaceId}/document-folders`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateWorkspaceDocumentFolder(
    workspaceSlug: string,
    folderId: string,
    input: Parameters<WorkspaceService["updateWorkspaceDocumentFolder"]>[2]
  ): Promise<WorkspaceDocumentFolder> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<WorkspaceDocumentFolder>(`/workspaces/${workspaceId}/document-folders/${folderId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async deleteWorkspaceDocumentFolder(workspaceSlug: string, folderId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/document-folders/${folderId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listCustomers(
    workspaceSlug: string,
    input?: { search?: string; status?: CustomerStatus }
  ): Promise<Customer[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const query = new URLSearchParams();
    if (input?.search) {
      query.set("search", input.search);
    }
    if (input?.status) {
      query.set("status", input.status);
    }
    const qs = query.toString();
    return apiClient.get<Customer[]>(`/workspaces/${workspaceId}/customers${qs ? `?${qs}` : ""}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createCustomer(workspaceSlug: string, input: CreateCustomerInput): Promise<Customer> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<Customer>(`/workspaces/${workspaceId}/customers`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateCustomer(
    workspaceSlug: string,
    customerId: string,
    input: Partial<CreateCustomerInput>
  ): Promise<Customer> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<Customer>(`/workspaces/${workspaceId}/customers/${customerId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createWorkspaceDocument(
    workspaceSlug: string,
    input: Parameters<WorkspaceService["createWorkspaceDocument"]>[1]
  ): Promise<WorkspaceDocument> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkspaceDocument>(`/workspaces/${workspaceId}/documents`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateWorkspaceDocument(
    workspaceSlug: string,
    documentId: string,
    input: Parameters<WorkspaceService["updateWorkspaceDocument"]>[2]
  ): Promise<WorkspaceDocument> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<WorkspaceDocument>(`/workspaces/${workspaceId}/documents/${documentId}`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async sendWorkspaceDocument(
    workspaceSlug: string,
    documentId: string,
    input: Parameters<WorkspaceService["sendWorkspaceDocument"]>[2]
  ): Promise<WorkspaceDocument> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkspaceDocument>(`/workspaces/${workspaceId}/documents/${documentId}/send`, input, {
      authMode: "required",
      retryOnUnauthorized: true,
      globalLoading: false
    });
  },

  async decideWorkspaceDocument(
    workspaceSlug: string,
    documentId: string,
    input: Parameters<WorkspaceService["decideWorkspaceDocument"]>[2]
  ): Promise<WorkspaceDocument> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkspaceDocument>(`/workspaces/${workspaceId}/documents/${documentId}/decision`, input, {
      authMode: "required",
      retryOnUnauthorized: true,
      globalLoading: false
    });
  },

  async listDocumentAssets(workspaceSlug: string, documentId: string): Promise<WorkspaceDocumentAsset[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkspaceDocumentAsset[]>(`/workspaces/${workspaceId}/documents/${documentId}/assets`, {
      authMode: "required",
      retryOnUnauthorized: true,
      globalLoading: false
    });
  },

  async uploadDocumentAsset(
    workspaceSlug: string,
    documentId: string,
    input: Parameters<WorkspaceService["uploadDocumentAsset"]>[2]
  ): Promise<WorkspaceDocumentAsset> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    const formData = new FormData();
    formData.append("type", input.type);
    formData.append("filename", input.filename ?? input.file.name);
    formData.append("contentType", input.contentType ?? (input.file.type || "application/octet-stream"));
    formData.append("file", input.file, input.filename ?? input.file.name);
    return apiClient.uploadFormData<WorkspaceDocumentAsset>(`/workspaces/${workspaceId}/documents/${documentId}/assets`, formData, {
      authMode: "required",
      retryOnUnauthorized: true,
      globalLoading: false,
      onProgress: input.onProgress
    });
  },

  async deleteDocumentAsset(workspaceSlug: string, documentId: string, assetId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/documents/${documentId}/assets/${assetId}`, {
      authMode: "required",
      retryOnUnauthorized: true,
      globalLoading: false
    });
  },

  async deleteWorkspaceDocument(workspaceSlug: string, documentId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/documents/${documentId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async listWorkItemLinkedDocuments(workspaceSlug: string, itemId: string): Promise<WorkItemLinkedDocument[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<WorkItemLinkedDocument[]>(`/workspaces/${workspaceId}/work-items/${itemId}/documents`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async linkDocumentToWorkItem(
    workspaceSlug: string,
    itemId: string,
    documentId: string
  ): Promise<WorkItemLinkedDocument[]> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<WorkItemLinkedDocument[]>(
      `/workspaces/${workspaceId}/work-items/${itemId}/documents/${documentId}`,
      undefined,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async unlinkDocumentFromWorkItem(workspaceSlug: string, itemId: string, documentId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/work-items/${itemId}/documents/${documentId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async getAiCapabilities(workspaceSlug: string): Promise<AiCapabilities> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.get<AiCapabilities>(`/ai/workspaces/${workspaceId}/capabilities`, {
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
    patch: Omit<Partial<CreateAiAgentInput>, "description"> & { description?: string | null }
  ): Promise<{ id: string }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.patch<{ id: string }>(`/ai/workspaces/${workspaceId}/agents/${agentId}`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async validateAiAgent(workspaceSlug: string, agentId: string): Promise<AiAgentRuntimeValidationResult> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AiAgentRuntimeValidationResult>(
      `/ai/workspaces/${workspaceId}/agents/${agentId}/validate`,
      {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async publishAiAgent(
    workspaceSlug: string,
    agentId: string,
    input?: { activateWorkflow?: boolean }
  ): Promise<AiAgentRuntimePublishResult> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<AiAgentRuntimePublishResult>(
      `/ai/workspaces/${workspaceId}/agents/${agentId}/publish`,
      {
        activateWorkflow: input?.activateWorkflow ?? true
      },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async runAiAgent(
    workspaceSlug: string,
    agentId: string,
    input?: RunAiAgentRuntimeInput
  ): Promise<RunAiAgentRuntimeResult> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<RunAiAgentRuntimeResult>(
      `/ai/workspaces/${workspaceId}/agents/${agentId}/run`,
      {
        instruction: input?.instruction,
        context: input?.context ?? {}
      },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  async archiveAiAgent(workspaceSlug: string, agentId: string): Promise<{ id: string }> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<{ id: string }>(
      `/ai/workspaces/${workspaceId}/agents/${agentId}/archive`,
      {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
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

  async runDocumentationAssistant(
    workspaceSlug: string,
    input: RunDocumentationAssistantInput
  ): Promise<RunDocumentationAssistantResult> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    return apiClient.post<RunDocumentationAssistantResult>(
      `/ai/workspaces/${workspaceId}/documentation/run`,
      {
        mode: input.mode,
        instruction: input.instruction,
        documentTitle: input.documentTitle,
        documentPath: input.documentPath,
        documentContent: input.documentContent,
        selection: input.selection,
        conversationHistory: input.conversationHistory,
        includeSemanticContext: input.includeSemanticContext ?? true,
        topKContextDocs: input.topKContextDocs ?? 5
      },
      {
        authMode: "required",
        retryOnUnauthorized: true,
        globalLoading: false
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
    input: { email: string; role: "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT" }
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
      role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT";
      permissions?: {
        allow?: WorkspacePermissionKey[];
        deny?: WorkspacePermissionKey[];
        groupIds?: string[];
        allowedModules?: WorkspaceModuleKey[];
        allowedBoardViewKeys?: string[];
        ownCardsOnly?: boolean;
      };
    }
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/members/${memberUserId}/access-control`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateWorkspaceModuleEntitlements(
    workspaceSlug: string,
    moduleEntitlements: Partial<Record<WorkspaceModuleKey, boolean>>
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/module-entitlements`, { moduleEntitlements }, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async createWorkspaceAccessGroup(
    workspaceSlug: string,
    input: {
      name: string;
      description?: string;
      allow?: WorkspacePermissionKey[];
      deny?: WorkspacePermissionKey[];
      allowedModules?: WorkspaceModuleKey[];
      allowedBoardViewKeys?: string[];
      ownCardsOnly?: boolean;
    }
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.post(`/workspaces/${workspaceId}/access-groups`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async updateWorkspaceAccessGroup(
    workspaceSlug: string,
    groupId: string,
    patch: {
      name?: string;
      description?: string;
      allow?: WorkspacePermissionKey[];
      deny?: WorkspacePermissionKey[];
      allowedModules?: WorkspaceModuleKey[];
      allowedBoardViewKeys?: string[];
      ownCardsOnly?: boolean;
    }
  ): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.patch(`/workspaces/${workspaceId}/access-groups/${groupId}`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  async deleteWorkspaceAccessGroup(workspaceSlug: string, groupId: string): Promise<void> {
    const workspaceId = await resolveWorkspaceId(workspaceSlug);
    await apiClient.delete(`/workspaces/${workspaceId}/access-groups/${groupId}`, {
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

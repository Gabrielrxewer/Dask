import type { MemberId, MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";

export type WorkspaceBoardMode = string;
export type WorkspaceDateFormat = "dd/mm/yyyy" | "mm/dd/yyyy";

export interface WorkspaceAutomation {
  id: string;
  title: string;
  status: "active" | "paused";
  trigger: string;
  action: string;
}

export interface WorkspacePreferences {
  defaultBoardMode: WorkspaceBoardMode;
  dateFormat: WorkspaceDateFormat;
  visibleCardFieldIds: string[];
  /** Campos visiveis por tipo de work item. Sobrepoe visibleCardFieldIds para aquele tipo. */
  visibleFieldsByType?: Record<string, string[]>;
  /** Campos visiveis no detalhe expandido por tipo de work item. */
  detailVisibleFieldsByType?: Record<string, string[]>;
  settings?: Record<string, unknown>;
}

export interface CreateTaskInput {
  type: string;
  title: string;
  description: string;
  priority: TaskPriority;
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  currentUserId: MemberId;
  membersById: MembersById;
  tasks: Task[];
  boardConfig: BoardConfig;
  automations: WorkspaceAutomation[];
  preferences: WorkspacePreferences;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string | null;
  kind: "PERSONAL" | "CORPORATE";
  name: string;
  key: string;
  slug: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export type WorkspaceTemplateKey = "software_delivery" | "product_discovery" | "operations_kanban";

export interface WorkspaceTemplateOption {
  key: WorkspaceTemplateKey;
  name: string;
  description?: string;
}

// ─── Board Config API Response Types ─────────────────────────────────────────
// Retornados pelos endpoints GET /board-columns, /item-types, /custom-fields
// Contêm os UUIDs reais necessários para PATCH/DELETE

export interface ApiBoardColumn {
  id: string;
  name: string;
  slug: string;
  order: number;
  wipLimit: number | null;
  isActive: boolean;
  /** UUIDs dos workflow states associados a esta coluna */
  stateIds: string[];
}

export interface ApiWorkflowState {
  id: string;
  name: string;
  slug: string;
  color: string;
  category: string | null;
  isTerminal: boolean;
  isEditable: boolean;
  isActive: boolean;
}

export interface ApiItemType {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  description: string | null;
  isActive: boolean;
}

export interface ApiCustomField {
  id: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  isActive: boolean;
  settings?: CustomFieldSettings | null;
  options: Array<{ id: string; label: string; value: string; color: string | null }>;
}

export interface CustomFieldSettings {
  allowAiGeneration?: boolean;
  [key: string]: unknown;
}

// ─── Board Config Input Types ────────────────────────────────────────────────

export interface CreateBoardColumnInput {
  name: string;
  order?: number;
  wipLimit?: number | null;
  stateIds?: string[];
}

export interface UpdateBoardColumnInput {
  name?: string;
  order?: number;
  wipLimit?: number | null;
  isActive?: boolean;
  stateIds?: string[];
}

export interface CreateItemTypeInput {
  name: string;
  color?: string;
  icon?: string;
  description?: string;
}

export interface UpdateItemTypeInput {
  name?: string;
  color?: string;
  icon?: string;
  description?: string;
  isActive?: boolean;
}

export type CustomFieldType =
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "select"
  | "multi_select";

export interface CustomFieldOptionInput {
  label: string;
  value: string;
  color?: string;
}

export interface CreateCustomFieldInput {
  name: string;
  type: CustomFieldType;
  description?: string;
  required?: boolean;
  settings?: CustomFieldSettings;
  options?: CustomFieldOptionInput[];
}

export interface UpdateCustomFieldInput {
  name?: string;
  type?: CustomFieldType;
  description?: string;
  required?: boolean;
  isActive?: boolean;
  settings?: CustomFieldSettings;
  options?: CustomFieldOptionInput[];
}

export interface WorkspaceService {
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  listWorkspaceTemplates: () => Promise<WorkspaceTemplateOption[]>;
  provisionWorkspace: (input: {
    kind: "PERSONAL" | "CORPORATE";
    workspaceName: string;
    workspaceKey?: string;
    templateKey?: WorkspaceTemplateOption["key"];
    organizationName?: string;
    organizationSlug?: string;
  }) => Promise<WorkspaceSummary>;
  createPersonalWorkspace: (input?: { workspaceName?: string }) => Promise<WorkspaceSummary>;
  getSnapshot: (workspaceSlug: string) => Promise<WorkspaceSnapshot>;
  createTask: (workspaceSlug: string, input: CreateTaskInput) => Promise<WorkspaceSnapshot>;
  moveTask: (workspaceSlug: string, taskId: string, nextStatus: TaskStatusId) => Promise<WorkspaceSnapshot>;
  updateTaskPriority: (
    workspaceSlug: string,
    taskId: string,
    priority: TaskPriority
  ) => Promise<WorkspaceSnapshot>;
  updateTaskTitle: (
    workspaceSlug: string,
    taskId: string,
    title: string
  ) => Promise<WorkspaceSnapshot>;
  updateTaskDescription: (
    workspaceSlug: string,
    taskId: string,
    description: string
  ) => Promise<WorkspaceSnapshot>;
  updateTaskCustomField: (
    workspaceSlug: string,
    taskId: string,
    fieldId: string,
    value: TaskCustomFieldValue
  ) => Promise<WorkspaceSnapshot>;
  toggleChecklistItem: (
    workspaceSlug: string,
    taskId: string,
    itemId: string
  ) => Promise<WorkspaceSnapshot>;
  setAutomationStatus: (
    workspaceSlug: string,
    automationId: string,
    status: WorkspaceAutomation["status"]
  ) => Promise<WorkspaceSnapshot>;
  updatePreferences: (
    workspaceSlug: string,
    patch: Partial<WorkspacePreferences>
  ) => Promise<WorkspaceSnapshot>;
  resetWorkspaceTemplate: (
    workspaceSlug: string,
    templateKey?: WorkspaceTemplateKey
  ) => Promise<WorkspaceSnapshot>;
  setCardFieldVisibility: (
    workspaceSlug: string,
    fieldId: string,
    visible: boolean
  ) => Promise<WorkspaceSnapshot>;
  setTypeFieldVisibility: (
    workspaceSlug: string,
    typeId: string,
    fieldId: string,
    visible: boolean
  ) => Promise<WorkspaceSnapshot>;
  setTypeDetailFieldVisibility: (
    workspaceSlug: string,
    typeId: string,
    fieldId: string,
    visible: boolean
  ) => Promise<WorkspaceSnapshot>;

  // Busca itens de config com UUIDs reais (necessários para PATCH/DELETE)
  fetchBoardColumns: (workspaceSlug: string) => Promise<ApiBoardColumn[]>;
  fetchWorkflowStates: (workspaceSlug: string) => Promise<ApiWorkflowState[]>;
  fetchItemTypes: (workspaceSlug: string) => Promise<ApiItemType[]>;
  fetchCustomFields: (workspaceSlug: string) => Promise<ApiCustomField[]>;

  // Board config management
  createBoardColumn: (workspaceSlug: string, input: CreateBoardColumnInput) => Promise<WorkspaceSnapshot>;
  updateBoardColumn: (workspaceSlug: string, columnId: string, input: UpdateBoardColumnInput) => Promise<WorkspaceSnapshot>;
  deleteBoardColumn: (workspaceSlug: string, columnId: string) => Promise<WorkspaceSnapshot>;

  createItemType: (workspaceSlug: string, input: CreateItemTypeInput) => Promise<WorkspaceSnapshot>;
  updateItemType: (workspaceSlug: string, typeId: string, input: UpdateItemTypeInput) => Promise<WorkspaceSnapshot>;
  deleteItemType: (workspaceSlug: string, typeId: string) => Promise<WorkspaceSnapshot>;

  createCustomField: (workspaceSlug: string, input: CreateCustomFieldInput) => Promise<WorkspaceSnapshot>;
  updateCustomField: (workspaceSlug: string, fieldId: string, input: UpdateCustomFieldInput) => Promise<WorkspaceSnapshot>;
  deleteCustomField: (workspaceSlug: string, fieldId: string) => Promise<WorkspaceSnapshot>;

  listAutomationRules: (workspaceSlug: string, options?: { includeDisabled?: boolean }) => Promise<AutomationRule[]>;
  listAutomationExecutions: (workspaceSlug: string, options?: { limit?: number }) => Promise<AutomationExecution[]>;
  runAutomationRule: (workspaceSlug: string, ruleId: string, context?: Record<string, unknown>) => Promise<void>;
  createAutomationRule: (workspaceSlug: string, input: CreateAutomationRuleInput) => Promise<AutomationRule>;

  listAiAgents: (workspaceSlug: string) => Promise<AiAgentSummary[]>;
  listAiRuns: (
    workspaceSlug: string,
    input?: { itemId?: string; limit?: number }
  ) => Promise<AiRunSummary[]>;
  getAiObservability: (workspaceSlug: string) => Promise<AiObservability>;
  createAiAgent: (workspaceSlug: string, input: CreateAiAgentInput) => Promise<{ id: string }>;
  updateAiAgent: (
    workspaceSlug: string,
    agentId: string,
    patch: Partial<CreateAiAgentInput> & { description?: string | null }
  ) => Promise<{ id: string }>;
  runAiAgentOnItem: (
    workspaceSlug: string,
    itemId: string,
    agentId: string,
    input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
  runAiRiskAnalysis: (
    workspaceSlug: string,
    itemId: string,
    input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
}

export interface AutomationRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  triggerType: string;
  trigger: unknown;
  conditions: unknown;
  actions: unknown;
  enabled: boolean;
  priority: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecution {
  id: string;
  workspaceId: string;
  ruleId: string;
  eventName: string | null;
  eventId: string | null;
  status: string;
  attempts: number;
  context: unknown;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rule: {
    id: string;
    name: string;
    triggerType: string;
    enabled: boolean;
  };
}

export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  trigger: { type: string; [key: string]: unknown };
  conditions?: Record<string, unknown>;
  actions: Array<{ type: string; [key: string]: unknown }>;
  enabled?: boolean;
  priority?: number;
}

export interface AiAgentSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  model: string;
  temperature: number;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string;
}

export interface CreateAiAgentInput {
  key: string;
  name: string;
  description?: string;
  model?: string;
  temperature?: number;
  systemPrompt: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface AiRunSummary {
  id: string;
  agentId: string;
  itemId: string | null;
  status: string;
  provider: string | null;
  model: string | null;
  latencyMs: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
}

export interface AiObservability {
  totals: {
    runs24h: number;
    failed24h: number;
    failureRate24h: number;
    avgLatencyMs24h: number;
    tokens24h: number;
    estimatedCostUsd24h: number;
  };
  byProvider: Array<{
    provider: string;
    runs24h: number;
    failed24h: number;
    avgLatencyMs24h: number;
    tokens24h: number;
    estimatedCostUsd24h: number;
  }>;
}

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
}

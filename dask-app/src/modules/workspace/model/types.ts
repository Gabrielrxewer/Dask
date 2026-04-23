import type { MemberId, MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskChecklist, TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";

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
  /** Compatibilidade legada. O runtime principal deve ler boardConfig.fieldBindings. */
  visibleFieldsByType?: Record<string, string[]>;
  /** Compatibilidade legada. O runtime principal deve ler boardConfig.fieldBindings. */
  detailVisibleFieldsByType?: Record<string, string[]>;
  settings?: Record<string, unknown>;
}

export interface CreateTaskInput {
  type: string;
  title: string;
  description: string;
  priority: TaskPriority;
  statusId?: TaskStatusId;
  columnId?: string;
  stateId?: string;
  position?: number;
  assigneeId?: MemberId | null;
  dueDate?: string | null;
  tags?: string[];
  checklist?: TaskChecklist;
  fields?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown>;
}

export interface TaskScheduleInput {
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  stateId?: TaskStatusId;
  typeSlug?: string;
  assigneeId?: MemberId | null;
  dueDate?: string | null;
  tags?: string[];
  priority?: TaskPriority;
  checklist?: TaskChecklist;
  fields?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown>;
}

export type CalendarIntegrationProvider = "teams" | "google-calendar" | "outlook-calendar" | "zoom" | "manual";

export interface ExternalCalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  provider: CalendarIntegrationProvider;
  source: "external-calendar";
  organizerName?: string | null;
  meetingUrl?: string | null;
}

export interface CalendarIntegrationStatus {
  provider: CalendarIntegrationProvider;
  isConnected: boolean;
  canImportMeetings: boolean;
  lastSyncAt?: string | null;
}

export interface CalendarFeedSnapshot {
  events: ExternalCalendarEvent[];
  integrations: CalendarIntegrationStatus[];
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  currentUserId: MemberId;
  membersById: MembersById;
  tasks: Task[];
  tags?: WorkspaceTag[];
  boardConfig: BoardConfig;
  automations: WorkspaceAutomation[];
  preferences: WorkspacePreferences;
  access?: {
    ownCardsOnly: boolean;
    allowedModules: WorkspaceModuleKey[];
    moduleEntitlements: Partial<Record<WorkspaceModuleKey, boolean>>;
    allowedBoardViewKeys: string[] | null;
  };
}

export interface WorkspaceTag {
  id: string;
  name: string;
  slug: string;
  color: string;
  description?: string | null;
  isActive?: boolean;
}

export interface WorkspaceDocument {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  position: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemLinkedDocument {
  id: string;
  title: string;
  updatedAt: string;
  linkedAt?: string;
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

export interface BoardTemplatePerspective {
  key: string;
  name: string;
  caption?: string;
  statuses?: Array<{
    id: string;
    label: string;
    dot: string;
  }>;
  statusSource?:
    | { kind: "workflow_state" }
    | { kind: "custom_field"; fieldId: string; fallbackByStatus?: Record<string, string> };
  compactCards?: boolean;
  visibleBoardColumnSlugs?: string[];
  visibleBoardColumnIds?: string[];
  allowedTaskTypes?: string[];
}

export interface BoardTemplateSummary {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  schema?: {
    perspectives?: BoardTemplatePerspective[];
    [key: string]: unknown;
  } | null;
  rules?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkspaceProfile {
  id: string;
  name: string;
  key: string;
  kind: "PERSONAL" | "CORPORATE";
  organizationId: string | null;
  info: {
    description: string;
    company: string;
    website: string;
  };
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  sentAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PublicWorkspaceInvite {
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  workspace: {
    id: string;
    name: string;
    key: string;
  };
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
}

export type WorkspacePermissionKey =
  | "workspace.read"
  | "workspace.manage"
  | "workspace.delete"
  | "member.read"
  | "member.invite"
  | "member.update_role"
  | "member.remove"
  | "role.read"
  | "role.manage"
  | "permission.manage"
  | "project.read"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "board.read"
  | "board.configure"
  | "item.read"
  | "item.create"
  | "item.update"
  | "item.delete"
  | "item.transition"
  | "comment.read"
  | "comment.create"
  | "comment.delete"
  | "file.read"
  | "file.upload"
  | "file.delete"
  | "automation.read"
  | "automation.create"
  | "automation.update"
  | "automation.delete"
  | "automation.run"
  | "integration.read"
  | "integration.manage"
  | "billing.read"
  | "billing.manage"
  | "fiscal.read"
  | "fiscal.issue"
  | "fiscal.config"
  | "lead.read"
  | "lead.capture"
  | "lead.qualify"
  | "lead.distribute"
  | "lead.nurture"
  | "lead.convert"
  | "lead.integration"
  | "marketing.view"
  | "marketing.campaign.create"
  | "marketing.campaign.approve"
  | "marketing.campaign.send"
  | "marketing.template.manage"
  | "marketing.segment.manage"
  | "marketing.analytics.view"
  | "marketing.sender.manage"
  | "marketing.automation.manage"
  | "marketing.ai.use"
  | "marketing.integration"
  | "audit.read"
  | "ai.use"
  | "ai.configure"
  | "workspace.write"
  | "board.write"
  | "item.write";

export type WorkspaceModuleKey = "board" | "automation" | "documentation" | "ai" | "settings" | "fiscal" | "leads" | "marketing";

export interface WorkspaceAccessGroup {
  id: string;
  name: string;
  description?: string;
  allow?: WorkspacePermissionKey[];
  deny?: WorkspacePermissionKey[];
  allowedModules?: WorkspaceModuleKey[];
  allowedBoardViewKeys?: string[];
  ownCardsOnly?: boolean;
}

export interface WorkspaceAccessControlMember {
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  overrides: {
    allow: WorkspacePermissionKey[];
    deny: WorkspacePermissionKey[];
    groupIds?: string[];
    allowedModules?: WorkspaceModuleKey[];
    allowedBoardViewKeys?: string[];
    ownCardsOnly?: boolean;
  };
  effectivePermissions: WorkspacePermissionKey[];
  effectiveModules?: WorkspaceModuleKey[];
  effectiveOwnCardsOnly?: boolean;
  effectiveBoardViewKeys?: string[] | null;
}

export interface WorkspaceAccessControlSnapshot {
  catalog: WorkspacePermissionKey[];
  moduleCatalog?: WorkspaceModuleKey[];
  moduleEntitlements?: Partial<Record<WorkspaceModuleKey, boolean>>;
  groups?: WorkspaceAccessGroup[];
  rolePresets: Record<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "MANAGER" | "GUEST", WorkspacePermissionKey[]>;
  members: WorkspaceAccessControlMember[];
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
  definitionId?: string;
  name: string;
  slug: string;
  type: string;
  description?: string | null;
  source?: "system" | "template" | "custom";
  required: boolean;
  isSystem?: boolean;
  isEditable?: boolean;
  isRemovable?: boolean;
  isActive: boolean;
  order?: number;
  defaultValue?: unknown;
  settings?: CustomFieldSettings | null;
  config?: Record<string, unknown> | null;
  options: Array<{
    id: string;
    label: string;
    value: string;
    color: string | null;
    order?: number;
    isActive?: boolean;
  }>;
  scopeTypeIds?: string[];
  bindings?: Array<{
    id: string;
    fieldId: string;
    typeId: string;
    fieldDefinitionId?: string;
    workItemTypeId?: string;
    displayContext: "card" | "detail";
    order: number;
    section?: string | null;
    isVisible: boolean;
    isRequiredOverride?: boolean | null;
    isReadonlyOverride?: boolean | null;
  }>;
}

export interface WorkItemFieldBindingInput {
  fieldDefinitionId: string;
  displayContext: "card" | "detail";
  order: number;
  section?: string | null;
  isVisible?: boolean;
  isRequiredOverride?: boolean | null;
  isReadonlyOverride?: boolean | null;
  settings?: Record<string, unknown> | null;
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
  | "multi_select"
  | "user"
  | "checklist"
  | "priority"
  | "status"
  | "tag"
  | "schedule"
  | "work_item_type";

export interface CustomFieldOptionInput {
  label: string;
  value: string;
  color?: string;
  order?: number;
  isActive?: boolean;
}

export interface CreateCustomFieldInput {
  name: string;
  type: CustomFieldType;
  description?: string;
  required?: boolean;
  isEditable?: boolean;
  isRemovable?: boolean;
  defaultValue?: unknown;
  settings?: CustomFieldSettings;
  options?: CustomFieldOptionInput[];
  scopeTypeIds?: string[];
}

export interface UpdateCustomFieldInput {
  name?: string;
  type?: CustomFieldType;
  description?: string;
  required?: boolean;
  isEditable?: boolean;
  isRemovable?: boolean;
  isActive?: boolean;
  defaultValue?: unknown;
  settings?: CustomFieldSettings;
  options?: CustomFieldOptionInput[];
  scopeTypeIds?: string[];
}

export interface WorkspaceService {
  listWorkspaces: () => Promise<WorkspaceSummary[]>;
  listWorkspaceTemplates: () => Promise<WorkspaceTemplateOption[]>;
  listBoardTemplates: (workspaceSlug: string) => Promise<BoardTemplateSummary[]>;
  createBoardTemplate: (
    workspaceSlug: string,
    input: {
      name: string;
      description?: string;
      schema: Record<string, unknown>;
      rules?: Record<string, unknown>;
    }
  ) => Promise<BoardTemplateSummary>;
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
  deleteTask: (workspaceSlug: string, taskId: string) => Promise<WorkspaceSnapshot>;
  moveTask: (workspaceSlug: string, taskId: string, nextStatus: TaskStatusId) => Promise<WorkspaceSnapshot>;
  moveTaskToColumn: (
    workspaceSlug: string,
    taskId: string,
    columnId: string,
    stateId?: string,
    position?: number
  ) => Promise<WorkspaceSnapshot>;
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
  updateTaskSchedule: (
    workspaceSlug: string,
    taskId: string,
    input: TaskScheduleInput
  ) => Promise<WorkspaceSnapshot>;
  updateTask: (
    workspaceSlug: string,
    taskId: string,
    input: UpdateTaskInput
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
  replaceItemTypeFieldBindings: (
    workspaceSlug: string,
    typeId: string,
    bindings: WorkItemFieldBindingInput[]
  ) => Promise<WorkspaceSnapshot>;

  createCustomField: (workspaceSlug: string, input: CreateCustomFieldInput) => Promise<WorkspaceSnapshot>;
  updateCustomField: (workspaceSlug: string, fieldId: string, input: UpdateCustomFieldInput) => Promise<WorkspaceSnapshot>;
  deleteCustomField: (workspaceSlug: string, fieldId: string) => Promise<WorkspaceSnapshot>;

  listAutomationRules: (workspaceSlug: string, options?: { includeDisabled?: boolean }) => Promise<AutomationRule[]>;
  listAutomationExecutions: (workspaceSlug: string, options?: { limit?: number }) => Promise<AutomationExecution[]>;
  listAutomationViews: (workspaceSlug: string) => Promise<AutomationView[]>;
  runAutomationRule: (workspaceSlug: string, ruleId: string, context?: Record<string, unknown>) => Promise<void>;
  createAutomationRule: (workspaceSlug: string, input: CreateAutomationRuleInput) => Promise<AutomationRule>;
  updateAutomationRule: (
    workspaceSlug: string,
    ruleId: string,
    input: Partial<CreateAutomationRuleInput> & { enabled?: boolean }
  ) => Promise<AutomationRule>;
  deleteAutomationRule: (workspaceSlug: string, ruleId: string) => Promise<void>;
  listWorkspaceDocuments: (workspaceSlug: string) => Promise<WorkspaceDocument[]>;
  createWorkspaceDocument: (
    workspaceSlug: string,
    input: { title: string; content?: string; position?: number }
  ) => Promise<WorkspaceDocument>;
  updateWorkspaceDocument: (
    workspaceSlug: string,
    documentId: string,
    input: { title?: string; content?: string; position?: number }
  ) => Promise<WorkspaceDocument>;
  deleteWorkspaceDocument: (workspaceSlug: string, documentId: string) => Promise<void>;
  listWorkItemLinkedDocuments: (workspaceSlug: string, itemId: string) => Promise<WorkItemLinkedDocument[]>;
  linkDocumentToWorkItem: (
    workspaceSlug: string,
    itemId: string,
    documentId: string
  ) => Promise<WorkItemLinkedDocument[]>;
  unlinkDocumentFromWorkItem: (workspaceSlug: string, itemId: string, documentId: string) => Promise<void>;

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
    patch: Omit<Partial<CreateAiAgentInput>, "description"> & { description?: string | null }
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
  runDocumentationAssistant: (
    workspaceSlug: string,
    input: RunDocumentationAssistantInput
  ) => Promise<RunDocumentationAssistantResult>;
  getAccessControl: (workspaceSlug: string) => Promise<WorkspaceAccessControlSnapshot>;
  updateMemberAccessControl: (
    workspaceSlug: string,
    memberUserId: string,
    patch: {
      role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
      permissions?: {
        allow?: WorkspacePermissionKey[];
        deny?: WorkspacePermissionKey[];
        groupIds?: string[];
        allowedModules?: WorkspaceModuleKey[];
        allowedBoardViewKeys?: string[];
        ownCardsOnly?: boolean;
      };
    }
  ) => Promise<void>;
  updateWorkspaceModuleEntitlements: (
    workspaceSlug: string,
    moduleEntitlements: Partial<Record<WorkspaceModuleKey, boolean>>
  ) => Promise<void>;
  createWorkspaceAccessGroup: (
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
  ) => Promise<void>;
  updateWorkspaceAccessGroup: (
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
  ) => Promise<void>;
  deleteWorkspaceAccessGroup: (workspaceSlug: string, groupId: string) => Promise<void>;
  listWorkspaceInvites: (workspaceSlug: string) => Promise<WorkspaceInvite[]>;
  createWorkspaceInvite: (
    workspaceSlug: string,
    input: { email: string; role: "ADMIN" | "MEMBER" | "VIEWER" }
  ) => Promise<WorkspaceInvite>;
  resendWorkspaceInvite: (workspaceSlug: string, inviteId: string) => Promise<WorkspaceInvite>;
  revokeWorkspaceInvite: (workspaceSlug: string, inviteId: string) => Promise<void>;
  getWorkspaceInviteByToken: (token: string) => Promise<PublicWorkspaceInvite>;
  getWorkspaceProfile: (workspaceSlug: string) => Promise<WorkspaceProfile>;
  updateWorkspaceProfile: (
    workspaceSlug: string,
    patch: {
      name?: string;
      key?: string;
      info?: { description?: string; company?: string; website?: string };
    }
  ) => Promise<WorkspaceProfile>;
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
  } | null;
}

export interface AutomationViewColumn {
  id: string;
  workspaceId: string;
  viewId: string;
  key: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  isActive: boolean;
  isTerminal: boolean;
  settings: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationView {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  position: number;
  isSystem: boolean;
  isActive: boolean;
  settings: unknown;
  placementsCount: number;
  columns: AutomationViewColumn[];
  createdAt: string;
  updatedAt: string;
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
  systemPrompt?: string;
  config?: AiAgentConfig | null;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string;
}

export type AiAgentRagSource = "none" | "documentation" | "card" | "card_and_documentation";

export interface AiAgentRagConfig {
  enabled?: boolean;
  source?: AiAgentRagSource;
  contextInstruction?: string;
  includeSemanticContext?: boolean;
  includeLinkedDocuments?: boolean;
  topKContextDocs?: number;
}

export interface AiAgentConfig extends Record<string, unknown> {
  limits?: {
    maxRequestsPerMinute?: number;
    maxTokensPerDay?: number;
  };
  tools?: {
    enabled?: boolean;
    allowed?: string[];
    nativeEnabled?: boolean;
    nativeAllowed?: string[];
    gptEnabled?: boolean;
    gptAllowed?: string[];
  };
  guardrails?: {
    redactSensitive?: boolean;
    requireJsonOutput?: boolean;
  };
  rag?: AiAgentRagConfig;
}

export type DocumentationAssistantMode = "chat" | "write" | "maintain";
export type DocumentationAssistantAction = "chat" | "replace_document" | "append_document";

export interface RunDocumentationAssistantInput {
  mode: DocumentationAssistantMode;
  instruction: string;
  documentTitle?: string;
  documentPath?: string;
  documentContent: string;
  selection?: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  includeSemanticContext?: boolean;
  topKContextDocs?: number;
}

export interface RunDocumentationAssistantResult {
  runId: string;
  content: string;
  action: DocumentationAssistantAction;
  updatedDocument: string | null;
}

export interface CreateAiAgentInput {
  key: string;
  name: string;
  description?: string;
  model?: string;
  temperature?: number;
  systemPrompt: string;
  config?: AiAgentConfig;
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

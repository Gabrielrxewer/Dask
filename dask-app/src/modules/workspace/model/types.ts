import type { MemberId, MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskChecklist, TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";

export type { Task } from "@/entities/task";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT";

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
  reason?: string;
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

export interface BulkUpdateWorkItemsInput {
  itemIds: string[];
  patch: {
    stateId?: TaskStatusId;
    stateSlug?: TaskStatusId;
    assigneeId?: MemberId | null;
    priority?: TaskPriority;
    archived?: boolean;
  };
}

export interface BulkUpdateWorkItemsResult {
  updatedCount: number;
  failedCount: number;
  items: Task[];
  failed: Array<{
    itemId: string;
    message: string;
  }>;
}

export interface ListWorkItemsInput {
  page?: number;
  pageSize?: number;
  limit?: number;
  cursor?: string | null;
  perspectiveId?: string;
  boardColumnId?: string;
  columnId?: string;
  workItemTypeId?: string;
  typeId?: string;
  workflowStateId?: string;
  workflowStateIds?: string[];
  stateId?: string;
  stateSlug?: string;
  typeSlug?: string;
  assignedToMe?: boolean;
  assigneeId?: string;
  responsibleId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  plannedStartFrom?: string;
  plannedStartTo?: string;
  plannedWindowFrom?: string;
  plannedWindowTo?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  source?: string;
  customerId?: string;
  converted?: boolean;
  customFieldFilters?: Array<{
    fieldId?: string;
    fieldKey?: string;
    value: string | number | boolean | null;
  }>;
  sortBy?: "position" | "title" | "type" | "status" | "assignee" | "dueDate" | "createdAt" | "updatedAt" | "plannedStartAt";
  sortDirection?: "asc" | "desc";
  sort?: "position_asc" | "updated_desc" | "updated_asc" | "created_desc" | "created_asc";
}

export interface WorkItemsPage {
  items: Task[];
  total: number;
  totalCount?: number;
  nextCursor: string | null;
  hasMore?: boolean;
  pageInfo?: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
  };
  columnCounts: Record<string, number>;
  workflowStateCounts: Record<string, number>;
  countsByState?: Record<string, number>;
  countsByType?: Record<string, number>;
}

export interface CustomersPage {
  items: Customer[];
  total: number;
  totalCount?: number;
  nextCursor: string | null;
  hasMore?: boolean;
}

export interface WorkItemTypeTransformationField {
  id: string;
  slug: string;
  name: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface WorkItemTypeTransformationSummary {
  id: string;
  workspaceId: string;
  fromTypeId: string;
  toTypeId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  mode: string;
  fieldCompatibilityMode: string;
  permission: string | null;
  fromType: { id: string; slug: string; name: string; color: string };
  toType: { id: string; slug: string; name: string; color: string };
  valid: boolean;
  missingFields: WorkItemTypeTransformationField[];
  preservedFields: WorkItemTypeTransformationField[];
  newRequiredFields: WorkItemTypeTransformationField[];
}

export type WorkItemTypeTransformationConfig = Omit<
  WorkItemTypeTransformationSummary,
  "valid" | "missingFields" | "preservedFields" | "newRequiredFields"
> & {
  defaultValuesForNewFields?: Record<string, unknown> | null;
  stateMapping?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export interface WorkItemTypeTransformationPayload {
  transformationId?: string;
  toTypeId?: string;
  toTypeSlug?: string;
  stateId?: string;
  stateSlug?: string;
  customFieldValues?: Record<string, unknown>;
  defaultValuesForNewFields?: Record<string, unknown>;
}

export interface WorkItemTypeTransformationValidation {
  valid: boolean;
  reason: string | null;
  transformation: WorkItemTypeTransformationConfig;
  fromType: { id: string; slug: string; name: string; color: string };
  toType: { id: string; slug: string; name: string; color: string };
  preservedFields: WorkItemTypeTransformationField[];
  missingFields: WorkItemTypeTransformationField[];
  newRequiredFields: WorkItemTypeTransformationField[];
  defaultValuesForNewFields: Record<string, unknown>;
}

export interface WorkspaceAuditEvent {
  id: string;
  eventName: string;
  severity: "INFO" | "WARNING" | "ERROR";
  actorId: string | null;
  workspaceId: string | null;
  metadata: Record<string, unknown> | null;
  happenedAt: string;
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
  key?: string;
  workspace?: {
    id: string;
    name: string;
    key: string;
    kind: "PERSONAL" | "CORPORATE";
    organizationId: string | null;
  };
  currentUserId: MemberId;
  membersById: MembersById;
  tasks: Task[];
  tags?: WorkspaceTag[];
  boardConfig: BoardConfig;
  itemTypes?: ApiItemType[];
  workflowStates?: ApiWorkflowState[];
  boardColumns?: ApiBoardColumn[];
  customFieldDefinitions?: ApiCustomField[];
  automations: WorkspaceAutomation[];
  preferences: WorkspacePreferences;
  access?: {
    role?: WorkspaceRole;
    isClient?: boolean;
    customerIds?: string[];
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

export type DocumentKind = "wiki" | "proposal" | "contract";
export type CommercialDocumentStatus = "draft" | "sent" | "viewed" | "approved" | "rejected" | "accepted" | "signed";

export interface WorkspaceDocumentMetadata {
  clientLogoUrl?: string;
  logoAssetId?: string | null;
  attachmentAssetIds?: string[];
  clientName?: string;
  clientEmail?: string;
  linkedWorkItemId?: string | null;
  variableContextType?: "work_item" | null;
  variableContextVersion?: string | null;
  visibility?: "internal" | "client_visible" | "commercial_shared" | "public_authenticated";
  proposalCode?: string;
  proposalDate?: string;
  proposalValidity?: string;
  ownerName?: string;
  sentAt?: string;
  sentToEmail?: string;
  sentToEmails?: string[];
  sentBy?: string;
  status?: CommercialDocumentStatus | string;
  publicToken?: string;
  folderId?: string | null;
  [key: string]: unknown;
}

export type DocumentLinkedEntityType = "work_item" | "customer" | "proposal" | "contract";

export interface WorkspaceDocument {
  id: string;
  workspaceId: string;
  title: string;
  content: string;
  kind: DocumentKind;
  linkedEntityType?: DocumentLinkedEntityType;
  linkedEntityId?: string;
  tags: string[];
  metadata: WorkspaceDocumentMetadata;
  position: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemLinkedDocument {
  id: string;
  title: string;
  kind?: DocumentKind;
  status?: string;
  createdAt?: string;
  updatedAt: string;
  linkedAt?: string;
}

export type CustomerStatus = "prospect" | "active" | "inactive" | "archived";

export interface CustomerAddress {
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface Customer {
  id: string;
  workspaceId: string;
  name: string;
  tradeName?: string;
  legalName?: string;
  document?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  taxRegime?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  address?: CustomerAddress;
  status: CustomerStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerInput {
  name: string;
  tradeName?: string | null;
  legalName?: string | null;
  document?: string | null;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  taxRegime?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  address?: CustomerAddress | null;
  status?: CustomerStatus;
  notes?: string | null;
  sourceWorkItemId?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  organizationId: string | null;
  kind: "PERSONAL" | "CORPORATE";
  name: string;
  key: string;
  slug: string;
  role: WorkspaceRole;
}

export type WorkspaceTemplateKey = "software_delivery" | "product_discovery" | "operations_kanban" | "commercial_crm";

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
  createTaskColumnSlugs?: string[];
  createTaskColumnIds?: string[];
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
  role: WorkspaceRole;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  sentAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PublicWorkspaceInvite {
  email: string;
  role: WorkspaceRole;
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
  | "dashboard.view"
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
  | "automation.workflows.read"
  | "automation.workflows.create"
  | "automation.workflows.update"
  | "automation.workflows.publish"
  | "automation.workflows.run"
  | "automation.workflows.archive"
  | "automation.runs.read"
  | "automation.runs.cancel"
  | "automation.approvals.read"
  | "automation.approvals.approve"
  | "automation.approvals.reject"
  | "automation.approvals.cancel"
  | "communication.inbox.read"
  | "communication.inbox.reply"
  | "communication.conversation.read"
  | "communication.conversation.reply"
  | "communication.conversation.resolve"
  | "communication.conversation.archive"
  | "communication.conversation.assign"
  | "integration.read"
  | "integration.manage"
  | "billing.read"
  | "billing.manage"
  | "fiscal.read"
  | "fiscal.issue"
  | "fiscal.config"
  | "commercial.read"
  | "commercial.capture"
  | "commercial.qualify"
  | "commercial.distribute"
  | "commercial.nurture"
  | "commercial.convert"
  | "commercial.integration"
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

export type WorkspaceModuleKey = "dashboard" | "board" | "automation" | "documentation" | "billing" | "ai" | "settings" | "fiscal" | "commercial" | "marketing";

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
  role: WorkspaceRole;
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
  rolePresets: Record<"OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT" | "MANAGER" | "GUEST", WorkspacePermissionKey[]>;
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
  workspaceId?: string;
  name: string;
  slug: string;
  color: string;
  order?: number;
  category: string | null;
  isTerminal: boolean;
  isEditable: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkflowStateInput {
  name: string;
  slug?: string;
  category?: string | null;
  color?: string;
  order?: number;
  isActive?: boolean;
  isTerminal?: boolean;
  isEditable?: boolean;
}

export type UpdateWorkflowStateInput = Partial<CreateWorkflowStateInput>;

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
  variableKey?: string | null;
  variableLabel?: string | null;
  variableDescription?: string | null;
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
  | "catalog_select"
  | "multi_select"
  | "user"
  | "checklist"
  | "priority"
  | "status"
  | "tag"
  | "schedule"
  | "work_item_type"
  | "billing_summary";

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
  variableKey?: string | null;
  variableLabel?: string | null;
  variableDescription?: string | null;
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
  variableKey?: string | null;
  variableLabel?: string | null;
  variableDescription?: string | null;
  required?: boolean;
  isEditable?: boolean;
  isRemovable?: boolean;
  isActive?: boolean;
  defaultValue?: unknown;
  settings?: CustomFieldSettings;
  options?: CustomFieldOptionInput[];
  scopeTypeIds?: string[];
}

export interface CapabilityOption {
  value: string;
  label: string;
  description?: string;
  group?: string;
}

export interface AiCapabilities {
  schemaVersion: 1;
  defaults: {
    model: string;
    ragSource: string;
    topKContextDocs: number;
    nativeTools: string[];
    gptTools: string[];
  };
  models: CapabilityOption[];
  ragSources: CapabilityOption[];
  topKContextDocsOptions: number[];
  tools: CapabilityOption[];
}

export interface AutomationNodeCapability {
  type: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  group?: string;
  configSchema?: {
    type: string;
    label: string;
    required: string[];
    requiredAny?: string[][];
    description: string;
  };
  isTerminal?: boolean;
  isTrigger?: boolean;
}

export interface AutomationRecipeCapability {
  id: string;
  name: string;
  description: string;
  category: "workItem" | "proposal" | "contract" | "billing" | "customer" | "followup";
  graph: AutomationWorkflowGraph;
}

export interface AutomationCapabilities {
  schemaVersion: 1;
  nodeCatalog: AutomationNodeCapability[];
  recipeCatalog: AutomationRecipeCapability[];
  defaultGraph: AutomationWorkflowGraph;
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
  deleteWorkspace: (workspaceSlug: string) => Promise<void>;
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
  listWorkItemsPage: (workspaceSlug: string, input?: ListWorkItemsInput) => Promise<WorkItemsPage>;
  bulkUpdateWorkItems: (workspaceSlug: string, input: BulkUpdateWorkItemsInput) => Promise<BulkUpdateWorkItemsResult>;
  listCustomersPage: (
    workspaceSlug: string,
    input?: { search?: string; status?: CustomerStatus; limit?: number; cursor?: string | null }
  ) => Promise<CustomersPage>;
  listWorkItemTypeTransformations: (workspaceSlug: string) => Promise<WorkItemTypeTransformationSummary[]>;
  validateWorkItemTypeTransformation: (
    workspaceSlug: string,
    taskId: string,
    input: WorkItemTypeTransformationPayload
  ) => Promise<WorkItemTypeTransformationValidation>;
  transformWorkItemType: (
    workspaceSlug: string,
    taskId: string,
    input: WorkItemTypeTransformationPayload
  ) => Promise<Task>;
  convertWorkItemToCustomer: (
    workspaceSlug: string,
    taskId: string,
    input: {
      customerId?: string;
      customer?: CreateCustomerInput;
      fields?: Record<string, unknown>;
      customFieldValues?: Record<string, unknown>;
    }
  ) => Promise<Customer>;
  listWorkspaceAuditLog: (workspaceSlug: string, input?: { limit?: number }) => Promise<WorkspaceAuditEvent[]>;
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
  updateWorkItemListConfig: (
    workspaceSlug: string,
    workItemTypeId: string,
    config: Record<string, unknown>
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

  createWorkflowState: (workspaceSlug: string, input: CreateWorkflowStateInput) => Promise<WorkspaceSnapshot>;
  updateWorkflowState: (
    workspaceSlug: string,
    stateId: string,
    input: UpdateWorkflowStateInput
  ) => Promise<WorkspaceSnapshot>;

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

  getAutomationCapabilities: (workspaceSlug: string) => Promise<AutomationCapabilities>;
  listAutomationWorkflows: (
    workspaceSlug: string,
    options?: { status?: AutomationWorkflowStatus; limit?: number }
  ) => Promise<{ items: AutomationWorkflow[] }>;
  createAutomationWorkflow: (
    workspaceSlug: string,
    input: CreateAutomationWorkflowInput
  ) => Promise<AutomationWorkflow>;
  getAutomationWorkflow: (workspaceSlug: string, workflowId: string) => Promise<AutomationWorkflow>;
  updateAutomationWorkflow: (
    workspaceSlug: string,
    workflowId: string,
    input: UpdateAutomationWorkflowInput
  ) => Promise<AutomationWorkflow>;
  activateAutomationWorkflow: (workspaceSlug: string, workflowId: string) => Promise<AutomationWorkflow>;
  pauseAutomationWorkflow: (workspaceSlug: string, workflowId: string) => Promise<AutomationWorkflow>;
  archiveAutomationWorkflow: (workspaceSlug: string, workflowId: string) => Promise<AutomationWorkflow>;
  listAutomationWorkflowVersions: (
    workspaceSlug: string,
    workflowId: string,
    options?: { status?: AutomationWorkflowVersionStatus; limit?: number }
  ) => Promise<{ items: AutomationWorkflowVersion[] }>;
  createAutomationWorkflowDraftVersion: (
    workspaceSlug: string,
    workflowId: string,
    input?: SaveAutomationWorkflowVersionInput
  ) => Promise<AutomationWorkflowVersion>;
  getAutomationWorkflowVersion: (
    workspaceSlug: string,
    workflowId: string,
    versionId: string
  ) => Promise<AutomationWorkflowVersion>;
  updateAutomationWorkflowVersion: (
    workspaceSlug: string,
    workflowId: string,
    versionId: string,
    input: SaveAutomationWorkflowVersionInput
  ) => Promise<AutomationWorkflowVersion>;
  publishAutomationWorkflowVersion: (
    workspaceSlug: string,
    workflowId: string,
    versionId: string,
    input?: { activateWorkflow?: boolean }
  ) => Promise<AutomationWorkflowVersion>;
  cloneAutomationWorkflowVersion: (
    workspaceSlug: string,
    workflowId: string,
    versionId: string
  ) => Promise<AutomationWorkflowVersion>;
  runAutomationWorkflow: (
    workspaceSlug: string,
    workflowId: string,
    input?: RunAutomationWorkflowInput
  ) => Promise<RunAutomationWorkflowResult>;
  listAutomationRuns: (
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
  ) => Promise<{ items: AutomationRunListItem[] }>;
  getAutomationRunDetail: (workspaceSlug: string, runId: string) => Promise<AutomationRunDetail>;
  cancelAutomationRun: (workspaceSlug: string, runId: string, reason?: string) => Promise<AutomationRunDetail>;
  listAutomationApprovals: (
    workspaceSlug: string,
    options?: ListAutomationApprovalsOptions
  ) => Promise<{ items: AutomationApprovalSummary[] }>;
  listCommunicationInbox: (
    workspaceSlug: string,
    options?: ListCommunicationInboxOptions
  ) => Promise<{ items: CommunicationConversationSummary[] }>;
  getCommunicationConversation: (
    workspaceSlug: string,
    conversationId: string
  ) => Promise<CommunicationConversationDetail>;
  markCommunicationConversationRead: (workspaceSlug: string, conversationId: string) => Promise<void>;
  resolveCommunicationConversation: (workspaceSlug: string, conversationId: string) => Promise<void>;
  archiveCommunicationConversation: (workspaceSlug: string, conversationId: string) => Promise<void>;
  assignCommunicationConversation: (
    workspaceSlug: string,
    conversationId: string,
    assignedToId?: string | null
  ) => Promise<void>;
  linkCommunicationConversationWorkItem: (
    workspaceSlug: string,
    conversationId: string,
    workItemId?: string | null
  ) => Promise<void>;
  replyCommunicationConversation: (
    workspaceSlug: string,
    conversationId: string,
    input: { channel: "email" | "whatsapp"; text: string; sendMode: "manual" }
  ) => Promise<{ sideEffect: AutomationSideEffectSummary; message: CommunicationMessageSummary }>;
  getAutomationApproval: (workspaceSlug: string, approvalId: string) => Promise<AutomationApprovalDetail>;
  approveAutomationApproval: (
    workspaceSlug: string,
    approvalId: string,
    input: ReviewAutomationApprovalInput
  ) => Promise<AutomationApprovalRecord>;
  rejectAutomationApproval: (
    workspaceSlug: string,
    approvalId: string,
    input: ReviewAutomationApprovalInput
  ) => Promise<AutomationApprovalRecord>;
  cancelAutomationApproval: (workspaceSlug: string, approvalId: string, reason?: string) => Promise<AutomationApprovalRecord>;
  listCommunicationTemplates: (
    workspaceSlug: string,
    options?: { channel?: string; status?: string; limit?: number }
  ) => Promise<{ items: CommunicationTemplate[] }>;
  createWhatsAppTemplate: (
    workspaceSlug: string,
    input: CreateWhatsAppTemplateInput
  ) => Promise<CommunicationTemplate>;
  updateCommunicationTemplateVersion: (
    workspaceSlug: string,
    versionId: string,
    input: UpdateCommunicationTemplateVersionInput
  ) => Promise<CommunicationTemplateVersion>;
  publishCommunicationTemplateVersion: (
    workspaceSlug: string,
    versionId: string
  ) => Promise<CommunicationTemplateVersion>;
  markWhatsAppTemplateApprovalStatus: (
    workspaceSlug: string,
    versionId: string,
    input: {
      approvalStatus: Exclude<WhatsAppTemplateApprovalStatus, "draft">;
      providerTemplateName?: string | null;
      providerTemplateId?: string | null;
    }
  ) => Promise<CommunicationTemplateVersion>;
  listWhatsAppConsents: (
    workspaceSlug: string,
    options?: { status?: string; limit?: number }
  ) => Promise<{ items: WhatsAppConsent[] }>;
  upsertWhatsAppConsent: (
    workspaceSlug: string,
    input: {
      address: string;
      status: "unknown" | "opted_in" | "opted_out" | "suppressed" | "bounced" | "complained" | "invalid";
      source?: string | null;
      reason?: string | null;
    }
  ) => Promise<WhatsAppConsent>;
  simulateWhatsAppMockEvent: (
    workspaceSlug: string,
    sideEffectId: string,
    input: { eventType: "delivered" | "read" | "failed" | "replied"; messageText?: string }
  ) => Promise<AutomationSideEffectSummary>;
  listAutomationViews: (workspaceSlug: string) => Promise<AutomationView[]>;
  listWorkspaceDocuments: (workspaceSlug: string, input?: WorkspaceDocumentFilters) => Promise<WorkspaceDocument[]>;
  listWorkspaceDocumentsPage: (
    workspaceSlug: string,
    input?: WorkspaceDocumentFilters
  ) => Promise<WorkspaceDocumentsPage>;
  listWorkspaceDocumentFolders: (workspaceSlug: string) => Promise<WorkspaceDocumentFolder[]>;
  createWorkspaceDocumentFolder: (
    workspaceSlug: string,
    input: {
      name: string;
      parentId?: string | null;
      position?: number;
    }
  ) => Promise<WorkspaceDocumentFolder>;
  updateWorkspaceDocumentFolder: (
    workspaceSlug: string,
    folderId: string,
    input: {
      name?: string;
      parentId?: string | null;
      position?: number;
    }
  ) => Promise<WorkspaceDocumentFolder>;
  deleteWorkspaceDocumentFolder: (workspaceSlug: string, folderId: string) => Promise<void>;
  listCustomers: (workspaceSlug: string, input?: { search?: string; status?: CustomerStatus }) => Promise<Customer[]>;
  createCustomer: (workspaceSlug: string, input: CreateCustomerInput) => Promise<Customer>;
  updateCustomer: (workspaceSlug: string, customerId: string, input: Partial<CreateCustomerInput>) => Promise<Customer>;
  createWorkspaceDocument: (
    workspaceSlug: string,
    input: {
      title: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType;
      linkedEntityId?: string;
      tags?: string[];
      metadata?: WorkspaceDocumentMetadata;
      position?: number;
      expectedUpdatedAt?: string;
    }
  ) => Promise<WorkspaceDocument>;
  updateWorkspaceDocument: (
    workspaceSlug: string,
    documentId: string,
    input: {
      title?: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType | null;
      linkedEntityId?: string | null;
      tags?: string[];
      metadata?: WorkspaceDocumentMetadata;
      position?: number;
    }
  ) => Promise<WorkspaceDocument>;
  sendWorkspaceDocument: (
    workspaceSlug: string,
    documentId: string,
    input: {
      email?: string;
      emails?: string[];
      subject?: string;
      message?: string;
      includeAttachments?: boolean;
      selectedAssetIds?: string[];
      expirationDate?: string | null;
      requireLogin?: boolean;
      allowAcceptReject?: boolean;
      linkedWorkItemId?: string | null;
      resolvedPreviewSnapshot?: string;
    }
  ) => Promise<WorkspaceDocument>;
  decideWorkspaceDocument: (
    workspaceSlug: string,
    documentId: string,
    input: { decision: "approve" | "accept" | "sign" | "reject"; reason?: string | null }
  ) => Promise<WorkspaceDocument>;
  listDocumentAssets: (workspaceSlug: string, documentId: string) => Promise<WorkspaceDocumentAsset[]>;
  uploadDocumentAsset: (
    workspaceSlug: string,
    documentId: string,
    input: {
      type: DocumentAssetType;
      file: File;
      filename?: string;
      contentType?: string;
      onProgress?: (progress: { loaded: number; total: number | null; percent: number | null }) => void;
    }
  ) => Promise<WorkspaceDocumentAsset>;
  deleteDocumentAsset: (workspaceSlug: string, documentId: string, assetId: string) => Promise<void>;
  deleteWorkspaceDocument: (workspaceSlug: string, documentId: string) => Promise<void>;
  listWorkItemLinkedDocuments: (workspaceSlug: string, itemId: string) => Promise<WorkItemLinkedDocument[]>;
  linkDocumentToWorkItem: (
    workspaceSlug: string,
    itemId: string,
    documentId: string
  ) => Promise<WorkItemLinkedDocument[]>;
  unlinkDocumentFromWorkItem: (workspaceSlug: string, itemId: string, documentId: string) => Promise<void>;

  getAiCapabilities: (workspaceSlug: string) => Promise<AiCapabilities>;
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
  validateAiAgent: (workspaceSlug: string, agentId: string) => Promise<AiAgentRuntimeValidationResult>;
  publishAiAgent: (
    workspaceSlug: string,
    agentId: string,
    input?: { activateWorkflow?: boolean }
  ) => Promise<AiAgentRuntimePublishResult>;
  runAiAgent: (
    workspaceSlug: string,
    agentId: string,
    input?: RunAiAgentRuntimeInput
  ) => Promise<RunAiAgentRuntimeResult>;
  archiveAiAgent: (workspaceSlug: string, agentId: string) => Promise<{ id: string }>;
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
      role?: WorkspaceRole;
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
    input: { email: string; role: "ADMIN" | "MEMBER" | "VIEWER" | "CLIENT" }
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

export type AutomationWorkflowStatus = "draft" | "active" | "paused" | "archived";
export type AutomationWorkflowVersionStatus = "draft" | "published" | "archived";

export interface AutomationWorkflowGraphNode {
  id: string;
  type: string;
  label?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface AutomationWorkflowGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  condition?: Record<string, unknown>;
}

export interface AutomationWorkflowGraph {
  version: 1;
  nodes: AutomationWorkflowGraphNode[];
  edges: AutomationWorkflowGraphEdge[];
  metadata?: Record<string, unknown>;
}

export interface AutomationWorkflowVersion {
  id: string;
  workflowId: string;
  workspaceId: string;
  version: number;
  status: AutomationWorkflowVersionStatus;
  definitionJson: Record<string, unknown>;
  graphNodesJson: AutomationWorkflowGraphNode[];
  graphEdgesJson: AutomationWorkflowGraphEdge[];
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
}

export interface AutomationWorkflow {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: AutomationWorkflowStatus;
  currentVersionId: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersion?: AutomationWorkflowVersion | null;
}

export interface CreateAutomationWorkflowInput {
  name: string;
  description?: string | null;
  status?: Extract<AutomationWorkflowStatus, "draft" | "active" | "paused">;
}

export interface UpdateAutomationWorkflowInput {
  name?: string;
  description?: string | null;
  status?: AutomationWorkflowStatus;
}

export interface SaveAutomationWorkflowVersionInput {
  definition?: Record<string, unknown>;
  graph?: AutomationWorkflowGraph;
  graphNodes?: AutomationWorkflowGraphNode[];
  graphEdges?: AutomationWorkflowGraphEdge[];
}

export interface RunAutomationWorkflowInput {
  triggerType?: "manual";
  context?: Record<string, unknown>;
}

export interface RunAutomationWorkflowResult {
  runId: string;
  status: string;
  executionStatus: string;
  executedNodeIds: string[];
}

export interface AutomationRunEventSummary {
  id: string;
  runId: string;
  stepRunId: string | null;
  eventType: string;
  level: string;
  message: string;
  payload: unknown;
  createdAt: string;
}

export interface AutomationRunListItem {
  runId: string;
  workspaceId: string;
  workflowId: string;
  workflowName: string;
  workflowStatus: string;
  workflowVersionId: string;
  workflowVersion: number;
  workflowVersionStatus: string;
  status: string;
  triggerType: string;
  triggerRefId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
  stepsCount: number;
  failedStepsCount: number;
  sideEffectsCount: number;
  eventsCount: number;
  lastEvent: AutomationRunEventSummary | null;
  error: unknown;
}

export type AutomationApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";
export type AutomationApprovalType = "send_message" | "move_card" | "create_task" | "apply_ai_recommendation";

export interface ListAutomationApprovalsOptions {
  status?: AutomationApprovalStatus;
  type?: AutomationApprovalType;
  channel?: string;
  workflowId?: string;
  contactId?: string;
  workItemId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export interface AutomationApprovalRecord {
  id: string;
  workspaceId: string;
  runId: string;
  stepRunId: string;
  contactId: string | null;
  workItemId: string | null;
  type: AutomationApprovalType;
  status: AutomationApprovalStatus;
  title: string;
  description: string | null;
  payloadJson: unknown;
  decisionJson: unknown;
  requestedBy: string | null;
  reviewedBy: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentAssetType = "logo" | "attachment" | "generated_pdf" | "exported_html";

export interface WorkspaceDocumentAsset {
  id: string;
  workspaceId: string;
  documentId: string;
  type: DocumentAssetType | string;
  storageKey: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  uploadedBy: string;
  createdAt: string;
  contentUrl: string;
}

export interface WorkspaceDocumentFilters {
  search?: string;
  type?: DocumentKind;
  kind?: DocumentKind;
  folderId?: string | null;
  tags?: string[];
  status?: string;
  commercialStatus?: string;
  linkedWorkItemId?: string;
  createdBy?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  visibility?: WorkspaceDocumentMetadata["visibility"];
  page?: number;
  pageSize?: number;
  limit?: number;
  cursor?: string | null;
  sort?: "position_asc" | "updated_desc" | "updated_asc" | "created_desc" | "created_asc" | "title_asc";
}

export interface WorkspaceDocumentsPage {
  items: WorkspaceDocument[];
  total: number;
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  pageInfo: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
  };
}

export interface WorkspaceDocumentFolder {
  id: string;
  workspaceId: string;
  name: string;
  parentId: string | null;
  position: number;
  createdBy: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationApprovalSummary {
  approvalId: string;
  type: AutomationApprovalType;
  status: AutomationApprovalStatus;
  title: string;
  channel: string | null;
  contactMasked: string | null;
  contactName: string | null;
  workflowId: string;
  workflowName: string;
  runId: string;
  stepRunId: string;
  createdAt: string;
  requestedAt: string;
  expiresAt: string | null;
  lastEvent: {
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
  } | null;
}

export interface ReviewAutomationApprovalInput {
  editedPayload?: Record<string, unknown>;
  decisionReason?: string;
  decision?: Record<string, unknown>;
}

export interface ListCommunicationInboxOptions {
  status?: "open" | "pending" | "waiting_customer" | "waiting_internal" | "resolved" | "archived" | "blocked";
  channel?: "email" | "whatsapp";
  assignedTo?: string;
  workItemId?: string;
  contactId?: string;
  hasUnread?: boolean;
  hasPendingApproval?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export interface CommunicationConversationSummary {
  conversationId: string;
  contactName: string;
  contactMasked: string | null;
  channel: "email" | "whatsapp" | string;
  status: string;
  priority: string;
  assignedTo: { id: string; name: string | null; email: string } | null;
  workItemTitle: string | null;
  workItemId: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  hasPendingApproval: boolean;
  hasFailedMessage: boolean;
}

export interface CommunicationMessageSummary {
  id: string;
  direction: "inbound" | "outbound" | "system" | string;
  channel: string;
  provider: string | null;
  type: string;
  status: string | null;
  textPreview: string | null;
  body: unknown;
  occurredAt: string;
  sideEffect: unknown;
  providerEvent: unknown;
  approvalRequest: { id: string; type: string; status: string; title: string; requestedAt: string } | null;
  run: { runId: string; status: string; workflowId: string; workflowName: string; triggerType: string; createdAt: string } | null;
  metadata: unknown;
}

export interface CommunicationConversationDetail {
  conversation: {
    id: string;
    workspaceId: string;
    channel: string;
    status: string;
    priority: string;
    assignedTo: { id: string; name: string | null; email: string } | null;
    workItemId: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    archivedAt: string | null;
    resolvedAt: string | null;
  };
  contact: {
    id: string;
    displayName: string | null;
    companyName: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    status: string;
    preferredChannel: string | null;
  };
  channels: Array<{ id: string; channel: string; address: string | null; status: string; isPrimary: boolean }>;
  workItem: { id: string; title: string; description: string | null; status: string; type: string | null; updatedAt: string } | null;
  messages: CommunicationMessageSummary[];
  pendingApprovals: Array<{ approvalId: string; type: string; status: string; title: string; requestedAt: string }>;
  recentAutomationRuns: Array<{ runId: string; status: string; workflowId: string; workflowName: string; triggerType: string; createdAt: string }>;
  timelineEvents: Array<{ id: string; type: string; status: string | null; direction: string; occurredAt: string }>;
}

export interface AutomationApprovalDetail {
  approval: AutomationApprovalRecord;
  run: {
    runId: string;
    status: string;
    triggerType: string;
    workflowId: string;
    workflowName: string;
    workflowVersion: number;
    createdAt: string;
  };
  stepRun: {
    id: string;
    nodeId: string;
    nodeType: string;
    status: string;
    output: unknown;
  };
  contact: {
    id: string;
    displayName: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    status: string;
  } | null;
  contactChannel: {
    id: string;
    channel: string;
    address: string | null;
    status: string;
  } | null;
  workItem: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    type: string;
    updatedAt: string;
  } | null;
  aiOutput: unknown;
  draft: {
    channel: string | null;
    text: string;
    subject: string | null;
    templateKey: string | null;
  };
  timeline: Array<{
    id: string;
    eventType: string;
    level: string;
    message: string;
    payload: unknown;
    createdAt: string;
  }>;
  decision: unknown;
  sideEffects: Array<{
    id: string;
    status: string;
    sideEffectType: string;
    channel: string | null;
    provider: string | null;
    createdAt: string;
  }>;
}

export interface AutomationScheduledStepSummary {
  id: string;
  nodeId: string;
  purpose: string;
  executeAt: string;
  status: string;
  attempts: number;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationStepRunSummary {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  stepStatus: string;
  status: string;
  attempt: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  durationMs: number | null;
  input: unknown;
  output: unknown;
  error: unknown;
  idempotencyKey: string | null;
  scheduledSteps: AutomationScheduledStepSummary[];
}

export interface AutomationSideEffectSummary {
  id: string;
  runId: string;
  stepRunId: string;
  sideEffectType: string;
  channel: string | null;
  provider: string | null;
  status: string;
  providerMessageId: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  processedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  locked: boolean;
  idempotencyKey: string;
  templateVersionId: string | null;
  contact: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    companyName: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    status: string;
  } | null;
  contactChannel: {
    id: string;
    channel: string;
    label: string | null;
    address: string | null;
    normalizedAddress: string | null;
    status: string;
  } | null;
  payload: unknown;
  result: unknown;
  error: unknown;
  providerEvents: Array<{
    id: string;
    provider: string;
    channel: string;
    providerEventId: string;
    providerMessageId: string | null;
    eventType: string;
    status: string;
    payload: unknown;
    normalized: unknown;
    error: unknown;
    receivedAt: string;
    processedAt: string | null;
  }>;
}

export type WhatsAppTemplateApprovalStatus = "draft" | "pending_review" | "approved" | "rejected" | "paused" | "disabled";

export interface CommunicationTemplateVersion {
  id: string;
  workspaceId: string;
  templateId: string;
  version: number;
  status: string;
  approvalStatus: WhatsAppTemplateApprovalStatus;
  providerTemplateName: string | null;
  providerTemplateId: string | null;
  language: string | null;
  componentsJson: unknown;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  variablesJson: unknown;
  metadataJson: unknown;
  publishedAt: string | null;
  publishedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationTemplate {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  channel: string;
  category: string;
  status: string;
  description: string | null;
  providerTemplateName: string | null;
  providerTemplateId: string | null;
  language: string | null;
  approvalStatus: WhatsAppTemplateApprovalStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  versions: CommunicationTemplateVersion[];
}

export interface WhatsAppConsent {
  id: string;
  workspaceId: string;
  contactType: string | null;
  contactId: string | null;
  channel: "whatsapp";
  address: string;
  status: string;
  source: string | null;
  reason: string | null;
  optInAt: string | null;
  optOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWhatsAppTemplateInput {
  name: string;
  key: string;
  body: string;
  category?: string;
  language?: string;
  variables?: string[];
  providerTemplateName?: string;
}

export interface UpdateCommunicationTemplateVersionInput {
  textBody?: string | null;
  variables?: string[];
  approvalStatus?: WhatsAppTemplateApprovalStatus;
  providerTemplateName?: string | null;
  providerTemplateId?: string | null;
  language?: string | null;
}

export interface AutomationRunDetail {
  run: {
    runId: string;
    workspaceId: string;
    workflowId: string;
    workflowVersionId: string;
    status: string;
    triggerType: string;
    triggerRefId: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    createdAt: string;
    updatedAt: string;
    durationMs: number | null;
    context: unknown;
    error: unknown;
    canCancel: boolean;
    canRetry: boolean;
  };
  workflow: {
    id: string;
    name: string;
    status: string;
  };
  workflowVersion: {
    id: string;
    version: number;
    status: string;
  };
  summary: {
    stepsCount: number;
    failedStepsCount: number;
    sideEffectsCount: number;
    sentEmailsCount: number;
    retriesCount: number;
    eventsCount: number;
  };
  steps: AutomationStepRunSummary[];
  events: AutomationRunEventSummary[];
  sideEffects: AutomationSideEffectSummary[];
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

export interface AiAgentRuntimeValidationResult {
  agentId: string;
  valid: boolean;
  issues: string[];
  definition: Record<string, unknown>;
}

export interface AiAgentRuntimePublishResult {
  agentId: string;
  workflowId: string;
  workflowVersionId: string;
  valid: boolean;
  issues: string[];
}

export interface RunAiAgentRuntimeInput {
  instruction?: string;
  context?: Record<string, unknown>;
}

export interface RunAiAgentRuntimeResult {
  agentId: string;
  workflowId: string;
  workflowVersionId: string;
  runId: string;
  status: string;
  executionStatus: string;
  executedNodeIds: string[];
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

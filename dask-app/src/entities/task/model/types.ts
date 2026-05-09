import type { MemberId } from "@/entities/member/model/types";

export type TaskStatusId = string;
export type TaskPriority = 0 | 1 | 2 | 3 | 4;
export type TaskType = string;

export type TaskCustomFieldValue = string | number | boolean | string[] | TaskChecklist | Record<string, unknown> | null;
export type TaskCustomFields = Record<string, TaskCustomFieldValue>;

export type TaskFieldType =
  | "text"
  | "long_text"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "catalog_select"
  | "multi_select"
  | "boolean"
  | "user"
  | "checklist"
  | "priority"
  | "status"
  | "tag"
  | "schedule"
  | "work_item_type"
  | "billing_summary";

export type BillingChargeSummaryStatus =
  | "DRAFT"
  | "CHECKOUT_OPEN"
  | "CHECKOUT_COMPLETED"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED";

export interface BillingChargeSummaryEntry {
  id: string;
  title: string;
  amount: number;
  currency: string;
  status: BillingChargeSummaryStatus;
}

export interface TaskFieldCapabilities {
  aiEnhance?: boolean;
  selectable?: boolean;
  multiSelectable?: boolean;
}

export interface TaskFieldOption {
  id: string;
  label: string;
  value: string;
  color?: string | null;
  order?: number;
  isActive?: boolean;
  catalogItem?: {
    id: string;
    kind: string;
    billingType: string;
    recurringInterval: string | null;
    recurringIntervalCount: number | null;
    name: string;
    description: string | null;
    amount: number;
    currency: string;
    metadata: Record<string, string> | null;
  };
}

export type TaskFieldBindingDisplayContext = "card" | "detail";
export type TaskFieldSurface = "detail" | "form" | "inline" | "table" | "card" | "filter";
export type TaskFieldCardArea = "badge" | "title" | "description" | "summary" | "tags" | "custom-field" | "meta";
export type TaskFieldDetailZone = "main" | "side";
export type TaskFieldVisualPriority = "primary" | "secondary" | "supporting";

export interface TaskFieldBindingSettings {
  cardArea?: TaskFieldCardArea;
  detailZone?: TaskFieldDetailZone;
  visualPriority?: TaskFieldVisualPriority;
  surfaces?: Partial<Record<TaskFieldSurface, boolean>>;
}

export interface TaskFieldBinding {
  id: string;
  fieldId: string;
  typeId: string;
  fieldDefinitionId?: string;
  workItemTypeId?: string;
  displayContext: TaskFieldBindingDisplayContext;
  order: number;
  section?: string | null;
  isVisible: boolean;
  isRequiredOverride?: boolean | null;
  isReadonlyOverride?: boolean | null;
  settings?: TaskFieldBindingSettings | null;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TaskChecklist {
  items: ChecklistItem[];
}

export interface LinkedTaskDocument {
  id: string;
  title: string;
  kind?: "wiki" | "proposal" | "contract";
  status?: string;
  createdAt?: string;
  updatedAt: string;
  linkedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  text: string;
  createdById?: string;
  type: TaskType;
  status: TaskStatusId;
  position?: number;
  priority: TaskPriority;
  tags: string[];
  assignee: MemberId;
  checklist: TaskChecklist;
  due: string;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  linkedDocuments?: LinkedTaskDocument[];
  customFieldValuesById?: TaskCustomFields;
  customFields: TaskCustomFields;
}

export interface TaskStatus {
  id: TaskStatusId;
  label: string;
  dot: string;
  category?: string | null;
  isTerminal?: boolean;
}

export interface PriorityMetaItem {
  label: string;
  className: string;
}

export type PriorityMeta = Record<TaskPriority, PriorityMetaItem>;

export interface TaskTypeMetaItem {
  id: TaskType;
  label: string;
  background: string;
  border: string;
  text: string;
}

export interface TaskFieldDefinition {
  id: string;
  definitionId?: string;
  label: string;
  name?: string;
  slug?: string;
  description?: string | null;
  variableKey?: string;
  variableLabel?: string;
  variableDescription?: string;
  type: TaskFieldType;
  options?: TaskFieldOption[];
  required?: boolean;
  isEditable?: boolean;
  isRemovable?: boolean;
  isActive?: boolean;
  order?: number;
  config?: Record<string, unknown> | null;
  defaultValue?: TaskCustomFieldValue;
  capabilities?: TaskFieldCapabilities;
  storage?: Record<string, unknown> | null;
}

export interface CardLayoutConfig {
  visibleFieldIds: string[];
  /** Campos visíveis por tipo de work item. Sobrepõe visibleFieldIds para aquele tipo. */
  visibleFieldIdsByType?: Record<string, string[]>;
  /** Campos visiveis no detalhe expandido por tipo de work item. */
  detailVisibleFieldIdsByType?: Record<string, string[]>;
  detailFieldZoneByType?: Record<string, Record<string, "main" | "side">>;
}

export type BoardViewStatusSource =
  | { kind: "workflow_state" }
  | {
      kind: "custom_field";
      fieldId: string;
      fallbackByStatus?: Record<string, string>;
    };

export interface BoardViewConfig {
  id: string;
  label: string;
  caption?: string;
  statuses: TaskStatus[];
  statusSource: BoardViewStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnIds?: string[];
  visibleStatusIds?: string[];
  createTaskColumnIds?: string[];
  analyticsRole?: "prospecting" | "funnel" | "terminal" | "client";
}

export interface BoardOperationalFunnelStage {
  key: string;
  label: string;
  statusIds: string[];
  color: string;
}

export interface BoardLeadOperationalMetadata {
  schemaVersion: 1;
  itemTypeIds: string[];
  defaultItemTypeId: string;
  initialStatusId: string;
  funnel: BoardOperationalFunnelStage[];
  activeStatusIds: string[];
  wonStatusIds: string[];
  lostStatusIds: string[];
  terminalStatusIds: string[];
  proposalRequiredStatusIds: string[];
  prospecting?: {
    itemTypeIds: string[];
    statusIds: string[];
    initialStatusId: string | null;
  };
}

export interface BoardOperationalMetadata {
  schemaVersion: 1;
  leads?: BoardLeadOperationalMetadata;
}

export interface BoardConfig {
  statuses: TaskStatus[];
  taskTypes: TaskTypeMetaItem[];
  fieldDefinitions: TaskFieldDefinition[];
  /** Fonte primaria de exibicao por tipo/contexto. */
  fieldBindings?: TaskFieldBinding[];
  /** Compatibilidade legada para consumidores ainda nao migrados. */
  cardLayout: CardLayoutConfig;
  perspectives: BoardViewConfig[];
  operationalMetadata?: BoardOperationalMetadata;
  /** @deprecated Use perspectives. */
  views?: BoardViewConfig[];
}

export interface BoardMetrics {
  total: number;
  doing: number;
  review: number;
  done: number;
  dueThisWeek: number;
  donePercent: number;
  active: number;
}

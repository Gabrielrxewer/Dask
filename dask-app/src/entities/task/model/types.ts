import type { MemberId } from "@/entities/member/model/types";

export type TaskStatusId = string;
export type TaskPriority = 0 | 1 | 2 | 3 | 4;
export type TaskType = string;

export type TaskCustomFieldValue = string | number | boolean | string[] | null;
export type TaskCustomFields = Record<string, TaskCustomFieldValue>;

export type TaskFieldType = "text" | "number" | "date" | "select" | "multi-select" | "boolean";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface TaskChecklist {
  items: ChecklistItem[];
}

export interface Task {
  id: string;
  title: string;
  text: string;
  type: TaskType;
  status: TaskStatusId;
  priority: TaskPriority;
  tags: string[];
  assignee: MemberId;
  checklist: TaskChecklist;
  due: string;
  customFields: TaskCustomFields;
}

export interface TaskStatus {
  id: TaskStatusId;
  label: string;
  dot: string;
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
  label: string;
  type: TaskFieldType;
  options?: string[];
}

export interface CardLayoutConfig {
  visibleFieldIds: string[];
  /** Campos visíveis por tipo de work item. Sobrepõe visibleFieldIds para aquele tipo. */
  visibleFieldIdsByType?: Record<string, string[]>;
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
}

export interface BoardConfig {
  statuses: TaskStatus[];
  taskTypes: TaskTypeMetaItem[];
  fieldDefinitions: TaskFieldDefinition[];
  cardLayout: CardLayoutConfig;
  perspectives: BoardViewConfig[];
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

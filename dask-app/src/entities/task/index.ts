export { priorityMeta, taskPriorityOptions } from "@/entities/task/model/task-statuses";
export { factoryBoardConfig, buildTaskTypeMetaMap } from "@/entities/task/model/board-config";
export {
  applyFieldCapabilityOverrides,
  CARD_FIELDS_SCHEMA_VERSION,
  getTaskFieldTypeLabel,
  inferCapabilitiesByType,
  isSystemCardFieldId,
  mergeCardFieldDefinitions,
  resolveFieldIdsForTaskType,
  resolveVisibleCardFieldIds
} from "@/entities/task/model/card-fields";
export { initialTasks } from "@/entities/task/model/mock-tasks";
export {
  groupTasksByStatus,
  buildBoardMetrics,
  buildTaskChecklistSummary,
  getTaskTypeDisplayMeta
} from "@/entities/task/model/task-selectors";
export { TaskCard } from "@/entities/task/ui/task-card";
export type {
  BoardConfig,
  BoardMetrics,
  Task,
  TaskFieldDefinition,
  TaskPriority,
  TaskStatus,
  TaskStatusId,
  TaskType,
  TaskTypeMetaItem,
  TaskCustomFieldValue,
  LinkedTaskDocument
} from "@/entities/task/model/types";

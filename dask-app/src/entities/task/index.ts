export { priorityMeta, taskPriorityOptions } from "@/entities/task/model/task-statuses";
export { factoryBoardConfig, buildTaskTypeMetaMap } from "@/entities/task/model/board-config";
export {
  applyFieldDefinitionOverrides,
  applyFieldCapabilityOverrides,
  CARD_FIELDS_SCHEMA_VERSION,
  getTaskFieldTypeLabel,
  inferCapabilitiesByType,
  injectCatalogOptionsIntoBoardConfig,
  mergeCardFieldDefinitions,
  resolveFieldIdsForTaskType,
  resolveVisibleCardFieldIds
} from "@/entities/task/model/card-fields";
export {
  buildTaskInputFromFieldDrafts,
  createTaskFieldDrafts,
  formatTaskFieldValue,
  getTaskFieldRegistryEntry,
  isTaskFieldValueEmpty,
  matchesTaskFieldStorage,
  readTaskFieldStorage,
  resolveTaskFieldCardArea,
  resolveTaskFieldDetailZone,
  resolveTaskFieldOptions,
  resolveTaskFieldValue,
  supportsAiGenerationForField
} from "@/entities/task/model/field-registry";
export {
  buildTaskFieldBindingsForType,
  buildDefaultTaskFieldBindingSettings,
  materializeTaskFieldBinding,
  resolveWorkItemFieldBindings,
  resolveWorkItemFieldBindingsForContext
} from "@/entities/task/model/field-bindings";
export {
  buildTaskCardRenderModel,
  CARD_SLOT_LIMITS,
  type ResolvedTaskCardField,
  type TaskCardDebugField,
  type TaskCardDebugSnapshot,
  type TaskCardRenderModel,
  type TaskCardSlotArea
} from "@/entities/task/model/task-card-render-model";
export { initialTasks } from "@/entities/task/model/mock-tasks";
export {
  groupTasksByStatus,
  buildBoardMetrics,
  buildTaskChecklistSummary,
  getTaskTypeDisplayMeta
} from "@/entities/task/model/task-selectors";
export { TaskCard } from "@/entities/task/ui/task-card";
export { FieldShell, WorkItemFieldRenderer, resolveFieldShellStyle } from "@/entities/task/ui/field-presentation";
export {
  getTaskFieldTypeSpec,
  normalizeTaskFieldPresentationValue,
  taskFieldTypeSpecs,
  validateTaskFieldPresentationValue
} from "@/entities/task/ui/field-presentation";
export type {
  BoardConfig,
  BoardMetrics,
  Task,
  TaskChecklist,
  TaskFieldBinding,
  TaskFieldBindingSettings,
  TaskFieldCardArea,
  TaskFieldDefinition,
  TaskFieldDetailZone,
  TaskFieldOption,
  TaskPriority,
  TaskStatus,
  TaskStatusId,
  TaskFieldVisualPriority,
  TaskType,
  TaskTypeMetaItem,
  TaskCustomFieldValue,
  LinkedTaskDocument
} from "@/entities/task/model/types";
export type {
  FieldControllerResult,
  FieldPresentationComponent,
  FieldPresentationComponentProps,
  FieldPresentationContext,
  FieldPresentationMode,
  FieldPresentationProps,
  FieldHelpMode,
  FieldShellKind,
  ResolvedFieldShellStyle,
  FieldTypeSpec
} from "@/entities/task/ui/field-presentation";

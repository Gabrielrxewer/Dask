export { priorityMeta, taskPriorityOptions } from "@/entities/task/model/task-statuses";
export { factoryBoardConfig, buildTaskTypeMetaMap } from "@/entities/task/model/board-config";
export { initialTasks } from "@/entities/task/model/mock-tasks";
export { groupTasksByStatus, buildBoardMetrics } from "@/entities/task/model/task-selectors";
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
  TaskCustomFieldValue
} from "@/entities/task/model/types";

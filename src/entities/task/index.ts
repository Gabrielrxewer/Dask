export { taskStatuses, priorityMeta } from "@/entities/task/model/task-statuses";
export { initialTasks } from "@/entities/task/model/mock-tasks";
export { groupTasksByStatus, buildBoardMetrics } from "@/entities/task/model/task-selectors";
export { TaskCard } from "@/entities/task/ui/task-card";
export type {
  BoardMetrics,
  Task,
  TaskPriority,
  TaskStatus,
  TaskStatusId
} from "@/entities/task/model/types";

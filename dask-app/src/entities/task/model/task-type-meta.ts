import type { TaskTypeMetaItem } from "@/entities/task/model/types";

export function buildTaskTypeMetaMap(taskTypes: TaskTypeMetaItem[]): Record<string, TaskTypeMetaItem> {
  return taskTypes.reduce<Record<string, TaskTypeMetaItem>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
}

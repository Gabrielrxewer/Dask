import type { Member, MemberId } from "@/entities/member";
import { buildTaskTypeMetaMap } from "@/entities/task";
import type { BoardConfig, Task } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter/model/types";

export const initialDashboardFilter: DashboardFilterState = {
  query: "",
  mineOnly: false
};

function stringifyCustomField(value: Task["customFields"][string]): string {
  if (Array.isArray(value)) {
    return value.join(" ");
  }
  if (typeof value === "boolean") {
    return value ? "true sim yes" : "false nao no";
  }
  if (value === null || typeof value === "undefined") {
    return "";
  }
  return String(value);
}

export function applyDashboardFilter(
  tasks: Task[],
  filter: DashboardFilterState,
  boardConfig: BoardConfig,
  membersById: Record<MemberId, Member>,
  currentUserId: MemberId
): Task[] {
  const normalizedQuery = filter.query.trim().toLowerCase();
  const taskTypeMap = buildTaskTypeMetaMap(boardConfig.taskTypes);

  return tasks.filter(task => {
    const assigneeName = membersById[task.assignee]?.name ?? "";
    const typeLabel = taskTypeMap[task.type]?.label ?? task.type;
    const customFieldsText = Object.values(task.customFields).map(stringifyCustomField).join(" ");

    const haystack = [task.title, task.text, typeLabel, task.tags.join(" "), assigneeName, customFieldsText]
      .join(" ")
      .toLowerCase();

    const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
    const matchesOwner = !filter.mineOnly || task.assignee === currentUserId;

    return matchesQuery && matchesOwner;
  });
}

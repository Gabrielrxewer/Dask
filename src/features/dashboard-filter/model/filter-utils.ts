import type { Member, MemberId } from "@/entities/member";
import type { Task } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter/model/types";

export const initialDashboardFilter: DashboardFilterState = {
  query: "",
  mineOnly: false
};

export function applyDashboardFilter(
  tasks: Task[],
  filter: DashboardFilterState,
  membersById: Record<MemberId, Member>,
  currentUserId: MemberId
): Task[] {
  const normalizedQuery = filter.query.trim().toLowerCase();

  return tasks.filter(task => {
    const assigneeName = membersById[task.assignee]?.name ?? "";
    const haystack = [task.title, task.text, task.tags.join(" "), assigneeName]
      .join(" ")
      .toLowerCase();

    const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
    const matchesOwner = !filter.mineOnly || task.assignee === currentUserId;

    return matchesQuery && matchesOwner;
  });
}

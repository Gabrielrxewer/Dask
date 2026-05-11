import { MemberAvatar, type MembersById } from "@/entities/member";
import type { Task } from "@/entities/task";

interface WorkItemAssigneeCellProps {
  task: Task;
  membersById: MembersById;
}

export function WorkItemAssigneeCell({ task, membersById }: WorkItemAssigneeCellProps) {
  const owner = membersById[task.assignee];

  if (!owner) {
    return <span className="work-item-cell-empty">-</span>;
  }

  return (
    <span className="work-item-cell-owner">
      <MemberAvatar member={owner} />
      <span>{owner.name}</span>
    </span>
  );
}

import type { MemberId } from "@/entities/member/model/types";

export type TaskStatusId = "backlog" | "doing" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";

export interface TaskChecklist {
  done: number;
  total: number;
}

export interface Task {
  id: string;
  title: string;
  text: string;
  status: TaskStatusId;
  priority: TaskPriority;
  tags: string[];
  assignee: MemberId;
  checklist: TaskChecklist;
  due: string;
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

export interface BoardMetrics {
  total: number;
  doing: number;
  review: number;
  done: number;
  dueThisWeek: number;
  donePercent: number;
  active: number;
}

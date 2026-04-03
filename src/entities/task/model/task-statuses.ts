import type { PriorityMeta, TaskStatus } from "@/entities/task/model/types";

export const taskStatuses: TaskStatus[] = [
  { id: "backlog", label: "Backlog", dot: "#8b9bb0" },
  { id: "doing", label: "Em Progresso", dot: "#0d8df7" },
  { id: "review", label: "Review", dot: "#f59e0b" },
  { id: "done", label: "Done", dot: "#22c55e" }
];

export const priorityMeta: PriorityMeta = {
  high: { label: "Urgente", className: "task-card__priority--high" },
  medium: { label: "Media", className: "task-card__priority--medium" },
  low: { label: "Baixa", className: "task-card__priority--low" }
};

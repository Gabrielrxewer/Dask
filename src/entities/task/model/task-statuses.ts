import type { PriorityMeta } from "@/entities/task/model/types";

export const priorityMeta: PriorityMeta = {
  high: { label: "Urgente", className: "task-card__priority--high" },
  medium: { label: "Media", className: "task-card__priority--medium" },
  low: { label: "Baixa", className: "task-card__priority--low" }
};

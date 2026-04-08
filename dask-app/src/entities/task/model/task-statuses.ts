import type { PriorityMeta, TaskPriority } from "@/entities/task/model/types";

export const taskPriorityOptions: TaskPriority[] = [0, 1, 2, 3, 4];

export const priorityMeta: PriorityMeta = {
  0: { label: "P0 Critica", className: "task-card__priority--0" },
  1: { label: "P1 Alta", className: "task-card__priority--1" },
  2: { label: "P2 Media", className: "task-card__priority--2" },
  3: { label: "P3 Baixa", className: "task-card__priority--3" },
  4: { label: "P4 Minima", className: "task-card__priority--4" }
};

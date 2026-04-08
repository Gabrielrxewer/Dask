import type { DragEvent } from "react";
import type { Task, TaskStatusId } from "@/entities/task";

export const TASK_DRAG_KEY = "application/x-dask-task-id";

export function setTaskDragPayload(event: DragEvent<HTMLElement>, taskId: string): void {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(TASK_DRAG_KEY, taskId);
}

export function getTaskDragPayload(event: DragEvent<HTMLElement>): string {
  return event.dataTransfer.getData(TASK_DRAG_KEY) || "";
}

export function moveTaskToStatus(
  tasks: Task[],
  taskId: string,
  nextStatus: TaskStatusId
): Task[] {
  return tasks.map(task => (task.id === taskId ? { ...task, status: nextStatus } : task));
}

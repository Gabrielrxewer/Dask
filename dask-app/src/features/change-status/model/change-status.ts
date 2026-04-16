import type { DragEvent } from "react";
import type { Task, TaskStatusId } from "@/entities/task";

export const TASK_DRAG_KEY = "application/x-dask-task-id";

export function setTaskDragPayload(event: DragEvent<HTMLElement>, taskId: string): void {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(TASK_DRAG_KEY, taskId);
  event.dataTransfer.setData("text/plain", taskId);

  const source = event.currentTarget;
  const rect = source.getBoundingClientRect();
  const preview = source.cloneNode(true) as HTMLElement;
  preview.style.position = "fixed";
  preview.style.top = "-1000px";
  preview.style.left = "-1000px";
  preview.style.width = `${rect.width}px`;
  preview.style.pointerEvents = "none";
  preview.style.opacity = "0.96";
  preview.style.transform = "rotate(2deg)";
  preview.style.boxShadow = "0 18px 36px rgba(12, 42, 73, 0.22)";
  preview.style.zIndex = "9999";
  preview.classList.add("task-card--drag-preview");

  document.body.appendChild(preview);
  const offsetX = Math.min(42, Math.max(16, rect.width * 0.2));
  const offsetY = 24;
  event.dataTransfer.setDragImage(preview, offsetX, offsetY);

  window.setTimeout(() => {
    preview.remove();
  }, 0);
}

export function getTaskDragPayload(event: DragEvent<HTMLElement>): string {
  return event.dataTransfer.getData(TASK_DRAG_KEY) || event.dataTransfer.getData("text/plain") || "";
}

export function moveTaskToStatus(
  tasks: Task[],
  taskId: string,
  nextStatus: TaskStatusId
): Task[] {
  return tasks.map(task => (task.id === taskId ? { ...task, status: nextStatus } : task));
}

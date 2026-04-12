import type { Task, TaskCustomFieldValue, TaskPriority, TaskStatusId } from "@/entities/task";
import { createTaskFromInput } from "@/modules/workspace/model/mock-workspace";
import type {
  CreateTaskInput,
  WorkspaceAutomation,
  WorkspacePreferences,
  WorkspaceSnapshot
} from "@/modules/workspace/model/types";

function updateTasksInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  updater: (tasks: Task[]) => Task[]
): WorkspaceSnapshot {
  return {
    ...snapshot,
    tasks: updater(snapshot.tasks)
  };
}

function updateTaskInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  taskId: string,
  updater: (task: Task) => Task
): WorkspaceSnapshot {
  return updateTasksInWorkspaceSnapshot(snapshot, tasks =>
    tasks.map(task => (task.id === taskId ? updater(task) : task))
  );
}

export function createTaskInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  input: CreateTaskInput
): WorkspaceSnapshot {
  const nextTask = createTaskFromInput(input, snapshot.currentUserId);

  return {
    ...snapshot,
    tasks: [nextTask, ...snapshot.tasks]
  };
}

export function moveTaskInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  taskId: string,
  nextStatus: TaskStatusId
): WorkspaceSnapshot {
  return updateTaskInWorkspaceSnapshot(snapshot, taskId, task => ({ ...task, status: nextStatus }));
}

export function updateTaskPriorityInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  taskId: string,
  priority: TaskPriority
): WorkspaceSnapshot {
  return updateTaskInWorkspaceSnapshot(snapshot, taskId, task => ({ ...task, priority }));
}

export function updateTaskCustomFieldInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  taskId: string,
  fieldId: string,
  value: TaskCustomFieldValue
): WorkspaceSnapshot {
  return updateTaskInWorkspaceSnapshot(snapshot, taskId, task => ({
    ...task,
    customFields: {
      ...task.customFields,
      [fieldId]: value
    }
  }));
}

export function toggleTaskChecklistItemInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  taskId: string,
  itemId: string
): WorkspaceSnapshot {
  return updateTaskInWorkspaceSnapshot(snapshot, taskId, task => ({
    ...task,
    checklist: {
      items: task.checklist.items.map(item => (item.id === itemId ? { ...item, done: !item.done } : item))
    }
  }));
}

export function updateAutomationStatusInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  automationId: string,
  status: WorkspaceAutomation["status"]
): WorkspaceSnapshot {
  return {
    ...snapshot,
    automations: snapshot.automations.map(automation =>
      automation.id === automationId ? { ...automation, status } : automation
    )
  };
}

export function updatePreferencesInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  patch: Partial<WorkspacePreferences>
): WorkspaceSnapshot {
  return {
    ...snapshot,
    preferences: {
      ...snapshot.preferences,
      ...patch
    }
  };
}

export function setCardFieldVisibilityInWorkspaceSnapshot(
  snapshot: WorkspaceSnapshot,
  fieldId: string,
  visible: boolean
): WorkspaceSnapshot {
  const visibleFields = new Set(snapshot.boardConfig.cardLayout.visibleFieldIds);

  if (visible) {
    visibleFields.add(fieldId);
  } else {
    visibleFields.delete(fieldId);
  }

  const visibleFieldIds = Array.from(visibleFields);

  return {
    ...snapshot,
    boardConfig: {
      ...snapshot.boardConfig,
      cardLayout: {
        ...snapshot.boardConfig.cardLayout,
        visibleFieldIds
      }
    },
    preferences: {
      ...snapshot.preferences,
      visibleCardFieldIds: visibleFieldIds
    }
  };
}

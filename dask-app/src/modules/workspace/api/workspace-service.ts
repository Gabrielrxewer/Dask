import { withMockLatency } from "@/shared/api/http-client";
import { createInitialWorkspaceSnapshot, cloneWorkspaceSnapshot, createTaskFromInput } from "@/modules/workspace/model/mock-workspace";
import type { WorkspacePreferences, WorkspaceService, WorkspaceSnapshot } from "@/modules/workspace/model/types";

let workspaceSnapshot: WorkspaceSnapshot = createInitialWorkspaceSnapshot();

function saveAndReturn(nextState: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
  workspaceSnapshot = nextState;
  return withMockLatency(cloneWorkspaceSnapshot(workspaceSnapshot));
}

export const workspaceService: WorkspaceService = {
  async getSnapshot() {
    return withMockLatency(cloneWorkspaceSnapshot(workspaceSnapshot));
  },

  async createTask(input) {
    const nextTask = createTaskFromInput(input, workspaceSnapshot.currentUserId);

    return saveAndReturn({
      ...workspaceSnapshot,
      tasks: [nextTask, ...workspaceSnapshot.tasks]
    });
  },

  async moveTask(taskId, nextStatus) {
    return saveAndReturn({
      ...workspaceSnapshot,
      tasks: workspaceSnapshot.tasks.map(task =>
        task.id === taskId ? { ...task, status: nextStatus } : task
      )
    });
  },

  async updateTaskPriority(taskId, priority) {
    return saveAndReturn({
      ...workspaceSnapshot,
      tasks: workspaceSnapshot.tasks.map(task =>
        task.id === taskId ? { ...task, priority } : task
      )
    });
  },

  async updateTaskCustomField(taskId, fieldId, value) {
    return saveAndReturn({
      ...workspaceSnapshot,
      tasks: workspaceSnapshot.tasks.map(task =>
        task.id === taskId
          ? { ...task, customFields: { ...task.customFields, [fieldId]: value } }
          : task
      )
    });
  },

  async toggleChecklistItem(taskId, itemId) {
    return saveAndReturn({
      ...workspaceSnapshot,
      tasks: workspaceSnapshot.tasks.map(task => {
        if (task.id !== taskId) {
          return task;
        }

        return {
          ...task,
          checklist: {
            items: task.checklist.items.map(item =>
              item.id === itemId ? { ...item, done: !item.done } : item
            )
          }
        };
      })
    });
  },

  async setAutomationStatus(automationId, status) {
    return saveAndReturn({
      ...workspaceSnapshot,
      automations: workspaceSnapshot.automations.map(automation =>
        automation.id === automationId ? { ...automation, status } : automation
      )
    });
  },

  async updatePreferences(patch) {
    const preferences: WorkspacePreferences = {
      ...workspaceSnapshot.preferences,
      ...patch
    };

    return saveAndReturn({
      ...workspaceSnapshot,
      preferences
    });
  },

  async setCardFieldVisibility(fieldId, visible) {
    const visibleFields = new Set(workspaceSnapshot.boardConfig.cardLayout.visibleFieldIds);

    if (visible) {
      visibleFields.add(fieldId);
    } else {
      visibleFields.delete(fieldId);
    }

    const visibleFieldIds = Array.from(visibleFields);

    return saveAndReturn({
      ...workspaceSnapshot,
      boardConfig: {
        ...workspaceSnapshot.boardConfig,
        cardLayout: {
          ...workspaceSnapshot.boardConfig.cardLayout,
          visibleFieldIds
        }
      },
      preferences: {
        ...workspaceSnapshot.preferences,
        visibleCardFieldIds: visibleFieldIds
      }
    });
  }
};

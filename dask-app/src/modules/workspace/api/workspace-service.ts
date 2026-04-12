import { withMockLatency } from "@/shared/api/http-client";
import { createInitialWorkspaceSnapshot, cloneWorkspaceSnapshot } from "@/modules/workspace/model/mock-workspace";
import {
  createTaskInWorkspaceSnapshot,
  moveTaskInWorkspaceSnapshot,
  setCardFieldVisibilityInWorkspaceSnapshot,
  toggleTaskChecklistItemInWorkspaceSnapshot,
  updateAutomationStatusInWorkspaceSnapshot,
  updatePreferencesInWorkspaceSnapshot,
  updateTaskCustomFieldInWorkspaceSnapshot,
  updateTaskPriorityInWorkspaceSnapshot
} from "@/modules/workspace/model/snapshot-mutations";
import type { WorkspaceService, WorkspaceSnapshot } from "@/modules/workspace/model/types";

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
    return saveAndReturn(createTaskInWorkspaceSnapshot(workspaceSnapshot, input));
  },

  async moveTask(taskId, nextStatus) {
    return saveAndReturn(moveTaskInWorkspaceSnapshot(workspaceSnapshot, taskId, nextStatus));
  },

  async updateTaskPriority(taskId, priority) {
    return saveAndReturn(updateTaskPriorityInWorkspaceSnapshot(workspaceSnapshot, taskId, priority));
  },

  async updateTaskCustomField(taskId, fieldId, value) {
    return saveAndReturn(updateTaskCustomFieldInWorkspaceSnapshot(workspaceSnapshot, taskId, fieldId, value));
  },

  async toggleChecklistItem(taskId, itemId) {
    return saveAndReturn(toggleTaskChecklistItemInWorkspaceSnapshot(workspaceSnapshot, taskId, itemId));
  },

  async setAutomationStatus(automationId, status) {
    return saveAndReturn(updateAutomationStatusInWorkspaceSnapshot(workspaceSnapshot, automationId, status));
  },

  async updatePreferences(patch) {
    return saveAndReturn(updatePreferencesInWorkspaceSnapshot(workspaceSnapshot, patch));
  },

  async setCardFieldVisibility(fieldId, visible) {
    return saveAndReturn(setCardFieldVisibilityInWorkspaceSnapshot(workspaceSnapshot, fieldId, visible));
  }
};

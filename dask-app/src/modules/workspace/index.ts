export { workspaceService } from "@/modules/workspace/api";
export {
  cloneWorkspaceSnapshot,
  countActiveAutomations,
  countPausedAutomations,
  createInitialWorkspaceSnapshot,
  createTaskFromInput,
  defaultWorkspacePreferences,
  getSelectedTask,
  getSelectedTaskStatus,
  getWorkspaceAutomations,
  getWorkspaceBoardConfig,
  getWorkspaceCurrentUserId,
  getWorkspaceMembers,
  getWorkspaceMetrics,
  getWorkspacePreferences,
  getWorkspaceTasks,
  useWorkspaceTaskPage,
  workspaceBoardModeOptions,
  workspaceDateFormatOptions
} from "@/modules/workspace/model";
export type {
  CreateTaskInput,
  WorkspaceAutomation,
  WorkspaceBoardMode,
  WorkspaceDateFormat,
  WorkspacePreferences,
  WorkspaceSnapshot
} from "@/modules/workspace/model";
export { WorkspaceProvider, useWorkspace } from "@/modules/workspace/providers";
export { SelectedTaskDetailsModal } from "@/modules/workspace/ui";

export { workspaceService } from "@/modules/workspace/api";
export {
  cloneWorkspaceSnapshot,
  createInitialWorkspaceSnapshot,
  createTaskFromInput,
  useWorkspaceTaskPage
} from "@/modules/workspace/model";
export type {
  CreateTaskInput,
  WorkspaceAutomation,
  WorkspaceBoardMode,
  WorkspaceDateFormat,
  WorkspacePreferences,
  WorkspaceSummary,
  WorkspaceTemplateOption,
  WorkspaceSnapshot
} from "@/modules/workspace/model";
export { WorkspaceProvider, useWorkspace } from "@/modules/workspace/providers";

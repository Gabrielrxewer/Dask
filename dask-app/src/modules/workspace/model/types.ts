import type { MemberId, MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskStatusId } from "@/entities/task";

export type WorkspaceBoardMode = "dev" | "po" | "manager" | "qa";
export type WorkspaceDateFormat = "dd/mm/yyyy" | "mm/dd/yyyy";

export interface WorkspaceAutomation {
  id: string;
  title: string;
  status: "active" | "paused";
  trigger: string;
  action: string;
}

export interface WorkspacePreferences {
  defaultBoardMode: WorkspaceBoardMode;
  dateFormat: WorkspaceDateFormat;
  visibleCardFieldIds: string[];
}

export interface CreateTaskInput {
  type: string;
  title: string;
  description: string;
}

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  currentUserId: MemberId;
  membersById: MembersById;
  tasks: Task[];
  boardConfig: BoardConfig;
  automations: WorkspaceAutomation[];
  preferences: WorkspacePreferences;
}

export interface WorkspaceService {
  getSnapshot: () => Promise<WorkspaceSnapshot>;
  createTask: (input: CreateTaskInput) => Promise<WorkspaceSnapshot>;
  moveTask: (taskId: string, nextStatus: TaskStatusId) => Promise<WorkspaceSnapshot>;
  updateTaskCustomField: (
    taskId: string,
    fieldId: string,
    value: TaskCustomFieldValue
  ) => Promise<WorkspaceSnapshot>;
  toggleChecklistItem: (taskId: string, itemId: string) => Promise<WorkspaceSnapshot>;
  setAutomationStatus: (
    automationId: string,
    status: WorkspaceAutomation["status"]
  ) => Promise<WorkspaceSnapshot>;
  updatePreferences: (patch: Partial<WorkspacePreferences>) => Promise<WorkspaceSnapshot>;
  setCardFieldVisibility: (fieldId: string, visible: boolean) => Promise<WorkspaceSnapshot>;
}

import { currentUserId, membersById, type MemberId, type MembersById } from "@/entities/member";
import {
  buildBoardMetrics,
  factoryBoardConfig,
  type BoardConfig,
  type BoardMetrics,
  type Task,
  type TaskStatus
} from "@/entities/task";
import { defaultWorkspacePreferences } from "@/modules/workspace/model/options";
import type { WorkspaceAutomation, WorkspacePreferences, WorkspaceSnapshot } from "@/modules/workspace/model/types";

export function getWorkspaceTasks(snapshot: WorkspaceSnapshot | null): Task[] {
  return snapshot?.tasks ?? [];
}

export function getWorkspaceBoardConfig(snapshot: WorkspaceSnapshot | null): BoardConfig {
  return snapshot?.boardConfig ?? factoryBoardConfig;
}

export function getWorkspaceMembers(snapshot: WorkspaceSnapshot | null): MembersById {
  return snapshot?.membersById ?? membersById;
}

export function getWorkspaceCurrentUserId(snapshot: WorkspaceSnapshot | null): MemberId {
  return snapshot?.currentUserId ?? currentUserId;
}

export function getWorkspaceAutomations(snapshot: WorkspaceSnapshot | null): WorkspaceAutomation[] {
  return snapshot?.automations ?? [];
}

export function getWorkspacePreferences(snapshot: WorkspaceSnapshot | null): WorkspacePreferences {
  return snapshot?.preferences ?? defaultWorkspacePreferences;
}

export function getWorkspaceMetrics(snapshot: WorkspaceSnapshot | null): BoardMetrics {
  return buildBoardMetrics(getWorkspaceTasks(snapshot));
}

export function getSelectedTask(tasks: Task[], selectedTaskId: string | null): Task | null {
  if (!selectedTaskId) {
    return null;
  }

  return tasks.find(task => task.id === selectedTaskId) ?? null;
}

export function getSelectedTaskStatus(boardConfig: BoardConfig, task: Task | null): TaskStatus | null {
  if (!task) {
    return null;
  }

  return boardConfig.statuses.find(status => status.id === task.status) ?? null;
}

export function countActiveAutomations(automations: WorkspaceAutomation[]): number {
  return automations.filter(automation => automation.status === "active").length;
}

export function countPausedAutomations(automations: WorkspaceAutomation[]): number {
  return automations.filter(automation => automation.status === "paused").length;
}

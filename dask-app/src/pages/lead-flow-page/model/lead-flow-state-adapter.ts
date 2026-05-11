import type { Task } from "@/entities/task";

export interface LeadFlowMoveCommand {
  workItemId: string;
  stateSlug: string;
}

export function createLeadFlowMoveCommand(workItem: Task, stateSlug: string): LeadFlowMoveCommand | null {
  if (!stateSlug || workItem.status === stateSlug) {
    return null;
  }

  return {
    workItemId: workItem.id,
    stateSlug
  };
}

export function isLeadFlowReadonly(input: { role?: string; isClient?: boolean } | null | undefined): boolean {
  return Boolean(input?.isClient || input?.role === "VIEWER");
}

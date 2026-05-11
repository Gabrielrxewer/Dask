export const automationWorkflowStatuses = ['draft', 'active', 'paused', 'archived'] as const;
export type AutomationWorkflowStatus = (typeof automationWorkflowStatuses)[number];

export const automationWorkflowVersionStatuses = ['draft', 'published', 'archived'] as const;
export type AutomationWorkflowVersionStatus = (typeof automationWorkflowVersionStatuses)[number];

export const automationRunStatuses = [
  'queued',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled'
] as const;
export type AutomationRunStatus = (typeof automationRunStatuses)[number];

export const automationStepRunStatuses = [
  'queued',
  'running',
  'waiting',
  'completed',
  'failed',
  'skipped',
  'cancelled'
] as const;
export type AutomationStepRunStatus = (typeof automationStepRunStatuses)[number];

export const automationScheduledStepStatuses = [
  'scheduled',
  'locked',
  'executed',
  'cancelled',
  'failed'
] as const;
export type AutomationScheduledStepStatus = (typeof automationScheduledStepStatuses)[number];

export const automationScheduledStepPurposes = ['resume', 'retry', 'follow_up'] as const;
export type AutomationScheduledStepPurpose = (typeof automationScheduledStepPurposes)[number];

export type AutomationWorkflowGraph = {
  version: 1;
  nodes: AutomationWorkflowNode[];
  edges: AutomationWorkflowEdge[];
  metadata?: Record<string, unknown>;
};

export type AutomationWorkflowNode = {
  id: string;
  type: string;
  label?: string;
  config: Record<string, unknown>;
  position?: {
    x: number;
    y: number;
  };
};

export type AutomationWorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  condition?: Record<string, unknown>;
};

export type AutomationGraphNode = AutomationWorkflowNode;
export type AutomationGraphEdge = AutomationWorkflowEdge;

export type AutomationTriggerDefinition = Record<string, unknown>;

export type AutomationExecutionPlan = {
  schemaVersion: 1;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  parallelGroups: Array<{
    sourceNodeId: string;
    targetNodeIds: string[];
  }>;
};

export type AutomationRunStep = {
  id: string;
  nodeId: string;
  status: AutomationStepRunStatus;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  error?: unknown;
};

export type AutomationDebugTrace = {
  runId: string;
  nodeId?: string | null;
  eventType: string;
  level?: string;
  message: string;
  payload?: unknown;
  createdAt?: Date | string;
};

export type AutomationWorkflowDefinition = {
  schemaVersion?: 1;
  definitionType?: 'automation_workflow';
  source?: Record<string, unknown>;
  trigger?: AutomationTriggerDefinition;
  variables?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  graph?: AutomationWorkflowGraph;
  executionPlan?: AutomationExecutionPlan;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export function isAutomationWorkflowStatus(value: string): value is AutomationWorkflowStatus {
  return automationWorkflowStatuses.includes(value as AutomationWorkflowStatus);
}

export function isAutomationWorkflowVersionStatus(value: string): value is AutomationWorkflowVersionStatus {
  return automationWorkflowVersionStatuses.includes(value as AutomationWorkflowVersionStatus);
}

export function isAutomationRunStatus(value: string): value is AutomationRunStatus {
  return automationRunStatuses.includes(value as AutomationRunStatus);
}

export function isAutomationStepRunStatus(value: string): value is AutomationStepRunStatus {
  return automationStepRunStatuses.includes(value as AutomationStepRunStatus);
}

export function isAutomationScheduledStepStatus(value: string): value is AutomationScheduledStepStatus {
  return automationScheduledStepStatuses.includes(value as AutomationScheduledStepStatus);
}

export function isAutomationScheduledStepPurpose(value: string): value is AutomationScheduledStepPurpose {
  return automationScheduledStepPurposes.includes(value as AutomationScheduledStepPurpose);
}

export function normalizeAutomationLimit(limit: number | undefined, fallback = 50, max = 500): number {
  if (!limit || Number.isNaN(limit)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), max);
}

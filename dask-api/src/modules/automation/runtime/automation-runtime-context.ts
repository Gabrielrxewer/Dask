import type { AutomationRun, AutomationWorkflowVersion } from '@prisma/client';
import type { AutomationWorkflowGraph } from '@/modules/automation/application/workflow-execution-types';

export type AutomationRuntimeContext = {
  run: AutomationRun;
  workflowVersion: AutomationWorkflowVersion;
  graph: AutomationWorkflowGraph;
  now: Date;
};

export type AutomationWorkflowExecutionStatus =
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export type AutomationWorkflowExecutionResult = {
  runId: string;
  status: AutomationWorkflowExecutionStatus;
  executedNodeIds: string[];
  waitingNodeId?: string;
  resumeAt?: Date;
  error?: Record<string, unknown>;
};

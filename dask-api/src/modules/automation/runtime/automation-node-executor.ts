import type { AutomationRun, AutomationStepRun } from '@prisma/client';
import type {
  AutomationWorkflowEdge,
  AutomationWorkflowGraph,
  AutomationWorkflowNode
} from '@/modules/automation/application/workflow-execution-types';

export type AutomationNodeExecutionResult =
  | {
      status: 'completed';
      output?: Record<string, unknown>;
      nextNodeIds?: string[];
    }
  | {
      status: 'waiting';
      output?: Record<string, unknown>;
      resumeAt?: Date;
      reason?: string;
    }
  | {
      status: 'skipped';
      output?: Record<string, unknown>;
      nextNodeIds?: string[];
    }
  | {
      status: 'failed';
      error: Record<string, unknown>;
      retryable?: boolean;
    };

export type AutomationNodeExecutionInput = {
  run: AutomationRun;
  stepRun: AutomationStepRun;
  node: AutomationWorkflowNode;
  graph: AutomationWorkflowGraph;
  incomingEdges: AutomationWorkflowEdge[];
  outgoingEdges: AutomationWorkflowEdge[];
  context: Record<string, unknown>;
  input: Record<string, unknown>;
  now: Date;
};

export interface AutomationNodeExecutor {
  type: string;
  execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult>;
}

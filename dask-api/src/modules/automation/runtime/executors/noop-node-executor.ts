import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

export class NoopNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'noop';

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    return {
      status: 'completed',
      output: {
        nodeId: input.node.id,
        noop: true,
        completedAt: input.now.toISOString()
      }
    };
  }
}

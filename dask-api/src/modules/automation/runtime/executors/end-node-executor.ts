import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

export class EndNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'end';

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    return {
      status: 'completed',
      output: {
        endedAt: input.now.toISOString()
      },
      nextNodeIds: []
    };
  }
}

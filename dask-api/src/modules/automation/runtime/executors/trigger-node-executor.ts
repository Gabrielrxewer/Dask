import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

export class TriggerNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'trigger';

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    return {
      status: 'completed',
      output: {
        triggerType: input.run.triggerType,
        triggerRefId: input.run.triggerRefId,
        receivedAt: input.now.toISOString()
      }
    };
  }
}

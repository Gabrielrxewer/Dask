import type { AutomationAIService } from '@/modules/automation/application/automation-ai-service';
import type { AutomationApprovalRequestService } from '@/modules/automation/application/automation-approval-request-service';
import type { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AppError } from '@/core/errors/app-error';
import type { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import type { AutomationNodeExecutor } from '@/modules/automation/runtime/automation-node-executor';
import { AINodeExecutor } from '@/modules/automation/runtime/executors/ai-node-executor';
import { CommunicationSendNodeExecutor } from '@/modules/automation/runtime/executors/communication-send-node-executor';
import { ConditionNodeExecutor } from '@/modules/automation/runtime/executors/condition-node-executor';
import { DelayNodeExecutor } from '@/modules/automation/runtime/executors/delay-node-executor';
import { EndNodeExecutor } from '@/modules/automation/runtime/executors/end-node-executor';
import { HumanApprovalNodeExecutor } from '@/modules/automation/runtime/executors/human-approval-node-executor';
import { NoopNodeExecutor } from '@/modules/automation/runtime/executors/noop-node-executor';
import { TriggerNodeExecutor } from '@/modules/automation/runtime/executors/trigger-node-executor';

export class AutomationNodeRegistry {
  private readonly executors = new Map<string, AutomationNodeExecutor>();

  public register(executor: AutomationNodeExecutor): void {
    const type = executor.type.trim();
    if (type.length === 0) {
      throw new AppError('Automation node executor type is required.', 422);
    }

    this.executors.set(type, executor);
  }

  public get(type: string): AutomationNodeExecutor {
    const normalized = type.trim();
    const executor = this.executors.get(normalized);
    if (!executor) {
      throw new AppError(`Automation node executor not registered for type "${normalized}".`, 422, {
        nodeType: normalized
      });
    }

    return executor;
  }

  public has(type: string): boolean {
    return this.executors.has(type.trim());
  }

  public listTypes(): string[] {
    return Array.from(this.executors.keys()).sort();
  }
}

export function createDefaultAutomationNodeRegistry(input?: {
  sideEffectService?: AutomationSideEffectService;
  aiService?: AutomationAIService;
  eventService?: AutomationRunEventService;
  approvalRequestService?: AutomationApprovalRequestService;
}): AutomationNodeRegistry {
  const registry = new AutomationNodeRegistry();

  registry.register(new TriggerNodeExecutor());
  registry.register(new ConditionNodeExecutor());
  registry.register(new DelayNodeExecutor());
  registry.register(new NoopNodeExecutor());
  registry.register(new EndNodeExecutor());
  if (input?.sideEffectService) {
    registry.register(new CommunicationSendNodeExecutor(input.sideEffectService));
  }
  if (input?.aiService && input.eventService) {
    registry.register(new AINodeExecutor('ai_summarize_context', input.aiService, input.eventService));
    registry.register(new AINodeExecutor('ai_classify_reply', input.aiService, input.eventService));
    registry.register(new AINodeExecutor('ai_extract_intent', input.aiService, input.eventService));
    registry.register(new AINodeExecutor('ai_generate_message_draft', input.aiService, input.eventService));
    registry.register(new AINodeExecutor('ai_recommend_next_action', input.aiService, input.eventService));
    registry.register(new AINodeExecutor('ai_fill_template_variables', input.aiService, input.eventService));
  }
  if (input?.approvalRequestService) {
    registry.register(new HumanApprovalNodeExecutor(input.approvalRequestService));
  }

  return registry;
}

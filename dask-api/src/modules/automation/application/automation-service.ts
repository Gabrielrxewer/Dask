import { Prisma, type PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { EventPublisher } from '@/core/events/event-publisher';
import type { JobQueue } from '@/core/jobs/job-queue';

export class AutomationService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly eventPublisher: EventPublisher,
    private readonly jobQueue: JobQueue
  ) {}

  public async createRule(input: {
    workspaceId: string;
    name: string;
    trigger: Record<string, unknown>;
    conditions?: Record<string, unknown>;
    actions: Record<string, unknown>;
  }) {
    const rule = await this.prisma.automationRule.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        trigger: input.trigger as Prisma.InputJsonValue,
        conditions: input.conditions as Prisma.InputJsonValue | undefined,
        actions: input.actions as Prisma.InputJsonValue
      }
    });

    await this.eventPublisher.publish({
      id: uuid(),
      name: 'automation.rule.created',
      aggregateType: 'automation-rule',
      aggregateId: rule.id,
      occurredAt: new Date(),
      payload: {
        ruleId: rule.id,
        workspaceId: rule.workspaceId
      }
    });

    return rule;
  }

  public async runRule(ruleId: string, context: Record<string, unknown>): Promise<void> {
    await this.jobQueue.enqueue('automation.run-rule', {
      ruleId,
      context
    });
  }
}

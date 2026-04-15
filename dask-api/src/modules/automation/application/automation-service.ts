import { Prisma, type PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { JobQueue } from '@/core/jobs/job-queue';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import { parseRuleSpec } from '@/modules/automation/application/rule-schema';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeExecutionLimit(limit: number | undefined): number {
  if (!limit || Number.isNaN(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

export class AutomationService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly eventPublisher: EventPublisher,
    private readonly jobQueue: JobQueue,
    private readonly workspaceConfigService: WorkspaceConfigService
  ) {}

  public async listRules(input: {
    workspaceId: string;
    userId: string;
    includeDisabled?: boolean;
  }) {
    await this.workspaceConfigService.ensureReadableWorkspace(input.workspaceId, input.userId);

    const where = input.includeDisabled
      ? { workspaceId: input.workspaceId }
      : {
          workspaceId: input.workspaceId,
          enabled: true
        };

    const rules = await this.prisma.automationRule.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }]
    });

    return rules.map((rule) => this.serializeRule(rule));
  }

  public async createRule(input: {
    workspaceId: string;
    userId: string;
    name: string;
    description?: string;
    trigger: unknown;
    conditions?: unknown;
    actions: unknown;
    enabled?: boolean;
    priority?: number;
  }) {
    await this.workspaceConfigService.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const spec = parseRuleSpec({
      trigger: input.trigger,
      conditions: input.conditions,
      actions: input.actions
    });

    const rule = await this.eventPublisher.runInTransaction(async (db, publisher) => {
      const created = await db.automationRule.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          triggerType: spec.trigger.type,
          trigger: toJsonValue(spec.trigger),
          conditions: spec.conditions ? toJsonValue(spec.conditions) : undefined,
          actions: toJsonValue(spec.actions),
          enabled: input.enabled ?? true,
          priority: input.priority ?? 100,
          version: 1
        }
      });

      await publisher.publishInTransaction(
        {
          id: uuid(),
          name: DomainEventNames.AutomationRuleCreated,
          aggregateType: 'automation-rule',
          aggregateId: created.id,
          occurredAt: new Date(),
          payload: {
            ruleId: created.id,
            workspaceId: input.workspaceId,
            triggerType: created.triggerType,
            requestedBy: input.userId
          }
        },
        db
      );

      return created;
    });

    return this.serializeRule(rule);
  }

  public async updateRule(input: {
    workspaceId: string;
    ruleId: string;
    userId: string;
    payload: {
      name?: string;
      description?: string | null;
      trigger?: unknown;
      conditions?: unknown;
      actions?: unknown;
      enabled?: boolean;
      priority?: number;
    };
  }) {
    await this.workspaceConfigService.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.automationRule.findFirst({
      where: {
        id: input.ruleId,
        workspaceId: input.workspaceId
      }
    });

    if (!current) {
      throw new AppError('Automation rule not found.', 404);
    }

    let trigger: Prisma.InputJsonValue | undefined;
    let conditions:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput
      | undefined;
    let actions: Prisma.InputJsonValue | undefined;
    let triggerType: string | undefined;

    const isSpecPatch =
      input.payload.trigger !== undefined ||
      input.payload.conditions !== undefined ||
      input.payload.actions !== undefined;

    if (isSpecPatch) {
      const mergedSpec = parseRuleSpec({
        trigger: input.payload.trigger ?? current.trigger,
        conditions: input.payload.conditions ?? current.conditions ?? undefined,
        actions: input.payload.actions ?? current.actions
      });

      trigger = toJsonValue(mergedSpec.trigger);
      conditions = mergedSpec.conditions ? toJsonValue(mergedSpec.conditions) : Prisma.JsonNull;
      actions = toJsonValue(mergedSpec.actions);
      triggerType = mergedSpec.trigger.type;
    }

    const nextVersion = isSpecPatch ? current.version + 1 : current.version;

    const updated = await this.eventPublisher.runInTransaction(async (db, publisher) => {
      const next = await db.automationRule.update({
        where: {
          id: current.id
        },
        data: {
          name: input.payload.name,
          description: input.payload.description,
          trigger,
          conditions,
          actions,
          triggerType,
          enabled: input.payload.enabled,
          priority: input.payload.priority,
          version: nextVersion
        }
      });

      await publisher.publishInTransaction(
        {
          id: uuid(),
          name: DomainEventNames.AutomationRuleUpdated,
          aggregateType: 'automation-rule',
          aggregateId: next.id,
          occurredAt: new Date(),
          payload: {
            ruleId: next.id,
            workspaceId: input.workspaceId,
            triggerType: next.triggerType,
            requestedBy: input.userId,
            version: next.version
          }
        },
        db
      );

      return next;
    });

    return this.serializeRule(updated);
  }

  public async runRule(input: {
    workspaceId?: string;
    ruleId: string;
    userId: string;
    context: Record<string, unknown>;
  }): Promise<void> {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id: input.ruleId },
      select: {
        id: true,
        workspaceId: true
      }
    });

    if (!rule) {
      throw new AppError('Automation rule not found.', 404);
    }

    if (input.workspaceId && input.workspaceId !== rule.workspaceId) {
      throw new AppError('Automation rule not found.', 404);
    }

    await this.workspaceConfigService.ensureReadableWorkspace(rule.workspaceId, input.userId);

    await this.jobQueue.enqueue('automation.run-rule', {
      ruleId: input.ruleId,
      context: input.context,
      requestedBy: input.userId
    });
  }

  public async listExecutions(input: {
    workspaceId: string;
    userId: string;
    limit?: number;
  }) {
    await this.workspaceConfigService.ensureReadableWorkspace(input.workspaceId, input.userId);

    const executions = await this.prisma.automationExecution.findMany({
      where: {
        workspaceId: input.workspaceId
      },
      include: {
        rule: {
          select: {
            id: true,
            name: true,
            triggerType: true,
            enabled: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: normalizeExecutionLimit(input.limit)
    });

    return executions.map((execution) => ({
      id: execution.id,
      workspaceId: execution.workspaceId,
      ruleId: execution.ruleId,
      eventName: execution.eventName,
      eventId: execution.eventId,
      status: execution.status,
      attempts: execution.attempts,
      context: execution.context,
      error: execution.error,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt,
      createdAt: execution.createdAt,
      updatedAt: execution.updatedAt,
      rule: execution.rule
    }));
  }

  private serializeRule(rule: {
    id: string;
    workspaceId: string;
    name: string;
    description: string | null;
    triggerType: string;
    trigger: Prisma.JsonValue;
    conditions: Prisma.JsonValue | null;
    actions: Prisma.JsonValue;
    enabled: boolean;
    priority: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: rule.id,
      workspaceId: rule.workspaceId,
      name: rule.name,
      description: rule.description,
      triggerType: rule.triggerType,
      trigger: rule.trigger,
      conditions: rule.conditions,
      actions: rule.actions,
      enabled: rule.enabled,
      priority: rule.priority,
      version: rule.version,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    };
  }
}

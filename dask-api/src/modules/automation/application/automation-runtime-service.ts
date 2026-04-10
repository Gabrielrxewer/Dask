import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  automationRuleSpecSchema,
  matchesConditions,
  type AutomationAction,
  type AutomationEventContext,
  type AutomationRuleSpec
} from '@/modules/automation/application/rule-schema';

export type QueuedAutomationEvent = {
  eventId?: string;
  eventName: string;
  workspaceId: string;
  payload: Record<string, unknown>;
};

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseRuleSpecOrThrow(rule: {
  id: string;
  trigger: Prisma.JsonValue;
  conditions: Prisma.JsonValue | null;
  actions: Prisma.JsonValue;
}): AutomationRuleSpec {
  const parsed = automationRuleSpecSchema.safeParse({
    trigger: rule.trigger,
    conditions: rule.conditions ?? undefined,
    actions: rule.actions
  });

  if (!parsed.success) {
    throw new AppError('Invalid persisted automation rule specification.', 500, {
      ruleId: rule.id,
      issues: parsed.error.flatten()
    });
  }

  return parsed.data;
}

function toContext(
  workspaceId: string,
  payload: Record<string, unknown>
): AutomationEventContext {
  const readString = (key: string): string | undefined => {
    const value = payload[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  };

  const readNumber = (key: string): number | undefined => {
    const value = payload[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  };

  return {
    workspaceId,
    itemId: readString('itemId'),
    sourceViewId: readString('sourceViewId'),
    sourceViewKey: readString('sourceViewKey'),
    fromColumnId: readString('fromColumnId'),
    fromColumnKey: readString('fromColumnKey'),
    toViewId: readString('toViewId'),
    toViewKey: readString('toViewKey'),
    toColumnId: readString('toColumnId'),
    toColumnKey: readString('toColumnKey'),
    itemTypeId: readString('itemTypeId'),
    itemTypeSlug: readString('itemTypeSlug'),
    status: readString('status'),
    assigneeId: readString('assigneeId'),
    priority: readNumber('priority')
  };
}

export class AutomationRuntimeService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async processEvent(event: QueuedAutomationEvent): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        workspaceId: event.workspaceId,
        enabled: true,
        triggerType: event.eventName
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }]
    });

    if (rules.length === 0) {
      return;
    }

    for (const rule of rules) {
      await this.executeRuleAgainstEvent(rule, event);
    }
  }

  public async runRule(input: {
    ruleId: string;
    context: Record<string, unknown>;
    requestedBy?: string;
  }): Promise<void> {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id: input.ruleId }
    });

    if (!rule) {
      throw new AppError('Automation rule not found.', 404);
    }

    await this.executeRuleAgainstEvent(rule, {
      eventName: 'manual',
      workspaceId: rule.workspaceId,
      payload: {
        ...input.context,
        requestedBy: input.requestedBy ?? input.context.requestedBy
      }
    });
  }

  private async executeRuleAgainstEvent(
    rule: {
      id: string;
      workspaceId: string;
      trigger: Prisma.JsonValue;
      conditions: Prisma.JsonValue | null;
      actions: Prisma.JsonValue;
    },
    event: QueuedAutomationEvent
  ): Promise<void> {
    if (event.eventId) {
      const duplicate = await this.prisma.automationExecution.findFirst({
        where: {
          ruleId: rule.id,
          eventId: event.eventId,
          status: {
            in: ['succeeded', 'failed', 'skipped']
          }
        },
        select: { id: true }
      });

      if (duplicate) {
        return;
      }
    }

    const execution = await this.prisma.automationExecution.create({
      data: {
        workspaceId: rule.workspaceId,
        ruleId: rule.id,
        eventName: event.eventName,
        eventId: event.eventId,
        status: 'running',
        attempts: 1,
        startedAt: new Date(),
        context: toJsonValue(event.payload)
      }
    });

    try {
      const spec = parseRuleSpecOrThrow(rule);
      const context = toContext(rule.workspaceId, event.payload);

      if (!matchesConditions(spec.conditions, context)) {
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'skipped',
            finishedAt: new Date()
          }
        });
        return;
      }

      for (const action of spec.actions) {
        await this.executeAction(action, context, event.payload);
      }

      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date()
        }
      });
    } catch (error) {
      await this.prisma.automationExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown automation runtime error.'
        }
      });

      throw error;
    }
  }

  private async executeAction(
    action: AutomationAction,
    context: AutomationEventContext,
    rawPayload: Record<string, unknown>
  ): Promise<void> {
    const itemId = context.itemId;

    if (!itemId) {
      throw new AppError('Automation event does not include itemId.', 422);
    }

    if (!context.workspaceId) {
      throw new AppError('Automation event does not include workspaceId.', 422);
    }

    switch (action.type) {
      case 'set_view_column': {
        const view = await this.resolveView({
          workspaceId: context.workspaceId,
          viewId: action.targetViewId,
          viewKey: action.targetViewKey
        });

        const column = await this.resolveColumn({
          workspaceId: context.workspaceId,
          viewId: view.id,
          columnId: action.targetColumnId,
          columnKey: action.targetColumnKey
        });

        await this.prisma.workItemViewPlacement.upsert({
          where: {
            itemId_viewId: {
              itemId,
              viewId: view.id
            }
          },
          create: {
            workspaceId: context.workspaceId,
            itemId,
            viewId: view.id,
            columnId: column.id,
            position: action.position ?? 0,
            metadata:
              action.metadata !== undefined
                ? toJsonValue(action.metadata)
                : ((rawPayload.metadata as Prisma.InputJsonValue | undefined) ?? undefined),
            updatedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : null
          },
          update: {
            columnId: column.id,
            position: action.position,
            metadata:
              action.metadata !== undefined
                ? toJsonValue(action.metadata)
                : undefined,
            updatedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : null
          }
        });
        return;
      }

      case 'remove_from_view': {
        const view = await this.resolveView({
          workspaceId: context.workspaceId,
          viewId: action.targetViewId,
          viewKey: action.targetViewKey
        });

        await this.prisma.workItemViewPlacement.deleteMany({
          where: {
            workspaceId: context.workspaceId,
            itemId,
            viewId: view.id
          }
        });
        return;
      }

      case 'set_work_item_state': {
        let statusToSet: string | undefined = action.status;
        let stateIdToSet: string | undefined = action.stateId;

        if (!stateIdToSet && action.stateSlug) {
          const state = await this.prisma.workflowState.findFirst({
            where: {
              workspaceId: context.workspaceId,
              slug: toSlug(action.stateSlug)
            },
            select: {
              id: true,
              slug: true
            }
          });

          if (!state) {
            throw new AppError('Target workflow state not found.', 404);
          }

          stateIdToSet = state.id;
          if (!statusToSet) {
            statusToSet = state.slug;
          }
        }

        await this.prisma.item.update({
          where: { id: itemId },
          data: {
            stateId: stateIdToSet,
            status: statusToSet,
            updatedBy: typeof rawPayload.requestedBy === 'string' ? rawPayload.requestedBy : undefined
          }
        });
        return;
      }

      default:
        throw new AppError('Unsupported automation action type.', 422);
    }
  }

  private async resolveView(input: {
    workspaceId: string;
    viewId?: string;
    viewKey?: string;
  }) {
    if (input.viewId) {
      const byId = await this.prisma.automationView.findFirst({
        where: { id: input.viewId, workspaceId: input.workspaceId }
      });

      if (byId) {
        return byId;
      }
    }

    if (input.viewKey) {
      const byKey = await this.prisma.automationView.findFirst({
        where: {
          workspaceId: input.workspaceId,
          key: toSlug(input.viewKey)
        }
      });

      if (byKey) {
        return byKey;
      }
    }

    throw new AppError('Target automation view not found.', 404);
  }

  private async resolveColumn(input: {
    workspaceId: string;
    viewId: string;
    columnId?: string;
    columnKey?: string;
  }) {
    if (input.columnId) {
      const byId = await this.prisma.automationViewColumn.findFirst({
        where: {
          id: input.columnId,
          workspaceId: input.workspaceId,
          viewId: input.viewId
        }
      });

      if (byId) {
        return byId;
      }
    }

    if (input.columnKey) {
      const byKey = await this.prisma.automationViewColumn.findFirst({
        where: {
          workspaceId: input.workspaceId,
          viewId: input.viewId,
          key: toSlug(input.columnKey)
        }
      });

      if (byKey) {
        return byKey;
      }
    }

    throw new AppError('Target automation view column not found.', 404);
  }
}

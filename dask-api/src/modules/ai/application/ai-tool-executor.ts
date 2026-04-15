import { v4 as uuid } from 'uuid';
import { type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { AIToolCall } from '@/modules/ai/domain/providers';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { EventPublisher } from '@/core/events/event-publisher';

type SupportedTool = 'update_item_description' | 'set_item_status' | 'set_item_priority';

function asSupportedTool(value: string): SupportedTool | null {
  if (
    value === 'update_item_description' ||
    value === 'set_item_status' ||
    value === 'set_item_priority'
  ) {
    return value;
  }
  return null;
}

export class AIToolExecutor {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly authorizationService: AuthorizationService,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async execute(input: {
    workspaceId: string;
    itemId: string;
    boardId: string;
    requestedBy: string;
    toolCalls: AIToolCall[];
    allowedTools: string[];
  }): Promise<string[]> {
    if (input.toolCalls.length === 0) {
      return [];
    }

    // Note: when tools are enabled, authorization was already verified in AIAgentService
    // before building the context. This check covers the case where the executor is called
    // directly or from a path that skips the early check.
    const canWriteItem = await this.authorizationService.can(input.requestedBy, 'item.write', {
      workspaceId: input.workspaceId,
      itemId: input.itemId
    });

    if (!canWriteItem) {
      throw new AppError('User is not allowed to execute AI tools for item mutations.', 403);
    }

    const summaries: string[] = [];

    for (const call of input.toolCalls) {
      const tool = asSupportedTool(call.name);
      if (!tool || !input.allowedTools.includes(tool)) {
        continue;
      }

      if (tool === 'update_item_description') {
        const description = String(call.arguments.description ?? '').trim();
        if (description.length >= 2) {
          await this.prisma.item.updateMany({
            where: { id: input.itemId, workspaceId: input.workspaceId },
            data: { description }
          });
          await this.eventPublisher.publish({
            id: uuid(),
            name: DomainEventNames.ItemUpdated,
            aggregateType: 'item',
            aggregateId: input.itemId,
            occurredAt: new Date(),
            payload: {
              itemId: input.itemId,
              workspaceId: input.workspaceId,
              boardId: input.boardId,
              patch: { description },
              source: 'ai-tool'
            }
          });
          summaries.push('Descricao do card atualizada pelo agente.');
        }
      }

      if (tool === 'set_item_status') {
        const status = String(call.arguments.status ?? '').trim();
        if (status.length >= 2) {
          await this.prisma.item.updateMany({
            where: { id: input.itemId, workspaceId: input.workspaceId },
            data: { status }
          });
          await this.eventPublisher.publish({
            id: uuid(),
            name: DomainEventNames.ItemUpdated,
            aggregateType: 'item',
            aggregateId: input.itemId,
            occurredAt: new Date(),
            payload: {
              itemId: input.itemId,
              workspaceId: input.workspaceId,
              boardId: input.boardId,
              patch: { status },
              source: 'ai-tool'
            }
          });
          summaries.push(`Status alterado para "${status}".`);
        }
      }

      if (tool === 'set_item_priority') {
        const priorityRaw = Number(call.arguments.priority);
        if (Number.isInteger(priorityRaw) && priorityRaw >= 0 && priorityRaw <= 4) {
          const item = await this.prisma.item.findFirst({
            where: { id: input.itemId, workspaceId: input.workspaceId },
            select: { metadata: true }
          });
          const metadata =
            item?.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
              ? (item.metadata as Record<string, unknown>)
              : {};
          const updatedMetadata = { ...metadata, priority: priorityRaw };
          await this.prisma.item.updateMany({
            where: { id: input.itemId, workspaceId: input.workspaceId },
            data: { metadata: updatedMetadata }
          });
          await this.eventPublisher.publish({
            id: uuid(),
            name: DomainEventNames.ItemUpdated,
            aggregateType: 'item',
            aggregateId: input.itemId,
            occurredAt: new Date(),
            payload: {
              itemId: input.itemId,
              workspaceId: input.workspaceId,
              boardId: input.boardId,
              patch: { metadata: updatedMetadata },
              source: 'ai-tool'
            }
          });
          summaries.push(`Prioridade alterada para ${priorityRaw}.`);
        }
      }
    }

    return summaries;
  }
}

import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import { EventPublisher } from '@/core/events/event-publisher';
import type { ItemsRepository } from '@/modules/items/repositories/items-repository';

export class ItemsService {
  public constructor(
    private readonly itemsRepository: ItemsRepository,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async createItem(input: {
    boardId: string;
    workspaceId: string;
    columnId?: string;
    type: 'CARD' | 'TASK' | 'NOTE';
    title: string;
    description?: string;
    status: string;
    fields?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    createdBy: string;
  }) {
    const item = await this.itemsRepository.createItem(input);
    await this.eventPublisher.publish({
      id: uuid(),
      name: DomainEventNames.ItemCreated,
      aggregateType: 'item',
      aggregateId: item.id,
      occurredAt: new Date(),
      payload: {
        itemId: item.id,
        workspaceId: item.workspaceId,
        boardId: item.boardId,
        type: item.type
      }
    });
    return item;
  }

  public async updateItem(
    itemId: string,
    patch: {
      title?: string;
      description?: string;
      status?: string;
      columnId?: string;
      fields?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ) {
    const current = await this.itemsRepository.findItemById(itemId);
    if (!current) {
      throw new AppError('Item not found', 404);
    }

    const updated = await this.itemsRepository.updateItem(itemId, patch);
    await this.eventPublisher.publish({
      id: uuid(),
      name: DomainEventNames.ItemUpdated,
      aggregateType: 'item',
      aggregateId: itemId,
      occurredAt: new Date(),
      payload: {
        itemId,
        workspaceId: updated.workspaceId,
        boardId: updated.boardId,
        patch
      }
    });

    if (patch.columnId && patch.columnId !== current.columnId) {
      await this.eventPublisher.publish({
        id: uuid(),
        name: DomainEventNames.ItemMoved,
        aggregateType: 'item',
        aggregateId: itemId,
        occurredAt: new Date(),
        payload: {
          itemId,
          fromColumnId: current.columnId,
          toColumnId: patch.columnId,
          workspaceId: updated.workspaceId,
          boardId: updated.boardId
        }
      });
    }

    return updated;
  }
}

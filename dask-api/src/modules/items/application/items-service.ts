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
    boardColumnId?: string;
    type: string;
    typeId?: string;
    title: string;
    description?: string;
    status: string;
    stateId?: string;
    fields?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    checklist?: Record<string, unknown>;
    assigneeId?: string;
    parentId?: string;
    dueDate?: Date;
    position?: number;
    createdBy: string;
    updatedBy?: string;
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
        type: item.type,
        typeId: item.typeId,
        stateId: item.stateId
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
      stateId?: string;
      columnId?: string;
      boardColumnId?: string;
      type?: string;
      typeId?: string;
      fields?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      checklist?: Record<string, unknown>;
      assigneeId?: string;
      parentId?: string;
      dueDate?: Date | null;
      position?: number;
      updatedBy?: string;
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

    const nextColumnId = patch.boardColumnId ?? patch.columnId;
    const previousColumnId = current.boardColumnId ?? current.columnId;

    if (nextColumnId && nextColumnId !== previousColumnId) {
      await this.eventPublisher.publish({
        id: uuid(),
        name: DomainEventNames.ItemMoved,
        aggregateType: 'item',
        aggregateId: itemId,
        occurredAt: new Date(),
        payload: {
          itemId,
          fromColumnId: previousColumnId,
          toColumnId: nextColumnId,
          workspaceId: updated.workspaceId,
          boardId: updated.boardId
        }
      });
    }

    return updated;
  }
}

import { type Item, type ItemType, type PrismaClient } from '@prisma/client';
import type { ItemsRepository } from '@/modules/items/repositories/items-repository';

export class PrismaItemsRepository implements ItemsRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public createItem(input: {
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
  }): Promise<Item> {
    return this.prisma.item.create({
      data: {
        ...input,
        type: input.type as ItemType
      }
    });
  }

  public updateItem(
    itemId: string,
    patch: {
      title?: string;
      description?: string;
      status?: string;
      columnId?: string;
      fields?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Item> {
    return this.prisma.item.update({
      where: { id: itemId },
      data: patch
    });
  }

  public findItemById(itemId: string): Promise<Item | null> {
    return this.prisma.item.findUnique({
      where: { id: itemId }
    });
  }
}

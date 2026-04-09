import { Prisma, type Item, type PrismaClient } from '@prisma/client';
import type { ItemsRepository } from '@/modules/items/repositories/items-repository';

export class PrismaItemsRepository implements ItemsRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public createItem(input: {
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
  }): Promise<Item> {
    return this.prisma.item.create({
      data: {
        ...input,
        fields: input.fields as Prisma.InputJsonValue | undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        checklist: input.checklist as Prisma.InputJsonValue | undefined
      }
    });
  }

  public updateItem(
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
  ): Promise<Item> {
    return this.prisma.item.update({
      where: { id: itemId },
      data: {
        ...patch,
        fields: patch.fields as Prisma.InputJsonValue | undefined,
        metadata: patch.metadata as Prisma.InputJsonValue | undefined,
        checklist: patch.checklist as Prisma.InputJsonValue | undefined
      }
    });
  }

  public findItemById(itemId: string): Promise<Item | null> {
    return this.prisma.item.findUnique({
      where: { id: itemId }
    });
  }
}

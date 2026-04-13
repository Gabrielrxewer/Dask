import type { Item } from '@prisma/client';

export interface ItemsRepository {
  createItem(input: {
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
  }): Promise<Item>;
  updateItem(
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
      assigneeId?: string | null;
      parentId?: string | null;
      dueDate?: Date | null;
      position?: number;
      updatedBy?: string;
    }
  ): Promise<Item>;
  findItemById(itemId: string): Promise<Item | null>;
}

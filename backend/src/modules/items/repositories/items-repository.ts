import type { Item } from '@prisma/client';

export interface ItemsRepository {
  createItem(input: {
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
  }): Promise<Item>;
  updateItem(
    itemId: string,
    patch: {
      title?: string;
      description?: string;
      status?: string;
      columnId?: string;
      fields?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Item>;
  findItemById(itemId: string): Promise<Item | null>;
}

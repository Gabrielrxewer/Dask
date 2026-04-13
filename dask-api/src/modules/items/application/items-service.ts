import { MembershipRole, type PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import { EventPublisher } from '@/core/events/event-publisher';
import type { ItemsRepository } from '@/modules/items/repositories/items-repository';

export class ItemsService {
  public constructor(
    private readonly itemsRepository: ItemsRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly prisma: PrismaClient
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
    await this.ensureWorkspaceItemWriteAccess(input.workspaceId, input.createdBy);
    await this.ensureBoardBelongsToWorkspace(input.workspaceId, input.boardId);

    if (input.columnId) {
      await this.ensureBoardColumnBelongsToWorkspace(input.workspaceId, input.columnId);
    }

    if (input.boardColumnId) {
      await this.ensureBoardColumnBelongsToWorkspace(input.workspaceId, input.boardColumnId);
    }

    if (input.typeId) {
      await this.ensureTypeBelongsToWorkspace(input.workspaceId, input.typeId);
    }

    if (input.stateId) {
      await this.ensureStateBelongsToWorkspace(input.workspaceId, input.stateId);
    }

    if (input.assigneeId) {
      await this.ensureWorkspaceMember(input.workspaceId, input.assigneeId, 'Assignee does not belong to this workspace');
    }

    if (input.parentId) {
      await this.ensureItemBelongsToWorkspace(input.workspaceId, input.parentId, 'Parent item not found');
    }

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
    workspaceId: string,
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
  ) {
    const current = await this.itemsRepository.findItemById(itemId);
    if (!current || current.workspaceId !== workspaceId) {
      throw new AppError('Item not found', 404);
    }

    const actingUserId = patch.updatedBy ?? current.updatedBy ?? current.createdBy;
    await this.ensureWorkspaceItemWriteAccess(workspaceId, actingUserId);

    if (patch.columnId) {
      await this.ensureBoardColumnBelongsToWorkspace(workspaceId, patch.columnId);
    }

    if (patch.boardColumnId) {
      await this.ensureBoardColumnBelongsToWorkspace(workspaceId, patch.boardColumnId);
    }

    if (patch.typeId) {
      await this.ensureTypeBelongsToWorkspace(workspaceId, patch.typeId);
    }

    if (patch.stateId) {
      await this.ensureStateBelongsToWorkspace(workspaceId, patch.stateId);
    }

    if (patch.assigneeId) {
      await this.ensureWorkspaceMember(workspaceId, patch.assigneeId, 'Assignee does not belong to this workspace');
    }

    if (patch.parentId) {
      await this.ensureItemBelongsToWorkspace(workspaceId, patch.parentId, 'Parent item not found');
    }

    const updated = await this.itemsRepository.updateItem(itemId, patch);
    if (updated.workspaceId !== workspaceId) {
      throw new AppError('Cross-workspace mutation blocked', 400);
    }
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

  private async ensureWorkspaceMember(workspaceId: string, userId: string, errorMessage: string): Promise<void> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId },
      select: { role: true }
    });

    if (!membership) {
      throw new AppError(errorMessage, 400);
    }
  }

  private async ensureWorkspaceItemWriteAccess(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId },
      select: { role: true }
    });

    if (!membership) {
      throw new AppError('Workspace not found', 404);
    }

    if (membership.role === MembershipRole.VIEWER) {
      throw new AppError('Forbidden', 403);
    }
  }

  private async ensureBoardBelongsToWorkspace(workspaceId: string, boardId: string): Promise<void> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, workspaceId },
      select: { id: true }
    });

    if (!board) {
      throw new AppError('Board not found', 404);
    }
  }

  private async ensureBoardColumnBelongsToWorkspace(workspaceId: string, boardColumnId: string): Promise<void> {
    const boardColumn = await this.prisma.boardColumn.findFirst({
      where: { id: boardColumnId, workspaceId },
      select: { id: true }
    });

    if (!boardColumn) {
      throw new AppError('Board column not found', 404);
    }
  }

  private async ensureTypeBelongsToWorkspace(workspaceId: string, typeId: string): Promise<void> {
    const type = await this.prisma.workItemType.findFirst({
      where: { id: typeId, workspaceId },
      select: { id: true }
    });

    if (!type) {
      throw new AppError('Work item type not found', 404);
    }
  }

  private async ensureStateBelongsToWorkspace(workspaceId: string, stateId: string): Promise<void> {
    const state = await this.prisma.workflowState.findFirst({
      where: { id: stateId, workspaceId },
      select: { id: true }
    });

    if (!state) {
      throw new AppError('Workflow state not found', 404);
    }
  }

  private async ensureItemBelongsToWorkspace(workspaceId: string, itemId: string, errorMessage: string): Promise<void> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, workspaceId },
      select: { id: true }
    });

    if (!item) {
      throw new AppError(errorMessage, 404);
    }
  }
}

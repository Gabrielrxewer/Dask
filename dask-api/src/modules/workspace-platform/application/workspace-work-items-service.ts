import type { Prisma} from '@prisma/client';
import { CustomFieldType, type PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import { ensureWorkspaceDefaultConfiguration } from '@/modules/workspaces/application/default-workspace-seed';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import {
  addHexAlpha,
  getColorFromId,
  getInitials,
  isRecord,
  mapCustomFieldTypeToFrontend,
  parseChecklist,
  parsePriority,
  summarizeAutomationPart,
  toJsonValue,
  toSlug,
  type JsonRecord
} from '@/modules/workspace-platform/application/shared';

type SerializedWorkItemSource = {
  id: string;
  workspaceId: string;
  boardId: string;
  title: string;
  description: string | null;
  typeId: string | null;
  type: string;
  typeDefinition: { id: string; slug: string; name: string; color: string } | null;
  stateId: string | null;
  workflowState: { id: string; slug: string; name: string; color: string; category: string | null } | null;
  status: string;
  boardColumn: { id: string; slug: string; name: string } | null;
  boardColumnId: string | null;
  columnId: string | null;
  assigneeId: string | null;
  parentId: string | null;
  dueDate: Date | null;
  position: number;
  checklist: unknown;
  tags: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
      color: string;
    };
  }>;
  customFieldValues: Array<{
    fieldId: string;
    value: unknown;
    field: {
      slug: string;
    };
  }>;
  fields: unknown;
  metadata: unknown;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class WorkspaceWorkItemsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async getWorkspaceSnapshot(input: { workspaceId: string; userId: string; limit?: number }) {
    const access = await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);

    await ensureWorkspaceDefaultConfiguration(this.prisma, {
      workspaceId: input.workspaceId,
      ownerUserId: input.userId
    });

    const [config, members, automations, workItems] = await Promise.all([
      this.configService.loadWorkspaceConfig(input.workspaceId),
      this.prisma.workspaceMembership.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.automationRule.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.item.findMany({
        where: { workspaceId: input.workspaceId },
        include: this.itemInclude(),
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
        take: input.limit ?? 500
      })
    ]);

    const serializedWorkItems = workItems.map((item) => this.serializeWorkItem(item));
    const tasks = serializedWorkItems.map((item) => this.serializeLegacyTask(item));

    const membersById = members.reduce<Record<string, JsonRecord>>((acc, membership) => {
      acc[membership.user.id] = {
        id: membership.user.id,
        name: membership.user.name,
        initials: getInitials(membership.user.name),
        color: getColorFromId(membership.user.id),
        role: membership.role
      };
      return acc;
    }, {});

    const statuses = config.workflowStates
      .filter((state) => state.isActive)
      .sort((left, right) => left.order - right.order)
      .map((state) => ({
        id: state.slug,
        label: state.name,
        dot: state.color
      }));

    const boardConfig = {
      statuses,
      taskTypes: config.itemTypes
        .filter((itemType) => itemType.isActive)
        .sort((left, right) => left.order - right.order)
        .map((itemType) => ({
          id: itemType.slug,
          label: itemType.name,
          background: addHexAlpha(itemType.color, '22'),
          border: addHexAlpha(itemType.color, '66'),
          text: itemType.color
        })),
      fieldDefinitions: config.customFieldDefinitions
        .filter((field) => field.isActive)
        .sort((left, right) => left.order - right.order)
        .map((field) => {
          const type = mapCustomFieldTypeToFrontend(this.toPrismaFieldType(field.type));
          const aiEnhance = this.isAiEnabledInFieldSettings(field.settings);

          return {
            id: field.slug,
            label: field.name,
            type,
            options: field.options.map((option) => option.label),
            capabilities: aiEnhance ? { aiEnhance: true } : undefined
          };
        }),
      cardLayout: {
        visibleFieldIds: config.preferences.visibleCardFieldIds,
        visibleFieldIdsByType: config.preferences.visibleFieldsByType ?? {},
        detailVisibleFieldIdsByType: config.preferences.detailVisibleFieldsByType ?? {}
      },
      perspectives: this.resolveBoardPerspectivesFromSettings(config.preferences.settings, statuses)
    };

    return {
      id: access.workspace.id,
      name: access.workspace.name,
      key: access.workspace.key,
      currentUserId: input.userId,
      members: members.map((membership) => ({
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        initials: getInitials(membership.user.name),
        color: getColorFromId(membership.user.id)
      })),
      membersById,
      preferences: config.preferences,
      boardConfig,
      automations: automations.map((rule) => ({
        id: rule.id,
        title: rule.name,
        status: rule.enabled ? 'active' : 'paused',
        trigger: summarizeAutomationPart(rule.trigger),
        action: summarizeAutomationPart(rule.actions)
      })),
      tasks,
      workspace: access.workspace,
      itemTypes: config.itemTypes,
      workflowStates: config.workflowStates,
      boardColumns: config.boardColumns,
      tags: config.tags,
      customFieldDefinitions: config.customFieldDefinitions,
      workItems: serializedWorkItems,
      automationsSummary: automations.map((rule) => ({
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        updatedAt: rule.updatedAt
      }))
    };
  }

  public async listWorkItems(input: { workspaceId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);

    const items = await this.prisma.item.findMany({
      where: { workspaceId: input.workspaceId },
      include: this.itemInclude(),
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }]
    });

    return items.map((item) => this.serializeWorkItem(item));
  }

  public async createWorkItem(input: {
    workspaceId: string;
    userId: string;
    payload: {
      boardId?: string;
      title: string;
      description?: string;
      typeId?: string;
      typeSlug?: string;
      stateId?: string;
      stateSlug?: string;
      columnId?: string;
      assigneeId?: string | null;
      parentId?: string | null;
      dueDate?: Date | null;
      position?: number;
      checklist?: JsonRecord;
      metadata?: JsonRecord;
      fields?: JsonRecord;
      tags?: string[];
      customFieldValues?: Record<string, unknown>;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const context = await this.resolveCreationContext(input.workspaceId, input.payload);

    if (input.payload.assigneeId) {
      await this.ensureUserInWorkspace(input.workspaceId, input.payload.assigneeId);
    }

    if (input.payload.parentId) {
      await this.ensureWorkItemBelongsToWorkspace(input.workspaceId, input.payload.parentId);
    }

    const createdItem = await this.prisma.$transaction(async (tx) => {
      const targetPosition = await this.resolveInsertPosition(
        tx,
        input.workspaceId,
        context.column.id,
        input.payload.position
      );
      await this.shiftColumnItemsForInsert(tx, input.workspaceId, context.column.id, targetPosition);

      const item = await tx.item.create({
        data: {
          boardId: context.boardId,
          workspaceId: input.workspaceId,
          columnId: context.column.id,
          boardColumnId: context.column.id,
          type: context.type.slug,
          typeId: context.type.id,
          title: input.payload.title,
          description: input.payload.description,
          status: context.state.slug,
          stateId: context.state.id,
          fields: input.payload.fields ? toJsonValue(input.payload.fields) : undefined,
          metadata: input.payload.metadata ? toJsonValue(input.payload.metadata) : undefined,
          checklist: input.payload.checklist ? toJsonValue(parseChecklist(input.payload.checklist)) : undefined,
          assigneeId: input.payload.assigneeId ?? null,
          parentId: input.payload.parentId ?? null,
          dueDate: input.payload.dueDate ?? null,
          position: targetPosition,
          createdBy: input.userId,
          updatedBy: input.userId
        }
      });

      if (input.payload.tags && input.payload.tags.length > 0) {
        await this.ensureTagsBelongToWorkspace(tx, input.workspaceId, input.payload.tags);
        await tx.workItemTag.createMany({
          data: input.payload.tags.map((tagId) => ({
            itemId: item.id,
            tagId
          })),
          skipDuplicates: true
        });
      }

      if (input.payload.customFieldValues && Object.keys(input.payload.customFieldValues).length > 0) {
        await this.applyCustomFieldValues(tx, {
          workspaceId: input.workspaceId,
          itemId: item.id,
          valuesByFieldId: input.payload.customFieldValues,
          updatedBy: input.userId,
          itemTypeId: context.type.id,
          mutateLegacyFields: true
        });
      }

      const serialized = await this.getSerializedWorkItemById(input.workspaceId, item.id, tx);
      await this.publishItemCreatedEvent({
        workspaceId: input.workspaceId,
        item: serialized,
        requestedBy: input.userId,
        db: tx
      });

      return serialized;
    });

    return createdItem;
  }

  public async updateWorkItem(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: {
      title?: string;
      description?: string;
      typeId?: string;
      typeSlug?: string;
      stateId?: string;
      stateSlug?: string;
      columnId?: string;
      assigneeId?: string | null;
      parentId?: string | null;
      dueDate?: Date | null;
      position?: number;
      checklist?: JsonRecord;
      metadata?: JsonRecord;
      fields?: JsonRecord;
      customFieldValues?: Record<string, unknown>;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId
      }
    });

    if (!current) {
      throw new AppError('Work item not found', 404);
    }

    if (input.payload.assigneeId) {
      await this.ensureUserInWorkspace(input.workspaceId, input.payload.assigneeId);
    }

    if (input.payload.parentId) {
      await this.ensureWorkItemBelongsToWorkspace(input.workspaceId, input.payload.parentId);
    }

    const type = await this.resolveWorkItemType(input.workspaceId, input.payload.typeId ?? current.typeId, input.payload.typeSlug ?? current.type);
    const state = await this.resolveWorkflowState(input.workspaceId, input.payload.stateId ?? current.stateId, input.payload.stateSlug ?? current.status);
    const column = input.payload.columnId
      ? await this.resolveBoardColumn(input.workspaceId, input.payload.columnId)
      : await this.resolveColumnForState(input.workspaceId, state.id, current.boardColumnId ?? current.columnId);

    const updatedItem = await this.prisma.$transaction(async (tx) => {
      const currentColumnId = current.boardColumnId ?? current.columnId;
      if (!currentColumnId) {
        throw new AppError('Current board column not found for work item', 409);
      }

      const nextPosition =
        input.payload.position !== undefined || currentColumnId !== column.id
          ? await this.resolveInsertPosition(tx, input.workspaceId, column.id, input.payload.position, current.id)
          : current.position;

      if (currentColumnId === column.id && nextPosition !== current.position) {
        await this.reorderWithinColumn(tx, input.workspaceId, column.id, current.id, current.position, nextPosition);
      } else if (currentColumnId !== column.id) {
        await this.closeColumnGap(tx, input.workspaceId, currentColumnId, current.position, current.id);
        await this.shiftColumnItemsForInsert(tx, input.workspaceId, column.id, nextPosition, current.id);
      }

      await tx.item.update({
        where: { id: current.id },
        data: {
          title: input.payload.title,
          description: input.payload.description,
          type: type.slug,
          typeId: type.id,
          status: state.slug,
          stateId: state.id,
          boardColumnId: column.id,
          columnId: column.id,
          assigneeId: input.payload.assigneeId,
          parentId: input.payload.parentId,
          dueDate: input.payload.dueDate,
          position: nextPosition,
          checklist:
            input.payload.checklist !== undefined
              ? toJsonValue(parseChecklist(input.payload.checklist))
              : undefined,
          metadata: input.payload.metadata !== undefined ? toJsonValue(input.payload.metadata) : undefined,
          fields: input.payload.fields !== undefined ? toJsonValue(input.payload.fields) : undefined,
          updatedBy: input.userId
        }
      });

      if (input.payload.customFieldValues && Object.keys(input.payload.customFieldValues).length > 0) {
        await this.applyCustomFieldValues(tx, {
          workspaceId: input.workspaceId,
          itemId: current.id,
          valuesByFieldId: input.payload.customFieldValues,
          updatedBy: input.userId,
          itemTypeId: type.id,
          mutateLegacyFields: true
        });
      }
      const serialized = await this.getSerializedWorkItemById(input.workspaceId, current.id, tx);
      const previousColumnId = current.boardColumnId ?? current.columnId;
      const nextColumnId = serialized.column.id;
      const previousStateId = current.stateId;
      const nextStateId = serialized.stateId;

      await this.publishItemUpdatedEvent({
        workspaceId: input.workspaceId,
        item: serialized,
        patch: input.payload as Record<string, unknown>,
        requestedBy: input.userId,
        db: tx
      });

      if (previousColumnId !== nextColumnId) {
        await this.publishItemMovedEvent({
          workspaceId: input.workspaceId,
          item: serialized,
          fromColumnId: previousColumnId,
          toColumnId: nextColumnId,
          requestedBy: input.userId,
          db: tx
        });
      }

      if (previousStateId !== nextStateId) {
        await this.publishItemStateChangedEvent({
          workspaceId: input.workspaceId,
          item: serialized,
          fromStateId: previousStateId,
          toStateId: nextStateId,
          requestedBy: input.userId,
          db: tx
        });
      }

      return serialized;
    });

    return updatedItem;
  }

  public async moveWorkItem(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: {
      columnId: string;
      position?: number;
      stateId?: string;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        boardColumnId: true,
        position: true,
        stateId: true
      }
    });

    if (!current) {
      throw new AppError('Work item not found', 404);
    }

    const column = await this.resolveBoardColumn(input.workspaceId, input.payload.columnId);
    const state = input.payload.stateId
      ? await this.resolveWorkflowState(input.workspaceId, input.payload.stateId)
      : await this.resolveDefaultStateForColumn(input.workspaceId, column.id, current.stateId);

    const movedItem = await this.prisma.$transaction(async (tx) => {
      const targetPosition = await this.resolveInsertPosition(
        tx,
        input.workspaceId,
        column.id,
        input.payload.position,
        current.id
      );

      if (current.boardColumnId === column.id) {
        await this.reorderWithinColumn(tx, input.workspaceId, column.id, current.id, current.position, targetPosition);
      } else {
        if (current.boardColumnId) {
          await this.closeColumnGap(tx, input.workspaceId, current.boardColumnId, current.position, current.id);
        }
        await this.shiftColumnItemsForInsert(tx, input.workspaceId, column.id, targetPosition, current.id);
      }

      await tx.item.update({
        where: { id: current.id },
        data: {
          boardColumnId: column.id,
          columnId: column.id,
          stateId: state.id,
          status: state.slug,
          position: targetPosition,
          updatedBy: input.userId
        }
      });

      const serialized = await this.getSerializedWorkItemById(input.workspaceId, current.id, tx);

      await this.publishItemMovedEvent({
        workspaceId: input.workspaceId,
        item: serialized,
        fromColumnId: current.boardColumnId ?? null,
        toColumnId: serialized.column.id,
        requestedBy: input.userId,
        db: tx
      });

      if (current.stateId !== serialized.stateId) {
        await this.publishItemStateChangedEvent({
          workspaceId: input.workspaceId,
          item: serialized,
          fromStateId: current.stateId,
          toStateId: serialized.stateId,
          requestedBy: input.userId,
          db: tx
        });
      }

      return serialized;
    });

    return movedItem;
  }

  public async transitionWorkItem(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: {
      stateId: string;
      columnId?: string;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        boardColumnId: true,
        columnId: true,
        stateId: true
      }
    });

    if (!current) {
      throw new AppError('Work item not found', 404);
    }

    const state = await this.resolveWorkflowState(input.workspaceId, input.payload.stateId);
    const column = input.payload.columnId
      ? await this.resolveBoardColumn(input.workspaceId, input.payload.columnId)
      : await this.resolveColumnForState(input.workspaceId, state.id, current.boardColumnId ?? current.columnId);

    const transitionedItem = await this.prisma.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: current.id },
        data: {
          stateId: state.id,
          status: state.slug,
          boardColumnId: column.id,
          columnId: column.id,
          updatedBy: input.userId
        }
      });

      const serialized = await this.getSerializedWorkItemById(input.workspaceId, current.id, tx);
      const previousColumnId = current.boardColumnId ?? current.columnId;
      const nextColumnId = serialized.column.id;

      await this.publishItemStateChangedEvent({
        workspaceId: input.workspaceId,
        item: serialized,
        fromStateId: current.stateId,
        toStateId: serialized.stateId,
        requestedBy: input.userId,
        db: tx
      });

      if (previousColumnId !== nextColumnId) {
        await this.publishItemMovedEvent({
          workspaceId: input.workspaceId,
          item: serialized,
          fromColumnId: previousColumnId,
          toColumnId: nextColumnId,
          requestedBy: input.userId,
          db: tx
        });
      }

      return serialized;
    });

    return transitionedItem;
  }

  public async setWorkItemCustomFieldValue(input: {
    workspaceId: string;
    itemId: string;
    fieldId: string;
    userId: string;
    value: unknown;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const item = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        typeId: true
      }
    });

    if (!item) {
      throw new AppError('Work item not found', 404);
    }

    await this.applyCustomFieldValues(this.prisma, {
      workspaceId: input.workspaceId,
      itemId: item.id,
      valuesByFieldId: {
        [input.fieldId]: input.value
      },
      updatedBy: input.userId,
      itemTypeId: item.typeId,
      mutateLegacyFields: true
    });

    return this.getSerializedWorkItemById(input.workspaceId, item.id);
  }

  public async addTagToWorkItem(input: {
    workspaceId: string;
    itemId: string;
    tagId: string;
    userId: string;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureWorkItemBelongsToWorkspace(input.workspaceId, input.itemId);
    await this.ensureTagBelongsToWorkspace(input.workspaceId, input.tagId);

    await this.prisma.workItemTag.upsert({
      where: {
        itemId_tagId: {
          itemId: input.itemId,
          tagId: input.tagId
        }
      },
      create: {
        itemId: input.itemId,
        tagId: input.tagId
      },
      update: {}
    });

    return this.getSerializedWorkItemById(input.workspaceId, input.itemId);
  }

  public async removeTagFromWorkItem(input: {
    workspaceId: string;
    itemId: string;
    tagId: string;
    userId: string;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureWorkItemBelongsToWorkspace(input.workspaceId, input.itemId);

    await this.prisma.workItemTag.deleteMany({
      where: {
        itemId: input.itemId,
        tagId: input.tagId
      }
    });
  }

  private itemInclude() {
    return {
      typeDefinition: true,
      workflowState: true,
      boardColumn: true,
      tags: {
        include: {
          tag: true
        }
      },
      customFieldValues: {
        include: {
          field: {
            select: {
              id: true,
              slug: true,
              name: true,
              type: true
            }
          }
        }
      }
    };
  }

  private async resolveCreationContext(
    workspaceId: string,
    payload: {
      boardId?: string;
      typeId?: string;
      typeSlug?: string;
      stateId?: string;
      stateSlug?: string;
      columnId?: string;
    }
  ) {
    const [boardId, type, state] = await Promise.all([
      this.resolveBoardId(workspaceId, payload.boardId),
      this.resolveWorkItemType(workspaceId, payload.typeId, payload.typeSlug),
      this.resolveWorkflowState(workspaceId, payload.stateId, payload.stateSlug)
    ]);

    const column = payload.columnId
      ? await this.resolveBoardColumn(workspaceId, payload.columnId)
      : await this.resolveColumnForState(workspaceId, state.id);

    return {
      boardId,
      type,
      state,
      column
    };
  }

  private async resolveBoardId(workspaceId: string, boardId?: string) {
    if (boardId) {
      const board = await this.prisma.board.findFirst({ where: { id: boardId, workspaceId }, select: { id: true } });
      if (!board) {
        throw new AppError('Board not found', 404);
      }
      return board.id;
    }

    const firstBoard = await this.prisma.board.findFirst({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });

    if (!firstBoard) {
      throw new AppError('Workspace board not found', 404);
    }

    return firstBoard.id;
  }

  private async resolveWorkItemType(workspaceId: string, typeId?: string | null, typeSlug?: string | null) {
    if (typeId) {
      const byId = await this.prisma.workItemType.findFirst({ where: { id: typeId, workspaceId } });
      if (byId) {
        return byId;
      }
    }

    if (typeSlug) {
      const bySlug = await this.prisma.workItemType.findFirst({ where: { workspaceId, slug: toSlug(typeSlug) } });
      if (bySlug) {
        return bySlug;
      }
    }

    const fallback = await this.prisma.workItemType.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { position: 'asc' }
    });

    if (!fallback) {
      throw new AppError('No work item types configured for this workspace', 409);
    }

    return fallback;
  }

  private async resolveWorkflowState(workspaceId: string, stateId?: string | null, stateSlug?: string | null) {
    if (stateId) {
      const byId = await this.prisma.workflowState.findFirst({ where: { id: stateId, workspaceId } });
      if (byId) {
        return byId;
      }
    }

    if (stateSlug) {
      const bySlug = await this.prisma.workflowState.findFirst({ where: { workspaceId, slug: toSlug(stateSlug) } });
      if (bySlug) {
        return bySlug;
      }
    }

    const fallback = await this.prisma.workflowState.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { position: 'asc' }
    });

    if (!fallback) {
      throw new AppError('No workflow states configured for this workspace', 409);
    }

    return fallback;
  }

  private async resolveBoardColumn(workspaceId: string, columnId?: string | null) {
    if (columnId) {
      const column = await this.prisma.boardColumn.findFirst({ where: { id: columnId, workspaceId } });
      if (!column) {
        throw new AppError('Board column not found', 404);
      }
      return column;
    }

    const fallback = await this.prisma.boardColumn.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { position: 'asc' }
    });

    if (!fallback) {
      throw new AppError('No board columns configured for this workspace', 409);
    }

    return fallback;
  }

  private async resolveColumnForState(workspaceId: string, stateId: string, fallbackColumnId?: string | null) {
    const mapping = await this.prisma.columnStateMapping.findFirst({
      where: { workspaceId, stateId },
      orderBy: { position: 'asc' },
      include: { column: true }
    });

    if (mapping?.column) {
      return mapping.column;
    }

    return this.resolveBoardColumn(workspaceId, fallbackColumnId);
  }

  private async resolveDefaultStateForColumn(workspaceId: string, columnId: string, fallbackStateId?: string | null) {
    const mapping = await this.prisma.columnStateMapping.findFirst({
      where: { workspaceId, columnId },
      orderBy: { position: 'asc' },
      include: { state: true }
    });

    if (mapping?.state) {
      return mapping.state;
    }

    return this.resolveWorkflowState(workspaceId, fallbackStateId);
  }

  private async ensureUserInWorkspace(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId },
      select: { id: true }
    });

    if (!membership) {
      throw new AppError('Assignee does not belong to this workspace', 400);
    }
  }

  private async ensureWorkItemBelongsToWorkspace(workspaceId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, workspaceId },
      select: { id: true }
    });

    if (!item) {
      throw new AppError('Work item not found', 404);
    }
  }

  private async ensureTagBelongsToWorkspace(workspaceId: string, tagId: string) {
    const tag = await this.prisma.tagDefinition.findFirst({
      where: { id: tagId, workspaceId },
      select: { id: true }
    });

    if (!tag) {
      throw new AppError('Tag not found', 404);
    }
  }

  private async ensureTagsBelongToWorkspace(
    prisma: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    tagIds: string[]
  ) {
    const uniqueTagIds = Array.from(new Set(tagIds));

    if (uniqueTagIds.length === 0) {
      return;
    }

    const tags = await prisma.tagDefinition.findMany({
      where: {
        workspaceId,
        id: {
          in: uniqueTagIds
        }
      },
      select: { id: true }
    });

    if (tags.length !== uniqueTagIds.length) {
      throw new AppError('One or more tags do not belong to this workspace', 400);
    }
  }

  private async applyCustomFieldValues(
    prisma: PrismaClient | Prisma.TransactionClient,
    input: {
      workspaceId: string;
      itemId: string;
      valuesByFieldId: Record<string, unknown>;
      updatedBy: string;
      itemTypeId: string | null;
      mutateLegacyFields: boolean;
    }
  ) {
    const fieldIds = Object.keys(input.valuesByFieldId);

    if (fieldIds.length === 0) {
      return;
    }

    const fields = await prisma.customFieldDefinition.findMany({
      where: {
        workspaceId: input.workspaceId,
        id: {
          in: fieldIds
        }
      },
      include: {
        scopes: {
          select: { typeId: true }
        }
      }
    });

    if (fields.length !== fieldIds.length) {
      throw new AppError('One or more custom fields do not belong to this workspace', 400);
    }

    for (const field of fields) {
      const scopeIds = field.scopes.map((scope) => scope.typeId);
      if (scopeIds.length > 0 && input.itemTypeId && !scopeIds.includes(input.itemTypeId)) {
        throw new AppError(`Field '${field.name}' is not available for this work item type`, 400);
      }

      await prisma.customFieldValue.upsert({
        where: {
          fieldId_itemId: {
            fieldId: field.id,
            itemId: input.itemId
          }
        },
        create: {
          fieldId: field.id,
          itemId: input.itemId,
          value: toJsonValue(input.valuesByFieldId[field.id]),
          updatedBy: input.updatedBy
        },
        update: {
          value: toJsonValue(input.valuesByFieldId[field.id]),
          updatedBy: input.updatedBy
        }
      });
    }

    if (input.mutateLegacyFields) {
      const currentItem = await prisma.item.findUnique({
        where: { id: input.itemId },
        select: { fields: true }
      });

      const legacyFields: Record<string, unknown> = isRecord(currentItem?.fields)
        ? { ...currentItem.fields }
        : {};
      for (const field of fields) {
        legacyFields[field.slug] = input.valuesByFieldId[field.id];
      }

      await prisma.item.update({
        where: { id: input.itemId },
        data: { fields: toJsonValue(legacyFields) }
      });
    }
  }

  private async getSerializedWorkItemById(
    workspaceId: string,
    itemId: string,
    db?: PrismaClient | Prisma.TransactionClient
  ) {
    const client = db ?? this.prisma;

    const item = await client.item.findFirst({
      where: { id: itemId, workspaceId },
      include: this.itemInclude()
    });

    if (!item) {
      throw new AppError('Work item not found', 404);
    }

    return this.serializeWorkItem(item);
  }

  private async getNextItemPosition(workspaceId: string, columnId: string) {
    const aggregate = await this.prisma.item.aggregate({
      where: { workspaceId, boardColumnId: columnId },
      _max: { position: true }
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  private async countColumnItems(
    prisma: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    columnId: string,
    excludeItemId?: string
  ) {
    return prisma.item.count({
      where: {
        workspaceId,
        boardColumnId: columnId,
        ...(excludeItemId ? { id: { not: excludeItemId } } : {})
      }
    });
  }

  private async resolveInsertPosition(
    prisma: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    columnId: string,
    desiredPosition?: number,
    excludeItemId?: string
  ) {
    const itemCount = await this.countColumnItems(prisma, workspaceId, columnId, excludeItemId);
    if (desiredPosition === undefined) {
      return itemCount;
    }

    return Math.max(0, Math.min(desiredPosition, itemCount));
  }

  private async shiftColumnItemsForInsert(
    prisma: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    columnId: string,
    position: number,
    excludeItemId?: string
  ) {
    await prisma.item.updateMany({
      where: {
        workspaceId,
        boardColumnId: columnId,
        position: { gte: position },
        ...(excludeItemId ? { id: { not: excludeItemId } } : {})
      },
      data: {
        position: { increment: 1 }
      }
    });
  }

  private async closeColumnGap(
    prisma: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    columnId: string,
    position: number,
    excludeItemId?: string
  ) {
    await prisma.item.updateMany({
      where: {
        workspaceId,
        boardColumnId: columnId,
        position: { gt: position },
        ...(excludeItemId ? { id: { not: excludeItemId } } : {})
      },
      data: {
        position: { decrement: 1 }
      }
    });
  }

  private async reorderWithinColumn(
    prisma: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    columnId: string,
    itemId: string,
    fromPosition: number,
    toPosition: number
  ) {
    if (fromPosition === toPosition) {
      return;
    }

    if (toPosition > fromPosition) {
      await prisma.item.updateMany({
        where: {
          workspaceId,
          boardColumnId: columnId,
          id: { not: itemId },
          position: {
            gt: fromPosition,
            lte: toPosition
          }
        },
        data: {
          position: { decrement: 1 }
        }
      });
      return;
    }

    await prisma.item.updateMany({
      where: {
        workspaceId,
        boardColumnId: columnId,
        id: { not: itemId },
        position: {
          gte: toPosition,
          lt: fromPosition
        }
      },
      data: {
        position: { increment: 1 }
      }
    });
  }

  private serializeWorkItem(item: SerializedWorkItemSource) {
    const customFieldValuesById = item.customFieldValues.reduce((acc: Record<string, unknown>, entry) => {
      acc[entry.fieldId] = entry.value;
      return acc;
    }, {});

    const customFieldValuesBySlug = item.customFieldValues.reduce(
      (acc: Record<string, unknown>, entry) => {
        acc[entry.field.slug] = entry.value;
        return acc;
      },
      {}
    );

    const legacyFields = isRecord(item.fields) ? item.fields : {};

    return {
      id: item.id,
      workspaceId: item.workspaceId,
      boardId: item.boardId,
      title: item.title,
      description: item.description,
      typeId: item.typeId,
      type: item.typeDefinition
        ? {
            id: item.typeDefinition.id,
            slug: item.typeDefinition.slug,
            name: item.typeDefinition.name,
            color: item.typeDefinition.color
          }
        : {
            id: null,
            slug: item.type,
            name: item.type,
            color: '#64748b'
          },
      stateId: item.stateId,
      state: item.workflowState
        ? {
            id: item.workflowState.id,
            slug: item.workflowState.slug,
            name: item.workflowState.name,
            color: item.workflowState.color,
            category: item.workflowState.category
          }
        : {
            id: null,
            slug: item.status,
            name: item.status,
            color: '#64748b',
            category: null
          },
      column: item.boardColumn
        ? {
            id: item.boardColumn.id,
            slug: item.boardColumn.slug,
            name: item.boardColumn.name
          }
        : {
            id: item.boardColumnId ?? item.columnId,
            slug: null,
            name: null
          },
      assigneeId: item.assigneeId,
      parentId: item.parentId,
      dueDate: item.dueDate,
      position: item.position,
      checklist: parseChecklist(item.checklist),
      tags: item.tags.map((entry) => ({
        id: entry.tag.id,
        name: entry.tag.name,
        slug: entry.tag.slug,
        color: entry.tag.color
      })),
      customFieldValuesById,
      customFieldValuesBySlug,
      customFields: {
        ...legacyFields,
        ...customFieldValuesBySlug
      },
      fields: legacyFields,
      metadata: isRecord(item.metadata) ? item.metadata : {},
      createdBy: item.createdBy,
      updatedBy: item.updatedBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private serializeLegacyTask(workItem: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>) {
    const metadata = isRecord(workItem.metadata) ? workItem.metadata : {};
    const plannedStartAt =
      typeof workItem.customFields.plannedStartAt === 'string' ? workItem.customFields.plannedStartAt : null;
    const plannedEndAt =
      typeof workItem.customFields.plannedEndAt === 'string' ? workItem.customFields.plannedEndAt : null;

    return {
      id: workItem.id,
      title: workItem.title,
      text: workItem.description ?? '',
      type: workItem.type.slug,
      status: workItem.state.slug,
      position: workItem.position,
      priority: parsePriority(metadata.priority),
      tags: workItem.tags.map((tag: { name: string }) => tag.name),
      assignee: workItem.assigneeId ?? workItem.createdBy,
      checklist: workItem.checklist,
      due: workItem.dueDate ? workItem.dueDate.toISOString().slice(0, 10) : '',
      plannedStartAt,
      plannedEndAt,
      customFields: workItem.customFields
    };
  }

  private async publishItemCreatedEvent(input: {
    workspaceId: string;
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>;
    requestedBy: string;
    db?: Prisma.TransactionClient;
  }): Promise<void> {
    await this.publishEvent(
      {
      id: uuid(),
      name: DomainEventNames.ItemCreated,
      aggregateType: 'item',
      aggregateId: input.item.id,
      occurredAt: new Date(),
      payload: {
        ...this.toAutomationEventPayload(input.workspaceId, input.item),
        requestedBy: input.requestedBy
      }
      },
      input.db
    );
  }

  private async publishItemUpdatedEvent(input: {
    workspaceId: string;
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>;
    patch: Record<string, unknown>;
    requestedBy: string;
    db?: Prisma.TransactionClient;
  }): Promise<void> {
    await this.publishEvent(
      {
      id: uuid(),
      name: DomainEventNames.ItemUpdated,
      aggregateType: 'item',
      aggregateId: input.item.id,
      occurredAt: new Date(),
      payload: {
        ...this.toAutomationEventPayload(input.workspaceId, input.item),
        patch: input.patch,
        requestedBy: input.requestedBy
      }
      },
      input.db
    );
  }

  private async publishItemMovedEvent(input: {
    workspaceId: string;
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>;
    fromColumnId: string | null;
    toColumnId: string | null;
    requestedBy: string;
    db?: Prisma.TransactionClient;
  }): Promise<void> {
    await this.publishEvent(
      {
      id: uuid(),
      name: DomainEventNames.ItemMoved,
      aggregateType: 'item',
      aggregateId: input.item.id,
      occurredAt: new Date(),
      payload: {
        ...this.toAutomationEventPayload(input.workspaceId, input.item),
        sourceViewKey: 'dev',
        toViewKey: 'dev',
        fromColumnId: input.fromColumnId,
        toColumnId: input.toColumnId,
        toColumnKey: input.item.column.slug,
        requestedBy: input.requestedBy
      }
      },
      input.db
    );
  }

  private async publishItemStateChangedEvent(input: {
    workspaceId: string;
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>;
    fromStateId: string | null;
    toStateId: string | null;
    requestedBy: string;
    db?: Prisma.TransactionClient;
  }): Promise<void> {
    await this.publishEvent(
      {
      id: uuid(),
      name: DomainEventNames.ItemStateChanged,
      aggregateType: 'item',
      aggregateId: input.item.id,
      occurredAt: new Date(),
      payload: {
        ...this.toAutomationEventPayload(input.workspaceId, input.item),
        fromStateId: input.fromStateId,
        toStateId: input.toStateId,
        requestedBy: input.requestedBy
      }
      },
      input.db
    );
  }

  private async publishEvent(
    event: {
      id: string;
      name: string;
      aggregateType: string;
      aggregateId: string;
      occurredAt: Date;
      payload: Record<string, unknown>;
    },
    db?: Prisma.TransactionClient
  ): Promise<void> {
    if (db) {
      await this.eventPublisher.publishInTransaction(event, db);
      return;
    }

    await this.eventPublisher.publish(event);
  }

  private toAutomationEventPayload(
    workspaceId: string,
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>
  ) {
    const priority = parsePriority(
      isRecord(item.metadata) ? (item.metadata.priority as unknown) : undefined
    );

    return {
      itemId: item.id,
      workspaceId,
      boardId: item.boardId,
      itemTypeId: item.type.id,
      itemTypeSlug: item.type.slug,
      status: item.state.slug,
      stateId: item.state.id,
      assigneeId: item.assigneeId,
      priority,
      toColumnId: item.column.id,
      toColumnKey: item.column.slug
    };
  }

  private toPrismaFieldType(type: string): CustomFieldType {
    switch (type) {
      case 'text':
        return CustomFieldType.TEXT;
      case 'long_text':
        return CustomFieldType.LONG_TEXT;
      case 'number':
        return CustomFieldType.NUMBER;
      case 'date':
        return CustomFieldType.DATE;
      case 'datetime':
        return CustomFieldType.DATETIME;
      case 'boolean':
        return CustomFieldType.BOOLEAN;
      case 'select':
        return CustomFieldType.SELECT;
      case 'multi_select':
        return CustomFieldType.MULTI_SELECT;
      case 'user':
        return CustomFieldType.USER;
      default:
        return CustomFieldType.TEXT;
    }
  }

  private isAiEnabledInFieldSettings(settings: unknown): boolean {
    if (!isRecord(settings)) {
      return false;
    }

    return settings.allowAiGeneration === true || settings.aiEnhance === true;
  }

  private resolveBoardPerspectivesFromSettings(
    settings: unknown,
    defaultStatuses: Array<{ id: string; label: string; dot: string }>
  ) {
    if (!isRecord(settings)) {
      return [
        {
          id: 'dev',
          label: 'DEV',
          caption: 'Fluxo operacional principal',
          statuses: defaultStatuses,
          statusSource: { kind: 'workflow_state' }
        }
      ];
    }

    const rawPerspectives = Array.isArray(settings.perspectives) ? settings.perspectives : settings.boardViews;
    if (!Array.isArray(rawPerspectives) || rawPerspectives.length === 0) {
      return [
        {
          id: 'dev',
          label: 'DEV',
          caption: 'Fluxo operacional principal',
          statuses: defaultStatuses,
          statusSource: { kind: 'workflow_state' }
        }
      ];
    }

    const parsed = rawPerspectives
      .map((rawView, index) => {
        if (!isRecord(rawView)) {
          return null;
        }

        const id = typeof rawView.key === 'string' && rawView.key.trim().length > 0 ? rawView.key : null;
        const label = typeof rawView.name === 'string' && rawView.name.trim().length > 0 ? rawView.name : null;
        if (!id || !label) {
          return null;
        }

        const caption = typeof rawView.caption === 'string' ? rawView.caption : undefined;
        const compactCards = Boolean(rawView.compactCards);
        const allowedTaskTypes = Array.isArray(rawView.allowedTaskTypes)
          ? rawView.allowedTaskTypes.filter((value): value is string => typeof value === 'string')
          : undefined;
        const visibleBoardColumnIds = Array.isArray(rawView.visibleBoardColumnIds)
          ? rawView.visibleBoardColumnIds.filter((value): value is string => typeof value === 'string')
          : undefined;

        const statuses = Array.isArray(rawView.statuses)
          ? rawView.statuses
              .map((status) => {
                if (!isRecord(status)) {
                  return null;
                }

                if (
                  typeof status.id !== 'string' ||
                  typeof status.label !== 'string' ||
                  typeof status.dot !== 'string'
                ) {
                  return null;
                }

                return {
                  id: status.id,
                  label: status.label,
                  dot: status.dot
                };
              })
              .filter(
                (
                  status
                ): status is {
                  id: string;
                  label: string;
                  dot: string;
                } => status !== null
              )
          : [];

        const statusSourceRecord = isRecord(rawView.statusSource) ? rawView.statusSource : null;
        const statusSourceKind =
          statusSourceRecord && typeof statusSourceRecord.kind === 'string'
            ? statusSourceRecord.kind
            : 'workflow_state';

        const statusSource =
          statusSourceKind === 'custom_field' &&
          typeof statusSourceRecord?.fieldId === 'string' &&
          statusSourceRecord.fieldId.trim().length > 0
            ? {
                kind: 'custom_field' as const,
                fieldId: statusSourceRecord.fieldId,
                fallbackByStatus:
                  isRecord(statusSourceRecord.fallbackByStatus)
                    ? Object.entries(statusSourceRecord.fallbackByStatus).reduce<Record<string, string>>(
                        (acc, [key, value]) => {
                          if (typeof value === 'string') {
                            acc[key] = value;
                          }
                          return acc;
                        },
                        {}
                      )
                    : undefined
              }
            : { kind: 'workflow_state' as const };

        return {
          id,
          label,
          caption,
          statuses: statuses.length > 0 ? statuses : defaultStatuses,
          statusSource,
          compactCards,
          allowedTaskTypes,
          visibleBoardColumnIds,
          position: typeof rawView.position === 'number' ? rawView.position : index
        };
      })
      .filter((view): view is NonNullable<typeof view> => view !== null)
      .sort((left, right) => left.position - right.position)
      .map(({ position: _position, ...view }) => view);

    if (parsed.length === 0) {
      return [
        {
          id: 'dev',
          label: 'DEV',
          caption: 'Fluxo operacional principal',
          statuses: defaultStatuses,
          statusSource: { kind: 'workflow_state' as const }
        }
      ];
    }

    return parsed;
  }
}

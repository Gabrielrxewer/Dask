import { CustomFieldType, Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { ensureWorkspaceDefaultConfiguration } from '@/modules/workspaces/application/default-workspace-seed';
import { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
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

export class WorkspaceWorkItemsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService
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

    const boardConfig = {
      statuses: config.workflowStates
        .filter((state) => state.isActive)
        .sort((left, right) => left.order - right.order)
        .map((state) => ({
          id: state.slug,
          label: state.name,
          dot: state.color
        })),
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
        .map((field) => ({
          id: field.slug,
          label: field.name,
          type: mapCustomFieldTypeToFrontend(this.toPrismaFieldType(field.type)),
          options: field.options.map((option) => option.label)
        })),
      cardLayout: {
        visibleFieldIds: config.preferences.visibleCardFieldIds
      }
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
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

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

    const defaultPosition = await this.getNextItemPosition(input.workspaceId, context.column.id);

    const created = await this.prisma.$transaction(async (tx) => {
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
          position: input.payload.position ?? defaultPosition,
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

      return item.id;
    });

    return this.getSerializedWorkItemById(input.workspaceId, created);
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

    await this.prisma.$transaction(async (tx) => {
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
          position: input.payload.position,
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
    });

    return this.getSerializedWorkItemById(input.workspaceId, current.id);
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

    await this.prisma.item.update({
      where: { id: current.id },
      data: {
        boardColumnId: column.id,
        columnId: column.id,
        stateId: state.id,
        status: state.slug,
        position: input.payload.position ?? (await this.getNextItemPosition(input.workspaceId, column.id)),
        updatedBy: input.userId
      }
    });

    return this.getSerializedWorkItemById(input.workspaceId, current.id);
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
        columnId: true
      }
    });

    if (!current) {
      throw new AppError('Work item not found', 404);
    }

    const state = await this.resolveWorkflowState(input.workspaceId, input.payload.stateId);
    const column = input.payload.columnId
      ? await this.resolveBoardColumn(input.workspaceId, input.payload.columnId)
      : await this.resolveColumnForState(input.workspaceId, state.id, current.boardColumnId ?? current.columnId);

    await this.prisma.item.update({
      where: { id: current.id },
      data: {
        stateId: state.id,
        status: state.slug,
        boardColumnId: column.id,
        columnId: column.id,
        updatedBy: input.userId
      }
    });

    return this.getSerializedWorkItemById(input.workspaceId, current.id);
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

      const legacyFields = isRecord(currentItem?.fields) ? { ...currentItem.fields } : {};
      for (const field of fields) {
        legacyFields[field.slug] = input.valuesByFieldId[field.id];
      }

      await prisma.item.update({
        where: { id: input.itemId },
        data: { fields: toJsonValue(legacyFields) }
      });
    }
  }

  private async getSerializedWorkItemById(workspaceId: string, itemId: string) {
    const item = await this.prisma.item.findFirst({
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

  private serializeWorkItem(item: any) {
    const customFieldValuesById = item.customFieldValues.reduce((acc: Record<string, unknown>, entry: any) => {
      acc[entry.fieldId] = entry.value;
      return acc;
    }, {});

    const customFieldValuesBySlug = item.customFieldValues.reduce(
      (acc: Record<string, unknown>, entry: any) => {
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
      tags: item.tags.map((entry: any) => ({
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

    return {
      id: workItem.id,
      title: workItem.title,
      text: workItem.description ?? '',
      type: workItem.type.slug,
      status: workItem.state.slug,
      priority: parsePriority(metadata.priority),
      tags: workItem.tags.map((tag) => tag.name),
      assignee: workItem.assigneeId ?? workItem.createdBy,
      checklist: workItem.checklist,
      due: workItem.dueDate ? workItem.dueDate.toISOString().slice(0, 10) : '',
      customFields: workItem.customFields
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
}

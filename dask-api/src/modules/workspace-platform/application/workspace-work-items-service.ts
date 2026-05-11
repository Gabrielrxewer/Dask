import { MembershipRole, Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import { ensureWorkspaceDefaultConfiguration } from '@/modules/workspaces/application/default-workspace-seed';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import {
  requireClientCustomerScope,
  resolveCustomerAccessScope,
  type CustomerAccessScope
} from '@/modules/workspace-platform/application/customer-access-scope';
import {
  addHexAlpha,
  getColorFromId,
  getInitials,
  isRecord,
  parseChecklist,
  parsePriority,
  toJsonValue,
  toSlug,
  type JsonRecord
} from '@/modules/workspace-platform/application/shared';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplatePerspective
} from '@/modules/workspaces/application/workspace-template-catalog';

type BoardStatusSnapshot = {
  id: string;
  label: string;
  dot: string;
  category?: string | null;
  isTerminal?: boolean;
};

type BoardColumnSnapshot = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  states?: Array<{ slug: string; name: string }>;
};

type BoardPerspectiveSnapshot = {
  id: string;
  label: string;
  caption?: string;
  statuses: Array<{ id: string; label: string; dot: string }>;
  statusSource: { kind: 'workflow_state' } | { kind: 'custom_field'; fieldId: string; fallbackByStatus?: Record<string, string> };
  compactCards?: boolean;
  allowedTaskTypes?: string[];
  visibleBoardColumnIds?: string[];
  visibleStatusIds?: string[];
  createTaskColumnIds?: string[];
  analyticsRole?: 'prospecting' | 'funnel' | 'terminal' | 'client';
};

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
  documentLinks: Array<{
    createdAt: Date;
    document: {
      id: string;
      title: string;
      updatedAt: Date;
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

type ListWorkItemsFilters = {
  page?: number;
  pageSize?: number;
  limit?: number;
  cursor?: string;
  perspectiveId?: string;
  boardColumnId?: string;
  columnId?: string;
  workItemTypeId?: string;
  typeId?: string;
  workflowStateId?: string;
  workflowStateIds?: string[];
  stateId?: string;
  stateSlug?: string;
  typeSlug?: string;
  assignedToMe?: boolean;
  assigneeId?: string;
  responsibleId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  plannedStartFrom?: Date;
  plannedStartTo?: Date;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  updatedAtFrom?: Date;
  updatedAtTo?: Date;
  source?: string;
  customerId?: string;
  converted?: boolean;
  customFieldFilters?: Array<{
    fieldId?: string;
    fieldKey?: string;
    value: string | number | boolean | null;
  }>;
  sortBy?: 'position' | 'title' | 'type' | 'status' | 'assignee' | 'dueDate' | 'createdAt' | 'updatedAt' | 'plannedStartAt';
  sortDirection?: 'asc' | 'desc';
  sort?: 'position_asc' | 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc';
};

type WorkItemTypeTransformationPayload = {
  transformationId?: string;
  toTypeId?: string;
  toTypeSlug?: string;
  stateId?: string;
  stateSlug?: string;
  customFieldValues?: Record<string, unknown>;
  defaultValuesForNewFields?: Record<string, unknown>;
};

type TransformationTypeSummary = {
  id: string;
  slug: string;
  name: string;
  color: string;
};

type TransformationFieldSummary = {
  id: string;
  slug: string;
  name: string;
  required: boolean;
  defaultValue: unknown;
};

type TransformationConfig = {
  id: string;
  workspaceId: string;
  fromTypeId: string;
  toTypeId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  mode: string;
  fieldCompatibilityMode: string;
  defaultValuesForNewFields: unknown;
  stateMapping: unknown;
  permission: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  fromType?: TransformationTypeSummary;
  toType?: TransformationTypeSummary;
};

type TransformationPersistenceRow = Omit<TransformationConfig, 'fromType' | 'toType'> & {
  fromType: TransformationTypeSummary;
  toType: TransformationTypeSummary;
};

type WorkItemTypeTransformationDelegate = {
  findMany(input: {
    where: { workspaceId: string; enabled: boolean };
    include: {
      fromType: { select: { id: true; slug: true; name: true; color: true } };
      toType: { select: { id: true; slug: true; name: true; color: true } };
    };
    orderBy: Array<{ createdAt: 'asc' }>;
  }): Promise<TransformationPersistenceRow[]>;
};

type TransformationValidationResult = {
  valid: boolean;
  reason: string | null;
  transformation: TransformationConfig;
  fromType: TransformationTypeSummary;
  toType: TransformationTypeSummary;
  preservedFields: TransformationFieldSummary[];
  missingFields: TransformationFieldSummary[];
  newRequiredFields: TransformationFieldSummary[];
  defaultValuesForNewFields: Record<string, unknown>;
};

export class WorkspaceWorkItemsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async getWorkspaceSnapshot(input: { workspaceId: string; userId: string; limit?: number }) {
    const access = await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const clientCustomerIds = requireClientCustomerScope(customerScope);
    const ownCardsFilter = access.ownCardsOnly && !customerScope.isClient
      ? {
          OR: [{ assigneeId: input.userId }, { createdBy: input.userId }]
        }
      : {};
    const customerFilter = this.buildClientWorkItemWhere(customerScope);
    const itemScopeFilter = this.combineItemWhere(ownCardsFilter, customerFilter, this.activeWorkItemWhere());

    await ensureWorkspaceDefaultConfiguration(this.prisma, {
      workspaceId: input.workspaceId,
      ownerUserId: input.userId
    });

    const [config, members, automations, workItems] = await Promise.all([
      this.configService.loadWorkspaceConfig(input.workspaceId),
      this.prisma.workspaceMembership.findMany({
        where: customerScope.isClient
          ? { workspaceId: input.workspaceId, userId: input.userId }
          : { workspaceId: input.workspaceId },
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
      this.prisma.automationWorkflow.findMany({
        where: customerScope.isClient ? { id: { in: [] } } : { workspaceId: input.workspaceId },
        include: {
          currentVersion: {
            select: {
              id: true,
              version: true,
              status: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      }),
      this.prisma.item.findMany({
        where: { workspaceId: input.workspaceId, ...itemScopeFilter },
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
        dot: state.color,
        category: state.category,
        isTerminal: state.isTerminal
      }));

    const templateKey = this.readTemplateKey(config.preferences.settings);
    const template = getWorkspaceTemplateByKey(templateKey);
    const statusIdsByColumnId = this.buildStatusIdsByColumnId(config.boardColumns);
    const allPerspectives = this.resolveBoardPerspectivesFromSettings(
      config.preferences.settings,
      statuses,
      template?.schema.perspectives ?? [],
      config.boardColumns
    ).map((perspective) => this.enrichPerspectiveWithStatusIds(perspective, statuses, statusIdsByColumnId));
    const boardPerspectives = access.allowedBoardViewKeys
      ? allPerspectives.filter((view) => access.allowedBoardViewKeys!.includes(toSlug(view.id)))
      : allPerspectives;

    const clientPerspective = customerScope.isClient
      ? this.buildClientBoardPerspective(allPerspectives)
      : null;
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
        .map((field) => ({
          id: field.slug,
          definitionId: field.definitionId ?? field.id,
          label: field.label ?? field.name,
          name: field.name,
          slug: field.slug,
          description: field.description,
          variableKey: field.variableKey,
          variableLabel: field.variableLabel,
          variableDescription: field.variableDescription,
          type: field.type,
          source: field.source,
          required: field.required,
          isSystem: field.isSystem,
          isEditable: field.isEditable,
          isRemovable: field.isRemovable,
          isActive: field.isActive,
          order: field.order,
          config: field.config,
          defaultValue: field.defaultValue,
          options: Array.isArray(field.options)
            ? field.options
                .filter((option: { isActive?: boolean }) => option.isActive !== false)
                .map((option: { id: string; label: string; value: string; color: string | null; order: number; isActive: boolean }) => ({
                  id: option.id,
                  label: option.label,
                  value: option.value,
                  color: option.color,
                  order: option.order,
                  isActive: option.isActive
                }))
            : [],
          capabilities: field.capabilities,
          storage: field.storage
        })),
      fieldBindings: config.fieldBindings,
      cardLayout: {
        visibleFieldIds: config.preferences.visibleCardFieldIds,
        visibleFieldIdsByType: config.preferences.visibleFieldsByType ?? {},
        detailVisibleFieldIdsByType: config.preferences.detailVisibleFieldsByType ?? {},
        detailFieldZoneByType:
          config.preferences.settings &&
          typeof config.preferences.settings === 'object' &&
          !Array.isArray(config.preferences.settings) &&
          typeof config.preferences.settings.detailFieldZoneByType === 'object' &&
          config.preferences.settings.detailFieldZoneByType !== null &&
          !Array.isArray(config.preferences.settings.detailFieldZoneByType)
            ? (config.preferences.settings.detailFieldZoneByType as Record<string, Record<string, 'main' | 'side'>>)
            : {}
      },
      perspectives:
        clientPerspective
          ? [clientPerspective]
          : customerScope.isClient
          ? []
          : boardPerspectives.length > 0
          ? boardPerspectives
          : allPerspectives,
      operationalMetadata: this.buildBoardOperationalMetadata({
        templateKey,
        templateRules: template?.rules,
        perspectives: allPerspectives,
        statuses,
        itemTypes: config.itemTypes
      })
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
      access: {
        role: access.role,
        isClient: customerScope.isClient,
        customerIds: clientCustomerIds,
        ownCardsOnly: access.ownCardsOnly,
        allowedModules: access.allowedModules,
        moduleEntitlements: access.moduleEntitlements,
        allowedBoardViewKeys: access.allowedBoardViewKeys
      },
      preferences: config.preferences,
      boardConfig,
      automations: automations.map((workflow) => ({
        id: workflow.id,
        title: workflow.name,
        status: workflow.status === 'active' ? 'active' : 'paused',
        trigger: workflow.currentVersion ? `Versao ${workflow.currentVersion.version}` : 'Sem versao publicada',
        action: 'Workflow versionado'
      })),
      tasks,
      workspace: access.workspace,
      itemTypes: config.itemTypes,
      workflowStates: config.workflowStates,
      boardColumns: config.boardColumns,
      tags: config.tags,
      customFieldDefinitions: config.customFieldDefinitions,
      workItems: serializedWorkItems,
      automationsSummary: automations.map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        currentVersion: workflow.currentVersion?.version ?? null,
        updatedAt: workflow.updatedAt
      }))
    };
  }

  public async listWorkItems(input: { workspaceId: string; userId: string }) {
    const access = await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const ownCardsFilter = access.ownCardsOnly && !customerScope.isClient
      ? {
          OR: [{ assigneeId: input.userId }, { createdBy: input.userId }]
        }
      : {};
    const itemScopeFilter = this.combineItemWhere(
      ownCardsFilter,
      this.buildClientWorkItemWhere(customerScope),
      this.activeWorkItemWhere()
    );

    const items = await this.prisma.item.findMany({
      where: { workspaceId: input.workspaceId, ...itemScopeFilter },
      include: this.itemInclude(),
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }]
    });

    return items.map((item) => this.serializeWorkItem(item));
  }

  public async listWorkItemsPage(input: { workspaceId: string; userId: string; filters?: ListWorkItemsFilters }) {
    const access = await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const ownCardsFilter = access.ownCardsOnly && !customerScope.isClient
      ? {
          OR: [{ assigneeId: input.userId }, { createdBy: input.userId }]
        }
      : {};
    const itemScopeFilter = this.combineItemWhere(
      ownCardsFilter,
      this.buildClientWorkItemWhere(customerScope),
      this.activeWorkItemWhere()
    );
    const filters = input.filters ?? {};
    const pageNumber = typeof filters.page === 'number' ? Math.max(filters.page, 1) : null;
    const take = Math.min(Math.max(filters.pageSize ?? filters.limit ?? 80, 1), 200);
    const where = this.combineItemWhere(
      { workspaceId: input.workspaceId },
      itemScopeFilter,
      this.buildWorkItemListFilterWhere({
        ...filters,
        assigneeId: filters.assignedToMe ? input.userId : filters.assigneeId
      })
    );

    const orderBy = this.buildWorkItemListOrderBy(filters);
    const paginationArgs: { skip?: number; cursor?: Prisma.ItemWhereUniqueInput } =
      pageNumber !== null
        ? { skip: (pageNumber - 1) * take }
        : filters.cursor
          ? { cursor: { id: filters.cursor }, skip: 1 }
          : {};

    const [items, total, columnCounts, stateCounts, typeCounts] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: this.itemInclude(),
        orderBy,
        take: take + 1,
        ...paginationArgs
      }),
      this.prisma.item.count({ where }),
      this.prisma.item.groupBy({
        by: ['boardColumnId'],
        where,
        _count: { _all: true }
      }),
      this.prisma.item.groupBy({
        by: ['stateId'],
        where,
        _count: { _all: true }
      }),
      this.prisma.item.groupBy({
        by: ['type'],
        where,
        _count: { _all: true }
      })
    ]);

    const pageItems = items.slice(0, take);
    const trailing = items[take];
    const totalPages = Math.max(Math.ceil(total / take), 1);
    const currentPage = pageNumber ?? 1;

    return {
      items: pageItems.map((item) => this.serializeLegacyTask(this.serializeWorkItem(item))),
      total,
      totalCount: total,
      nextCursor: trailing?.id ?? null,
      hasMore: Boolean(trailing),
      pageInfo: {
        page: currentPage,
        pageSize: take,
        totalPages,
        hasNextPage: pageNumber !== null ? currentPage < totalPages : Boolean(trailing),
        hasPreviousPage: pageNumber !== null ? currentPage > 1 : Boolean(filters.cursor),
        nextCursor: trailing?.id ?? null
      },
      columnCounts: columnCounts.reduce<Record<string, number>>((acc, entry) => {
        if (entry.boardColumnId) {
          acc[entry.boardColumnId] = entry._count._all;
        }
        return acc;
      }, {}),
      workflowStateCounts: stateCounts.reduce<Record<string, number>>((acc, entry) => {
        if (entry.stateId) {
          acc[entry.stateId] = entry._count._all;
        }
        return acc;
      }, {}),
      countsByState: stateCounts.reduce<Record<string, number>>((acc, entry) => {
        if (entry.stateId) {
          acc[entry.stateId] = entry._count._all;
        }
        return acc;
      }, {}),
      countsByType: typeCounts.reduce<Record<string, number>>((acc, entry) => {
        if (entry.type) {
          acc[entry.type] = entry._count._all;
        }
        return acc;
      }, {})
    };
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

  public async bulkUpdateWorkItems(input: {
    workspaceId: string;
    userId: string;
    payload: {
      itemIds: string[];
      patch: {
        stateId?: string;
        stateSlug?: string;
        assigneeId?: string | null;
        priority?: number;
        archived?: boolean;
      };
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const itemIds = Array.from(new Set(input.payload.itemIds));
    const updated: ReturnType<typeof this.serializeLegacyTask>[] = [];
    const failed: Array<{ itemId: string; message: string }> = [];
    const basePatch = {
      ...(input.payload.patch.stateId !== undefined ? { stateId: input.payload.patch.stateId } : {}),
      ...(input.payload.patch.stateSlug !== undefined ? { stateSlug: input.payload.patch.stateSlug } : {}),
      ...(input.payload.patch.assigneeId !== undefined ? { assigneeId: input.payload.patch.assigneeId } : {})
    };
    const shouldPatchMetadata =
      input.payload.patch.priority !== undefined || input.payload.patch.archived !== undefined;

    for (const itemId of itemIds) {
      try {
        let metadataPatch: { metadata?: JsonRecord } = {};
        if (shouldPatchMetadata) {
          const current = await this.prisma.item.findFirst({
            where: {
              id: itemId,
              workspaceId: input.workspaceId
            },
            select: { metadata: true }
          });
          if (!current) {
            throw new AppError('Work item not found', 404);
          }

          const metadata = isRecord(current.metadata) ? { ...current.metadata } : {};
          if (input.payload.patch.priority !== undefined) {
            metadata.priority = input.payload.patch.priority;
          }
          if (input.payload.patch.archived !== undefined) {
            if (input.payload.patch.archived) {
              metadata.archivedAt = new Date().toISOString();
              metadata.archivedBy = input.userId;
            } else {
              delete metadata.archivedAt;
              delete metadata.archivedBy;
            }
          }
          metadataPatch = { metadata };
        }

        const item = await this.updateWorkItem({
          workspaceId: input.workspaceId,
          itemId,
          userId: input.userId,
          payload: {
            ...basePatch,
            ...metadataPatch
          }
        });
        updated.push(this.serializeLegacyTask(item));
      } catch (error) {
        failed.push({
          itemId,
          message: error instanceof Error ? error.message : 'Unable to update work item'
        });
      }
    }

    return {
      updatedCount: updated.length,
      failedCount: failed.length,
      items: updated,
      failed
    };
  }

  public async updateWorkItemSchedule(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: {
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
      reason?: string;
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
        fields: true
      }
    });

    if (!current) {
      throw new AppError('Work item not found', 404);
    }

    const currentFields = isRecord(current.fields) ? current.fields : {};
    const nextFields: JsonRecord = {
      ...currentFields
    };
    const schedulePatch: JsonRecord = {};

    if (input.payload.plannedStartAt !== undefined) {
      nextFields.plannedStartAt = input.payload.plannedStartAt;
      schedulePatch.plannedStartAt = input.payload.plannedStartAt;
    }

    if (input.payload.plannedEndAt !== undefined) {
      nextFields.plannedEndAt = input.payload.plannedEndAt;
      schedulePatch.plannedEndAt = input.payload.plannedEndAt;
    }

    const updatedItem = await this.prisma.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: current.id },
        data: {
          fields: toJsonValue(nextFields),
          updatedBy: input.userId
        }
      });

      const serialized = await this.getSerializedWorkItemById(input.workspaceId, current.id, tx);

      await this.publishItemUpdatedEvent({
        workspaceId: input.workspaceId,
        item: serialized,
        patch: {
          fields: schedulePatch,
          ...(input.payload.reason ? { reason: input.payload.reason } : {})
        },
        requestedBy: input.userId,
        db: tx
      });

      return serialized;
    });

    return updatedItem;
  }

  public async deleteWorkItem(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
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
        position: true
      }
    });

    if (!current) {
      throw new AppError('Work item not found', 404);
    }

    await this.prisma.$transaction(async (tx) => {
      const currentColumnId = current.boardColumnId ?? current.columnId;

      await tx.item.delete({
        where: { id: current.id }
      });

      if (currentColumnId) {
        await this.closeColumnGap(tx, input.workspaceId, currentColumnId, current.position, current.id);
      }
    });
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
    const access = await this.configService.ensureItemTransitionWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const itemScopeFilter = this.buildClientWorkItemWhere(customerScope);

    const current = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId,
        ...itemScopeFilter
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
    await this.ensureClientColumnAllowed(input.workspaceId, column.id, access);
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
    const access = await this.configService.ensureItemTransitionWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const itemScopeFilter = this.buildClientWorkItemWhere(customerScope);

    const current = await this.prisma.item.findFirst({
      where: {
        id: input.itemId,
        workspaceId: input.workspaceId,
        ...itemScopeFilter
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
    await this.ensureClientColumnAllowed(input.workspaceId, column.id, access);

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

  public async listWorkItemTypeTransformations(input: { workspaceId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const configured = await this.loadConfiguredTypeTransformations(input.workspaceId);
    if (configured.length > 0) {
      return Promise.all(configured.map((entry) => this.describeTypeTransformation(input.workspaceId, entry)));
    }

    const fallback = await this.buildDefaultCommercialTypeTransformations(input.workspaceId);
    return Promise.all(fallback.map((entry) => this.describeTypeTransformation(input.workspaceId, entry)));
  }

  public async validateWorkItemTypeTransformation(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: WorkItemTypeTransformationPayload;
  }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    return this.buildTypeTransformationValidation(input.workspaceId, input.itemId, input.payload);
  }

  public async transformWorkItemType(input: {
    workspaceId: string;
    itemId: string;
    userId: string;
    payload: WorkItemTypeTransformationPayload;
  }) {
    await this.configService.ensureItemTransitionWorkspace(input.workspaceId, input.userId);
    const validation = await this.buildTypeTransformationValidation(input.workspaceId, input.itemId, input.payload);

    if (!validation.valid) {
      throw new AppError(
        validation.reason ?? 'The target type cannot preserve all source fields.',
        422,
        {
          code: 'WORK_ITEM_TYPE_TRANSFORMATION_INVALID',
          missingFields: validation.missingFields.map((field) => field.slug)
        }
      );
    }

    const customFieldValues = {
      ...(validation.defaultValuesForNewFields ?? {}),
      ...(input.payload.customFieldValues ?? {})
    };
    const missingRequired = validation.newRequiredFields.filter((field) => this.isBlankCustomFieldValue(customFieldValues[field.id]));
    if (missingRequired.length > 0) {
      throw new AppError('Required fields for the target type must be filled before transforming.', 422, {
        code: 'WORK_ITEM_TYPE_TRANSFORMATION_REQUIRED_FIELDS',
        requiredFields: missingRequired.map((field) => field.slug)
      });
    }

    const transformed = await this.prisma.$transaction(async (tx) => {
      const current = await tx.item.findFirst({
        where: { id: input.itemId, workspaceId: input.workspaceId },
        select: {
          id: true,
          typeId: true,
          type: true,
          stateId: true,
          status: true,
          metadata: true
        }
      });

      if (!current) {
        throw new AppError('Work item not found', 404);
      }

      const nextState = await this.resolveTransformationTargetState(
        tx,
        input.workspaceId,
        current,
        validation.transformation,
        input.payload
      );
      const nextMetadata = this.mergeTransformationMetadata(current.metadata, {
        transformationId: validation.transformation.id,
        transformationName: validation.transformation.name,
        fromTypeId: validation.fromType.id,
        fromTypeSlug: validation.fromType.slug,
        toTypeId: validation.toType.id,
        toTypeSlug: validation.toType.slug,
        requestedBy: input.userId
      });

      await tx.item.update({
        where: { id: current.id },
        data: {
          typeId: validation.toType.id,
          type: validation.toType.slug,
          stateId: nextState?.id ?? current.stateId,
          status: nextState?.slug ?? current.status,
          metadata: toJsonValue(nextMetadata),
          updatedBy: input.userId
        }
      });

      if (Object.keys(customFieldValues).length > 0) {
        await this.applyCustomFieldValues(tx, {
          workspaceId: input.workspaceId,
          itemId: current.id,
          valuesByFieldId: customFieldValues,
          updatedBy: input.userId,
          itemTypeId: validation.toType.id,
          mutateLegacyFields: true
        });
      }

      const serialized = await this.getSerializedWorkItemById(input.workspaceId, current.id, tx);

      await this.publishEvent(
        {
          id: uuid(),
          name: DomainEventNames.WorkItemTypeTransformationExecuted,
          aggregateType: 'item',
          aggregateId: current.id,
          occurredAt: new Date(),
          payload: {
            ...this.toAutomationEventPayload(input.workspaceId, serialized),
            workspaceId: input.workspaceId,
            itemId: current.id,
            transformationId: validation.transformation.id,
            fromTypeId: validation.fromType.id,
            fromTypeSlug: validation.fromType.slug,
            toTypeId: validation.toType.id,
            toTypeSlug: validation.toType.slug,
            preservedFields: validation.preservedFields.map((field) => field.slug),
            requestedBy: input.userId
          }
        },
        tx
      );

      return serialized;
    });

    return transformed;
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

  public async listLinkedDocuments(input: { workspaceId: string; itemId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    await this.ensureWorkItemVisibleToUser(input.workspaceId, input.itemId, customerScope);

    const links = await this.prisma.workItemDocumentLink.findMany({
      where: {
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        ...(customerScope.isClient
          ? {
              document: this.buildClientDocumentWhere(customerScope.customerIds)
            }
          : {})
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            kind: true,
            metadata: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    return this.serializeLinkedDocuments(links);
  }

  public async linkDocumentToWorkItem(input: {
    workspaceId: string;
    itemId: string;
    documentId: string;
    userId: string;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureWorkItemBelongsToWorkspace(input.workspaceId, input.itemId);
    await this.ensureDocumentBelongsToWorkspace(input.workspaceId, input.documentId);

    await this.prisma.workItemDocumentLink.upsert({
      where: {
        itemId_documentId: {
          itemId: input.itemId,
          documentId: input.documentId
        }
      },
      create: {
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        documentId: input.documentId,
        linkedBy: input.userId
      },
      update: {
        linkedBy: input.userId
      }
    });

    return this.listLinkedDocuments(input);
  }

  public async unlinkDocumentFromWorkItem(input: {
    workspaceId: string;
    itemId: string;
    documentId: string;
    userId: string;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureWorkItemBelongsToWorkspace(input.workspaceId, input.itemId);

    await this.prisma.workItemDocumentLink.deleteMany({
      where: {
        workspaceId: input.workspaceId,
        itemId: input.itemId,
        documentId: input.documentId
      }
    });
  }

  private combineItemWhere(...parts: Prisma.ItemWhereInput[]): Prisma.ItemWhereInput {
    const and = parts.filter((part) => Object.keys(part).length > 0);
    return and.length > 0 ? { AND: and } : {};
  }

  private activeWorkItemWhere(): Prisma.ItemWhereInput {
    return {
      metadata: {
        path: ['archivedAt'],
        equals: Prisma.AnyNull
      }
    };
  }

  private buildWorkItemListFilterWhere(filters: ListWorkItemsFilters): Prisma.ItemWhereInput {
    const where: Prisma.ItemWhereInput = {};
    const columnId = filters.boardColumnId ?? filters.columnId;
    const stateId = filters.workflowStateId ?? filters.stateId;
    const typeId = filters.workItemTypeId ?? filters.typeId;
    const assigneeId = filters.responsibleId ?? filters.assigneeId;

    if (columnId) {
      where.boardColumnId = columnId;
    }

    if (stateId) {
      where.stateId = stateId;
    } else if (filters.workflowStateIds && filters.workflowStateIds.length > 0) {
      where.stateId = { in: filters.workflowStateIds };
    }

    if (filters.stateSlug) {
      where.status = toSlug(filters.stateSlug);
    }

    if (typeId) {
      where.typeId = typeId;
    }

    if (filters.typeSlug) {
      where.type = toSlug(filters.typeSlug);
    }

    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    const dueDateFrom = filters.dueDateFrom ?? filters.dateFrom;
    const dueDateTo = filters.dueDateTo ?? filters.dateTo;
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {
        ...(dueDateFrom ? { gte: dueDateFrom } : {}),
        ...(dueDateTo ? { lte: dueDateTo } : {})
      };
    }

    if (filters.createdAtFrom || filters.createdAtTo) {
      where.createdAt = {
        ...(filters.createdAtFrom ? { gte: filters.createdAtFrom } : {}),
        ...(filters.createdAtTo ? { lte: filters.createdAtTo } : {})
      };
    }

    if (filters.updatedAtFrom || filters.updatedAtTo) {
      where.updatedAt = {
        ...(filters.updatedAtFrom ? { gte: filters.updatedAtFrom } : {}),
        ...(filters.updatedAtTo ? { lte: filters.updatedAtTo } : {})
      };
    }

    const commercialFilters: Prisma.ItemWhereInput[] = [];
    const source = filters.source?.trim();
    if (source) {
      commercialFilters.push(this.buildCommercialFieldFilter('source', source));
    }

    const customerId = filters.customerId?.trim();
    if (customerId) {
      commercialFilters.push(this.buildCommercialFieldFilter('customerId', customerId));
    }

    if (filters.converted !== undefined) {
      commercialFilters.push(this.buildCommercialConvertedFilter(filters.converted));
    }

    for (const customFilter of filters.customFieldFilters ?? []) {
      const fieldFilter = this.buildCustomFieldListFilter(customFilter);
      if (fieldFilter) {
        commercialFilters.push(fieldFilter);
      }
    }

    if (filters.plannedStartFrom || filters.plannedStartTo) {
      commercialFilters.push(this.buildJsonDateRangeFilter({
        paths: [['plannedStartAt'], ['schedule', 'plannedStartAt']],
        from: filters.plannedStartFrom,
        to: filters.plannedStartTo
      }));
    }

    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { status: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
        {
          tags: {
            some: {
              tag: {
                name: { contains: search, mode: 'insensitive' }
              }
            }
          }
        }
      ];
    }

    if (commercialFilters.length > 0) {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...commercialFilters];
    }

    return where;
  }

  private buildCommercialFieldFilter(slug: string, value: string): Prisma.ItemWhereInput {
    return {
      OR: [
        {
          fields: {
            path: [slug],
            equals: value
          }
        },
        {
          customFieldValues: {
            some: {
              field: { slug },
              value: { equals: value }
            }
          }
        }
      ]
    };
  }

  private buildCommercialConvertedFilter(converted: boolean): Prisma.ItemWhereInput {
    const hasCustomerField: Prisma.ItemWhereInput = {
      customFieldValues: {
        some: {
          field: { slug: 'customerId' }
        }
      }
    };

    return converted ? hasCustomerField : { NOT: hasCustomerField };
  }

  private buildCustomFieldListFilter(filter: NonNullable<ListWorkItemsFilters['customFieldFilters']>[number]): Prisma.ItemWhereInput | null {
    const fieldKey = filter.fieldId ?? this.normalizeCustomFieldFilterKey(filter.fieldKey);
    if (!fieldKey) {
      return null;
    }

    const value = filter.value as Prisma.InputJsonValue;

    return {
      OR: [
        {
          fields: {
            path: [fieldKey],
            equals: value
          }
        },
        {
          customFieldValues: {
            some: {
              field: {
                OR: [
                  { id: fieldKey },
                  { slug: fieldKey },
                  { variableKey: fieldKey }
                ]
              },
              value: {
                equals: value
              }
            }
          }
        }
      ]
    };
  }

  private normalizeCustomFieldFilterKey(value: string | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed || !/^[A-Za-z0-9_.:-]{1,120}$/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  private buildJsonDateRangeFilter(input: {
    paths: string[][];
    from?: Date;
    to?: Date;
  }): Prisma.ItemWhereInput {
    return {
      OR: input.paths.map((path) => ({
        fields: {
          path,
          ...(input.from ? { gte: input.from.toISOString() } : {}),
          ...(input.to ? { lte: input.to.toISOString() } : {})
        }
      }))
    };
  }

  private buildWorkItemListOrderBy(filters: ListWorkItemsFilters): Prisma.ItemOrderByWithRelationInput[] {
    const direction = filters.sortDirection ?? 'asc';

    switch (filters.sortBy) {
      case 'title':
        return [{ title: direction }, { id: 'asc' }];
      case 'type':
        return [{ type: direction }, { id: 'asc' }];
      case 'status':
        return [{ status: direction }, { id: 'asc' }];
      case 'assignee':
        return [{ assigneeId: direction }, { id: 'asc' }];
      case 'dueDate':
        return [{ dueDate: direction }, { id: 'asc' }];
      case 'createdAt':
        return [{ createdAt: direction }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'position':
        return [{ position: direction }, { updatedAt: 'desc' }, { id: 'asc' }];
      case 'plannedStartAt':
        return [{ updatedAt: 'desc' }, { id: 'asc' }];
      default:
        break;
    }

    switch (filters.sort) {
      case 'updated_asc':
        return [{ updatedAt: 'asc' }, { id: 'asc' }];
      case 'created_desc':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      case 'created_asc':
        return [{ createdAt: 'asc' }, { id: 'asc' }];
      case 'updated_desc':
        return [{ updatedAt: 'desc' }, { id: 'asc' }];
      case 'position_asc':
      default:
        return [{ position: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }];
    }
  }

  private buildClientWorkItemWhere(scope: CustomerAccessScope): Prisma.ItemWhereInput {
    if (!scope.isClient) {
      return {};
    }

    const customerIds = requireClientCustomerScope(scope);
    return {
      OR: customerIds.flatMap((customerId) => [
        {
          fields: {
            path: ['customerId'],
            equals: customerId
          }
        },
        {
          metadata: {
            path: ['customerId'],
            equals: customerId
          }
        },
        {
          customFieldValues: {
            some: {
              field: {
                slug: 'customerId'
              },
              value: {
                equals: customerId as Prisma.InputJsonValue
              }
            }
          }
        }
      ])
    };
  }

  private buildClientDocumentWhere(customerIds: string[]): Prisma.WorkspaceDocumentWhereInput {
    return {
      kind: {
        in: ['proposal', 'contract']
      },
      OR: customerIds.flatMap((customerId) => [
        {
          linkedEntityType: 'customer',
          linkedEntityId: customerId
        },
        {
          metadata: {
            path: ['customerId'],
            equals: customerId
          }
        },
        {
          metadata: {
            path: ['customer', 'id'],
            equals: customerId
          }
        }
      ])
    };
  }

  private async ensureWorkItemVisibleToUser(
    workspaceId: string,
    itemId: string,
    customerScope: CustomerAccessScope
  ): Promise<void> {
    const item = await this.prisma.item.findFirst({
      where: {
        id: itemId,
        workspaceId,
        ...this.buildClientWorkItemWhere(customerScope)
      },
      select: { id: true }
    });

    if (!item) {
      throw new AppError('Work item not found', 404);
    }
  }

  private async ensureClientColumnAllowed(
    workspaceId: string,
    columnId: string,
    access: { role: MembershipRole; customerIds: string[] }
  ): Promise<void> {
    if (access.role !== MembershipRole.CLIENT) {
      return;
    }

    if (access.customerIds.length === 0) {
      throw new AppError('Customer access is not linked to this workspace', 403);
    }

    const column = await this.prisma.boardColumn.findFirst({
      where: {
        id: columnId,
        workspaceId,
        isActive: true
      },
      select: { id: true }
    });

    if (!column) {
      throw new AppError('Board column not available for customers', 403);
    }
  }

  private buildClientBoardPerspective(allPerspectives: BoardPerspectiveSnapshot[]): BoardPerspectiveSnapshot | null {
    return allPerspectives.find((perspective) => perspective.analyticsRole === 'client' || perspective.id === 'cliente') ?? null;
  }

  private itemInclude() {
    return {
      typeDefinition: true,
      workflowState: true,
      boardColumn: true,
      documentLinks: {
        include: {
          document: {
            select: {
              id: true,
              title: true,
              kind: true,
              metadata: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: [{ createdAt: 'desc' as const }]
      },
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

  private async ensureDocumentBelongsToWorkspace(workspaceId: string, documentId: string) {
    const document = await this.prisma.workspaceDocument.findFirst({
      where: { id: documentId, workspaceId },
      select: { id: true }
    });

    if (!document) {
      throw new AppError('Workspace document not found', 404);
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

  private async loadConfiguredTypeTransformations(workspaceId: string): Promise<TransformationConfig[]> {
    const prisma = this.prisma as unknown as { workItemTypeTransformation: WorkItemTypeTransformationDelegate };
    const rows = await prisma.workItemTypeTransformation.findMany({
      where: { workspaceId, enabled: true },
      include: {
        fromType: { select: { id: true, slug: true, name: true, color: true } },
        toType: { select: { id: true, slug: true, name: true, color: true } }
      },
      orderBy: [{ createdAt: 'asc' }]
    });

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      fromTypeId: row.fromTypeId,
      toTypeId: row.toTypeId,
      name: row.name,
      description: row.description ?? null,
      enabled: Boolean(row.enabled),
      mode: row.mode,
      fieldCompatibilityMode: row.fieldCompatibilityMode,
      defaultValuesForNewFields: row.defaultValuesForNewFields,
      stateMapping: row.stateMapping,
      permission: row.permission ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      fromType: row.fromType,
      toType: row.toType
    }));
  }

  private async buildDefaultCommercialTypeTransformations(workspaceId: string): Promise<TransformationConfig[]> {
    const types = await this.prisma.workItemType.findMany({
      where: {
        workspaceId,
        isActive: true,
        slug: { in: ['signal', 'prospect', 'lead', 'commercial'] }
      },
      orderBy: { position: 'asc' },
      select: { id: true, slug: true, name: true, color: true }
    });
    const source = types.find((type) => ['signal', 'prospect'].includes(type.slug));
    const target = types.find((type) => ['lead', 'commercial'].includes(type.slug));

    if (!source || !target || source.id === target.id) {
      return [];
    }

    return [
      {
        id: `default:${source.id}:${target.id}`,
        workspaceId,
        fromTypeId: source.id,
        toTypeId: target.id,
        name: `Transformar ${source.name} em ${target.name}`,
        description: 'Transformacao padrao de Signal/Prospect para Lead comercial mantendo o mesmo WorkItem.',
        enabled: true,
        mode: 'same_work_item_type_change',
        fieldCompatibilityMode: 'strict_superset',
        defaultValuesForNewFields: {},
        stateMapping: {},
        permission: 'lead.transform',
        fromType: source,
        toType: target
      }
    ];
  }

  private async describeTypeTransformation(workspaceId: string, transformation: TransformationConfig) {
    const compatibility = await this.validateTypeFieldCompatibility(workspaceId, transformation.fromTypeId, transformation.toTypeId);
    return {
      ...transformation,
      fromType: transformation.fromType ?? compatibility.fromType,
      toType: transformation.toType ?? compatibility.toType,
      valid: compatibility.missingFields.length === 0,
      missingFields: compatibility.missingFields,
      preservedFields: compatibility.preservedFields,
      newRequiredFields: compatibility.newRequiredFields
    };
  }

  private async buildTypeTransformationValidation(
    workspaceId: string,
    itemId: string,
    payload: WorkItemTypeTransformationPayload
  ): Promise<TransformationValidationResult> {
    const item = await this.prisma.item.findFirst({
      where: { id: itemId, workspaceId },
      select: {
        id: true,
        typeId: true,
        type: true,
        customFieldValues: {
          include: {
            field: {
              select: {
                id: true,
                slug: true,
                name: true,
                required: true,
                defaultValue: true
              }
            }
          }
        }
      }
    });

    if (!item || !item.typeId) {
      throw new AppError('Work item not found or has no configured type', 404);
    }

    const transformation = await this.resolveTypeTransformationConfig(workspaceId, item.typeId, payload);
    const compatibility = await this.validateTypeFieldCompatibility(workspaceId, transformation.fromTypeId, transformation.toTypeId);
    const currentValueFieldIds = new Set(item.customFieldValues.map((entry) => entry.fieldId));
    const toFieldById = new Map(compatibility.toFields.map((field) => [field.id, field]));
    const normalizedPayloadValues = this.normalizeValuesForFields(payload.customFieldValues, compatibility.toFields);
    const defaultValuesForNewFields = {
      ...this.normalizeValuesForFields(
        isRecord(transformation.defaultValuesForNewFields) ? transformation.defaultValuesForNewFields : {},
        compatibility.toFields
      ),
      ...this.normalizeValuesForFields(payload.defaultValuesForNewFields, compatibility.toFields)
    };
    const valuesForRequiredCheck = {
      ...defaultValuesForNewFields,
      ...normalizedPayloadValues
    };

    const sourceFieldsFromValues = item.customFieldValues
      .map((entry) => ({
        id: entry.field.id,
        slug: entry.field.slug,
        name: entry.field.name,
        required: entry.field.required,
        defaultValue: entry.field.defaultValue
      }))
      .filter((field) => !compatibility.fromFields.some((entry) => entry.id === field.id));
    const sourceFields = [...compatibility.fromFields, ...sourceFieldsFromValues];
    const missingFields = sourceFields.filter((field) => !toFieldById.has(field.id));
    const preservedFields = sourceFields.filter((field) => toFieldById.has(field.id));
    const newRequiredFields = compatibility.toFields.filter((field) => {
      if (!field.required || currentValueFieldIds.has(field.id)) {
        return false;
      }
      return this.isBlankCustomFieldValue(valuesForRequiredCheck[field.id]);
    });

    return {
      valid: missingFields.length === 0,
      reason:
        missingFields.length > 0
          ? 'O tipo destino nao contem todos os campos necessarios para preservar os dados.'
          : null,
      transformation,
      fromType: compatibility.fromType,
      toType: compatibility.toType,
      preservedFields,
      missingFields,
      newRequiredFields,
      defaultValuesForNewFields
    };
  }

  private async resolveTypeTransformationConfig(
    workspaceId: string,
    currentTypeId: string,
    payload: WorkItemTypeTransformationPayload
  ): Promise<TransformationConfig> {
    if (payload.transformationId) {
      const configured = [
        ...(await this.loadConfiguredTypeTransformations(workspaceId)),
        ...(await this.buildDefaultCommercialTypeTransformations(workspaceId))
      ];
      const match = configured.find((entry) => entry.id === payload.transformationId);
      if (!match) {
        throw new AppError('Work item type transformation not found', 404);
      }
      if (match.fromTypeId !== currentTypeId) {
        throw new AppError('Transformation cannot be applied to this work item type', 422);
      }
      return match;
    }

    if (payload.toTypeId || payload.toTypeSlug) {
      const toType = await this.resolveWorkItemType(workspaceId, payload.toTypeId, payload.toTypeSlug);
      const fromType = await this.resolveWorkItemType(workspaceId, currentTypeId, null);
      return {
        id: `adhoc:${fromType.id}:${toType.id}`,
        workspaceId,
        fromTypeId: fromType.id,
        toTypeId: toType.id,
        name: `Transformar ${fromType.name} em ${toType.name}`,
        description: null,
        enabled: true,
        mode: 'same_work_item_type_change',
        fieldCompatibilityMode: 'strict_superset',
        defaultValuesForNewFields: {},
        stateMapping: {},
        permission: 'lead.transform',
        fromType,
        toType
      };
    }

    const fallback = (await this.buildDefaultCommercialTypeTransformations(workspaceId)).find(
      (entry) => entry.fromTypeId === currentTypeId
    );
    if (!fallback) {
      throw new AppError('No valid target type transformation was found for this work item', 422);
    }
    return fallback;
  }

  private async validateTypeFieldCompatibility(workspaceId: string, fromTypeId: string, toTypeId: string) {
    const [fromType, toType, fromFields, toFields] = await Promise.all([
      this.resolveWorkItemType(workspaceId, fromTypeId, null),
      this.resolveWorkItemType(workspaceId, toTypeId, null),
      this.loadFieldsForType(workspaceId, fromTypeId),
      this.loadFieldsForType(workspaceId, toTypeId)
    ]);
    const toFieldIds = new Set(toFields.map((field) => field.id));
    const missingFields = fromFields.filter((field) => !toFieldIds.has(field.id));
    const preservedFields = fromFields.filter((field) => toFieldIds.has(field.id));
    const fromFieldIds = new Set(fromFields.map((field) => field.id));
    const newRequiredFields = toFields.filter((field) => field.required && !fromFieldIds.has(field.id));

    return {
      fromType: { id: fromType.id, slug: fromType.slug, name: fromType.name, color: fromType.color },
      toType: { id: toType.id, slug: toType.slug, name: toType.name, color: toType.color },
      fromFields,
      toFields,
      missingFields,
      preservedFields,
      newRequiredFields
    };
  }

  private async loadFieldsForType(workspaceId: string, typeId: string): Promise<TransformationFieldSummary[]> {
    const fields = await this.prisma.customFieldDefinition.findMany({
      where: { workspaceId, isActive: true },
      include: {
        scopes: { select: { typeId: true } },
        bindings: {
          where: { typeId },
          select: { isRequiredOverride: true, isVisible: true, position: true }
        }
      },
      orderBy: { position: 'asc' }
    });

    return fields
      .filter((field) => {
        if (field.isSystem) {
          return false;
        }
        const scopedToType = field.scopes.some((scope) => scope.typeId === typeId);
        return field.scopes.length === 0 || scopedToType || field.bindings.length > 0;
      })
      .sort((left, right) => {
        const leftBinding = left.bindings[0]?.position ?? left.position;
        const rightBinding = right.bindings[0]?.position ?? right.position;
        return leftBinding - rightBinding;
      })
      .map((field) => {
        const override = field.bindings.find((binding) => binding.isRequiredOverride !== null)?.isRequiredOverride;
        return {
          id: field.id,
          slug: field.slug,
          name: field.name,
          required: override ?? field.required,
          defaultValue: field.defaultValue
        };
      });
  }

  private normalizeValuesForFields(
    values: Record<string, unknown> | undefined,
    fields: TransformationFieldSummary[]
  ): Record<string, unknown> {
    if (!values) {
      return {};
    }

    return fields.reduce<Record<string, unknown>>((acc, field) => {
      if (Object.prototype.hasOwnProperty.call(values, field.id)) {
        acc[field.id] = values[field.id];
      } else if (Object.prototype.hasOwnProperty.call(values, field.slug)) {
        acc[field.id] = values[field.slug];
      }
      return acc;
    }, {});
  }

  private isBlankCustomFieldValue(value: unknown): boolean {
    if (value === undefined || value === null) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length === 0;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return false;
  }

  private async resolveTransformationTargetState(
    db: PrismaClient | Prisma.TransactionClient,
    workspaceId: string,
    current: { stateId: string | null; status: string },
    transformation: TransformationConfig,
    payload: WorkItemTypeTransformationPayload
  ) {
    const explicitStateId = payload.stateId;
    const explicitStateSlug = payload.stateSlug;
    const mapping = isRecord(transformation.stateMapping) ? transformation.stateMapping : {};
    const mappedValue =
      (current.stateId ? mapping[current.stateId] : undefined) ??
      mapping[current.status];
    const target = explicitStateId ?? explicitStateSlug ?? (typeof mappedValue === 'string' ? mappedValue : undefined);

    if (!target) {
      return null;
    }

    const state = await db.workflowState.findFirst({
      where: {
        workspaceId,
        OR: [{ id: target }, { slug: toSlug(target) }]
      }
    });

    if (!state) {
      throw new AppError('Target workflow state for transformation was not found', 404);
    }

    return state;
  }

  private mergeTransformationMetadata(
    currentMetadata: unknown,
    entry: Record<string, unknown>
  ): Record<string, unknown> {
    const current = isRecord(currentMetadata) ? { ...currentMetadata } : {};
    const history = Array.isArray(current.typeTransformations)
      ? current.typeTransformations.filter((value): value is Record<string, unknown> => isRecord(value))
      : [];

    return {
      ...current,
      lastTypeTransformation: {
        ...entry,
        transformedAt: new Date().toISOString()
      },
      typeTransformations: [
        ...history,
        {
          ...entry,
          transformedAt: new Date().toISOString()
        }
      ].slice(-20)
    };
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

  private serializeLinkedDocuments(
    links: Array<{
      document: {
        id: string;
        title: string;
        kind?: string | null;
        metadata?: Prisma.JsonValue | null;
        createdAt?: Date;
        updatedAt: Date;
      };
      createdAt: Date;
    }>
  ) {
    return links.map((entry) => ({
      id: entry.document.id,
      title: entry.document.title,
      kind: entry.document.kind ?? undefined,
      status: isRecord(entry.document.metadata) && typeof entry.document.metadata.status === 'string'
        ? entry.document.metadata.status
        : undefined,
      createdAt: entry.document.createdAt,
      updatedAt: entry.document.updatedAt,
      linkedAt: entry.createdAt
    }));
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
    const plannedStartAt = typeof legacyFields.plannedStartAt === 'string' ? legacyFields.plannedStartAt : null;
    const plannedEndAt = typeof legacyFields.plannedEndAt === 'string' ? legacyFields.plannedEndAt : null;

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
      plannedStartAt,
      plannedEndAt,
      position: item.position,
      checklist: parseChecklist(item.checklist),
      tags: item.tags.map((entry) => ({
        id: entry.tag.id,
        name: entry.tag.name,
        slug: entry.tag.slug,
        color: entry.tag.color
      })),
      linkedDocuments: this.serializeLinkedDocuments(item.documentLinks),
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
      typeof workItem.plannedStartAt === 'string' ? workItem.plannedStartAt : null;
    const plannedEndAt =
      typeof workItem.plannedEndAt === 'string' ? workItem.plannedEndAt : null;

    return {
      id: workItem.id,
      title: workItem.title,
      text: workItem.description ?? '',
      createdById: workItem.createdBy,
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
      linkedDocuments: workItem.linkedDocuments,
      customFieldValuesById: workItem.customFieldValuesById,
      customFields: workItem.customFields
    };
  }

  private async publishItemCreatedEvent(input: {
    workspaceId: string;
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>;
    requestedBy: string;
    db?: Prisma.TransactionClient;
  }): Promise<void> {
    const payload = {
      ...this.toAutomationEventPayload(input.workspaceId, input.item),
      requestedBy: input.requestedBy
    };

    await this.publishEvent(
      {
      id: uuid(),
      name: DomainEventNames.ItemCreated,
      aggregateType: 'item',
      aggregateId: input.item.id,
      occurredAt: new Date(),
      payload
      },
      input.db
    );

    if (await this.isLeadOperationalItem({ workspaceId: input.workspaceId, typeSlug: input.item.type.slug })) {
      await this.publishEvent(
        {
          id: uuid(),
          name: DomainEventNames.CommercialWorkItemCreated,
          aggregateType: 'item',
          aggregateId: input.item.id,
          occurredAt: new Date(),
          payload
        },
        input.db
      );
    }
  }

  private async publishItemUpdatedEvent(input: {
    workspaceId: string;
    item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>;
    patch: Record<string, unknown>;
    requestedBy: string;
    db?: Prisma.TransactionClient;
  }): Promise<void> {
    const payload = {
      ...this.toAutomationEventPayload(input.workspaceId, input.item),
      patch: input.patch,
      requestedBy: input.requestedBy
    };

    await this.publishEvent(
      {
      id: uuid(),
      name: DomainEventNames.ItemUpdated,
      aggregateType: 'item',
      aggregateId: input.item.id,
      occurredAt: new Date(),
      payload
      },
      input.db
    );

    if (
      input.patch.fields !== undefined ||
      input.patch.customFieldValues !== undefined ||
      input.patch.metadata !== undefined
    ) {
      await this.publishEvent(
        {
          id: uuid(),
          name: DomainEventNames.ItemFieldUpdated,
          aggregateType: 'item',
          aggregateId: input.item.id,
          occurredAt: new Date(),
          payload
        },
        input.db
      );
    }

    const customerId = this.resolveCustomerIdFromCommercialItem(input.item);
    if (
      customerId &&
      this.patchTouchesCustomerLink(input.patch) &&
      await this.isLeadOperationalItem({ workspaceId: input.workspaceId, typeSlug: input.item.type.slug })
    ) {
      await this.publishEvent(
        {
          id: uuid(),
          name: DomainEventNames.CommercialWorkItemLinkedToCustomer,
          aggregateType: 'item',
          aggregateId: input.item.id,
          occurredAt: new Date(),
          payload: {
            ...payload,
            customerId
          }
        },
        input.db
      );
    }
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

  private resolveCustomerIdFromCommercialItem(item: ReturnType<WorkspaceWorkItemsService['serializeWorkItem']>) {
    const value = item.customFields.customerId;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private patchTouchesCustomerLink(patch: Record<string, unknown>) {
    if (isRecord(patch.fields) && typeof patch.fields.customerId === 'string') {
      return true;
    }

    if (isRecord(patch.customFieldValues) && typeof patch.customFieldValues.customerId === 'string') {
      return true;
    }

    return false;
  }

  private async isLeadOperationalItem(input: { workspaceId: string; typeSlug: string }): Promise<boolean> {
    const config = await this.configService.loadWorkspaceConfig(input.workspaceId);
    const statuses = config.workflowStates
      .filter((state) => state.isActive)
      .sort((left, right) => left.order - right.order)
      .map((state) => ({
        id: state.slug,
        label: state.name,
        dot: state.color,
        category: state.category,
        isTerminal: state.isTerminal
      }));
    const templateKey = this.readTemplateKey(config.preferences.settings);
    const template = getWorkspaceTemplateByKey(templateKey);
    const statusIdsByColumnId = this.buildStatusIdsByColumnId(config.boardColumns);
    const perspectives = this.resolveBoardPerspectivesFromSettings(
      config.preferences.settings,
      statuses,
      template?.schema.perspectives ?? [],
      config.boardColumns
    ).map((perspective) => this.enrichPerspectiveWithStatusIds(perspective, statuses, statusIdsByColumnId));
    const metadata = this.buildBoardOperationalMetadata({
      templateKey,
      templateRules: template?.rules,
      perspectives,
      statuses,
      itemTypes: config.itemTypes
    });

    return metadata.leads?.itemTypeIds.includes(input.typeSlug) ?? false;
  }

  private readTemplateKey(settings: unknown): string | undefined {
    if (!isRecord(settings) || typeof settings.templateKey !== 'string') {
      return undefined;
    }

    const templateKey = settings.templateKey.trim();
    return templateKey.length > 0 ? templateKey : undefined;
  }

  private buildStatusIdsByColumnId(boardColumns: BoardColumnSnapshot[]): Map<string, string[]> {
    return new Map(
      boardColumns.map((column) => [
        column.id,
        Array.from(
          new Set(
            (column.states ?? [])
              .map((state) => state.slug)
              .filter((slug): slug is string => typeof slug === 'string' && slug.trim().length > 0)
          )
        )
      ])
    );
  }

  private enrichPerspectiveWithStatusIds(
    perspective: BoardPerspectiveSnapshot,
    defaultStatuses: BoardStatusSnapshot[],
    statusIdsByColumnId: Map<string, string[]>
  ): BoardPerspectiveSnapshot {
    const statusIdsFromColumns = (perspective.visibleBoardColumnIds ?? [])
      .flatMap((columnId) => statusIdsByColumnId.get(columnId) ?? [])
      .filter((statusId) => defaultStatuses.some((status) => status.id === statusId));
    const statusIdsFromStatusList = perspective.statuses
      .map((status) => status.id)
      .filter((statusId) => defaultStatuses.some((status) => status.id === statusId));

    return {
      ...perspective,
      visibleStatusIds: Array.from(new Set(statusIdsFromColumns.length > 0 ? statusIdsFromColumns : statusIdsFromStatusList))
    };
  }

  private resolveColumnIdsFromSlugs(
    slugs: string[] | undefined,
    columnIdBySlug: Map<string, string>
  ): string[] | undefined {
    if (!slugs) {
      return undefined;
    }

    return slugs
      .map((slug) => columnIdBySlug.get(slug))
      .filter((value): value is string => Boolean(value));
  }

  private isBoardAnalyticsRole(value: unknown): value is BoardPerspectiveSnapshot['analyticsRole'] {
    return value === 'prospecting' || value === 'funnel' || value === 'terminal' || value === 'client';
  }

  private mapTemplatePerspectives(
    templatePerspectives: WorkspaceTemplatePerspective[],
    defaultStatuses: BoardStatusSnapshot[],
    boardColumns: BoardColumnSnapshot[]
  ): BoardPerspectiveSnapshot[] {
    const columnIdBySlug = new Map(boardColumns.map((column) => [column.slug, column.id]));

    return templatePerspectives.map((view) => ({
      id: view.key,
      label: view.name,
      caption: view.caption,
      statuses: view.statuses.length > 0 ? view.statuses : defaultStatuses,
      statusSource: view.statusSource,
      compactCards: view.compactCards,
      allowedTaskTypes: view.allowedTaskTypes,
      visibleBoardColumnIds: this.resolveColumnIdsFromSlugs(
        view.visibleBoardColumnSlugs ?? boardColumns.filter((column) => column.isActive).map((column) => column.slug),
        columnIdBySlug
      ),
      createTaskColumnIds: this.resolveColumnIdsFromSlugs(view.createTaskColumnSlugs ?? [], columnIdBySlug),
      analyticsRole: view.analyticsRole
    }));
  }

  private deriveBoardPerspectiveFromColumns(
    defaultStatuses: BoardStatusSnapshot[],
    boardColumns: BoardColumnSnapshot[]
  ): BoardPerspectiveSnapshot[] {
    const activeColumnIds = boardColumns
      .filter((column) => column.isActive)
      .map((column) => column.id);

    return [
      {
        id: 'board',
        label: 'Board',
        caption: 'Fluxo operacional',
        statuses: defaultStatuses,
        statusSource: { kind: 'workflow_state' as const },
        visibleBoardColumnIds: activeColumnIds,
        createTaskColumnIds: activeColumnIds.slice(0, 1)
      }
    ];
  }

  private resolveBoardPerspectivesFromSettings(
    settings: unknown,
    defaultStatuses: BoardStatusSnapshot[],
    templatePerspectives: WorkspaceTemplatePerspective[],
    boardColumns: BoardColumnSnapshot[]
  ): BoardPerspectiveSnapshot[] {
    const templateViews = this.mapTemplatePerspectives(templatePerspectives, defaultStatuses, boardColumns);
    const templateViewByKey = new Map(templateViews.map((view) => [view.id, view]));
    const sourceSettings = isRecord(settings) ? settings : {};
    const rawPerspectives = Array.isArray(sourceSettings.perspectives) ? sourceSettings.perspectives : sourceSettings.boardViews;

    if (!Array.isArray(rawPerspectives) || rawPerspectives.length === 0) {
      return templateViews.length > 0
        ? templateViews
        : this.deriveBoardPerspectiveFromColumns(defaultStatuses, boardColumns);
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

        const templateView = templateViewByKey.get(id);
        const caption = typeof rawView.caption === 'string' ? rawView.caption : templateView?.caption;
        const compactCards = typeof rawView.compactCards === 'boolean' ? rawView.compactCards : templateView?.compactCards;
        const allowedTaskTypes = Array.isArray(rawView.allowedTaskTypes)
          ? rawView.allowedTaskTypes.filter((value): value is string => typeof value === 'string')
          : templateView?.allowedTaskTypes;
        const visibleBoardColumnIds = Array.isArray(rawView.visibleBoardColumnIds)
          ? rawView.visibleBoardColumnIds.filter((value): value is string => typeof value === 'string')
          : templateView?.visibleBoardColumnIds;
        const createTaskColumnIds = Array.isArray(rawView.createTaskColumnIds)
          ? rawView.createTaskColumnIds.filter((value): value is string => typeof value === 'string')
          : templateView?.createTaskColumnIds;
        const analyticsRole = this.isBoardAnalyticsRole(rawView.analyticsRole)
          ? rawView.analyticsRole
          : templateView?.analyticsRole;

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
            : templateView?.statusSource.kind ?? 'workflow_state';

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
            : templateView?.statusSource ?? { kind: 'workflow_state' as const };

        return {
          id,
          label,
          caption,
          statuses: statuses.length > 0 ? statuses : templateView?.statuses ?? defaultStatuses,
          statusSource,
          compactCards,
          allowedTaskTypes,
          visibleBoardColumnIds,
          createTaskColumnIds,
          analyticsRole,
          position: typeof rawView.position === 'number' ? rawView.position : index
        };
      })
      .filter((view): view is NonNullable<typeof view> => view !== null)
      .sort((left, right) => left.position - right.position)
      .map(({ position: _position, ...view }) => view);

    return parsed.length > 0
      ? parsed
      : templateViews.length > 0
      ? templateViews
      : this.deriveBoardPerspectiveFromColumns(defaultStatuses, boardColumns);
  }

  private readStringRule(rules: Record<string, unknown> | undefined, key: string): string | null {
    const value = rules?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private buildBoardOperationalMetadata(input: {
    templateKey?: string;
    templateRules?: Record<string, unknown>;
    perspectives: BoardPerspectiveSnapshot[];
    statuses: BoardStatusSnapshot[];
    itemTypes: Array<{ slug: string; isActive: boolean }>;
  }) {
    if (input.templateKey !== 'commercial_crm') {
      return { schemaVersion: 1 as const };
    }

    const statusById = new Map(input.statuses.map((status) => [status.id, status]));
    const leadState = this.readStringRule(input.templateRules, 'leadState');
    const doneState = this.readStringRule(input.templateRules, 'doneState');
    const lostState = this.readStringRule(input.templateRules, 'lostState');
    const funnelPerspectives = input.perspectives.filter((perspective) => perspective.analyticsRole === 'funnel');
    const funnel = funnelPerspectives
      .map((perspective) => {
        const statusIds = (perspective.visibleStatusIds ?? perspective.statuses.map((status) => status.id))
          .filter((statusId) => statusById.has(statusId));
        const firstStatus = statusIds[0] ? statusById.get(statusIds[0]) : null;
        return {
          key: perspective.id,
          label: perspective.label,
          statusIds,
          color: firstStatus?.dot ?? '#64748b'
        };
      })
      .filter((stage) => stage.statusIds.length > 0);
    const itemTypeIds = Array.from(
      new Set(
        funnelPerspectives
          .flatMap((perspective) => perspective.allowedTaskTypes ?? [])
          .filter((typeId) => input.itemTypes.some((itemType) => itemType.slug === typeId && itemType.isActive))
      )
    );
    const defaultItemTypeId = itemTypeIds[0] ?? input.itemTypes.find((itemType) => itemType.isActive)?.slug ?? null;
    const initialStatusId =
      leadState && statusById.has(leadState)
        ? leadState
        : funnel[0]?.statusIds[0] ?? null;

    if (!defaultItemTypeId || !initialStatusId || funnel.length === 0) {
      return { schemaVersion: 1 as const };
    }

    const wonStatusIds = doneState && statusById.has(doneState) ? [doneState] : [];
    const lostStatusIds = lostState && statusById.has(lostState) ? [lostState] : [];
    const terminalStatusIds = Array.from(
      new Set([
        ...input.statuses.filter((status) => status.isTerminal).map((status) => status.id),
        ...wonStatusIds,
        ...lostStatusIds
      ])
    );
    const terminalStatusSet = new Set(terminalStatusIds);
    const activeStatusIds = Array.from(
      new Set(
        funnel
          .flatMap((stage) => stage.statusIds)
          .filter((statusId) => !terminalStatusSet.has(statusId))
      )
    );
    const proposalRequiredStatusIds = Array.from(
      new Set(
        funnel
          .slice(1)
          .flatMap((stage) => stage.statusIds)
          .filter((statusId) => !terminalStatusSet.has(statusId))
      )
    );
    const prospectingPerspectives = input.perspectives.filter((perspective) => perspective.analyticsRole === 'prospecting');
    const prospectingStatusIds = Array.from(
      new Set(prospectingPerspectives.flatMap((perspective) => perspective.visibleStatusIds ?? perspective.statuses.map((status) => status.id)))
    ).filter((statusId) => statusById.has(statusId));
    const prospectingItemTypeIds = Array.from(
      new Set(prospectingPerspectives.flatMap((perspective) => perspective.allowedTaskTypes ?? []))
    ).filter((typeId) => input.itemTypes.some((itemType) => itemType.slug === typeId && itemType.isActive));

    return {
      schemaVersion: 1 as const,
      leads: {
        schemaVersion: 1 as const,
        itemTypeIds,
        defaultItemTypeId,
        initialStatusId,
        funnel,
        activeStatusIds,
        wonStatusIds,
        lostStatusIds,
        terminalStatusIds,
        proposalRequiredStatusIds,
        prospecting: {
          itemTypeIds: prospectingItemTypeIds,
          statusIds: prospectingStatusIds,
          initialStatusId: prospectingStatusIds[0] ?? null
        }
      }
    };
  }
}

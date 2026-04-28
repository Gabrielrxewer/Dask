import { MembershipRole, Prisma, type CustomFieldType, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { resolveWorkspaceAccessPolicy, type WorkspaceModuleKey } from '@/modules/identity/domain/access-policy';
import { ensureWorkspaceDefaultConfiguration } from '@/modules/workspaces/application/default-workspace-seed';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplateKey
} from '@/modules/workspaces/application/workspace-template-catalog';
import {
  buildLegacyFieldLayoutMaps,
  serializeFieldBinding,
  serializeFieldDefinition
} from '@/modules/workspace-platform/application/field-platform';
import {
  isSystemOnlyFieldType,
  mapCustomFieldTypeToInput,
  mapInputTypeToPrisma,
  normalizeFieldSection,
  sanitizeHexColor,
  toJsonValue,
  toSlug,
  type CustomFieldInputType,
  type JsonRecord
} from '@/modules/workspace-platform/application/shared';

export type WorkspaceAccess = {
  workspace: {
    id: string;
    name: string;
    key: string;
    kind: 'PERSONAL' | 'CORPORATE';
    organizationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  role: MembershipRole;
  ownCardsOnly: boolean;
  allowedModules: WorkspaceModuleKey[];
  moduleEntitlements: Partial<Record<WorkspaceModuleKey, boolean>>;
  allowedBoardViewKeys: string[] | null;
};

function normalizeNullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeVariableKey(value: string | null | undefined): string | null | undefined {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return normalized;
  }

  if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(normalized)) {
    throw new AppError('Field variable key must start with a letter and contain only letters, numbers or underscores', 422);
  }

  return normalized;
}

export class WorkspaceConfigService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getWorkspaceConfig(input: { workspaceId: string; userId: string }) {
    const access = await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    await ensureWorkspaceDefaultConfiguration(this.prisma, {
      workspaceId: input.workspaceId,
      ownerUserId: input.userId
    });

    const config = await this.loadWorkspaceConfig(input.workspaceId);

    return {
      workspace: access.workspace,
      ...config
    };
  }

  public async listItemTypes(input: { workspaceId: string; userId: string }) {
    await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    const itemTypes = await this.prisma.workItemType.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return itemTypes.map((itemType) => this.serializeItemType(itemType));
  }

  public async createItemType(input: {
    workspaceId: string;
    userId: string;
    payload: {
      name: string;
      slug?: string;
      description?: string;
      color?: string;
      icon?: string;
      order?: number;
      isActive?: boolean;
      usageRules?: JsonRecord;
      acceptsParent?: boolean;
      acceptsChecklist?: boolean;
      acceptsDueDate?: boolean;
      acceptsAssignee?: boolean;
      acceptsTags?: boolean;
      acceptsCustomFields?: boolean;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const itemType = await this.prisma.workItemType.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.payload.name,
        slug: toSlug(input.payload.slug ?? input.payload.name),
        description: input.payload.description,
        color: sanitizeHexColor(input.payload.color, '#0369a1'),
        icon: input.payload.icon,
        position:
          input.payload.order ?? (await this.prisma.workItemType.count({ where: { workspaceId: input.workspaceId } })),
        isActive: input.payload.isActive ?? true,
        usageRules: input.payload.usageRules ? toJsonValue(input.payload.usageRules) : undefined,
        acceptsParent: input.payload.acceptsParent ?? true,
        acceptsChecklist: input.payload.acceptsChecklist ?? true,
        acceptsDueDate: input.payload.acceptsDueDate ?? true,
        acceptsAssignee: input.payload.acceptsAssignee ?? true,
        acceptsTags: input.payload.acceptsTags ?? true,
        acceptsCustomFields: input.payload.acceptsCustomFields ?? true
      }
    });

    return this.serializeItemType(itemType);
  }

  public async updateItemType(input: {
    workspaceId: string;
    typeId: string;
    userId: string;
    payload: {
      name?: string;
      slug?: string;
      description?: string | null;
      color?: string;
      icon?: string | null;
      order?: number;
      isActive?: boolean;
      usageRules?: JsonRecord;
      acceptsParent?: boolean;
      acceptsChecklist?: boolean;
      acceptsDueDate?: boolean;
      acceptsAssignee?: boolean;
      acceptsTags?: boolean;
      acceptsCustomFields?: boolean;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.workItemType.findFirst({ where: { id: input.typeId, workspaceId: input.workspaceId } });
    if (!current) {
      throw new AppError('Work item type not found', 404);
    }

    const itemType = await this.prisma.workItemType.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        slug: input.payload.slug ? toSlug(input.payload.slug) : undefined,
        description: input.payload.description,
        color: input.payload.color ? sanitizeHexColor(input.payload.color, current.color) : undefined,
        icon: input.payload.icon,
        position: input.payload.order,
        isActive: input.payload.isActive,
        usageRules: input.payload.usageRules !== undefined ? toJsonValue(input.payload.usageRules) : undefined,
        acceptsParent: input.payload.acceptsParent,
        acceptsChecklist: input.payload.acceptsChecklist,
        acceptsDueDate: input.payload.acceptsDueDate,
        acceptsAssignee: input.payload.acceptsAssignee,
        acceptsTags: input.payload.acceptsTags,
        acceptsCustomFields: input.payload.acceptsCustomFields
      }
    });

    return this.serializeItemType(itemType);
  }

  public async replaceItemTypeFieldBindings(input: {
    workspaceId: string;
    typeId: string;
    userId: string;
    payload: {
      bindings: Array<{
        fieldDefinitionId: string;
        displayContext: 'card' | 'detail';
        order: number;
        section?: string | null;
        isVisible?: boolean;
        isRequiredOverride?: boolean | null;
        isReadonlyOverride?: boolean | null;
        settings?: JsonRecord | null;
      }>;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const itemType = await this.prisma.workItemType.findFirst({
      where: { id: input.typeId, workspaceId: input.workspaceId },
      select: { id: true }
    });

    if (!itemType) {
      throw new AppError('Work item type not found', 404);
    }

    const uniqueFieldDefinitionIds = Array.from(
      new Set(input.payload.bindings.map((binding) => binding.fieldDefinitionId))
    );

    if (uniqueFieldDefinitionIds.length > 0) {
      const existingFields = await this.prisma.customFieldDefinition.findMany({
        where: {
          workspaceId: input.workspaceId,
          id: {
            in: uniqueFieldDefinitionIds
          }
        },
        select: { id: true }
      });

      if (existingFields.length !== uniqueFieldDefinitionIds.length) {
        throw new AppError('One or more field definitions do not belong to this workspace', 400);
      }
    }

    const seenBindings = new Set<string>();
    const normalizedBindings = input.payload.bindings.map((binding) => {
      const dedupeKey = `${binding.displayContext}:${binding.fieldDefinitionId}`;
      if (seenBindings.has(dedupeKey)) {
        throw new AppError('Duplicated field binding for the same type/context', 422);
      }
      seenBindings.add(dedupeKey);

      return {
        workspaceId: input.workspaceId,
        typeId: itemType.id,
        fieldId: binding.fieldDefinitionId,
        displayContext: binding.displayContext,
        position: binding.order,
        section: normalizeFieldSection(binding.section) ?? null,
        isVisible: binding.isVisible ?? true,
        isRequiredOverride: binding.isRequiredOverride ?? null,
        isReadonlyOverride: binding.isReadonlyOverride ?? null,
        settings:
          binding.settings === undefined
            ? undefined
            : binding.settings === null
              ? Prisma.JsonNull
              : toJsonValue(binding.settings)
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.workItemFieldBinding.deleteMany({
        where: {
          workspaceId: input.workspaceId,
          typeId: itemType.id
        }
      });

      if (normalizedBindings.length > 0) {
        await tx.workItemFieldBinding.createMany({
          data: normalizedBindings
        });
      }
    });
  }

  public async listWorkflowStates(input: { workspaceId: string; userId: string }) {
    await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    const states = await this.prisma.workflowState.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return states.map((state) => this.serializeWorkflowState(state));
  }

  public async createWorkflowState(input: {
    workspaceId: string;
    userId: string;
    payload: {
      name: string;
      slug?: string;
      category?: string;
      color?: string;
      order?: number;
      isActive?: boolean;
      isTerminal?: boolean;
      isEditable?: boolean;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const state = await this.prisma.workflowState.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.payload.name,
        slug: toSlug(input.payload.slug ?? input.payload.name),
        category: input.payload.category,
        color: sanitizeHexColor(input.payload.color, '#64748b'),
        position: input.payload.order ?? (await this.prisma.workflowState.count({ where: { workspaceId: input.workspaceId } })),
        isActive: input.payload.isActive ?? true,
        isTerminal: input.payload.isTerminal ?? false,
        isEditable: input.payload.isEditable ?? true
      }
    });

    return this.serializeWorkflowState(state);
  }

  public async updateWorkflowState(input: {
    workspaceId: string;
    stateId: string;
    userId: string;
    payload: {
      name?: string;
      slug?: string;
      category?: string | null;
      color?: string;
      order?: number;
      isActive?: boolean;
      isTerminal?: boolean;
      isEditable?: boolean;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.workflowState.findFirst({ where: { id: input.stateId, workspaceId: input.workspaceId } });
    if (!current) {
      throw new AppError('Workflow state not found', 404);
    }

    const state = await this.prisma.workflowState.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        slug: input.payload.slug ? toSlug(input.payload.slug) : undefined,
        category: input.payload.category,
        color: input.payload.color ? sanitizeHexColor(input.payload.color, current.color) : undefined,
        position: input.payload.order,
        isActive: input.payload.isActive,
        isTerminal: input.payload.isTerminal,
        isEditable: input.payload.isEditable
      }
    });

    return this.serializeWorkflowState(state);
  }

  public async listBoardColumns(input: { workspaceId: string; userId: string }) {
    await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    const columns = await this.prisma.boardColumn.findMany({
      where: { workspaceId: input.workspaceId },
      include: {
        stateMappings: {
          orderBy: { position: 'asc' },
          select: {
            stateId: true,
            state: {
              select: {
                slug: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return columns.map((column) => this.serializeBoardColumn(column));
  }

  public async createBoardColumn(input: {
    workspaceId: string;
    userId: string;
    payload: {
      name: string;
      slug?: string;
      order?: number;
      wipLimit?: number | null;
      isActive?: boolean;
      stateIds?: string[];
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const column = await this.prisma.boardColumn.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.payload.name,
        slug: toSlug(input.payload.slug ?? input.payload.name),
        position: input.payload.order ?? (await this.prisma.boardColumn.count({ where: { workspaceId: input.workspaceId } })),
        wipLimit: input.payload.wipLimit ?? null,
        isActive: input.payload.isActive ?? true
      }
    });

    if (input.payload.stateIds) {
      await this.replaceColumnStateMappings(input.workspaceId, column.id, input.payload.stateIds);
    }

    return this.getBoardColumnOrFail(column.id, input.workspaceId);
  }

  public async updateBoardColumn(input: {
    workspaceId: string;
    columnId: string;
    userId: string;
    payload: {
      name?: string;
      slug?: string;
      order?: number;
      wipLimit?: number | null;
      isActive?: boolean;
      stateIds?: string[];
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.boardColumn.findFirst({ where: { id: input.columnId, workspaceId: input.workspaceId } });
    if (!current) {
      throw new AppError('Board column not found', 404);
    }

    await this.prisma.boardColumn.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        slug: input.payload.slug ? toSlug(input.payload.slug) : undefined,
        position: input.payload.order,
        wipLimit: input.payload.wipLimit,
        isActive: input.payload.isActive
      }
    });

    if (input.payload.stateIds) {
      await this.replaceColumnStateMappings(input.workspaceId, current.id, input.payload.stateIds);
    }

    return this.getBoardColumnOrFail(current.id, input.workspaceId);
  }

  public async listTags(input: { workspaceId: string; userId: string }) {
    await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    const tags = await this.prisma.tagDefinition.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: [{ name: 'asc' }]
    });

    return tags.map((tag) => this.serializeTag(tag));
  }

  public async createTag(input: {
    workspaceId: string;
    userId: string;
    payload: {
      name: string;
      slug?: string;
      color?: string;
      description?: string;
      isActive?: boolean;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const tag = await this.prisma.tagDefinition.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.payload.name,
        slug: toSlug(input.payload.slug ?? input.payload.name),
        color: sanitizeHexColor(input.payload.color, '#64748b'),
        description: input.payload.description,
        isActive: input.payload.isActive ?? true
      }
    });

    return this.serializeTag(tag);
  }

  public async updateTag(input: {
    workspaceId: string;
    tagId: string;
    userId: string;
    payload: {
      name?: string;
      slug?: string;
      color?: string;
      description?: string | null;
      isActive?: boolean;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.tagDefinition.findFirst({ where: { id: input.tagId, workspaceId: input.workspaceId } });
    if (!current) {
      throw new AppError('Tag not found', 404);
    }

    const tag = await this.prisma.tagDefinition.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        slug: input.payload.slug ? toSlug(input.payload.slug) : undefined,
        color: input.payload.color ? sanitizeHexColor(input.payload.color, current.color) : undefined,
        description: input.payload.description,
        isActive: input.payload.isActive
      }
    });

    return this.serializeTag(tag);
  }

  public async listCustomFields(input: { workspaceId: string; userId: string }) {
    await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    const fields = await this.prisma.customFieldDefinition.findMany({
      where: { workspaceId: input.workspaceId },
      include: {
        options: {
          orderBy: { position: 'asc' }
        },
        scopes: {
          select: {
            typeId: true
          }
        },
        bindings: {
          include: {
            type: {
              select: {
                id: true,
                slug: true
              }
            }
          },
          orderBy: [{ displayContext: 'asc' }, { position: 'asc' }]
        }
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    return fields.map((field) => this.serializeCustomField(field));
  }

  public async createCustomField(input: {
    workspaceId: string;
    userId: string;
    payload: {
      name: string;
      slug?: string;
      description?: string;
      variableKey?: string | null;
      variableLabel?: string | null;
      variableDescription?: string | null;
      type: CustomFieldInputType;
      required?: boolean;
      isEditable?: boolean;
      isRemovable?: boolean;
      order?: number;
      isActive?: boolean;
      defaultValue?: unknown;
      settings?: JsonRecord;
      options?: Array<{ label: string; value: string; color?: string; order?: number; isActive?: boolean }>;
      scopeTypeIds?: string[];
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    if (isSystemOnlyFieldType(input.payload.type)) {
      throw new AppError('This field type is reserved for system fields', 422);
    }

    const field = await this.prisma.customFieldDefinition.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.payload.name,
        slug: toSlug(input.payload.slug ?? input.payload.name),
        description: input.payload.description,
        variableKey: normalizeVariableKey(input.payload.variableKey),
        variableLabel: normalizeNullableText(input.payload.variableLabel),
        variableDescription: normalizeNullableText(input.payload.variableDescription),
        type: mapInputTypeToPrisma(input.payload.type),
        isSystem: false,
        required: input.payload.required ?? false,
        isEditable: input.payload.isEditable ?? true,
        isRemovable: input.payload.isRemovable ?? true,
        position: input.payload.order ?? (await this.prisma.customFieldDefinition.count({ where: { workspaceId: input.workspaceId } })),
        isActive: input.payload.isActive ?? true,
        settings: input.payload.settings ? toJsonValue(input.payload.settings) : undefined,
        defaultValue: input.payload.defaultValue !== undefined ? toJsonValue(input.payload.defaultValue) : undefined
      }
    });

    await this.replaceCustomFieldOptions(field.id, input.payload.options ?? []);

    const scopeIds =
      input.payload.scopeTypeIds && input.payload.scopeTypeIds.length > 0
        ? input.payload.scopeTypeIds
        : (
            await this.prisma.workItemType.findMany({
              where: { workspaceId: input.workspaceId, isActive: true },
              select: { id: true }
            })
          ).map((entry) => entry.id);

    await this.replaceCustomFieldScopes(input.workspaceId, field.id, scopeIds);

    return this.getCustomFieldOrFail(field.id, input.workspaceId);
  }

  public async updateCustomField(input: {
    workspaceId: string;
    fieldId: string;
    userId: string;
    payload: {
      name?: string;
      slug?: string;
      description?: string | null;
      variableKey?: string | null;
      variableLabel?: string | null;
      variableDescription?: string | null;
      type?: CustomFieldInputType;
      required?: boolean;
      isEditable?: boolean;
      isRemovable?: boolean;
      order?: number;
      isActive?: boolean;
      defaultValue?: unknown;
      settings?: JsonRecord;
      options?: Array<{ label: string; value: string; color?: string; order?: number; isActive?: boolean }>;
      scopeTypeIds?: string[];
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.customFieldDefinition.findFirst({ where: { id: input.fieldId, workspaceId: input.workspaceId } });
    if (!current) {
      throw new AppError('Custom field not found', 404);
    }

    if (current.isSystem && input.payload.type && input.payload.type !== mapCustomFieldTypeToInput(current.type)) {
      throw new AppError('System field types cannot be changed', 422);
    }

    if (
      current.isEditable === false &&
      (
        input.payload.name !== undefined ||
        input.payload.slug !== undefined ||
        input.payload.description !== undefined ||
        input.payload.variableKey !== undefined ||
        input.payload.variableLabel !== undefined ||
        input.payload.variableDescription !== undefined ||
        input.payload.required !== undefined ||
        input.payload.settings !== undefined ||
        input.payload.defaultValue !== undefined ||
        input.payload.options !== undefined
      )
    ) {
      throw new AppError('This system field is read-only', 422);
    }

    if (current.isRemovable === false && input.payload.isActive === false) {
      throw new AppError('This system field cannot be removed', 422);
    }

    await this.prisma.customFieldDefinition.update({
      where: { id: current.id },
      data: {
        name: input.payload.name,
        slug: input.payload.slug ? toSlug(input.payload.slug) : undefined,
        description: input.payload.description,
        variableKey: input.payload.variableKey !== undefined ? normalizeVariableKey(input.payload.variableKey) : undefined,
        variableLabel:
          input.payload.variableLabel !== undefined ? normalizeNullableText(input.payload.variableLabel) : undefined,
        variableDescription:
          input.payload.variableDescription !== undefined
            ? normalizeNullableText(input.payload.variableDescription)
            : undefined,
        type: input.payload.type ? mapInputTypeToPrisma(input.payload.type) : undefined,
        required: input.payload.required,
        isEditable: input.payload.isEditable,
        isRemovable: input.payload.isRemovable,
        position: input.payload.order,
        isActive: input.payload.isActive,
        settings: input.payload.settings !== undefined ? toJsonValue(input.payload.settings) : undefined,
        defaultValue: input.payload.defaultValue !== undefined ? toJsonValue(input.payload.defaultValue) : undefined
      }
    });

    if (input.payload.options) {
      await this.replaceCustomFieldOptions(current.id, input.payload.options);
    }

    if (input.payload.scopeTypeIds) {
      await this.replaceCustomFieldScopes(input.workspaceId, current.id, input.payload.scopeTypeIds);
    }

    return this.getCustomFieldOrFail(current.id, input.workspaceId);
  }

  public async getPreferences(input: { workspaceId: string; userId: string }) {
    await this.ensureReadableWorkspace(input.workspaceId, input.userId);

    const preferences = await this.prisma.workspacePreferences.findUnique({ where: { workspaceId: input.workspaceId } });
    if (!preferences) {
      throw new AppError('Workspace preferences not found', 404);
    }

    return this.serializePreferences(preferences);
  }

  public async updatePreferences(input: {
    workspaceId: string;
    userId: string;
    payload: {
      defaultBoardMode?: string;
      dateFormat?: string;
      visibleCardFieldIds?: string[];
      visibleFieldsByType?: Record<string, string[]>;
      detailVisibleFieldsByType?: Record<string, string[]>;
      settings?: JsonRecord;
    };
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.workspacePreferences.findUnique({ where: { workspaceId: input.workspaceId } });

    const currentSettings =
      current?.settings && typeof current.settings === 'object' && !Array.isArray(current.settings)
        ? (current.settings as JsonRecord)
        : {};

    const mergedSettings = {
      ...currentSettings,
      ...(input.payload.visibleFieldsByType !== undefined
        ? { visibleFieldsByType: input.payload.visibleFieldsByType }
        : {}),
      ...(input.payload.detailVisibleFieldsByType !== undefined
        ? { detailVisibleFieldsByType: input.payload.detailVisibleFieldsByType }
        : {}),
      ...(input.payload.settings ?? {})
    };

    const preferences = await this.prisma.workspacePreferences.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        defaultBoardMode: input.payload.defaultBoardMode ?? 'dev',
        dateFormat: input.payload.dateFormat ?? 'dd/mm/yyyy',
        visibleCardFieldIds: toJsonValue(input.payload.visibleCardFieldIds ?? []),
        settings: toJsonValue(mergedSettings)
      },
      update: {
        defaultBoardMode: input.payload.defaultBoardMode,
        dateFormat: input.payload.dateFormat,
        visibleCardFieldIds:
          input.payload.visibleCardFieldIds !== undefined
            ? toJsonValue(input.payload.visibleCardFieldIds)
            : undefined,
        settings:
          input.payload.settings !== undefined ||
          input.payload.visibleFieldsByType !== undefined ||
          input.payload.detailVisibleFieldsByType !== undefined
            ? toJsonValue(mergedSettings)
            : undefined
      }
    });

    if (
      input.payload.visibleFieldsByType !== undefined ||
      input.payload.detailVisibleFieldsByType !== undefined ||
      (input.payload.settings !== undefined && input.payload.settings.detailFieldZoneByType !== undefined)
    ) {
      await this.replaceFieldBindingsFromPreferences(input.workspaceId, {
        visibleCardFieldIds:
          input.payload.visibleCardFieldIds ??
          (Array.isArray(preferences.visibleCardFieldIds)
            ? preferences.visibleCardFieldIds.filter((value): value is string => typeof value === 'string')
            : []),
        visibleFieldsByType: input.payload.visibleFieldsByType,
        detailVisibleFieldsByType: input.payload.detailVisibleFieldsByType,
        detailFieldZoneByType:
          input.payload.settings && typeof input.payload.settings.detailFieldZoneByType === 'object'
            ? (input.payload.settings.detailFieldZoneByType as Record<string, Record<string, string>>)
            : undefined
      });
    }

    return this.serializePreferences(preferences);
  }

  public async resetWorkspaceToTemplate(input: {
    workspaceId: string;
    userId: string;
    templateKey?: WorkspaceTemplateKey;
  }) {
    await this.ensureConfigWritableWorkspace(input.workspaceId, input.userId);

    const selectedTemplateKey = input.templateKey ?? 'software_delivery';
    const selectedTemplate = getWorkspaceTemplateByKey(selectedTemplateKey);
    if (!selectedTemplate) {
      throw new AppError('Invalid workspace template', 422);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.item.updateMany({
        where: { workspaceId: input.workspaceId },
        data: {
          fields: toJsonValue({})
        }
      });

      await tx.workItemViewPlacement.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.automationView.deleteMany({
        where: { workspaceId: input.workspaceId }
      });

      await tx.columnStateMapping.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.customFieldDefinition.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.tagDefinition.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.boardColumn.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.workflowState.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.workItemType.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.workspacePreferences.deleteMany({
        where: { workspaceId: input.workspaceId }
      });
      await tx.columnDefinition.deleteMany({
        where: {
          board: { workspaceId: input.workspaceId }
        }
      });
      await tx.boardTemplate.deleteMany({
        where: { workspaceId: input.workspaceId }
      });

      const { defaultBoardId } = await ensureWorkspaceDefaultConfiguration(tx, {
        workspaceId: input.workspaceId,
        ownerUserId: input.userId,
        templateKey: selectedTemplate.key
      });

      const boardTemplate = await tx.boardTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          name: selectedTemplate.name,
          description: selectedTemplate.description,
          schema: toJsonValue(selectedTemplate.schema),
          rules: toJsonValue(selectedTemplate.rules)
        }
      });

      await tx.board.update({
        where: { id: defaultBoardId },
        data: {
          templateId: boardTemplate.id,
          name: selectedTemplate.boardName,
          description: selectedTemplate.boardDescription
        }
      });
    });

    const access = await this.ensureReadableWorkspace(input.workspaceId, input.userId);
    const config = await this.loadWorkspaceConfig(input.workspaceId);

    return {
      workspace: access.workspace,
      templateKey: selectedTemplate.key,
      ...config
    };
  }

  public async ensureReadableWorkspace(workspaceId: string, userId: string): Promise<WorkspaceAccess> {
    const [membership, user] = await Promise.all([
      this.prisma.workspaceMembership.findFirst({
        where: {
          workspaceId,
          userId
        },
        select: {
          role: true,
          permissions: true,
          workspace: {
            select: {
              id: true,
              name: true,
              key: true,
              kind: true,
              organizationId: true,
              createdAt: true,
              updatedAt: true,
              config: true
            }
          }
        }
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionPlan: true }
      })
    ]);

    if (!membership) {
      throw new AppError('Workspace not found', 404);
    }

    const policy = resolveWorkspaceAccessPolicy({
      role: membership.role,
      membershipPermissions: membership.permissions,
      workspaceConfig: membership.workspace.config,
      subscriptionPlan: user?.subscriptionPlan ?? null
    });

    return {
      role: membership.role,
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        key: membership.workspace.key,
        kind: membership.workspace.kind,
        organizationId: membership.workspace.organizationId,
        createdAt: membership.workspace.createdAt,
        updatedAt: membership.workspace.updatedAt
      },
      ownCardsOnly: policy.ownCardsOnly,
      allowedModules: policy.allowedModules,
      moduleEntitlements: policy.moduleEntitlements,
      allowedBoardViewKeys: policy.allowedBoardViewKeys
    };
  }

  public async ensureConfigWritableWorkspace(workspaceId: string, userId: string): Promise<void> {
    const access = await this.ensureReadableWorkspace(workspaceId, userId);
    if (!(access.role === MembershipRole.OWNER || access.role === MembershipRole.ADMIN)) {
      throw new AppError('Forbidden', 403);
    }
  }

  public async ensureItemWritableWorkspace(workspaceId: string, userId: string): Promise<void> {
    const access = await this.ensureReadableWorkspace(workspaceId, userId);
    if (access.role === MembershipRole.VIEWER) {
      throw new AppError('Forbidden', 403);
    }
  }

  public async loadWorkspaceConfig(workspaceId: string) {
    const [itemTypes, workflowStates, boardColumns, tags, customFieldDefinitions, fieldBindings, preferences] = await Promise.all([
      this.prisma.workItemType.findMany({ where: { workspaceId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.workflowState.findMany({ where: { workspaceId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
      this.prisma.boardColumn.findMany({
        where: { workspaceId },
        include: {
          stateMappings: {
            orderBy: { position: 'asc' },
            select: {
              stateId: true,
              state: {
                select: {
                  slug: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.tagDefinition.findMany({ where: { workspaceId }, orderBy: [{ name: 'asc' }] }),
      this.prisma.customFieldDefinition.findMany({
        where: { workspaceId },
        include: {
          options: {
            orderBy: { position: 'asc' }
          },
          scopes: {
            select: {
              typeId: true
            }
          }
        },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.workItemFieldBinding.findMany({
        where: { workspaceId },
        include: {
          field: {
            select: {
              id: true,
              slug: true
            }
          },
          type: {
            select: {
              id: true,
              slug: true
            }
          }
        },
        orderBy: [{ typeId: 'asc' }, { displayContext: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.workspacePreferences.findUnique({ where: { workspaceId } })
    ]);

    if (!preferences) {
      throw new AppError('Workspace preferences not found', 404);
    }

    const serializedFieldBindings = fieldBindings.map((binding) =>
      serializeFieldBinding({
        id: binding.id,
        fieldId: binding.fieldId,
        fieldSlug: binding.field.slug,
        typeId: binding.typeId,
        typeSlug: binding.type.slug,
        displayContext: binding.displayContext === 'card' ? 'card' : 'detail',
        order: binding.position,
        section: binding.section,
        isVisible: binding.isVisible,
        isRequiredOverride: binding.isRequiredOverride,
        isReadonlyOverride: binding.isReadonlyOverride,
        settings: binding.settings
      })
    );

    const layoutMaps = buildLegacyFieldLayoutMaps(serializedFieldBindings);

    return {
      itemTypes: itemTypes.map((entry) => this.serializeItemType(entry)),
      workflowStates: workflowStates.map((entry) => this.serializeWorkflowState(entry)),
      boardColumns: boardColumns.map((entry) => this.serializeBoardColumn(entry)),
      tags: tags.map((entry) => this.serializeTag(entry)),
      customFieldDefinitions: customFieldDefinitions.map((entry) => this.serializeCustomField(entry)),
      fieldBindings: serializedFieldBindings,
      preferences: this.serializePreferences(preferences, layoutMaps)
    };
  }

  private async getBoardColumnOrFail(columnId: string, workspaceId: string) {
    const column = await this.prisma.boardColumn.findFirst({
      where: {
        id: columnId,
        workspaceId
      },
      include: {
        stateMappings: {
          orderBy: { position: 'asc' },
          select: {
            stateId: true,
            state: {
              select: {
                slug: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!column) {
      throw new AppError('Board column not found', 404);
    }

    return this.serializeBoardColumn(column);
  }

  private async getCustomFieldOrFail(fieldId: string, workspaceId: string) {
    const field = await this.prisma.customFieldDefinition.findFirst({
      where: {
        id: fieldId,
        workspaceId
      },
      include: {
        options: {
          orderBy: { position: 'asc' }
        },
        scopes: {
          select: {
            typeId: true
          }
        },
        bindings: {
          include: {
            type: {
              select: {
                id: true,
                slug: true
              }
            }
          },
          orderBy: [{ displayContext: 'asc' }, { position: 'asc' }]
        }
      }
    });

    if (!field) {
      throw new AppError('Custom field not found', 404);
    }

    return this.serializeCustomField(field);
  }

  private async replaceColumnStateMappings(workspaceId: string, columnId: string, stateIds: string[]) {
    const uniqueStateIds = Array.from(new Set(stateIds));

    if (uniqueStateIds.length > 0) {
      const states = await this.prisma.workflowState.findMany({
        where: {
          workspaceId,
          id: {
            in: uniqueStateIds
          }
        },
        select: {
          id: true
        }
      });

      if (states.length !== uniqueStateIds.length) {
        throw new AppError('One or more states do not belong to this workspace', 400);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.columnStateMapping.deleteMany({
        where: {
          workspaceId,
          columnId
        }
      });

      if (uniqueStateIds.length > 0) {
        await tx.columnStateMapping.createMany({
          data: uniqueStateIds.map((stateId, index) => ({
            workspaceId,
            columnId,
            stateId,
            position: index
          }))
        });
      }
    });
  }

  private async replaceCustomFieldOptions(
    fieldId: string,
    options: Array<{ label: string; value: string; color?: string; order?: number; isActive?: boolean }>
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.customFieldOption.deleteMany({ where: { fieldId } });

      if (options.length > 0) {
        await tx.customFieldOption.createMany({
          data: options.map((option, index) => ({
            fieldId,
            label: option.label,
            value: toSlug(option.value || option.label),
            color: option.color ? sanitizeHexColor(option.color, '#64748b') : null,
            position: option.order ?? index,
            isActive: option.isActive ?? true
          }))
        });
      }
    });
  }

  private async replaceCustomFieldScopes(workspaceId: string, fieldId: string, typeIds: string[]) {
    const uniqueTypeIds = Array.from(new Set(typeIds));

    if (uniqueTypeIds.length > 0) {
      const types = await this.prisma.workItemType.findMany({
        where: {
          workspaceId,
          id: {
            in: uniqueTypeIds
          }
        },
        select: {
          id: true
        }
      });

      if (types.length !== uniqueTypeIds.length) {
        throw new AppError('One or more scope item types do not belong to this workspace', 400);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customFieldScope.deleteMany({ where: { fieldId } });

      if (uniqueTypeIds.length > 0) {
        await tx.customFieldScope.createMany({
          data: uniqueTypeIds.map((typeId) => ({ fieldId, typeId }))
        });
      }
    });
  }

  private async replaceFieldBindingsFromPreferences(
    workspaceId: string,
    input: {
      visibleCardFieldIds?: string[];
      visibleFieldsByType?: Record<string, string[]>;
      detailVisibleFieldsByType?: Record<string, string[]>;
      detailFieldZoneByType?: Record<string, Record<string, string>>;
    }
  ) {
    const [itemTypes, fields, existingBindings] = await Promise.all([
      this.prisma.workItemType.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, slug: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.customFieldDefinition.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, slug: true }
      }),
      this.prisma.workItemFieldBinding.findMany({
        where: { workspaceId },
        include: {
          type: { select: { slug: true } },
          field: { select: { slug: true } }
        },
        orderBy: [{ displayContext: 'asc' }, { position: 'asc' }]
      })
    ]);

    const fieldIdBySlug = new Map(fields.map((field) => [field.slug, field.id]));
    const existingDetailFieldIdsByType = existingBindings.reduce<Record<string, string[]>>((acc, binding) => {
      if (binding.displayContext !== 'detail') {
        return acc;
      }

      const list = acc[binding.type.slug] ?? [];
      list.push(binding.field.slug);
      acc[binding.type.slug] = list;
      return acc;
    }, {});
    const existingDetailZonesByType = existingBindings.reduce<Record<string, Record<string, string>>>((acc, binding) => {
      if (binding.displayContext !== 'detail') {
        return acc;
      }

      const zoneMap = acc[binding.type.slug] ?? {};
      zoneMap[binding.field.slug] = normalizeFieldSection(binding.section) ?? 'side';
      acc[binding.type.slug] = zoneMap;
      return acc;
    }, {});

    await this.prisma.$transaction(async (tx) => {
      if (input.visibleFieldsByType !== undefined || input.visibleCardFieldIds !== undefined) {
        await tx.workItemFieldBinding.deleteMany({
          where: {
            workspaceId,
            displayContext: 'card'
          }
        });

        for (const itemType of itemTypes) {
          const fieldSlugs = input.visibleFieldsByType?.[itemType.slug] ?? input.visibleCardFieldIds ?? [];
          let position = 0;

          for (const fieldSlug of fieldSlugs) {
            const fieldId = fieldIdBySlug.get(fieldSlug);
            if (!fieldId) {
              continue;
            }

            await tx.workItemFieldBinding.create({
              data: {
                workspaceId,
                typeId: itemType.id,
                fieldId,
                displayContext: 'card',
                position,
                isVisible: true
              }
            });
            position += 1;
          }
        }
      }

      if (input.detailVisibleFieldsByType !== undefined || input.detailFieldZoneByType !== undefined) {
        await tx.workItemFieldBinding.deleteMany({
          where: {
            workspaceId,
            displayContext: 'detail'
          }
        });

        for (const itemType of itemTypes) {
          const fieldSlugs = input.detailVisibleFieldsByType?.[itemType.slug] ?? existingDetailFieldIdsByType[itemType.slug] ?? [];
          const zoneMap = input.detailFieldZoneByType?.[itemType.slug] ?? existingDetailZonesByType[itemType.slug] ?? {};
          let position = 0;

          for (const fieldSlug of fieldSlugs) {
            const fieldId = fieldIdBySlug.get(fieldSlug);
            if (!fieldId) {
              continue;
            }

            await tx.workItemFieldBinding.create({
              data: {
                workspaceId,
                typeId: itemType.id,
                fieldId,
                displayContext: 'detail',
                position,
                section: normalizeFieldSection(zoneMap[fieldSlug]) ?? 'side',
                isVisible: true
              }
            });
            position += 1;
          }
        }
      }
    });
  }

  private serializeItemType(itemType: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string | null;
    color: string;
    icon: string | null;
    position: number;
    isActive: boolean;
    usageRules: unknown;
    acceptsParent: boolean;
    acceptsChecklist: boolean;
    acceptsDueDate: boolean;
    acceptsAssignee: boolean;
    acceptsTags: boolean;
    acceptsCustomFields: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: itemType.id,
      workspaceId: itemType.workspaceId,
      name: itemType.name,
      slug: itemType.slug,
      description: itemType.description,
      color: itemType.color,
      icon: itemType.icon,
      order: itemType.position,
      isActive: itemType.isActive,
      usageRules: itemType.usageRules,
      acceptsParent: itemType.acceptsParent,
      acceptsChecklist: itemType.acceptsChecklist,
      acceptsDueDate: itemType.acceptsDueDate,
      acceptsAssignee: itemType.acceptsAssignee,
      acceptsTags: itemType.acceptsTags,
      acceptsCustomFields: itemType.acceptsCustomFields,
      createdAt: itemType.createdAt,
      updatedAt: itemType.updatedAt
    };
  }

  private serializeWorkflowState(state: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    category: string | null;
    color: string;
    position: number;
    isActive: boolean;
    isTerminal: boolean;
    isEditable: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: state.id,
      workspaceId: state.workspaceId,
      name: state.name,
      slug: state.slug,
      category: state.category,
      color: state.color,
      order: state.position,
      isActive: state.isActive,
      isTerminal: state.isTerminal,
      isEditable: state.isEditable,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt
    };
  }

  private serializeBoardColumn(column: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    position: number;
    wipLimit: number | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    stateMappings: Array<{ stateId: string; state: { slug: string; name: string } }>;
  }) {
    return {
      id: column.id,
      workspaceId: column.workspaceId,
      name: column.name,
      slug: column.slug,
      order: column.position,
      wipLimit: column.wipLimit,
      isActive: column.isActive,
      stateIds: column.stateMappings.map((mapping) => mapping.stateId),
      states: column.stateMappings.map((mapping) => ({
        id: mapping.stateId,
        slug: mapping.state.slug,
        name: mapping.state.name
      })),
      createdAt: column.createdAt,
      updatedAt: column.updatedAt
    };
  }

  private serializeTag(tag: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    color: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: tag.id,
      workspaceId: tag.workspaceId,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
      description: tag.description,
      isActive: tag.isActive,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt
    };
  }

  private serializeCustomField(field: {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string | null;
    variableKey: string | null;
    variableLabel: string | null;
    variableDescription: string | null;
    type: CustomFieldType;
    isSystem: boolean;
    required: boolean;
    isEditable: boolean;
    isRemovable: boolean;
    position: number;
    isActive: boolean;
    settings: unknown;
    defaultValue: unknown;
    createdAt: Date;
    updatedAt: Date;
    options: Array<{
      id: string;
      label: string;
      value: string;
      color: string | null;
      position: number;
      isActive: boolean;
    }>;
    scopes: Array<{ typeId: string }>;
    bindings?: Array<{
      id: string;
      fieldId: string;
      typeId: string;
      displayContext: string;
      position: number;
      section: string | null;
      isVisible: boolean;
      isRequiredOverride: boolean | null;
      isReadonlyOverride: boolean | null;
      settings: unknown;
      type: { id: string; slug: string };
    }>;
  }) {
    const base = serializeFieldDefinition({
      id: field.id,
      slug: field.slug,
      name: field.name,
      description: field.description,
      variableKey: field.variableKey,
      variableLabel: field.variableLabel,
      variableDescription: field.variableDescription,
      type: mapCustomFieldTypeToInput(field.type),
      required: field.required,
      isSystem: field.isSystem,
      isEditable: field.isEditable,
      isRemovable: field.isRemovable,
      isActive: field.isActive,
      order: field.position,
      settings: field.settings,
      defaultValue: field.defaultValue,
      options: field.options.map((option) => ({
        id: option.id,
        label: option.label,
        value: option.value,
        color: option.color,
        order: option.position,
        isActive: option.isActive
      }))
    });

    return {
      ...base,
      id: field.id,
      workspaceId: field.workspaceId,
      scopeTypeIds: field.scopes.map((scope) => scope.typeId),
      bindings: Array.isArray(field.bindings)
        ? field.bindings.map((binding) =>
            serializeFieldBinding({
              id: binding.id,
              fieldId: binding.fieldId,
              fieldSlug: field.slug,
              typeId: binding.typeId,
              typeSlug: binding.type.slug,
              displayContext: binding.displayContext === 'card' ? 'card' : 'detail',
              order: binding.position,
              section: binding.section,
              isVisible: binding.isVisible,
              isRequiredOverride: binding.isRequiredOverride,
              isReadonlyOverride: binding.isReadonlyOverride,
              settings: binding.settings
            })
          )
        : [],
      createdAt: field.createdAt,
      updatedAt: field.updatedAt
    };
  }

  private serializePreferences(preferences: {
    workspaceId: string;
    defaultBoardMode: string;
    dateFormat: string;
    visibleCardFieldIds: unknown;
    settings: unknown;
    updatedAt: Date;
  }, layoutMaps?: {
    visibleFieldIdsByType: Record<string, string[]>;
    detailVisibleFieldIdsByType: Record<string, string[]>;
    detailFieldZoneByType: Record<string, Record<string, 'main' | 'side'>>;
  }) {
    const settings =
      preferences.settings && typeof preferences.settings === 'object' && !Array.isArray(preferences.settings)
        ? (preferences.settings as Record<string, unknown>)
        : {};

    const visibleFieldsByType = layoutMaps?.visibleFieldIdsByType ?? this.extractFieldMap(settings.visibleFieldsByType);
    const detailVisibleFieldsByType =
      layoutMaps?.detailVisibleFieldIdsByType ?? this.extractFieldMap(settings.detailVisibleFieldsByType);
    const detailFieldZoneByType =
      layoutMaps?.detailFieldZoneByType ??
      (settings.detailFieldZoneByType && typeof settings.detailFieldZoneByType === 'object' && !Array.isArray(settings.detailFieldZoneByType)
        ? (settings.detailFieldZoneByType as Record<string, Record<string, 'main' | 'side'>>)
        : {});

    return {
      workspaceId: preferences.workspaceId,
      defaultBoardMode: preferences.defaultBoardMode,
      dateFormat: preferences.dateFormat,
      visibleCardFieldIds: Array.isArray(preferences.visibleCardFieldIds)
        ? preferences.visibleCardFieldIds.filter((value): value is string => typeof value === 'string')
        : [],
      visibleFieldsByType,
      detailVisibleFieldsByType,
      settings: {
        ...settings,
        detailFieldZoneByType
      },
      updatedAt: preferences.updatedAt
    };
  }

  private extractFieldMap(input: unknown): Record<string, string[]> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return {};
    }

    return Object.entries(input as Record<string, unknown>).reduce<Record<string, string[]>>((acc, [key, value]) => {
      if (!Array.isArray(value)) {
        return acc;
      }

      const fieldIds = value.filter((entry): entry is string => typeof entry === 'string');
      acc[key] = fieldIds;
      return acc;
    }, {});
  }
}

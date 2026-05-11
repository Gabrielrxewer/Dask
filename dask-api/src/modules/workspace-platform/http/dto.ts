import { z } from 'zod';
import { isPermission } from '@/modules/identity/domain/permissions';
import { workspaceModuleCatalog } from '@/modules/identity/domain/access-policy';

const customFieldTypeEnum = z.enum([
  'text',
  'long_text',
  'number',
  'date',
  'datetime',
  'boolean',
  'select',
  'catalog_select',
  'multi_select',
  'user',
  'checklist',
  'priority',
  'status',
  'tag',
  'schedule',
  'work_item_type',
  'billing_summary'
]);

const workspaceTemplateKeyEnum = z.enum([
  'software_delivery',
  'product_discovery',
  'operations_kanban',
  'commercial_crm'
]);

const workspaceDocumentKindEnum = z.enum(['wiki', 'proposal', 'contract']);
const documentLinkedEntityTypeEnum = z.enum(['work_item', 'customer', 'proposal', 'contract']);
const customerStatusEnum = z.enum(['prospect', 'active', 'inactive', 'archived']);

const queryBooleanDto = z
  .union([z.literal('true'), z.literal('1'), z.literal(true), z.literal('false'), z.literal('0'), z.literal(false)])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value === true || value === 'true' || value === '1';
  });

function queryArrayDto(item: z.ZodTypeAny) {
  return z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }

      const values = Array.isArray(value) ? value : String(value).split(',');
      return values.map((entry) => String(entry).trim()).filter(Boolean);
    }, z.array(item).optional());
}

const customFieldFilterDto = z.object({
  fieldId: z.string().uuid().optional(),
  fieldKey: z.string().trim().min(1).max(120).optional(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()])
}).refine((filter) => Boolean(filter.fieldId || filter.fieldKey), {
  message: 'fieldId or fieldKey is required'
});

const customFieldFiltersQueryDto = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      try {
        return [JSON.parse(String(entry))];
      } catch {
        return [];
      }
    });
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  return value;
}, z.array(customFieldFilterDto).max(24).optional());

const customerAddressDto = z.object({
  street: z.string().trim().max(120).optional(),
  number: z.string().trim().max(40).optional(),
  complement: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(60).optional(),
  zipCode: z.string().trim().max(24).optional(),
  country: z.string().trim().max(80).optional()
});

const fieldVariableKeyDto = z
  .string()
  .trim()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,79}$/)
  .nullable()
  .optional();

export const workspaceIdParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const workspaceSnapshotQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional()
});

export const workItemListQueryDto = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
  perspectiveId: z.string().trim().min(1).max(120).optional(),
  boardColumnId: z.string().uuid().optional(),
  columnId: z.string().uuid().optional(),
  workItemTypeId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  workflowStateId: z.string().uuid().optional(),
  workflowStateIds: queryArrayDto(z.string().uuid()),
  stateId: z.string().uuid().optional(),
  stateSlug: z.string().trim().min(1).max(80).optional(),
  typeSlug: z.string().trim().min(1).max(80).optional(),
  assignedToMe: queryBooleanDto,
  assigneeId: z.string().uuid().optional(),
  responsibleId: z.string().uuid().optional(),
  search: z.string().trim().max(160).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  plannedStartFrom: z.coerce.date().optional(),
  plannedStartTo: z.coerce.date().optional(),
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
  updatedAtFrom: z.coerce.date().optional(),
  updatedAtTo: z.coerce.date().optional(),
  source: z.string().trim().max(120).optional(),
  customerId: z.string().uuid().optional(),
  converted: queryBooleanDto,
  customFieldFilters: customFieldFiltersQueryDto,
  sortBy: z.enum(['position', 'title', 'type', 'status', 'assignee', 'dueDate', 'createdAt', 'updatedAt', 'plannedStartAt']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  sort: z.enum(['position_asc', 'updated_desc', 'updated_asc', 'created_desc', 'created_asc']).optional(),
  paged: z
    .union([z.literal('true'), z.literal('1'), z.literal(true)])
    .optional()
    .transform(Boolean)
});

export const workspaceDocumentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid()
});

export const workspaceDocumentAssetParamsDto = z.object({
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid(),
  assetId: z.string().uuid()
});

export const workspaceDocumentFolderParamsDto = z.object({
  workspaceId: z.string().uuid(),
  folderId: z.string().uuid()
});

export const workspaceDocumentListQueryDto = z.object({
  search: z.string().trim().max(160).optional(),
  type: workspaceDocumentKindEnum.optional(),
  kind: workspaceDocumentKindEnum.optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: queryArrayDto(z.string().trim().min(1).max(80)),
  status: z.string().trim().min(1).max(40).optional(),
  commercialStatus: z.string().trim().min(1).max(40).optional(),
  linkedWorkItemId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  updatedAtFrom: z.coerce.date().optional(),
  updatedAtTo: z.coerce.date().optional(),
  visibility: z.enum(['internal', 'client_visible', 'commercial_shared', 'public_authenticated']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
  sort: z.enum(['position_asc', 'updated_desc', 'updated_asc', 'created_desc', 'created_asc', 'title_asc']).optional(),
  paged: z
    .union([z.literal('true'), z.literal('1'), z.literal(true)])
    .optional()
    .transform(Boolean)
});

export const createWorkspaceDocumentFolderDto = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().nonnegative().optional()
});

export const patchWorkspaceDocumentFolderDto = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    parentId: z.string().uuid().nullable().optional(),
    position: z.number().int().nonnegative().optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

export const createWorkspaceDocumentDto = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.string().max(200_000).optional(),
  kind: workspaceDocumentKindEnum.optional(),
  linkedEntityType: documentLinkedEntityTypeEnum.optional(),
  linkedEntityId: z.string().uuid().optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
  metadata: z.record(z.unknown()).optional(),
  position: z.number().int().nonnegative().optional()
});

export const patchWorkspaceDocumentDto = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    content: z.string().max(200_000).optional(),
    kind: workspaceDocumentKindEnum.optional(),
    linkedEntityType: documentLinkedEntityTypeEnum.nullable().optional(),
    linkedEntityId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
    metadata: z.record(z.unknown()).optional(),
    position: z.number().int().nonnegative().optional(),
    expectedUpdatedAt: z.string().datetime().optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

export const sendWorkspaceDocumentDto = z
  .object({
    email: z.string().trim().email().max(320).optional(),
    emails: z.array(z.string().trim().email().max(320)).min(1).max(20).optional(),
    subject: z.string().trim().min(1).max(180).optional(),
    message: z.string().trim().max(4000).optional(),
    includeAttachments: z.boolean().optional(),
    selectedAssetIds: z.array(z.string().uuid()).max(50).optional(),
    expirationDate: z.string().datetime().nullable().optional(),
    requireLogin: z.boolean().optional(),
    allowAcceptReject: z.boolean().optional(),
    linkedWorkItemId: z.string().uuid().nullable().optional(),
    resolvedPreviewSnapshot: z.string().max(200000).optional()
  })
  .refine((payload) => Boolean(payload.email || payload.emails?.length), {
    message: 'At least one recipient email is required'
  });

export const publicWorkspaceDocumentTokenParamsDto = z.object({
  token: z.string().trim().min(32).max(512)
});

export const publicWorkspaceDocumentAssetParamsDto = z.object({
  token: z.string().trim().min(32).max(512),
  assetId: z.string().uuid()
});

export const decidePublicWorkspaceDocumentDto = z.object({
  decision: z.enum(['approve', 'accept', 'sign', 'reject'])
});

export const decideWorkspaceDocumentDto = z.object({
  decision: z.enum(['approve', 'accept', 'sign', 'reject']),
  reason: z.string().trim().max(2000).nullable().optional()
});

export const documentAssetTypeDto = z.enum(['logo', 'attachment', 'generated_pdf', 'exported_html']);

export const uploadWorkspaceDocumentAssetDto = z.object({
  type: documentAssetTypeDto,
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(120),
  dataBase64: z.string().trim().min(1)
});

export const itemTypeParamsDto = z.object({
  workspaceId: z.string().uuid(),
  typeId: z.string().uuid()
});

export const customerParamsDto = z.object({
  workspaceId: z.string().uuid(),
  customerId: z.string().uuid()
});

export const customerUserLinkParamsDto = z.object({
  workspaceId: z.string().uuid(),
  customerId: z.string().uuid(),
  memberUserId: z.string().uuid()
});

export const customerListQueryDto = z.object({
  search: z.string().trim().max(160).optional(),
  status: customerStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().uuid().optional(),
  paged: z
    .union([z.literal('true'), z.literal('1'), z.literal(true)])
    .optional()
    .transform(Boolean)
});

export const createCustomerDto = z.object({
  name: z.string().trim().min(2).max(180),
  tradeName: z.string().trim().max(180).nullable().optional(),
  legalName: z.string().trim().max(180).nullable().optional(),
  document: z.string().trim().max(40).nullable().optional(),
  stateRegistration: z.string().trim().max(40).nullable().optional(),
  municipalRegistration: z.string().trim().max(40).nullable().optional(),
  taxRegime: z.string().trim().max(80).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  website: z.string().trim().max(180).nullable().optional(),
  logoUrl: z.string().trim().max(600).nullable().optional(),
  address: customerAddressDto.nullable().optional(),
  status: customerStatusEnum.optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  sourceWorkItemId: z.string().uuid().nullable().optional()
});

export const patchCustomerDto = createCustomerDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const createItemTypeDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  usageRules: z.record(z.unknown()).optional(),
  acceptsParent: z.boolean().optional(),
  acceptsChecklist: z.boolean().optional(),
  acceptsDueDate: z.boolean().optional(),
  acceptsAssignee: z.boolean().optional(),
  acceptsTags: z.boolean().optional(),
  acceptsCustomFields: z.boolean().optional()
});

export const patchItemTypeDto = createItemTypeDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const workflowStateParamsDto = z.object({
  workspaceId: z.string().uuid(),
  stateId: z.string().uuid()
});

export const createWorkflowStateDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(1).optional(),
  category: z.string().optional(),
  color: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  isEditable: z.boolean().optional()
});

export const patchWorkflowStateDto = createWorkflowStateDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const boardColumnParamsDto = z.object({
  workspaceId: z.string().uuid(),
  columnId: z.string().uuid()
});

export const createBoardColumnDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  wipLimit: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  stateIds: z.array(z.string().uuid()).optional()
});

export const patchBoardColumnDto = createBoardColumnDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const tagParamsDto = z.object({
  workspaceId: z.string().uuid(),
  tagId: z.string().uuid()
});

export const createTagDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(1).optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional()
});

export const patchTagDto = createTagDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const customFieldParamsDto = z.object({
  workspaceId: z.string().uuid(),
  fieldId: z.string().uuid()
});

const customFieldOptionDto = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  color: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional()
});

export const createCustomFieldDto = z.object({
  name: z.string().min(2),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  variableKey: fieldVariableKeyDto,
  variableLabel: z.string().trim().max(120).nullable().optional(),
  variableDescription: z.string().trim().max(500).nullable().optional(),
  type: customFieldTypeEnum,
  required: z.boolean().optional(),
  isEditable: z.boolean().optional(),
  isRemovable: z.boolean().optional(),
  order: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  settings: z.record(z.unknown()).optional(),
  options: z.array(customFieldOptionDto).optional(),
  scopeTypeIds: z.array(z.string().uuid()).optional()
});

export const patchCustomFieldDto = createCustomFieldDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const workItemFieldBindingInputDto = z.object({
  fieldDefinitionId: z.string().uuid(),
  displayContext: z.enum(['card', 'detail']),
  order: z.number().int().nonnegative(),
  section: z.string().nullable().optional(),
  isVisible: z.boolean().optional(),
  isRequiredOverride: z.boolean().nullable().optional(),
  isReadonlyOverride: z.boolean().nullable().optional(),
  settings: z.record(z.unknown()).nullable().optional()
});

export const replaceItemTypeFieldBindingsDto = z.object({
  bindings: z.array(workItemFieldBindingInputDto)
});

export const patchPreferencesDto = z
  .object({
    defaultBoardMode: z.string().min(1).optional(),
    dateFormat: z.string().min(1).optional(),
    visibleCardFieldIds: z.array(z.string().min(1)).optional(),
    visibleFieldsByType: z.record(z.array(z.string().min(1))).optional(),
    detailVisibleFieldsByType: z.record(z.array(z.string().min(1))).optional(),
    settings: z.record(z.unknown()).optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

export const resetWorkspaceTemplateDto = z.object({
  templateKey: workspaceTemplateKeyEnum.optional()
});

export const workItemParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid()
});

export const workItemDocumentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid(),
  documentId: z.string().uuid()
});

export const createWorkItemDto = z.object({
  boardId: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  typeId: z.string().uuid().optional(),
  typeSlug: z.string().min(1).optional(),
  stateId: z.string().uuid().optional(),
  stateSlug: z.string().min(1).optional(),
  columnId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  position: z.number().int().optional(),
  checklist: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  fields: z.record(z.unknown()).optional(),
  tags: z.array(z.string().uuid()).optional(),
  customFieldValues: z.record(z.unknown()).optional()
});

export const patchWorkItemDto = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    typeId: z.string().uuid().optional(),
    typeSlug: z.string().min(1).optional(),
    stateId: z.string().uuid().optional(),
    stateSlug: z.string().min(1).optional(),
    columnId: z.string().uuid().optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    position: z.number().int().optional(),
    checklist: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    fields: z.record(z.unknown()).optional(),
    customFieldValues: z.record(z.unknown()).optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

export const bulkUpdateWorkItemsDto = z
  .object({
    itemIds: z.array(z.string().uuid()).min(1).max(200),
    patch: z.object({
      stateId: z.string().uuid().optional(),
      stateSlug: z.string().trim().min(1).max(80).optional(),
      assigneeId: z.string().uuid().nullable().optional(),
      priority: z.number().int().min(0).max(4).optional(),
      archived: z.boolean().optional()
    })
  })
  .refine(
    (payload) =>
      payload.patch.stateId !== undefined ||
      payload.patch.stateSlug !== undefined ||
      payload.patch.assigneeId !== undefined ||
      payload.patch.priority !== undefined ||
      payload.patch.archived !== undefined,
    {
      message: 'At least one bulk patch field is required',
      path: ['patch']
    }
  );

const workItemListColumnDto = z
  .object({
    id: z.string().trim().min(1).max(160),
    fieldKey: z.string().trim().min(1).max(160),
    fieldId: z.string().trim().min(1).max(160).optional(),
    label: z.string().trim().max(160),
    type: z.string().trim().min(1).max(80),
    visible: z.boolean(),
    pinned: z.union([z.enum(['left', 'right']), z.literal(false)]).optional(),
    width: z.number().int().min(40).max(800).optional(),
    minWidth: z.number().int().min(40).max(800).optional(),
    sortable: z.boolean().optional(),
    filterable: z.boolean().optional(),
    editableInline: z.boolean().optional(),
    required: z.boolean().optional(),
    order: z.number().int().min(0).max(100_000),
    cellRenderer: z.string().trim().max(120).optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    format: z.string().trim().max(120).optional(),
    permissions: z.record(z.unknown()).optional()
  })
  .strict();

export const workItemListConfigDto = z
  .object({
    id: z.string().trim().min(1).max(240),
    workspaceId: z.string().trim().min(1).max(120),
    workItemTypeId: z.string().trim().min(1).max(120),
    schemaVersion: z.number().int().min(1),
    name: z.string().trim().min(1).max(160),
    columns: z.array(workItemListColumnDto).min(1).max(80),
    defaultSort: z
      .object({
        sortBy: z.string().trim().max(80).optional(),
        sortDirection: z.enum(['asc', 'desc']).optional()
      })
      .optional()
      .default({}),
    defaultFilters: z.record(z.unknown()).optional().default({}),
    density: z.enum(['comfortable', 'compact']).optional().default('compact'),
    rowActions: z.array(z.string().trim().min(1).max(80)).optional().default([]),
    bulkActions: z.array(z.string().trim().min(1).max(80)).optional().default([]),
    mobileCardLayout: z.object({
      titleField: z.string().trim().min(1).max(160),
      subtitleFields: z.array(z.string().trim().min(1).max(160)).optional().default([]),
      badgeFields: z.array(z.string().trim().min(1).max(160)).optional().default([]),
      primaryMetaFields: z.array(z.string().trim().min(1).max(160)).optional().default([]),
      secondaryMetaFields: z.array(z.string().trim().min(1).max(160)).optional().default([]),
      actions: z.array(z.string().trim().min(1).max(80)).optional().default([])
    }),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    updatedBy: z.string().nullable().optional()
  })
  .strict();

const scheduleDateValueDto = z.string().trim().min(1).nullable();

export const patchWorkItemScheduleDto = z
  .object({
    plannedStartAt: scheduleDateValueDto.optional(),
    plannedEndAt: scheduleDateValueDto.optional(),
    reason: z.string().trim().min(1).max(120).optional()
  })
  .refine((obj) => obj.plannedStartAt !== undefined || obj.plannedEndAt !== undefined, {
    message: 'At least one schedule field is required'
  })
  .superRefine((obj, ctx) => {
    const start = obj.plannedStartAt ? new Date(obj.plannedStartAt).getTime() : null;
    const end = obj.plannedEndAt ? new Date(obj.plannedEndAt).getTime() : null;

    if (obj.plannedStartAt && Number.isNaN(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plannedStartAt'],
        message: 'Invalid planned start date'
      });
    }

    if (obj.plannedEndAt && Number.isNaN(end)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plannedEndAt'],
        message: 'Invalid planned end date'
      });
    }

    if (start !== null && end !== null && !Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plannedEndAt'],
        message: 'Planned end must be after planned start'
      });
    }
  });

export const workItemTypeTransformationDto = z
  .object({
    transformationId: z.string().trim().min(1).optional(),
    toTypeId: z.string().uuid().optional(),
    toTypeSlug: z.string().trim().min(1).max(80).optional(),
    stateId: z.string().uuid().optional(),
    stateSlug: z.string().trim().min(1).max(80).optional(),
    customFieldValues: z.record(z.unknown()).optional(),
    defaultValuesForNewFields: z.record(z.unknown()).optional()
  })
  .refine((payload) => Boolean(payload.transformationId || payload.toTypeId || payload.toTypeSlug), {
    message: 'transformationId, toTypeId or toTypeSlug is required'
  });

export const convertWorkItemToCustomerDto = z
  .object({
    customerId: z.string().uuid().optional(),
    customer: createCustomerDto.optional(),
    fields: z.record(z.unknown()).optional(),
    customFieldValues: z.record(z.unknown()).optional()
  })
  .refine((payload) => Boolean(payload.customerId || payload.customer), {
    message: 'customerId or customer is required'
  });

export const moveWorkItemDto = z.object({
  columnId: z.string().uuid(),
  position: z.number().int().optional(),
  stateId: z.string().uuid().optional()
});

export const transitionWorkItemDto = z.object({
  stateId: z.string().uuid(),
  columnId: z.string().uuid().optional()
});

export const fieldValueParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid(),
  fieldId: z.string().uuid()
});

export const patchWorkItemCustomFieldValueDto = z.object({
  value: z.unknown()
});

export const workItemTagParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid(),
  tagId: z.string().uuid()
});

export const workspaceMemberAccessParamsDto = z.object({
  workspaceId: z.string().uuid(),
  memberUserId: z.string().uuid()
});

const permissionStringDto = z
  .string()
  .min(1)
  .refine((value) => isPermission(value), { message: 'Invalid permission key' });

const moduleKeyDto = z
  .string()
  .min(1)
  .refine((value) => workspaceModuleCatalog.includes(value as (typeof workspaceModuleCatalog)[number]), {
    message: 'Invalid module key'
  });

export const patchWorkspaceMemberAccessDto = z
  .object({
    role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER', 'CLIENT']).optional(),
    permissions: z
      .object({
        allow: z.array(permissionStringDto).optional(),
        deny: z.array(permissionStringDto).optional(),
        groupIds: z.array(z.string().min(1)).optional(),
        allowedModules: z.array(moduleKeyDto).optional(),
        allowedBoardViewKeys: z.array(z.string().min(1)).optional(),
        ownCardsOnly: z.boolean().optional()
      })
      .optional()
  })
  .refine((obj) => obj.role !== undefined || obj.permissions !== undefined, {
    message: 'At least one field is required'
  });

export const patchWorkspaceModuleEntitlementsDto = z
  .object({
    moduleEntitlements: z.record(moduleKeyDto, z.boolean())
  })
  .refine((obj) => Object.keys(obj.moduleEntitlements).length > 0, {
    message: 'At least one module entitlement is required'
  });

const accessGroupBaseDto = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  allow: z.array(permissionStringDto).optional(),
  deny: z.array(permissionStringDto).optional(),
  allowedModules: z.array(moduleKeyDto).optional(),
  allowedBoardViewKeys: z.array(z.string().trim().min(1)).optional(),
  ownCardsOnly: z.boolean().optional()
});

export const createWorkspaceAccessGroupDto = accessGroupBaseDto;
export const patchWorkspaceAccessGroupDto = accessGroupBaseDto.partial().refine((obj) => Object.keys(obj).length > 0, {
  message: 'At least one field is required'
});

export const workspaceAccessGroupParamsDto = z.object({
  workspaceId: z.string().uuid(),
  groupId: z.string().min(1)
});

export const workspaceInviteParamsDto = z.object({
  workspaceId: z.string().uuid(),
  inviteId: z.string().uuid()
});

export const createWorkspaceInviteDto = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER', 'CLIENT']).default('MEMBER')
});

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
  'multi_select',
  'user',
  'checklist',
  'priority',
  'status',
  'tag',
  'schedule',
  'work_item_type'
]);

const workspaceTemplateKeyEnum = z.enum([
  'software_delivery',
  'product_discovery',
  'operations_kanban'
]);

export const workspaceIdParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const workspaceSnapshotQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional()
});

export const workspaceDocumentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid()
});

export const createWorkspaceDocumentDto = z.object({
  title: z.string().trim().min(1).max(180),
  content: z.string().max(200_000).optional(),
  position: z.number().int().nonnegative().optional()
});

export const patchWorkspaceDocumentDto = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    content: z.string().max(200_000).optional(),
    position: z.number().int().nonnegative().optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

export const itemTypeParamsDto = z.object({
  workspaceId: z.string().uuid(),
  typeId: z.string().uuid()
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
    role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional(),
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
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER')
});

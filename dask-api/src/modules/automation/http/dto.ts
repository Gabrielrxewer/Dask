import { z } from 'zod';

export const workspaceIdParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const automationRuleParamsDto = z.object({
  workspaceId: z.string().uuid(),
  ruleId: z.string().uuid()
});

export const listAutomationRulesQueryDto = z.object({
  includeDisabled: z.coerce.boolean().optional()
});

export const listAutomationExecutionsQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const createAutomationRuleDto = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional(),
  trigger: z.record(z.unknown()),
  conditions: z.record(z.unknown()).optional(),
  actions: z.array(z.record(z.unknown())).min(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10000).optional()
});

export const patchAutomationRuleDto = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    trigger: z.record(z.unknown()).optional(),
    conditions: z.record(z.unknown()).optional(),
    actions: z.array(z.record(z.unknown())).min(1).optional(),
    enabled: z.boolean().optional(),
    priority: z.number().int().min(0).max(10000).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const runAutomationRuleDto = z.object({
  workspaceId: z.string().uuid().optional(),
  context: z.record(z.unknown()).default({})
});

export const automationViewParamsDto = z.object({
  workspaceId: z.string().uuid(),
  viewId: z.string().uuid()
});

export const automationViewColumnParamsDto = z.object({
  workspaceId: z.string().uuid(),
  viewId: z.string().uuid(),
  columnId: z.string().uuid()
});

const automationViewColumnPayloadDto = z.object({
  key: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  color: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  settings: z.record(z.unknown()).optional()
});

export const createAutomationViewDto = z.object({
  key: z.string().min(1),
  name: z.string().min(2),
  description: z.string().optional(),
  position: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
  columns: z.array(automationViewColumnPayloadDto).optional()
});

export const patchAutomationViewDto = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    position: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    settings: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const createAutomationViewColumnDto = automationViewColumnPayloadDto;

export const patchAutomationViewColumnDto = z
  .object({
    name: z.string().min(2).optional(),
    description: z.string().nullable().optional(),
    color: z.string().optional(),
    position: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    isTerminal: z.boolean().optional(),
    settings: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const itemPlacementParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid(),
  viewId: z.string().uuid()
});

export const listItemPlacementsParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid()
});

export const upsertItemPlacementDto = z.object({
  columnId: z.string().uuid(),
  position: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional()
});

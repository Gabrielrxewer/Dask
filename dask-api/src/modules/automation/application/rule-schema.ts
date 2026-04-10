import { z } from 'zod';
import { AppError } from '@/core/errors/app-error';

export const automationTriggerTypeSchema = z.enum([
  'item.created',
  'item.updated',
  'item.moved',
  'item.state.changed',
  'manual'
]);

export type AutomationTriggerType = z.infer<typeof automationTriggerTypeSchema>;

export const automationTriggerSchema = z.object({
  type: automationTriggerTypeSchema,
  settings: z.record(z.unknown()).optional()
});

export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;

const nonEmptyStringArray = z.array(z.string().min(1)).min(1);

const idOrKeyRefinement = (
  value: { targetViewId?: string; targetViewKey?: string },
  context: z.RefinementCtx
): void => {
  if (!value.targetViewId && !value.targetViewKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either targetViewId or targetViewKey is required.'
    });
  }
};

const viewAndColumnRefinement = (
  value: {
    targetViewId?: string;
    targetViewKey?: string;
    targetColumnId?: string;
    targetColumnKey?: string;
  },
  context: z.RefinementCtx
): void => {
  idOrKeyRefinement(value, context);

  if (!value.targetColumnId && !value.targetColumnKey) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either targetColumnId or targetColumnKey is required.'
    });
  }
};

export const setViewColumnActionSchema = z
  .object({
    type: z.literal('set_view_column'),
    targetViewId: z.string().uuid().optional(),
    targetViewKey: z.string().min(1).optional(),
    targetColumnId: z.string().uuid().optional(),
    targetColumnKey: z.string().min(1).optional(),
    mode: z.enum(['upsert', 'replace']).default('upsert'),
    position: z.number().int().nonnegative().optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .superRefine(viewAndColumnRefinement);

export const removeFromViewActionSchema = z
  .object({
    type: z.literal('remove_from_view'),
    targetViewId: z.string().uuid().optional(),
    targetViewKey: z.string().min(1).optional()
  })
  .superRefine(idOrKeyRefinement);

export const setWorkItemStateActionSchema = z
  .object({
    type: z.literal('set_work_item_state'),
    stateId: z.string().uuid().optional(),
    stateSlug: z.string().min(1).optional(),
    status: z.string().min(1).optional()
  })
  .superRefine((value, context) => {
    if (!value.stateId && !value.stateSlug && !value.status) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one of stateId, stateSlug or status is required.'
      });
    }
  });

export const automationActionSchema = z.union([
  setViewColumnActionSchema,
  removeFromViewActionSchema,
  setWorkItemStateActionSchema
]);

export type AutomationAction = z.infer<typeof automationActionSchema>;

export const automationConditionsSchema = z
  .object({
    sourceViewIds: z.array(z.string().uuid()).min(1).optional(),
    sourceViewKeys: nonEmptyStringArray.optional(),
    fromColumnIds: z.array(z.string().uuid()).min(1).optional(),
    fromColumnKeys: nonEmptyStringArray.optional(),
    toViewIds: z.array(z.string().uuid()).min(1).optional(),
    toViewKeys: nonEmptyStringArray.optional(),
    toColumnIds: z.array(z.string().uuid()).min(1).optional(),
    toColumnKeys: nonEmptyStringArray.optional(),
    itemTypeIds: z.array(z.string().uuid()).min(1).optional(),
    itemTypeSlugs: nonEmptyStringArray.optional(),
    statuses: nonEmptyStringArray.optional(),
    assigneeIds: z.array(z.string().uuid()).min(1).optional(),
    priorities: z.array(z.number().int().min(0).max(4)).min(1).optional()
  })
  .strict();

export type AutomationConditions = z.infer<typeof automationConditionsSchema>;

export const automationRuleSpecSchema = z.object({
  trigger: automationTriggerSchema,
  conditions: automationConditionsSchema.optional(),
  actions: z.array(automationActionSchema).min(1)
});

export type AutomationRuleSpec = z.infer<typeof automationRuleSpecSchema>;

export type AutomationEventContext = {
  itemId?: string;
  workspaceId?: string;
  sourceViewId?: string | null;
  sourceViewKey?: string | null;
  fromColumnId?: string | null;
  fromColumnKey?: string | null;
  toViewId?: string | null;
  toViewKey?: string | null;
  toColumnId?: string | null;
  toColumnKey?: string | null;
  itemTypeId?: string | null;
  itemTypeSlug?: string | null;
  status?: string | null;
  assigneeId?: string | null;
  priority?: number | null;
};

function includesString(expected: readonly string[] | undefined, actual: string | null | undefined): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  if (!actual) {
    return false;
  }

  return expected.includes(actual);
}

function includesNumber(expected: readonly number[] | undefined, actual: number | null | undefined): boolean {
  if (!expected || expected.length === 0) {
    return true;
  }

  if (typeof actual !== 'number') {
    return false;
  }

  return expected.includes(actual);
}

export function matchesConditions(
  conditions: AutomationConditions | undefined,
  context: AutomationEventContext
): boolean {
  if (!conditions) {
    return true;
  }

  return (
    includesString(conditions.sourceViewIds, context.sourceViewId) &&
    includesString(conditions.sourceViewKeys, context.sourceViewKey) &&
    includesString(conditions.fromColumnIds, context.fromColumnId) &&
    includesString(conditions.fromColumnKeys, context.fromColumnKey) &&
    includesString(conditions.toViewIds, context.toViewId) &&
    includesString(conditions.toViewKeys, context.toViewKey) &&
    includesString(conditions.toColumnIds, context.toColumnId) &&
    includesString(conditions.toColumnKeys, context.toColumnKey) &&
    includesString(conditions.itemTypeIds, context.itemTypeId) &&
    includesString(conditions.itemTypeSlugs, context.itemTypeSlug) &&
    includesString(conditions.statuses, context.status) &&
    includesString(conditions.assigneeIds, context.assigneeId) &&
    includesNumber(conditions.priorities, context.priority)
  );
}

export function parseRuleSpec(payload: {
  trigger: unknown;
  conditions?: unknown;
  actions: unknown;
}): AutomationRuleSpec {
  const parsed = automationRuleSpecSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError('Invalid automation rule specification.', 422, {
      issues: parsed.error.flatten()
    });
  }

  return parsed.data;
}

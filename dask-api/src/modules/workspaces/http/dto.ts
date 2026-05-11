import { z } from 'zod';

const workspaceTemplateKeyDto = z.enum([
  'software_delivery',
  'product_discovery',
  'operations_kanban',
  'commercial_crm'
]);

export const createWorkspaceDto = z.object({
  kind: z.enum(['PERSONAL', 'CORPORATE']),
  organizationId: z.string().uuid().optional(),
  name: z.string().min(2),
  key: z.string().min(2).max(20),
  templateKey: workspaceTemplateKeyDto.optional(),
  config: z.record(z.unknown()).optional()
}).superRefine((value, context) => {
  if (value.kind === 'CORPORATE' && !value.organizationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organizationId'],
      message: 'organizationId is required for corporate workspace'
    });
  }

  if (value.kind === 'PERSONAL' && value.organizationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organizationId'],
      message: 'personal workspace must not contain organizationId'
    });
  }
});

export const provisionWorkspaceDto = z.object({
  kind: z.enum(['PERSONAL', 'CORPORATE']),
  workspaceName: z.string().min(2),
  workspaceKey: z.string().min(2).max(20).optional(),
  templateKey: workspaceTemplateKeyDto.optional(),
  organizationName: z.string().min(2).optional(),
  organizationSlug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional()
}).superRefine((value, context) => {
  if (value.kind === 'CORPORATE' && !value.organizationName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organizationName'],
      message: 'organizationName is required for corporate workspace'
    });
  }

  if (value.kind === 'PERSONAL' && value.organizationName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organizationName'],
      message: 'organizationName must be empty for personal workspace'
    });
  }
});

export const workspaceTemplateCatalogQueryDto = z.object({
  includeDescriptions: z.coerce.boolean().optional()
});

export const createBoardDto = z.object({
  templateId: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional()
});

export const createTemplateDto = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  schema: z.record(z.unknown()),
  rules: z.record(z.unknown()).optional()
});

export const workspaceIdParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const boardSnapshotParamsDto = z.object({
  workspaceId: z.string().uuid(),
  boardId: z.string().uuid()
});

export const boardSnapshotQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const patchWorkspaceDto = z
  .object({
    name: z.string().min(2).optional(),
    key: z
      .string()
      .min(2)
      .max(20)
      .regex(/^[A-Z0-9]+$/)
      .optional(),
    info: z
      .object({
        description: z.string().max(500).optional(),
        company: z.string().max(120).optional(),
        website: z.string().url().max(255).optional()
      })
      .optional()
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

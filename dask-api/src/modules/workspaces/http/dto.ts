import { z } from 'zod';

export const createWorkspaceDto = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  key: z.string().min(2).max(20),
  config: z.record(z.unknown()).optional()
});

export const createBoardDto = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional()
});

export const createTemplateDto = z.object({
  workspaceId: z.string().uuid(),
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

import { z } from 'zod';

export const workspaceAuditParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const listWorkspaceAuditEventsQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

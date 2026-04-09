import { z } from 'zod';

export const searchQueryDto = z.object({
  q: z.string().min(1),
  workspaceId: z.string().uuid().optional(),
  boardId: z.string().uuid().optional(),
  status: z.string().optional(),
  itemType: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional()
});

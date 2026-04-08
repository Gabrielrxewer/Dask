import { z } from 'zod';

export const createItemDto = z.object({
  boardId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  columnId: z.string().uuid().optional(),
  type: z.enum(['CARD', 'TASK', 'NOTE']),
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.string().min(1),
  fields: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const updateItemDto = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.string().min(1).optional(),
    columnId: z.string().uuid().optional(),
    fields: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .refine((obj: Record<string, unknown>) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

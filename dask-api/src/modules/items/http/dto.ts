import { z } from 'zod';

export const createItemDto = z.object({
  boardId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  columnId: z.string().uuid().optional(),
  boardColumnId: z.string().uuid().optional(),
  type: z.string().min(1),
  typeId: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.string().min(1),
  stateId: z.string().uuid().optional(),
  fields: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  checklist: z.record(z.unknown()).optional(),
  assigneeId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional(),
  position: z.number().int().optional(),
  updatedBy: z.string().uuid().optional()
});

export const updateItemDto = z
  .object({
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    status: z.string().min(1).optional(),
    stateId: z.string().uuid().optional(),
    columnId: z.string().uuid().optional(),
    boardColumnId: z.string().uuid().optional(),
    type: z.string().min(1).optional(),
    typeId: z.string().uuid().optional(),
    fields: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
    checklist: z.record(z.unknown()).optional(),
    assigneeId: z.string().uuid().optional(),
    parentId: z.string().uuid().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    position: z.number().int().optional(),
    updatedBy: z.string().uuid().optional()
  })
  .refine((obj: Record<string, unknown>) => Object.keys(obj).length > 0, {
    message: 'At least one field is required'
  });

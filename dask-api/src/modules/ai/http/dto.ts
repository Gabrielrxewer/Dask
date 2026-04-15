import { z } from 'zod';

export const aiWorkspaceParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const aiWorkspaceAgentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid()
});

export const aiWorkspaceItemParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid()
});

export const aiWorkspaceItemAgentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  itemId: z.string().uuid(),
  agentId: z.string().uuid()
});

export const createAiAgentDto = z.object({
  key: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-_]+$/),
  name: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  model: z.string().min(2).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().min(10),
  config: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional()
});

export const patchAiAgentDto = z
  .object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(400).nullable().optional(),
    model: z.string().min(2).optional(),
    temperature: z.number().min(0).max(2).optional(),
    systemPrompt: z.string().min(10).optional(),
    config: z.record(z.unknown()).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const runAgentOnItemDto = z.object({
  instruction: z.string().min(2).max(4_000),
  includeSemanticContext: z.boolean().default(true),
  topKContextDocs: z.number().int().min(1).max(10).default(5)
});

export const runRiskAnalysisDto = z.object({
  includeSemanticContext: z.boolean().default(true),
  topKContextDocs: z.number().int().min(1).max(10).default(5)
});

export const listAiRunsQueryDto = z.object({
  itemId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

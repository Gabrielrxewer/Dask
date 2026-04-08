import { z } from 'zod';

export const createAutomationRuleDto = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(2),
  trigger: z.record(z.unknown()),
  conditions: z.record(z.unknown()).optional(),
  actions: z.record(z.unknown())
});

export const runAutomationRuleDto = z.object({
  context: z.record(z.unknown()).default({})
});

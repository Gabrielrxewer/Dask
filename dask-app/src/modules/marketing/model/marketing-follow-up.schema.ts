import { z } from "zod";

export const marketingFollowUpPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const createMarketingFollowUpSchema = z.object({
  signalId: z.string().uuid(),
  leadId: z.string().uuid(),
  title: z.string().trim().min(2, "Informe um titulo.").max(160),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.string().trim().nullable().optional().refine((value) => {
    return !value || !Number.isNaN(new Date(value).getTime());
  }, "Data do follow-up invalida."),
  priority: marketingFollowUpPrioritySchema.default("medium"),
  createWorkItem: z.boolean().default(true),
  boardId: z.string().uuid().optional(),
  workflowStateId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional()
});

export type CreateMarketingFollowUpValues = z.infer<typeof createMarketingFollowUpSchema>;

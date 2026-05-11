import { z } from "zod";

export const marketingJourneyNodeKindSchema = z.enum(["TRIGGER", "CONDITION", "DELAY", "ACTION", "EXIT"]);

export const marketingJourneyTriggerSchema = z.object({
  event: z.enum([
    "lead.created",
    "lead.status_changed",
    "lead.score_updated",
    "invoice.overdue",
    "campaign.opened",
    "campaign.clicked",
    "form.submitted",
    "manual"
  ]),
  segmentId: z.string().uuid().optional(),
  filters: z.record(z.string(), z.unknown()).optional()
});

export const marketingJourneyActionSchema = z.object({
  type: z.enum([
    "send_campaign",
    "update_score",
    "move_lead",
    "create_task",
    "notify_user",
    "start_flow",
    "tag_lead",
    "webhook"
  ]),
  campaignId: z.string().uuid().optional(),
  scoreChange: z.coerce.number().optional(),
  targetStatus: z.string().trim().optional(),
  taskTitle: z.string().trim().optional(),
  notifyUserId: z.string().uuid().optional(),
  targetFlowId: z.string().uuid().optional(),
  tag: z.string().trim().optional(),
  webhookUrl: z.string().url().optional(),
  label: z.string().trim().optional()
});

export const marketingJourneyConditionSchema = z.object({
  logic: z.enum(["AND", "OR"]),
  rules: z.array(z.object({
    field: z.string().trim().min(1),
    operator: z.enum(["eq", "neq", "gte", "lte", "contains", "in", "is_true", "is_false"]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional()
  })).min(1),
  yesLabel: z.string().trim().optional(),
  noLabel: z.string().trim().optional()
});

export const marketingJourneyDelaySchema = z.object({
  duration: z.coerce.number().int().positive(),
  unit: z.enum(["minutes", "hours", "days", "weeks"])
});

export const marketingJourneyExitSchema = z.object({
  reason: z.string().trim().optional()
});

export const marketingJourneyNodeSchema = z.object({
  id: z.string().trim().min(1),
  type: marketingJourneyNodeKindSchema,
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.object({
    kind: marketingJourneyNodeKindSchema,
    label: z.string().trim().min(1),
    validation: z.enum(["valid", "incomplete", "error"]),
    config: z.union([
      marketingJourneyTriggerSchema,
      marketingJourneyActionSchema,
      marketingJourneyConditionSchema,
      marketingJourneyDelaySchema,
      marketingJourneyExitSchema
    ])
  }).passthrough()
});

export type MarketingJourneyNodeValues = z.infer<typeof marketingJourneyNodeSchema>;

import { z } from "zod";
import { marketingJourneyNodeSchema, marketingJourneyTriggerSchema } from "@/modules/marketing/model/marketing-node.schema";

export const marketingJourneyEdgeSchema = z.object({
  id: z.string().trim().min(1),
  source: z.string().trim().min(1),
  target: z.string().trim().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: z.object({
    label: z.string().optional(),
    branchType: z.enum(["yes", "no", "default"]).optional()
  }).optional()
}).passthrough();

export const marketingJourneyStepSchema = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["TRIGGER", "CONDITION", "DELAY", "ACTION", "BRANCH", "EXIT"]),
  position: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()).default({}),
  nextStepId: z.string().optional()
});

export const marketingJourneyDefinitionSchema = z.object({
  version: z.literal(1),
  id: z.string().optional(),
  workspaceId: z.string().optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1200).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).default("DRAFT"),
  trigger: marketingJourneyTriggerSchema,
  nodes: z.array(marketingJourneyNodeSchema).min(1),
  edges: z.array(marketingJourneyEdgeSchema),
  steps: z.array(marketingJourneyStepSchema),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type MarketingJourneyDefinition = z.infer<typeof marketingJourneyDefinitionSchema>;
export type MarketingJourneyStep = z.infer<typeof marketingJourneyStepSchema>;

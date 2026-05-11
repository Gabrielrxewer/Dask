import { z } from 'zod';

export const workspaceParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const campaignParamsDto = z.object({
  workspaceId: z.string().uuid(),
  campaignId: z.string().uuid()
});

export const campaignVariantParamsDto = z.object({
  workspaceId: z.string().uuid(),
  campaignId: z.string().uuid(),
  variantId: z.string().uuid()
});

export const segmentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  segmentId: z.string().uuid()
});

export const templateParamsDto = z.object({
  workspaceId: z.string().uuid(),
  templateId: z.string().uuid()
});

export const campaignListQueryDto = z.object({
  status: z
    .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
    .optional(),
  objective: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const audienceQueryDto = z.object({
  search: z.string().trim().min(1).max(160).optional(),
  stage: z.string().trim().min(1).max(80).optional(),
  consentStatus: z.enum(['OPT_IN', 'OPT_OUT', 'UNSUBSCRIBED', 'UNKNOWN']).optional(),
  limit: z.coerce.number().int().min(1).max(400).optional()
});

const campaignVariantDto = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(220),
  preheader: z.string().trim().max(280).optional(),
  bodyMarkdown: z.string().min(1).max(200000),
  bodyHtml: z.string().max(300000).optional(),
  weight: z.number().int().min(1).max(1000).optional(),
  isControl: z.boolean().optional()
});

export const createCampaignDto = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  objective: z.enum([
    'LEAD_NURTURE',
    'ONBOARDING',
    'REACTIVATION',
    'BILLING_REMINDER',
    'RENEWAL',
    'EXPANSION',
    'PRODUCT_UPDATE',
    'NEWSLETTER',
    'CUSTOM'
  ]),
  channel: z.enum(['EMAIL', 'NEWSLETTER']).default('EMAIL'),
  hypothesis: z.string().trim().max(2000).optional(),
  persona: z.string().trim().max(160).optional(),
  icp: z.string().trim().max(200).optional(),
  offer: z.string().trim().max(200).optional(),
  productRef: z.string().trim().max(120).optional(),
  billingContext: z.string().trim().max(240).optional(),
  segmentId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  senderProfileId: z.string().uuid().optional(),
  abTestEnabled: z.boolean().optional(),
  variants: z.array(campaignVariantDto).max(6).optional()
});

export const updateCampaignDto = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(4000).optional(),
    objective: z
      .enum([
        'LEAD_NURTURE',
        'ONBOARDING',
        'REACTIVATION',
        'BILLING_REMINDER',
        'RENEWAL',
        'EXPANSION',
        'PRODUCT_UPDATE',
        'NEWSLETTER',
        'CUSTOM'
      ])
      .optional(),
    status: z
      .enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
      .optional(),
    persona: z.string().trim().max(160).optional(),
    icp: z.string().trim().max(200).optional(),
    offer: z.string().trim().max(200).optional(),
    segmentId: z.string().uuid().nullable().optional(),
    templateId: z.string().uuid().nullable().optional(),
    senderProfileId: z.string().uuid().nullable().optional(),
    abTestEnabled: z.boolean().optional(),
    abTestConfig: z.record(z.unknown()).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const scheduleCampaignDto = z.object({
  scheduledAt: z.coerce.date()
});

export const sendTestEmailDto = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().max(220).optional(),
  content: z.string().max(200000).optional()
});

const segmentRuleDto = z.object({
  field: z.string().trim().min(1).max(80),
  operator: z.enum([
    'eq',
    'neq',
    'gte',
    'lte',
    'contains',
    'in',
    'before_days',
    'after_days',
    'is_true',
    'is_false'
  ]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]).optional()
});

export const segmentFilterDto = z.object({
  logic: z.enum(['AND', 'OR']).optional(),
  rules: z.array(segmentRuleDto).max(80)
});

export const createSegmentDto = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1200).optional(),
  kind: z.enum(['STATIC', 'DYNAMIC']).optional(),
  filters: segmentFilterDto
});

export const updateSegmentDto = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(1200).optional(),
    kind: z.enum(['STATIC', 'DYNAMIC']).optional(),
    filters: segmentFilterDto.optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const createTemplateDto = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(180).optional(),
  category: z.string().trim().max(80).optional(),
  objective: z.string().trim().max(80).optional(),
  funnelStage: z.string().trim().max(80).optional(),
  subject: z.string().trim().min(1).max(220),
  bodyMarkdown: z.string().min(1).max(200000),
  bodyHtml: z.string().max(300000).optional(),
  blocks: z.record(z.unknown()).optional()
});

export const updateTemplateDto = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    category: z.string().trim().max(80).optional(),
    objective: z.string().trim().max(80).nullable().optional(),
    funnelStage: z.string().trim().max(80).optional(),
    subject: z.string().trim().min(1).max(220).optional(),
    bodyMarkdown: z.string().min(1).max(200000).optional(),
    bodyHtml: z.string().max(300000).optional(),
    blocks: z.record(z.unknown()).optional(),
    isArchived: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required'
  });

export const sendTemplateTestEmailDto = z.object({
  to: z.string().trim().email(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

const automationStepDto = z.object({
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['TRIGGER', 'CONDITION', 'DELAY', 'ACTION', 'BRANCH', 'EXIT']),
  position: z.number().int().min(0).optional(),
  config: z.record(z.unknown()).optional(),
  nextStepId: z.string().uuid().optional()
});

export const createAutomationFlowDto = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1200).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  triggerDefinition: z.record(z.unknown()),
  entryCriteria: z.record(z.unknown()).optional(),
  exitCriteria: z.record(z.unknown()).optional(),
  steps: z.array(automationStepDto).max(40).optional()
});

export const aiGenerateCampaignDto = z.object({
  objective: z.string().trim().min(2).max(200),
  tone: z.string().trim().max(120).optional(),
  targetStage: z.string().trim().max(120).optional(),
  segmentHint: z.string().trim().max(200).optional(),
  documentLimit: z.number().int().min(1).max(12).optional()
});

export const aiImproveVariantDto = z.object({
  objective: z.string().trim().max(200).optional(),
  tone: z.string().trim().max(120).optional()
});

export const signalInboxQueryDto = z.object({
  types: z.string().trim().optional(),
  includeDismissed: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const signalEventParamsDto = z.object({
  workspaceId: z.string().uuid(),
  eventId: z.string().uuid()
});

export const markSignalDto = z.object({
  action: z.enum(['seen', 'dismissed'])
});

export const createSignalFollowUpDto = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  createWorkItem: z.boolean().default(false),
  boardId: z.string().uuid().optional(),
  workflowStateId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().nullable().optional()
});

export const providerWebhookParamsDto = z.object({
  provider: z.string().trim().min(1).max(40)
});

export const providerWebhookBodyDto = z.object({
  workspaceId: z.string().uuid(),
  providerMessageId: z.string().trim().min(1).max(240),
  eventType: z.enum([
    'EMAIL_DELIVERED',
    'EMAIL_OPENED',
    'EMAIL_CLICKED',
    'EMAIL_BOUNCED',
    'EMAIL_COMPLAINT',
    'EMAIL_UNSUBSCRIBED'
  ]),
  occurredAt: z.coerce.date().optional(),
  payload: z.record(z.unknown()).optional()
});

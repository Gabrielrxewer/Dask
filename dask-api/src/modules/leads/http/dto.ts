import { z } from 'zod';

export const workspaceParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const leadParamsDto = z.object({
  workspaceId: z.string().uuid(),
  leadId: z.string().uuid()
});

export const leadListQueryDto = z.object({
  status: z.enum(['CAPTURED', 'QUALIFIED', 'DISTRIBUTED', 'FOLLOW_UP', 'NURTURING', 'CONVERTED', 'LOST']).optional(),
  ownerUserId: z.string().uuid().optional(),
  qualificationStatus: z.enum(['UNQUALIFIED', 'MQL', 'SQL', 'DISQUALIFIED']).optional(),
  distributionStatus: z.enum(['UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'REASSIGNED']).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const captureLeadDto = z.object({
  source: z.enum(['MANUAL', 'API', 'WEBHOOK', 'IMPORT', 'INTEGRATION']).default('MANUAL'),
  externalSource: z.enum(['GENERIC_WEBHOOK', 'ZAPIER', 'MAKE', 'N8N', 'HUBSPOT', 'RD_STATION']).optional(),
  externalId: z.string().trim().min(1).max(255).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  fullName: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(180).optional(),
  phone: z.string().trim().max(40).optional(),
  companyName: z.string().trim().max(180).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  website: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  interest: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(4000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  score: z.number().min(0).max(100).optional(),
  estimatedValue: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().trim().length(3).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const qualifyLeadDto = z.object({
  qualificationStatus: z.enum(['UNQUALIFIED', 'MQL', 'SQL', 'DISQUALIFIED']),
  score: z.number().min(0).max(100).optional(),
  temperature: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(4000).optional()
});

export const distributeLeadDto = z.object({
  toUserId: z.string().uuid(),
  strategy: z.enum(['MANUAL', 'ROUND_ROBIN', 'RULE_BASED', 'TERRITORY']).default('MANUAL'),
  reason: z.string().trim().max(500).optional()
});

export const followUpDto = z.object({
  note: z.string().trim().max(4000).optional(),
  nextFollowUpAt: z.coerce.date().optional()
});

export const nurtureTouchDto = z.object({
  channel: z.string().trim().min(1).max(80),
  templateKey: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(180).optional(),
  message: z.string().trim().max(4000).optional(),
  scheduledAt: z.coerce.date().optional(),
  sentAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const convertLeadDto = z.object({
  conversionType: z.enum(['CUSTOMER', 'OPPORTUNITY', 'DEAL', 'SUBSCRIPTION']),
  conversionRef: z.string().trim().min(1).max(200),
  amount: z.string().trim().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().trim().length(3).optional(),
  notes: z.string().trim().max(2000).optional()
});

export const markLostDto = z.object({
  reason: z.string().trim().max(2000).optional()
});

export const leadWebhookParamsDto = z.object({
  source: z.string().trim().min(1).max(40)
});

export const leadWebhookBodyDto = z.record(z.unknown());

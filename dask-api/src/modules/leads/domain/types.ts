import crypto from 'crypto';
import type {
  LeadActivityType,
  LeadDistributionStrategy,
  LeadDistributionStatus,
  LeadIntegrationSource,
  LeadNurtureStatus,
  LeadQualificationStatus,
  LeadSource,
  LeadStatus
} from '@prisma/client';

export interface CaptureLeadInput {
  workspaceId: string;
  source: LeadSource;
  customerId?: string | null;
  externalSource?: LeadIntegrationSource | null;
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  interest?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  score?: number;
  estimatedValue?: string | null;
  currency?: string;
  metadata?: Record<string, unknown> | null;
  createdByUserId?: string | null;
}

export interface LeadWebhookInput {
  source: LeadIntegrationSource;
  headers: Record<string, string | undefined>;
  payload: Record<string, unknown>;
  workspaceId?: string;
}

export const leadStatusOrder: LeadStatus[] = [
  'CAPTURED',
  'QUALIFIED',
  'DISTRIBUTED',
  'FOLLOW_UP',
  'NURTURING',
  'CONVERTED',
  'LOST'
];

export function computeLeadStatus(args: {
  convertedAt?: Date | null;
  lostAt?: Date | null;
  qualificationStatus?: LeadQualificationStatus;
  distributionStatus?: LeadDistributionStatus;
  nurturingStartedAt?: Date | null;
  lastContactAt?: Date | null;
}): LeadStatus {
  if (args.convertedAt) {
    return 'CONVERTED';
  }

  if (args.lostAt) {
    return 'LOST';
  }

  if (args.nurturingStartedAt) {
    return 'NURTURING';
  }

  if (args.lastContactAt) {
    return 'FOLLOW_UP';
  }

  if (args.distributionStatus && args.distributionStatus !== 'UNASSIGNED') {
    return 'DISTRIBUTED';
  }

  if (args.qualificationStatus && args.qualificationStatus !== 'UNQUALIFIED') {
    return 'QUALIFIED';
  }

  return 'CAPTURED';
}

export function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizeScore(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeTags(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => normalizeText(entry)?.toLowerCase() ?? null)
        .filter((entry): entry is string => Boolean(entry))
    )
  );
}

export function resolveLeadName(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): { firstName: string | null; lastName: string | null; fullName: string | null } {
  const firstName = normalizeText(input.firstName);
  const lastName = normalizeText(input.lastName);
  const providedFullName = normalizeText(input.fullName);

  if (providedFullName) {
    return {
      firstName,
      lastName,
      fullName: providedFullName
    };
  }

  const synthesized = [firstName, lastName].filter((part): part is string => Boolean(part)).join(' ').trim();

  return {
    firstName,
    lastName,
    fullName: synthesized.length > 0 ? synthesized : null
  };
}

export function toActivityTitle(type: LeadActivityType): string {
  switch (type) {
    case 'CAPTURED':
      return 'Lead capturado';
    case 'QUALIFIED':
      return 'Lead qualificado';
    case 'DISTRIBUTED':
      return 'Lead distribuido';
    case 'FOLLOW_UP':
      return 'Follow-up registrado';
    case 'NURTURE_TOUCH':
      return 'Acao de nutricao registrada';
    case 'CONVERTED':
      return 'Lead convertido';
    case 'STATUS_CHANGED':
      return 'Status alterado';
    case 'NOTE':
    default:
      return 'Nota registrada';
  }
}

export function buildWebhookIdempotencyKey(input: LeadWebhookInput): string {
  const payloadEventId = normalizeText((input.payload['eventId'] as string | undefined) ?? (input.payload['id'] as string | undefined));
  if (payloadEventId) {
    return `${input.source}:${payloadEventId}`;
  }

  const normalized = JSON.stringify(input.payload, Object.keys(input.payload).sort());
  const hash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `${input.source}:${hash}`;
}

export function resolveDistributionStatus(strategy: LeadDistributionStrategy): LeadDistributionStatus {
  if (strategy === 'ROUND_ROBIN' || strategy === 'RULE_BASED' || strategy === 'TERRITORY') {
    return 'ASSIGNED';
  }

  return 'ASSIGNED';
}

export function resolveNurtureStatus(channel: string, sentAt?: Date | null): LeadNurtureStatus {
  if (sentAt) {
    return 'SENT';
  }

  return normalizeText(channel) ? 'SCHEDULED' : 'DRAFT';
}

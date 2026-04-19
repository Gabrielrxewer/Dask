import type { Lead } from '@prisma/client';

export type SegmentRuleOperator =
  | 'eq'
  | 'neq'
  | 'gte'
  | 'lte'
  | 'contains'
  | 'in'
  | 'before_days'
  | 'after_days'
  | 'is_true'
  | 'is_false';

export type SegmentRule = {
  field: string;
  operator: SegmentRuleOperator;
  value?: string | number | boolean | Array<string | number | boolean>;
};

export type SegmentFilter = {
  logic?: 'AND' | 'OR';
  rules: SegmentRule[];
};

export function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toSegmentFilter(value: unknown): SegmentFilter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { logic: 'AND', rules: [] };
  }

  const parsed = value as { logic?: unknown; rules?: unknown };
  const logic = parsed.logic === 'OR' ? 'OR' : 'AND';
  const rules = Array.isArray(parsed.rules)
    ? parsed.rules
        .filter((entry): entry is SegmentRule => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry))
        .map((entry) => ({
          field: String((entry as Record<string, unknown>).field ?? '').trim(),
          operator: ((entry as Record<string, unknown>).operator ?? 'eq') as SegmentRuleOperator,
          value: (entry as Record<string, unknown>).value as SegmentRule['value']
        }))
        .filter((entry) => entry.field.length > 0)
    : [];

  return {
    logic,
    rules
  };
}

export function chooseWeightedVariant<T extends { weight: number; isControl?: boolean }>(variants: T[]): T {
  const safeVariants = variants.length > 0 ? variants : [];
  if (safeVariants.length === 0) {
    throw new Error('Cannot choose variant from empty list');
  }

  const weightedTotal = safeVariants.reduce((sum, variant) => sum + Math.max(1, variant.weight), 0);
  const roll = Math.random() * weightedTotal;
  let cursor = 0;

  for (const variant of safeVariants) {
    cursor += Math.max(1, variant.weight);
    if (roll <= cursor) {
      return variant;
    }
  }

  return safeVariants.find((variant) => variant.isControl) ?? safeVariants[0];
}

export function renderLeadVariables(content: string, lead: Lead | null): string {
  if (!lead) {
    return content;
  }

  const replacements: Record<string, string> = {
    '{{lead.fullName}}': lead.fullName ?? 'cliente',
    '{{lead.firstName}}': lead.firstName ?? lead.fullName?.split(' ')[0] ?? 'cliente',
    '{{lead.email}}': lead.email ?? '',
    '{{lead.companyName}}': lead.companyName ?? '',
    '{{lead.interest}}': lead.interest ?? '',
    '{{lead.score}}': String(lead.score)
  };

  return Object.entries(replacements).reduce((acc, [token, value]) => acc.split(token).join(value), content);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

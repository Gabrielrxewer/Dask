import { CustomFieldType, type Prisma } from '@prisma/client';

export type JsonRecord = Record<string, unknown>;

export type CustomFieldInputType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'user';

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function sanitizeHexColor(color: string | null | undefined, fallback: string): string {
  const candidate = (color ?? '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(candidate)) {
    return candidate.toLowerCase();
  }

  return fallback;
}

export function addHexAlpha(color: string, alphaHex: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `${color}${alphaHex}`;
  }

  return color;
}

export function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function getInitials(name: string): string {
  const chunks = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (chunks.length === 0) {
    return 'U';
  }

  return chunks.map((chunk) => chunk[0]!.toUpperCase()).join('');
}

export function getColorFromId(id: string): string {
  const palette = ['#2563eb', '#0d9488', '#9333ea', '#d97706', '#dc2626', '#4f46e5', '#059669'];
  let hash = 0;

  for (let index = 0; index < id.length; index += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(index);
    hash |= 0;
  }

  const paletteIndex = Math.abs(hash) % palette.length;
  return palette[paletteIndex]!;
}

export function parseChecklist(value: unknown): { items: Array<{ id: string; label: string; done: boolean }> } {
  if (!isRecord(value)) {
    return { items: [] };
  }

  const items = Array.isArray(value.items) ? value.items : [];

  return {
    items: items
      .filter((item) => isRecord(item))
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `check-${index + 1}`,
        label: typeof item.label === 'string' && item.label.length > 0 ? item.label : 'Checklist item',
        done: Boolean(item.done)
      }))
  };
}

export function parsePriority(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4) {
    return value;
  }

  return 2;
}

export function mapCustomFieldTypeToInput(type: CustomFieldType): CustomFieldInputType {
  switch (type) {
    case CustomFieldType.TEXT:
      return 'text';
    case CustomFieldType.LONG_TEXT:
      return 'long_text';
    case CustomFieldType.NUMBER:
      return 'number';
    case CustomFieldType.DATE:
      return 'date';
    case CustomFieldType.DATETIME:
      return 'datetime';
    case CustomFieldType.BOOLEAN:
      return 'boolean';
    case CustomFieldType.SELECT:
      return 'select';
    case CustomFieldType.MULTI_SELECT:
      return 'multi_select';
    case CustomFieldType.USER:
      return 'user';
    default:
      return 'text';
  }
}

export function mapCustomFieldTypeToFrontend(type: CustomFieldType):
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'boolean' {
  switch (type) {
    case CustomFieldType.NUMBER:
      return 'number';
    case CustomFieldType.DATE:
    case CustomFieldType.DATETIME:
      return 'date';
    case CustomFieldType.SELECT:
      return 'select';
    case CustomFieldType.MULTI_SELECT:
      return 'multi-select';
    case CustomFieldType.BOOLEAN:
      return 'boolean';
    default:
      return 'text';
  }
}

export function mapInputTypeToPrisma(type: CustomFieldInputType): CustomFieldType {
  switch (type) {
    case 'text':
      return CustomFieldType.TEXT;
    case 'long_text':
      return CustomFieldType.LONG_TEXT;
    case 'number':
      return CustomFieldType.NUMBER;
    case 'date':
      return CustomFieldType.DATE;
    case 'datetime':
      return CustomFieldType.DATETIME;
    case 'boolean':
      return CustomFieldType.BOOLEAN;
    case 'select':
      return CustomFieldType.SELECT;
    case 'multi_select':
      return CustomFieldType.MULTI_SELECT;
    case 'user':
      return CustomFieldType.USER;
    default:
      return CustomFieldType.TEXT;
  }
}

export function summarizeAutomationPart(part: unknown): string {
  if (typeof part === 'string') {
    return part;
  }

  if (Array.isArray(part)) {
    return part.map((entry) => summarizeAutomationPart(entry)).join(', ');
  }

  if (isRecord(part)) {
    return Object.entries(part)
      .map(([key, value]) => `${key}: ${summarizeAutomationPart(value)}`)
      .join(' | ');
  }

  if (typeof part === 'number' || typeof part === 'boolean') {
    return String(part);
  }

  return 'n/a';
}

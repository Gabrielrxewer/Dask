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
  | 'user'
  | 'checklist'
  | 'priority'
  | 'status'
  | 'tag'
  | 'schedule'
  | 'work_item_type';

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
    case CustomFieldType.CHECKLIST:
      return 'checklist';
    case CustomFieldType.PRIORITY:
      return 'priority';
    case CustomFieldType.STATUS:
      return 'status';
    case CustomFieldType.TAG:
      return 'tag';
    case CustomFieldType.SCHEDULE:
      return 'schedule';
    case CustomFieldType.WORK_ITEM_TYPE:
      return 'work_item_type';
    default:
      return 'text';
  }
}

export function mapCustomFieldTypeToFrontend(type: CustomFieldType):
  | 'text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'boolean'
  | 'user'
  | 'checklist'
  | 'priority'
  | 'status'
  | 'tag'
  | 'schedule'
  | 'work_item_type' {
  switch (type) {
    case CustomFieldType.LONG_TEXT:
      return 'long_text';
    case CustomFieldType.NUMBER:
      return 'number';
    case CustomFieldType.DATE:
      return 'date';
    case CustomFieldType.DATETIME:
      return 'datetime';
    case CustomFieldType.SELECT:
      return 'select';
    case CustomFieldType.MULTI_SELECT:
      return 'multi_select';
    case CustomFieldType.BOOLEAN:
      return 'boolean';
    case CustomFieldType.USER:
      return 'user';
    case CustomFieldType.CHECKLIST:
      return 'checklist';
    case CustomFieldType.PRIORITY:
      return 'priority';
    case CustomFieldType.STATUS:
      return 'status';
    case CustomFieldType.TAG:
      return 'tag';
    case CustomFieldType.SCHEDULE:
      return 'schedule';
    case CustomFieldType.WORK_ITEM_TYPE:
      return 'work_item_type';
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
    case 'checklist':
      return CustomFieldType.CHECKLIST;
    case 'priority':
      return CustomFieldType.PRIORITY;
    case 'status':
      return CustomFieldType.STATUS;
    case 'tag':
      return CustomFieldType.TAG;
    case 'schedule':
      return CustomFieldType.SCHEDULE;
    case 'work_item_type':
      return CustomFieldType.WORK_ITEM_TYPE;
    default:
      return CustomFieldType.TEXT;
  }
}

export function isSelectableFieldType(type: CustomFieldInputType): boolean {
  return (
    type === 'select' ||
    type === 'multi_select' ||
    type === 'user' ||
    type === 'priority' ||
    type === 'status' ||
    type === 'tag' ||
    type === 'work_item_type'
  );
}

export function isSystemOnlyFieldType(type: CustomFieldInputType): boolean {
  return type === 'priority' || type === 'status' || type === 'tag' || type === 'schedule' || type === 'work_item_type';
}

export function buildFieldSourceTag(input: { isSystem: boolean; settings: unknown }): 'system' | 'template' | 'custom' {
  if (input.isSystem) {
    return 'system';
  }

  if (isRecord(input.settings) && typeof input.settings.source === 'string' && input.settings.source.startsWith('seed.')) {
    return 'template';
  }

  return 'custom';
}

export function readFieldStorageConfig(settings: unknown): JsonRecord | null {
  if (!isRecord(settings) || !isRecord(settings.storage)) {
    return null;
  }

  return settings.storage;
}

export function normalizeFieldDisplayContext(context: unknown): 'card' | 'detail' {
  return context === 'card' ? 'card' : 'detail';
}

export function normalizeFieldSection(section: unknown): string | null {
  if (typeof section !== 'string') {
    return null;
  }

  const trimmed = section.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function inferFieldCapabilities(type: CustomFieldInputType, settings: unknown): JsonRecord {
  const capabilities: JsonRecord = {};

  if (type === 'select' || type === 'user' || type === 'priority' || type === 'status' || type === 'work_item_type') {
    capabilities.selectable = true;
  }

  if (type === 'multi_select' || type === 'tag') {
    capabilities.multiSelectable = true;
  }

  if ((type === 'text' || type === 'long_text') && isRecord(settings) && settings.allowAiGeneration === true) {
    capabilities.aiEnhance = true;
  }

  return capabilities;
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

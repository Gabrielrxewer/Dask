import {
  DEFAULT_FIELD_SEMANTIC_KEYS,
  LEGACY_FIELD_ALIASES,
  type FieldAliasMap,
  type FieldSemanticKeyMap
} from "@/shared/field-core/field-core-aliases";
import type { FieldDefinition } from "@/shared/field-core/field-core.types";
import { getFieldContexts, normalizeFieldDefinition, normalizeFieldKey } from "@/shared/field-core/field-core-utils";

export interface FieldRegistryOptions {
  aliases?: FieldAliasMap;
  semanticKeys?: FieldSemanticKeyMap;
  normalizeKeys?: boolean;
}

export class FieldRegistry<TField extends FieldDefinition = FieldDefinition> {
  private fieldsByKey = new Map<string, TField>();
  private fieldsById = new Map<string, TField>();
  private aliases: FieldAliasMap;
  private semanticKeys: FieldSemanticKeyMap;
  private normalizeKeys: boolean;

  constructor(options: FieldRegistryOptions = {}) {
    this.aliases = { ...LEGACY_FIELD_ALIASES, ...(options.aliases ?? {}) };
    this.semanticKeys = { ...DEFAULT_FIELD_SEMANTIC_KEYS, ...(options.semanticKeys ?? {}) };
    this.normalizeKeys = options.normalizeKeys ?? true;
  }

  registerField(field: TField): TField {
    const normalized = this.normalizeKeys ? normalizeFieldDefinition(field) : field;
    this.assertNoDuplicateFields([normalized]);
    this.fieldsByKey.set(normalized.key, normalized);
    this.fieldsById.set(normalized.id, normalized);
    return normalized;
  }

  registerFields(fields: TField[]): TField[] {
    this.assertNoDuplicateFields(fields);
    return fields.map(field => this.registerField(field));
  }

  getFieldByKey(key: string): TField | undefined {
    const resolvedKey = this.resolveAlias(key) ?? key;
    return this.fieldsByKey.get(resolvedKey) ?? this.fieldsByKey.get(normalizeFieldKey(resolvedKey));
  }

  getFieldById(id: string): TField | undefined {
    return this.fieldsById.get(id);
  }

  getFieldsByContext(context: string): TField[] {
    return [...this.fieldsByKey.values()].filter(field => getFieldContexts(field).includes(context));
  }

  getFieldsByEntity(entity: string): TField[] {
    return [...this.fieldsByKey.values()].filter(field => field.entity === entity);
  }

  resolveAlias(alias: string): string | undefined {
    return this.aliases[alias] ?? (this.fieldsByKey.has(alias) ? alias : undefined);
  }

  resolveSemanticKey(key: string): string | undefined {
    return this.semanticKeys[key] ?? this.resolveAlias(key);
  }

  assertNoDuplicateFields(fields?: TField[]): void {
    const fieldsToCheck = fields ?? [...this.fieldsByKey.values()];
    const seenKeys = fields ? new Set(this.fieldsByKey.keys()) : new Set<string>();
    const seenIds = fields ? new Set(this.fieldsById.keys()) : new Set<string>();

    for (const field of fieldsToCheck) {
      if (seenKeys.has(field.key)) {
        throw new Error(`Duplicate field key registered: ${field.key}`);
      }

      if (seenIds.has(field.id)) {
        throw new Error(`Duplicate field id registered: ${field.id}`);
      }

      seenKeys.add(field.key);
      seenIds.add(field.id);
    }
  }
}

export function createFieldRegistry<TField extends FieldDefinition = FieldDefinition>(
  fields: TField[] = [],
  options?: FieldRegistryOptions
): FieldRegistry<TField> {
  const registry = new FieldRegistry<TField>(options);
  registry.registerFields(fields);
  return registry;
}

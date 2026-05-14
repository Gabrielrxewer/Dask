export type {
  FieldApiMapping,
  FieldContextValue,
  FieldDefinition,
  FieldOption,
  FieldType
} from "@/shared/field-core/field-core.types";
export {
  DEFAULT_FIELD_SEMANTIC_KEYS,
  LEGACY_FIELD_ALIASES,
  type FieldAliasMap,
  type FieldSemanticKeyMap,
  type LegacyFieldAlias
} from "@/shared/field-core/field-core-aliases";
export {
  getFieldContexts,
  isFieldType,
  isReadonlyField,
  normalizeFieldDefinition,
  normalizeFieldKey
} from "@/shared/field-core/field-core-utils";
export { createFieldRegistry, FieldRegistry, type FieldRegistryOptions } from "@/shared/field-core/field-registry";


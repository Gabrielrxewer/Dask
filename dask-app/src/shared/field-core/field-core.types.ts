export type FieldType =
  | "text"
  | "textarea"
  | "long_text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "boolean"
  | "checkbox"
  | "select"
  | "multi_select"
  | "user"
  | "status"
  | "priority"
  | "relation"
  | "reference"
  | "attachment"
  | "file"
  | "computed"
  | "custom"
  | "catalog_select"
  | "billing_summary"
  | "checklist"
  | "client";

export type FieldContextValue = string;

export interface FieldOption {
  id: string;
  label: string;
  value: string;
  color?: string | null;
  order?: number;
}

export interface FieldApiMapping {
  requestKey?: string;
  responseKey?: string;
  payloadPath?: string;
  storage?: Record<string, unknown>;
}

export interface FieldDefinition {
  id: string;
  key: string;
  type: FieldType;
  label: string;
  description?: string | null;
  placeholder?: string | null;
  required?: boolean;
  readonly?: boolean;
  defaultValue?: unknown;
  options?: FieldOption[];
  validations?: Record<string, unknown>;
  visibilityRules?: Record<string, unknown>;
  permissionRules?: Record<string, unknown>;
  source?: string | Record<string, unknown>;
  context?: FieldContextValue | FieldContextValue[];
  entity?: string;
  apiMapping?: FieldApiMapping;
  formatter?: string;
  parser?: string;
  sortConfig?: Record<string, unknown>;
  filterConfig?: Record<string, unknown>;
  tableConfig?: Record<string, unknown>;
  formConfig?: Record<string, unknown>;
  detailConfig?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}


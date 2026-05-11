export type WorkItemPublicFieldType =
  | "text"
  | "textarea"
  | "long_text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "select"
  | "multi_select"
  | "checkbox"
  | "boolean"
  | "checklist"
  | "user"
  | "client"
  | "file"
  | "reference"
  | "billing_summary"
  | "computed";

export interface WorkItemFieldOption {
  id: string;
  label: string;
  value: string;
  color?: string | null;
  order?: number;
}

export interface BillingSummaryFieldMetadata {
  currency: string;
  sourceFields: string[];
  aggregationMode: "sum" | "average" | "count" | "manual";
  displayFormat: "currency" | "number" | "compact";
  permissions?: string[];
  readOnly?: boolean;
}

export interface WorkItemPublicField {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  type: WorkItemPublicFieldType;
  required: boolean;
  defaultValue?: unknown;
  visibility?: "visible" | "hidden" | "conditional";
  validation?: Record<string, unknown>;
  options?: WorkItemFieldOption[];
  metadata?: Record<string, unknown> & {
    billingSummary?: BillingSummaryFieldMetadata;
  };
  display?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  system?: boolean;
  userConfigurable?: boolean;
}


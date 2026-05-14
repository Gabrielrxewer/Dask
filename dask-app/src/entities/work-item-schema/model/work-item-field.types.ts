import type { FieldDefinition, FieldOption, FieldType } from "@/shared/field-core";

export type WorkItemPublicFieldType = FieldType;

export interface WorkItemFieldOption extends FieldOption {}

export interface BillingSummaryFieldMetadata {
  currency: string;
  sourceFields: string[];
  aggregationMode: "sum" | "average" | "count" | "manual";
  displayFormat: "currency" | "number" | "compact";
  permissions?: string[];
  readOnly?: boolean;
}

export interface WorkItemPublicField extends FieldDefinition {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  type: WorkItemPublicFieldType;
  required: boolean;
  readonly?: boolean;
  defaultValue?: unknown;
  visibility?: "visible" | "hidden" | "conditional";
  validation?: Record<string, unknown>;
  validations?: Record<string, unknown>;
  options?: WorkItemFieldOption[];
  metadata?: Record<string, unknown> & {
    billingSummary?: BillingSummaryFieldMetadata;
  };
  display?: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  system?: boolean;
  userConfigurable?: boolean;
}


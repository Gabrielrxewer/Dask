import { z } from "zod";

export const workItemPublicFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "long_text",
  "number",
  "currency",
  "date",
  "datetime",
  "select",
  "multi_select",
  "status",
  "priority",
  "checkbox",
  "boolean",
  "checklist",
  "user",
  "client",
  "file",
  "attachment",
  "reference",
  "relation",
  "custom",
  "catalog_select",
  "billing_summary",
  "computed"
]);

export const billingSummaryFieldMetadataSchema = z.object({
  currency: z.string().min(3).max(8).default("BRL"),
  sourceFields: z.array(z.string().min(1)).default([]),
  aggregationMode: z.enum(["sum", "average", "count", "manual"]).default("sum"),
  displayFormat: z.enum(["currency", "number", "compact"]).default("currency"),
  permissions: z.array(z.string()).optional(),
  readOnly: z.boolean().optional()
});

export const workItemFieldOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  color: z.string().nullable().optional(),
  order: z.number().int().nonnegative().optional()
});

export const workItemPublicFieldSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  type: workItemPublicFieldTypeSchema,
  required: z.boolean().default(false),
  readonly: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  visibility: z.enum(["visible", "hidden", "conditional"]).optional(),
  validation: z.record(z.string(), z.unknown()).optional(),
  validations: z.record(z.string(), z.unknown()).optional(),
  options: z.array(workItemFieldOptionSchema).optional(),
  metadata: z
    .record(z.string(), z.unknown())
    .and(z.object({ billingSummary: billingSummaryFieldMetadataSchema.optional() }))
    .optional(),
  display: z.record(z.string(), z.unknown()).optional(),
  conditions: z.record(z.string(), z.unknown()).optional(),
  placeholder: z.string().nullable().optional(),
  visibilityRules: z.record(z.string(), z.unknown()).optional(),
  permissionRules: z.record(z.string(), z.unknown()).optional(),
  source: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  context: z.union([z.string(), z.array(z.string())]).optional(),
  entity: z.string().optional(),
  apiMapping: z.record(z.string(), z.unknown()).optional(),
  formatter: z.string().optional(),
  parser: z.string().optional(),
  sortConfig: z.record(z.string(), z.unknown()).optional(),
  filterConfig: z.record(z.string(), z.unknown()).optional(),
  tableConfig: z.record(z.string(), z.unknown()).optional(),
  formConfig: z.record(z.string(), z.unknown()).optional(),
  detailConfig: z.record(z.string(), z.unknown()).optional(),
  system: z.boolean().optional(),
  userConfigurable: z.boolean().optional()
});


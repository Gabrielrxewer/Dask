import type { WorkItemPublicFieldType } from "@/entities/work-item-schema/model/work-item-field.types";

export interface WorkItemFieldCapability {
  selectable: boolean;
  arrayValue: boolean;
  computed: boolean;
  supportsOptions: boolean;
}

export const fieldCapabilities: Record<WorkItemPublicFieldType, WorkItemFieldCapability> = {
  text: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  textarea: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  long_text: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  number: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  currency: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  date: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  datetime: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  select: { selectable: true, arrayValue: false, computed: false, supportsOptions: true },
  multi_select: { selectable: true, arrayValue: true, computed: false, supportsOptions: true },
  checkbox: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  boolean: { selectable: false, arrayValue: false, computed: false, supportsOptions: false },
  checklist: { selectable: false, arrayValue: true, computed: false, supportsOptions: false },
  user: { selectable: true, arrayValue: false, computed: false, supportsOptions: false },
  client: { selectable: true, arrayValue: false, computed: false, supportsOptions: false },
  file: { selectable: false, arrayValue: true, computed: false, supportsOptions: false },
  reference: { selectable: true, arrayValue: false, computed: false, supportsOptions: false },
  billing_summary: { selectable: false, arrayValue: false, computed: true, supportsOptions: false },
  computed: { selectable: false, arrayValue: false, computed: true, supportsOptions: false }
};


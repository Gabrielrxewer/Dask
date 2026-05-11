import type { Ref } from "react";
import type { WorkItemPublicField } from "@/entities/work-item-schema";
import { TextFieldRenderer } from "@/entities/work-item-form/field-renderers/TextFieldRenderer";
import { TextareaFieldRenderer } from "@/entities/work-item-form/field-renderers/TextareaFieldRenderer";
import { NumberFieldRenderer } from "@/entities/work-item-form/field-renderers/NumberFieldRenderer";
import { CurrencyFieldRenderer } from "@/entities/work-item-form/field-renderers/CurrencyFieldRenderer";
import { DateFieldRenderer } from "@/entities/work-item-form/field-renderers/DateFieldRenderer";
import { DateTimeFieldRenderer } from "@/entities/work-item-form/field-renderers/DateTimeFieldRenderer";
import { SelectFieldRenderer } from "@/entities/work-item-form/field-renderers/SelectFieldRenderer";
import { MultiSelectFieldRenderer } from "@/entities/work-item-form/field-renderers/MultiSelectFieldRenderer";
import { CheckboxFieldRenderer } from "@/entities/work-item-form/field-renderers/CheckboxFieldRenderer";
import { ChecklistFieldRenderer } from "@/entities/work-item-form/field-renderers/ChecklistFieldRenderer";
import { ClientFieldRenderer } from "@/entities/work-item-form/field-renderers/ClientFieldRenderer";
import { UserFieldRenderer } from "@/entities/work-item-form/field-renderers/UserFieldRenderer";
import { BillingSummaryFieldRenderer } from "@/entities/work-item-form/field-renderers/BillingSummaryFieldRenderer";

export interface WorkItemFieldRendererProps {
  field: WorkItemPublicField;
  value: unknown;
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  inputRef?: Ref<unknown>;
  error?: string;
  readonly?: boolean;
}

export function renderWorkItemField(props: WorkItemFieldRendererProps) {
  switch (props.field.type) {
    case "textarea":
    case "long_text":
      return <TextareaFieldRenderer {...props} />;
    case "number":
      return <NumberFieldRenderer {...props} />;
    case "currency":
      return <CurrencyFieldRenderer {...props} />;
    case "date":
      return <DateFieldRenderer {...props} />;
    case "datetime":
      return <DateTimeFieldRenderer {...props} />;
    case "select":
      return <SelectFieldRenderer {...props} />;
    case "multi_select":
      return <MultiSelectFieldRenderer {...props} />;
    case "checkbox":
    case "boolean":
      return <CheckboxFieldRenderer {...props} />;
    case "checklist":
      return <ChecklistFieldRenderer {...props} />;
    case "client":
      return <ClientFieldRenderer {...props} />;
    case "user":
      return <UserFieldRenderer {...props} />;
    case "billing_summary":
      return <BillingSummaryFieldRenderer {...props} />;
    default:
      return <TextFieldRenderer {...props} />;
  }
}


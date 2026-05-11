import { Controller, useFormContext } from "react-hook-form";
import type { WorkItemPublicField } from "@/entities/work-item-schema";
import type { WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";
import { renderWorkItemField } from "@/entities/work-item-form/field-renderers/field-renderer-registry";

export interface WorkItemFieldControllerProps {
  field: WorkItemPublicField;
  readonly?: boolean;
  onFieldChange?: (field: WorkItemPublicField, value: unknown) => void;
}

export function WorkItemFieldController({ field, readonly = false, onFieldChange }: WorkItemFieldControllerProps) {
  const form = useFormContext<WorkItemFormValues>();
  const error = form.formState.errors[field.key]?.message;

  if (field.visibility === "hidden") {
    return null;
  }

  return (
    <Controller
      control={form.control}
      name={field.key}
      render={({ field: controllerField }) => renderWorkItemField({
        field,
        value: controllerField.value,
        onChange: (value) => {
          controllerField.onChange(value);
          onFieldChange?.(field, value);
        },
        onBlur: controllerField.onBlur,
        inputRef: controllerField.ref,
        error: typeof error === "string" ? error : undefined,
        readonly: readonly || field.type === "computed" || field.type === "billing_summary"
      })}
    />
  );
}

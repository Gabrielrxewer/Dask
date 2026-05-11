import { AppCheckbox } from "@/shared/ui";
import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function CheckboxFieldRenderer({ field, value, onChange, error, readonly }: WorkItemFieldRendererProps) {
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <AppCheckbox checked={Boolean(value)} onCheckedChange={next => onChange(next === true)} disabled={readonly} />
    </FieldFrame>
  );
}


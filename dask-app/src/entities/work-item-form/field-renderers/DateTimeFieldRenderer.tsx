import { AppDateTimePicker } from "@/shared/ui";
import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function DateTimeFieldRenderer({ field, value, onChange, error, readonly }: WorkItemFieldRendererProps) {
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <AppDateTimePicker value={typeof value === "string" ? value : null} onChange={onChange} disabled={readonly} />
    </FieldFrame>
  );
}


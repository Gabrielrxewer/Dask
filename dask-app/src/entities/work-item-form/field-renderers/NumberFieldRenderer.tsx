import { TextInput } from "@/shared/ui";
import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function NumberFieldRenderer({ field, value, onChange, onBlur, error, readonly }: WorkItemFieldRendererProps) {
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <TextInput type="number" value={typeof value === "number" ? String(value) : ""} onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))} onBlur={onBlur} disabled={readonly} />
    </FieldFrame>
  );
}


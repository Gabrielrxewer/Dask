import { Textarea } from "@/shared/ui";
import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function TextareaFieldRenderer({ field, value, onChange, onBlur, error, readonly }: WorkItemFieldRendererProps) {
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <Textarea value={typeof value === "string" ? value : ""} onChange={event => onChange(event.target.value)} onBlur={onBlur} disabled={readonly} />
    </FieldFrame>
  );
}


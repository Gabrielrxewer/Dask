import { AppSelect } from "@/shared/ui";
import { FieldFrame } from "./FieldFrame";
import type { WorkItemFieldRendererProps } from "./field-renderer-registry";

export function SelectFieldRenderer({ field, value, onChange, error, readonly }: WorkItemFieldRendererProps) {
  return (
    <FieldFrame label={field.label} description={field.description} error={error}>
      <AppSelect
        value={typeof value === "string" ? value : undefined}
        onValueChange={onChange}
        disabled={readonly}
        items={(field.options ?? []).map(option => ({ value: option.value, label: option.label }))}
      />
    </FieldFrame>
  );
}

